using GymManagement.Domain.Entities;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace GymManagement.Infrastructure.Identity;

/// <summary>Creates short-lived access tokens (JWT, HMAC-SHA256).</summary>
public sealed class JwtTokenGenerator(IOptions<JwtOptions> options, TimeProvider timeProvider)
{
    /// <summary>Claim type used for the user's role, both when issuing and when validating tokens.</summary>
    public const string RoleClaimType = "role";

    public (string Token, DateTime ExpiresUtc) CreateAccessToken(ApplicationUser user, string role)
    {
        var settings = options.Value;
        var now = timeProvider.GetUtcNow().UtcDateTime;
        var expires = now.AddMinutes(settings.AccessTokenMinutes);

        // Only what the API needs to authorize a request. No names, phone numbers or profile data.
        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = settings.Issuer,
            Audience = settings.Audience,
            IssuedAt = now,
            NotBefore = now,
            Expires = expires,
            Claims = new Dictionary<string, object>
            {
                [JwtRegisteredClaimNames.Sub] = user.Id.ToString(),
                [JwtRegisteredClaimNames.Email] = user.Email!,
                [JwtRegisteredClaimNames.Jti] = Guid.NewGuid().ToString(),
                [RoleClaimType] = role
            },
            SigningCredentials = new SigningCredentials(settings.GetSigningKey(), SecurityAlgorithms.HmacSha256)
        };

        return (new JsonWebTokenHandler().CreateToken(descriptor), expires);
    }
}
