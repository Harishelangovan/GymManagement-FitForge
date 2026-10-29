using GymManagement.Domain.Common;

namespace GymManagement.Domain.Entities;

/// <summary>
/// Refresh token record. Only the SHA-256 hash of the token is stored, never the token itself.
/// Tokens issued from the same login share a FamilyId so a reused (stolen) token can revoke the whole chain.
/// </summary>
public class RefreshToken : BaseEntity
{
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;

    public string TokenHash { get; set; } = string.Empty;
    public Guid FamilyId { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime ExpiresUtc { get; set; }
    public DateTime? RevokedUtc { get; set; }
    public string? ReplacedByTokenHash { get; set; }
    public string? CreatedByIp { get; set; }

    public bool IsActive(DateTime utcNow) => RevokedUtc is null && utcNow < ExpiresUtc;
}

/// <summary>Who did what to which record. Details must never contain passwords or tokens.</summary>
public class AuditLog
{
    public long Id { get; set; }
    public Guid? ActorUserId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string? Details { get; set; }
    public string? IpAddress { get; set; }
    public DateTime CreatedUtc { get; set; }
}
