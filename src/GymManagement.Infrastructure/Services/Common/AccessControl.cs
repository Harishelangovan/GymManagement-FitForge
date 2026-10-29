using GymManagement.Application.Common.Exceptions;
using GymManagement.Application.Interfaces;
using GymManagement.Domain.Common;
using GymManagement.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagement.Infrastructure.Services.Common;

/// <summary>
/// Resource-level authorization shared by all services (prevents IDOR: changing an ID in the URL
/// never exposes someone else's data). Records the caller may not see are reported as 404, not 403,
/// so the API never confirms that another person's record exists.
/// </summary>
public sealed class AccessControl(AppDbContext db, ICurrentUser currentUser)
{
    private int? _memberProfileId;
    private int? _trainerProfileId;

    public bool IsAdmin => currentUser.IsInRole(Roles.Admin);
    public bool IsTrainer => currentUser.IsInRole(Roles.Trainer);
    public bool IsMember => currentUser.IsInRole(Roles.Member);

    /// <summary>The caller's member profile ID. Throws 403 if the caller is not a member.</summary>
    public async Task<int> GetMyMemberProfileIdAsync(CancellationToken ct)
    {
        _memberProfileId ??= await db.MemberProfiles
            .Where(m => m.UserId == currentUser.UserId)
            .Select(m => (int?)m.Id)
            .FirstOrDefaultAsync(ct);

        return _memberProfileId ?? throw new ForbiddenException("Only members can do this.");
    }

    /// <summary>The caller's trainer profile ID. Throws 403 if the caller is not a trainer.</summary>
    public async Task<int> GetMyTrainerProfileIdAsync(CancellationToken ct)
    {
        _trainerProfileId ??= await db.TrainerProfiles
            .Where(t => t.UserId == currentUser.UserId)
            .Select(t => (int?)t.Id)
            .FirstOrDefaultAsync(ct);

        return _trainerProfileId ?? throw new ForbiddenException("Only trainers can do this.");
    }

    /// <summary>Read access to a member's records: admin, the member's assigned trainer, or the member.</summary>
    public async Task EnsureCanViewMemberAsync(int memberProfileId, CancellationToken ct)
    {
        if (IsAdmin)
        {
            if (!await db.MemberProfiles.AnyAsync(m => m.Id == memberProfileId, ct))
            {
                throw new NotFoundException("Member", memberProfileId);
            }
            return;
        }

        if (IsMember && await GetMyMemberProfileIdAsync(ct) == memberProfileId)
        {
            return;
        }

        if (IsTrainer && await IsAssignedToMeAsync(memberProfileId, ct))
        {
            return;
        }

        throw new NotFoundException("Member", memberProfileId);
    }

    /// <summary>Write access to a member's training records: admin or the member's assigned trainer.</summary>
    public async Task EnsureCanManageMemberAsync(int memberProfileId, CancellationToken ct)
    {
        if (IsAdmin)
        {
            if (!await db.MemberProfiles.AnyAsync(m => m.Id == memberProfileId, ct))
            {
                throw new NotFoundException("Member", memberProfileId);
            }
            return;
        }

        if (IsTrainer && await IsAssignedToMeAsync(memberProfileId, ct))
        {
            return;
        }

        throw new NotFoundException("Member", memberProfileId);
    }

    private async Task<bool> IsAssignedToMeAsync(int memberProfileId, CancellationToken ct)
    {
        var trainerId = await GetMyTrainerProfileIdAsync(ct);
        return await db.MemberProfiles.AnyAsync(m => m.Id == memberProfileId && m.AssignedTrainerId == trainerId, ct);
    }
}
