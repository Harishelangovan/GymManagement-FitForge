using GymManagement.Application.DTOs.Auth;

namespace GymManagement.Application.Interfaces;

public interface IAuthService
{
    /// <summary>Creates a Member account and its profile, then signs the user in.</summary>
    Task<AuthResult> RegisterAsync(RegisterRequest request, CancellationToken ct = default);

    Task<AuthResult> LoginAsync(LoginRequest request, CancellationToken ct = default);

    /// <summary>Rotates the refresh token. Reuse of an old token revokes the whole session family.</summary>
    Task<AuthResult> RefreshAsync(string refreshToken, CancellationToken ct = default);

    /// <summary>Revokes the session the refresh token belongs to. Safe to call with an unknown token.</summary>
    Task LogoutAsync(string? refreshToken, CancellationToken ct = default);

    /// <summary>Changes the password of the current user and signs out every session.</summary>
    Task ChangePasswordAsync(ChangePasswordRequest request, CancellationToken ct = default);

    /// <summary>Sends a reset link if the account exists. Never reveals whether it does.</summary>
    Task ForgotPasswordAsync(ForgotPasswordRequest request, CancellationToken ct = default);

    Task ResetPasswordAsync(ResetPasswordRequest request, CancellationToken ct = default);

    Task<CurrentUserDto> GetCurrentUserAsync(CancellationToken ct = default);
}
