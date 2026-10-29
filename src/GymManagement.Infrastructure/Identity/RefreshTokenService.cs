using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;
using GymManagement.Domain.Entities;
using GymManagement.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace GymManagement.Infrastructure.Identity;

/// <summary>
/// Issues, finds and revokes refresh tokens. The raw token is 64 random bytes (base64url) and is
/// only ever sent to the browser in an HttpOnly cookie; the database stores its SHA-256 hash, so a
/// leaked database backup cannot be used to sign in.
/// </summary>
public sealed class RefreshTokenService(AppDbContext db, IOptions<JwtOptions> options, TimeProvider timeProvider)
{
    /// <summary>Adds a new token to the context (caller saves). Returns the raw value for the cookie.</summary>
    public (string RawToken, RefreshToken Entity) Create(Guid userId, Guid familyId, string? ipAddress)
    {
        var now = timeProvider.GetUtcNow().UtcDateTime;
        var rawToken = Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(64));

        var entity = new RefreshToken
        {
            UserId = userId,
            FamilyId = familyId,
            TokenHash = Hash(rawToken),
            CreatedUtc = now,
            ExpiresUtc = now.AddDays(options.Value.RefreshTokenDays),
            CreatedByIp = ipAddress
        };

        db.RefreshTokens.Add(entity);
        return (rawToken, entity);
    }

    public Task<RefreshToken?> FindAsync(string rawToken, CancellationToken ct) =>
        db.RefreshTokens
            .Include(t => t.User)
            .SingleOrDefaultAsync(t => t.TokenHash == Hash(rawToken), ct);

    /// <summary>Revokes every still-active token of one login session (used on logout and on reuse detection).</summary>
    public Task<int> RevokeFamilyAsync(Guid familyId, CancellationToken ct)
    {
        var now = timeProvider.GetUtcNow().UtcDateTime;
        return db.RefreshTokens
            .Where(t => t.FamilyId == familyId && t.RevokedUtc == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedUtc, now), ct);
    }

    /// <summary>Revokes every active token of a user (password change/reset, deactivation): signs out all devices.</summary>
    public Task<int> RevokeAllForUserAsync(Guid userId, CancellationToken ct)
    {
        var now = timeProvider.GetUtcNow().UtcDateTime;
        return db.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedUtc == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedUtc, now), ct);
    }

    public static string Hash(string rawToken) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));
}
