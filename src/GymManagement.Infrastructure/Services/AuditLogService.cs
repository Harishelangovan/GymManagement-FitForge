using GymManagement.Application.Common;
using GymManagement.Application.DTOs.Audit;
using GymManagement.Application.Interfaces;
using GymManagement.Infrastructure.Data;
using GymManagement.Infrastructure.Services.Common;
using Microsoft.EntityFrameworkCore;

namespace GymManagement.Infrastructure.Services;

public sealed class AuditLogService(AppDbContext db, IGymClock clock) : IAuditLogService
{
    public async Task<PagedResult<AuditLogDto>> ListAsync(AuditLogQuery query, CancellationToken ct = default)
    {
        // Left join: the actor may be null (anonymous events such as a failed login).
        var logs =
            from log in db.AuditLogs.AsNoTracking()
            join user in db.Users on log.ActorUserId equals (Guid?)user.Id into actors
            from actor in actors.DefaultIfEmpty()
            select new
            {
                Log = log,
                ActorName = actor != null ? actor.FirstName + " " + actor.LastName : null,
                ActorEmail = actor != null ? actor.Email : null
            };

        if (!string.IsNullOrWhiteSpace(query.Action))
        {
            var action = query.Action.Trim();
            logs = action.EndsWith('.')
                ? logs.Where(x => x.Log.Action.StartsWith(action))
                : logs.Where(x => x.Log.Action == action);
        }

        if (!string.IsNullOrWhiteSpace(query.EntityType))
        {
            logs = logs.Where(x => x.Log.EntityType == query.EntityType);
        }

        if (!string.IsNullOrWhiteSpace(query.EntityId))
        {
            logs = logs.Where(x => x.Log.EntityId == query.EntityId);
        }

        if (query.ActorUserId is Guid actorId)
        {
            logs = logs.Where(x => x.Log.ActorUserId == actorId);
        }

        if (query.From is DateOnly from)
        {
            var fromUtc = clock.StartOfGymDayUtc(from);
            logs = logs.Where(x => x.Log.CreatedUtc >= fromUtc);
        }

        if (query.To is DateOnly to)
        {
            var toUtcExclusive = clock.StartOfGymDayUtc(to.AddDays(1));
            logs = logs.Where(x => x.Log.CreatedUtc < toUtcExclusive);
        }

        if (query.SearchTerm is { } search)
        {
            logs = logs.Where(x => x.Log.Action.Contains(search)
                                   || (x.Log.Details != null && x.Log.Details.Contains(search))
                                   || (x.ActorEmail != null && x.ActorEmail.Contains(search)));
        }

        return await logs
            .OrderByDescending(x => x.Log.CreatedUtc).ThenByDescending(x => x.Log.Id)
            .Select(x => new AuditLogDto(x.Log.Id, x.Log.CreatedUtc, x.Log.ActorUserId, x.ActorName, x.ActorEmail,
                x.Log.Action, x.Log.EntityType, x.Log.EntityId, x.Log.Details, x.Log.IpAddress))
            .ToPagedResultAsync(query, ct);
    }
}
