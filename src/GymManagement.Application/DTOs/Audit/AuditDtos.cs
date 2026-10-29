using GymManagement.Application.Common;

namespace GymManagement.Application.DTOs.Audit;

public sealed class AuditLogQuery : PageQuery
{
    /// <summary>Exact action ("payment.recorded") or a prefix ending in "." ("auth." for all security events).</summary>
    public string? Action { get; set; }
    public string? EntityType { get; set; }
    public string? EntityId { get; set; }
    public Guid? ActorUserId { get; set; }
    public DateOnly? From { get; set; }
    public DateOnly? To { get; set; }
}

public sealed record AuditLogDto(
    long Id,
    DateTime CreatedUtc,
    Guid? ActorUserId,
    string? ActorName,
    string? ActorEmail,
    string Action,
    string EntityType,
    string EntityId,
    string? Details,
    string? IpAddress);

/// <summary>Action names for security events, so writers and the audit page use the same strings.</summary>
public static class SecurityEvents
{
    public const string Prefix = "auth.";
    public const string LoginFailed = "auth.login_failed";
    public const string AccountLockedOut = "auth.account_locked_out";
    public const string RefreshTokenReuse = "auth.refresh_token_reuse";
    public const string PasswordChanged = "auth.password_changed";
    public const string PasswordResetRequested = "auth.password_reset_requested";
    public const string PasswordResetCompleted = "auth.password_reset_completed";
}
