using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace GymManagement.Infrastructure.Identity;

/// <summary>
/// Bound from the "Jwt" configuration section. SigningKey is a secret: it comes from
/// user secrets in development and from an environment variable (Jwt__SigningKey) on servers.
/// </summary>
public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; set; } = string.Empty;
    public string Audience { get; set; } = string.Empty;
    public string SigningKey { get; set; } = string.Empty;
    public int AccessTokenMinutes { get; set; } = 15;
    public int RefreshTokenDays { get; set; } = 7;

    /// <summary>HMAC-SHA256 needs a key of at least 256 bits (32 bytes).</summary>
    public bool HasValidSigningKey => Encoding.UTF8.GetByteCount(SigningKey) >= 32;

    public SymmetricSecurityKey GetSigningKey() => new(Encoding.UTF8.GetBytes(SigningKey));
}

/// <summary>Bound from "Frontend". Used to build links in emails (and for CORS in Phase 5).</summary>
public sealed class FrontendOptions
{
    public const string SectionName = "Frontend";

    public string BaseUrl { get; set; } = "http://localhost:5173";
}
