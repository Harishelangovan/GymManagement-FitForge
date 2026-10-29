using System.Text.Json;
using GymManagement.Application.Interfaces;
using GymManagement.Domain.Entities;
using GymManagement.Infrastructure.Data;

namespace GymManagement.Infrastructure.Services.Common;

/// <summary>
/// Adds an AuditLog row to the current DbContext; it is written by the caller's next SaveChanges,
/// so the audit entry and the change it describes succeed or fail together.
/// Callers must never pass passwords, tokens or other secrets in <c>details</c>.
/// </summary>
public sealed class AuditService(AppDbContext db, ICurrentUser currentUser, IGymClock clock) : IAuditService
{
    public void Record(string action, string entityType, object entityId, object? details = null)
    {
        db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = currentUser.IsAuthenticated ? currentUser.UserId : null,
            Action = action,
            EntityType = entityType,
            EntityId = entityId.ToString() ?? string.Empty,
            Details = details is null ? null : JsonSerializer.Serialize(details),
            IpAddress = currentUser.IpAddress,
            CreatedUtc = clock.UtcNow
        });
    }
}
