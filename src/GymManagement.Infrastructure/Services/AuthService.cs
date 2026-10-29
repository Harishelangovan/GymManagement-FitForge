using System.Buffers.Text;
using System.Text;
using GymManagement.Application.Common.Exceptions;
using GymManagement.Application.DTOs.Audit;
using GymManagement.Application.DTOs.Auth;
using GymManagement.Application.Interfaces;
using GymManagement.Domain.Common;
using GymManagement.Domain.Entities;
using GymManagement.Infrastructure.Data;
using GymManagement.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace GymManagement.Infrastructure.Services;

public sealed class AuthService(
    UserManager<ApplicationUser> userManager,
    IPasswordHasher<ApplicationUser> passwordHasher,
    AppDbContext db,
    JwtTokenGenerator jwtTokenGenerator,
    RefreshTokenService refreshTokens,
    ICurrentUser currentUser,
    IEmailSender emailSender,
    IAuditService audit,
    IOptions<FrontendOptions> frontendOptions,
    TimeProvider timeProvider,
    ILogger<AuthService> logger) : IAuthService
{
    private const string SessionExpiredMessage = "Your session has expired. Please sign in again.";
    private const string InvalidResetLinkMessage = "This password reset link is invalid or has expired.";

    // A real password hash used when the email is unknown, so a failed login takes the same time
    // whether or not the account exists (prevents discovering valid emails by timing).
    private static readonly Lazy<string> DummyPasswordHash = new(() =>
        new PasswordHasher<ApplicationUser>().HashPassword(new ApplicationUser(), Guid.NewGuid().ToString()));

    public async Task<AuthResult> RegisterAsync(RegisterRequest request, CancellationToken ct = default)
    {
        var email = request.Email.Trim();

        if (await userManager.FindByEmailAsync(email) is not null)
        {
            throw new ConflictException("An account with this email already exists.");
        }

        // User, role and profile are created together or not at all.
        await using var transaction = await db.Database.BeginTransactionAsync(ct);

        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            FirstName = request.FirstName.Trim(),
            LastName = request.LastName.Trim(),
            PhoneNumber = string.IsNullOrWhiteSpace(request.PhoneNumber) ? null : request.PhoneNumber.Trim()
        };

        var created = await userManager.CreateAsync(user, request.Password);
        if (!created.Succeeded)
        {
            if (created.Errors.Any(e => e.Code is "DuplicateEmail" or "DuplicateUserName"))
            {
                throw new ConflictException("An account with this email already exists.");
            }

            throw ToValidationException(created, "password");
        }

        // Public registration can only ever create a Member.
        EnsureSucceeded(await userManager.AddToRoleAsync(user, Roles.Member));

        db.MemberProfiles.Add(new MemberProfile
        {
            UserId = user.Id,
            JoinedOn = DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime)
        });
        await db.SaveChangesAsync(ct);

        var result = await IssueTokensAsync(user, Roles.Member, Guid.NewGuid(), replacing: null, ct);
        await transaction.CommitAsync(ct);

        logger.LogInformation("New member registered: {UserId}", user.Id);
        return result;
    }

    public async Task<AuthResult> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        var user = await userManager.FindByEmailAsync(request.Email.Trim());

        if (user is null)
        {
            passwordHasher.VerifyHashedPassword(new ApplicationUser(), DummyPasswordHash.Value, request.Password);
            // The attempted email is not stored: people sometimes type a password into the email field.
            await RecordSecurityEventAsync(SecurityEvents.LoginFailed, "unknown", new { Reason = "unknown_email" }, ct);
            throw new AuthenticationFailedException();
        }

        // Same generic message for every failure: wrong password, locked out, or deactivated.
        if (await userManager.IsLockedOutAsync(user))
        {
            logger.LogWarning("Login attempt for locked-out user {UserId}", user.Id);
            await RecordSecurityEventAsync(SecurityEvents.LoginFailed, user.Id, new { Reason = "locked_out" }, ct);
            throw new AuthenticationFailedException();
        }

        if (!await userManager.CheckPasswordAsync(user, request.Password))
        {
            await userManager.AccessFailedAsync(user); // 5 failures → 15-minute lockout

            if (await userManager.IsLockedOutAsync(user))
            {
                logger.LogWarning("User {UserId} locked out after repeated failed logins", user.Id);
                await RecordSecurityEventAsync(SecurityEvents.AccountLockedOut, user.Id, new { user.LockoutEnd }, ct);
            }
            else
            {
                await RecordSecurityEventAsync(SecurityEvents.LoginFailed, user.Id, new { Reason = "invalid_password" }, ct);
            }

            throw new AuthenticationFailedException();
        }

        if (!user.IsActive)
        {
            logger.LogWarning("Login attempt for deactivated user {UserId}", user.Id);
            await RecordSecurityEventAsync(SecurityEvents.LoginFailed, user.Id, new { Reason = "deactivated" }, ct);
            throw new AuthenticationFailedException();
        }

        await userManager.ResetAccessFailedCountAsync(user);

        var role = await GetRoleAsync(user);
        return await IssueTokensAsync(user, role, Guid.NewGuid(), replacing: null, ct);
    }

    public async Task<AuthResult> RefreshAsync(string refreshToken, CancellationToken ct = default)
    {
        var stored = await refreshTokens.FindAsync(refreshToken, ct)
            ?? throw new AuthenticationFailedException(SessionExpiredMessage);

        if (stored.ReplacedByTokenHash is not null)
        {
            // This token was already exchanged for a newer one, yet it is being used again:
            // someone has a copy of it. Revoke the whole session so neither the attacker nor the
            // victim can continue with it.
            logger.LogWarning("Refresh token reuse detected for user {UserId}; revoking session {FamilyId}",
                stored.UserId, stored.FamilyId);
            await refreshTokens.RevokeFamilyAsync(stored.FamilyId, ct);
            await RecordSecurityEventAsync(SecurityEvents.RefreshTokenReuse, stored.UserId, new { Session = stored.FamilyId }, ct);
            throw new AuthenticationFailedException(SessionExpiredMessage);
        }

        // Revoked by logout or a password change, or simply expired: a normal end of session.
        if (!stored.IsActive(timeProvider.GetUtcNow().UtcDateTime))
        {
            throw new AuthenticationFailedException(SessionExpiredMessage);
        }

        var user = stored.User;
        if (!user.IsActive || await userManager.IsLockedOutAsync(user))
        {
            await refreshTokens.RevokeFamilyAsync(stored.FamilyId, ct);
            throw new AuthenticationFailedException(SessionExpiredMessage);
        }

        var role = await GetRoleAsync(user);
        return await IssueTokensAsync(user, role, stored.FamilyId, replacing: stored, ct);
    }

    public async Task LogoutAsync(string? refreshToken, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(refreshToken))
        {
            return;
        }

        var stored = await refreshTokens.FindAsync(refreshToken, ct);
        if (stored is not null)
        {
            await refreshTokens.RevokeFamilyAsync(stored.FamilyId, ct);
        }
    }

    public async Task ChangePasswordAsync(ChangePasswordRequest request, CancellationToken ct = default)
    {
        var user = await userManager.FindByIdAsync(currentUser.UserId.ToString())
            ?? throw new AuthenticationFailedException(SessionExpiredMessage);

        var result = await userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded)
        {
            if (result.Errors.Any(e => e.Code == "PasswordMismatch"))
            {
                throw new RequestValidationException("currentPassword", "Current password is incorrect.");
            }

            throw ToValidationException(result, "newPassword");
        }

        // Sign out every device. Access tokens already issued expire on their own within 15 minutes.
        await refreshTokens.RevokeAllForUserAsync(user.Id, ct);
        await RecordSecurityEventAsync(SecurityEvents.PasswordChanged, user.Id, null, ct);
        logger.LogInformation("Password changed for user {UserId}", user.Id);
    }

    public async Task ForgotPasswordAsync(ForgotPasswordRequest request, CancellationToken ct = default)
    {
        var user = await userManager.FindByEmailAsync(request.Email.Trim());
        if (user is null || !user.IsActive)
        {
            // Respond exactly as if the email was sent, so the endpoint can't be used to find accounts.
            logger.LogInformation("Password reset requested for an unknown or inactive account");
            return;
        }

        // Identity's reset token is single-use (tied to the security stamp) and expires after 30 minutes.
        var token = await userManager.GeneratePasswordResetTokenAsync(user);
        var encodedToken = Base64Url.EncodeToString(Encoding.UTF8.GetBytes(token));
        var link = $"{frontendOptions.Value.BaseUrl.TrimEnd('/')}/reset-password" +
                   $"?email={Uri.EscapeDataString(user.Email!)}&token={encodedToken}";

        await RecordSecurityEventAsync(SecurityEvents.PasswordResetRequested, user.Id, null, ct);

        await emailSender.SendAsync(
            user.Email!,
            "Reset your FitForge password",
            $"Hi {user.FirstName},\n\nUse this link to reset your password (valid for 30 minutes):\n{link}\n\n" +
            "If you didn't ask for this, you can ignore this email.",
            ct);
    }

    public async Task ResetPasswordAsync(ResetPasswordRequest request, CancellationToken ct = default)
    {
        var user = await userManager.FindByEmailAsync(request.Email.Trim());
        if (user is null || !user.IsActive)
        {
            throw new BusinessRuleException(InvalidResetLinkMessage);
        }

        string token;
        try
        {
            token = Encoding.UTF8.GetString(Base64Url.DecodeFromChars(request.Token));
        }
        catch (FormatException)
        {
            throw new BusinessRuleException(InvalidResetLinkMessage);
        }

        var result = await userManager.ResetPasswordAsync(user, token, request.NewPassword);
        if (!result.Succeeded)
        {
            if (result.Errors.Any(e => e.Code == "InvalidToken"))
            {
                throw new BusinessRuleException(InvalidResetLinkMessage);
            }

            throw ToValidationException(result, "newPassword");
        }

        // A successful reset proves the user owns the email: clear any lockout and end all sessions.
        await userManager.ResetAccessFailedCountAsync(user);
        await userManager.SetLockoutEndDateAsync(user, null);
        await refreshTokens.RevokeAllForUserAsync(user.Id, ct);
        await RecordSecurityEventAsync(SecurityEvents.PasswordResetCompleted, user.Id, null, ct);
        logger.LogInformation("Password reset completed for user {UserId}", user.Id);
    }

    public async Task<CurrentUserDto> GetCurrentUserAsync(CancellationToken ct = default)
    {
        var user = await userManager.FindByIdAsync(currentUser.UserId.ToString());
        if (user is null || !user.IsActive)
        {
            throw new AuthenticationFailedException(SessionExpiredMessage);
        }

        return await BuildUserDtoAsync(user, await GetRoleAsync(user), ct);
    }

    // ---------- helpers ----------

    /// <summary>Writes a security event to the audit log immediately (the request may end in an exception).</summary>
    private async Task RecordSecurityEventAsync(string action, object userId, object? details, CancellationToken ct)
    {
        audit.Record(action, "User", userId, details);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Creates an access token and a new refresh token in the given session family.
    /// When rotating, the old token is revoked and linked to its replacement in the same SaveChanges.
    /// </summary>
    private async Task<AuthResult> IssueTokensAsync(
        ApplicationUser user, string role, Guid familyId, RefreshToken? replacing, CancellationToken ct)
    {
        var (accessToken, accessExpires) = jwtTokenGenerator.CreateAccessToken(user, role);
        var (rawRefreshToken, newRefreshToken) = refreshTokens.Create(user.Id, familyId, currentUser.IpAddress);

        if (replacing is not null)
        {
            replacing.RevokedUtc = newRefreshToken.CreatedUtc;
            replacing.ReplacedByTokenHash = newRefreshToken.TokenHash;
        }

        await db.SaveChangesAsync(ct);

        var userDto = await BuildUserDtoAsync(user, role, ct);
        return new AuthResult(
            new AuthResponse(accessToken, accessExpires, userDto),
            rawRefreshToken,
            newRefreshToken.ExpiresUtc);
    }

    private async Task<CurrentUserDto> BuildUserDtoAsync(ApplicationUser user, string role, CancellationToken ct)
    {
        int? memberProfileId = role == Roles.Member
            ? await db.MemberProfiles.Where(m => m.UserId == user.Id).Select(m => (int?)m.Id).FirstOrDefaultAsync(ct)
            : null;

        int? trainerProfileId = role == Roles.Trainer
            ? await db.TrainerProfiles.Where(t => t.UserId == user.Id).Select(t => (int?)t.Id).FirstOrDefaultAsync(ct)
            : null;

        return new CurrentUserDto(user.Id, user.Email!, user.FirstName, user.LastName, role, memberProfileId, trainerProfileId);
    }

    private async Task<string> GetRoleAsync(ApplicationUser user)
    {
        var roles = await userManager.GetRolesAsync(user);
        return roles.Count == 1
            ? roles[0]
            : throw new InvalidOperationException($"User {user.Id} must have exactly one role but has {roles.Count}.");
    }

    private static RequestValidationException ToValidationException(IdentityResult result, string field) =>
        new(new Dictionary<string, string[]> { [field] = result.Errors.Select(e => e.Description).ToArray() });

    private static void EnsureSucceeded(IdentityResult result)
    {
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(string.Join("; ", result.Errors.Select(e => e.Description)));
        }
    }
}
