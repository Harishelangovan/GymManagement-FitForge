using GymManagement.Application.Common;
using GymManagement.Application.Common.Exceptions;
using GymManagement.Application.DTOs.Billing;
using GymManagement.Application.Interfaces;
using GymManagement.Domain.Entities;
using GymManagement.Domain.Enums;
using GymManagement.Infrastructure.Data;
using GymManagement.Infrastructure.Services.Common;
using Microsoft.EntityFrameworkCore;

namespace GymManagement.Infrastructure.Services;

public sealed class MembershipService(
    AppDbContext db,
    AccessControl access,
    IAuditService audit,
    IGymClock clock) : IMembershipService
{
    public async Task<PagedResult<MembershipDto>> ListAsync(MembershipQuery query, CancellationToken ct = default)
    {
        var today = clock.Today;
        var memberships = db.Memberships.AsNoTracking();

        if (query.MemberId is int memberId)
        {
            memberships = memberships.Where(m => m.MemberProfileId == memberId);
        }

        memberships = query.State switch
        {
            MembershipState.Cancelled => memberships.Where(m => m.Status == MembershipStatus.Cancelled),
            MembershipState.Upcoming => memberships.Where(m => m.Status == MembershipStatus.Active && m.StartDate > today),
            MembershipState.Expired => memberships.Where(m => m.Status == MembershipStatus.Active && m.EndDate < today),
            MembershipState.Active => memberships.Where(m => m.Status == MembershipStatus.Active
                                                             && m.StartDate <= today && m.EndDate >= today),
            _ => memberships
        };

        if (query.ExpiringSoon)
        {
            var limit = today.AddDays(MembershipRules.ExpiringSoonDays);
            memberships = memberships.Where(m => m.Status == MembershipStatus.Active
                                                 && m.StartDate <= today && m.EndDate >= today && m.EndDate <= limit);
        }

        if (query.SearchTerm is { } search)
        {
            memberships = memberships.Where(m => m.MemberProfile.User.FirstName.Contains(search)
                                                 || m.MemberProfile.User.LastName.Contains(search)
                                                 || m.MemberProfile.User.Email!.Contains(search)
                                                 || m.MembershipPlan.Name.Contains(search));
        }

        var sorted = query.SortBy?.ToLowerInvariant() switch
        {
            "start" => memberships.OrderByDirection(m => m.StartDate, query.Descending),
            "end" => memberships.OrderByDirection(m => m.EndDate, query.Descending),
            "member" => memberships.OrderByDirection(m => m.MemberProfile.User.LastName, query.Descending),
            // Newest first unless the client explicitly asks for ascending.
            _ => memberships.OrderByDirection(m => m.CreatedUtc, query.SortDirection is null || query.Descending)
        };

        var page = await Project(sorted.ThenBy(m => m.Id)).ToPagedResultAsync(query, ct);
        return page.Map(row => ToDto(row, today));
    }

    public async Task<IReadOnlyList<MembershipDto>> ListMineAsync(CancellationToken ct = default)
    {
        var memberId = await access.GetMyMemberProfileIdAsync(ct);
        var today = clock.Today;

        var rows = await Project(db.Memberships.AsNoTracking()
                .Where(m => m.MemberProfileId == memberId)
                .OrderByDescending(m => m.StartDate))
            .ToListAsync(ct);

        return rows.Select(r => ToDto(r, today)).ToList();
    }

    public async Task<MembershipDto> GetAsync(int id, CancellationToken ct = default)
    {
        var memberId = await db.Memberships.Where(m => m.Id == id).Select(m => (int?)m.MemberProfileId).FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException("Membership", id);

        try
        {
            await access.EnsureCanViewMemberAsync(memberId, ct);
        }
        catch (NotFoundException)
        {
            throw new NotFoundException("Membership", id); // don't reveal which member it belongs to
        }

        return await LoadAsync(id, ct);
    }

    public async Task<MembershipDto> CreateAsync(CreateMembershipRequest request, CancellationToken ct = default)
    {
        var member = await db.MemberProfiles
            .Where(m => m.Id == request.MemberProfileId)
            .Select(m => new { m.Id, m.User.IsActive })
            .FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException("Member", request.MemberProfileId);

        if (!member.IsActive)
        {
            throw new BusinessRuleException("This member's account is deactivated.");
        }

        var plan = await db.MembershipPlans.FirstOrDefaultAsync(p => p.Id == request.MembershipPlanId, ct)
            ?? throw new NotFoundException("Membership plan", request.MembershipPlanId);

        if (!plan.IsActive)
        {
            throw new BusinessRuleException("This plan is no longer offered.");
        }

        var today = clock.Today;
        var existing = await db.Memberships
            .Where(m => m.MemberProfileId == member.Id && m.Status == MembershipStatus.Active)
            .Select(m => new { m.StartDate, m.EndDate })
            .ToListAsync(ct);

        DateOnly start;
        if (request.StartDate is { } requestedStart)
        {
            if (requestedStart < today.AddDays(-MembershipRules.MaxBackdatedStartDays))
            {
                throw new BusinessRuleException(
                    $"A membership cannot start more than {MembershipRules.MaxBackdatedStartDays} days in the past.");
            }
            start = requestedStart;
        }
        else
        {
            // Renewal: start the day after the current/upcoming membership ends, otherwise today.
            var latestEnd = existing.Where(e => e.EndDate >= today).Select(e => (DateOnly?)e.EndDate).Max();
            start = latestEnd?.AddDays(1) ?? today;
        }

        var end = MembershipRules.EndDateFor(start, plan.DurationDays);

        var clash = existing.FirstOrDefault(e => MembershipRules.Overlaps(start, end, e.StartDate, e.EndDate));
        if (clash is not null)
        {
            throw new ConflictException(
                $"This overlaps an existing membership ({clash.StartDate:dd MMM yyyy} – {clash.EndDate:dd MMM yyyy}).");
        }

        var membership = new Membership
        {
            MemberProfileId = member.Id,
            MembershipPlanId = plan.Id,
            StartDate = start,
            EndDate = end,
            PriceAtPurchase = plan.Price,
            Status = MembershipStatus.Active
        };
        db.Memberships.Add(membership);
        await db.SaveChangesAsync(ct);

        audit.Record("membership.created", nameof(Membership), membership.Id,
            new { membership.MemberProfileId, Plan = plan.Name, membership.StartDate, membership.EndDate, membership.PriceAtPurchase });
        await db.SaveChangesAsync(ct);

        return await LoadAsync(membership.Id, ct);
    }

    public async Task<MembershipDto> CancelAsync(int id, CancellationToken ct = default)
    {
        var membership = await db.Memberships.FirstOrDefaultAsync(m => m.Id == id, ct)
            ?? throw new NotFoundException("Membership", id);

        if (membership.Status == MembershipStatus.Cancelled)
        {
            throw new BusinessRuleException("This membership is already cancelled.");
        }

        if (membership.EndDate < clock.Today)
        {
            throw new BusinessRuleException("An expired membership cannot be cancelled.");
        }

        membership.Status = MembershipStatus.Cancelled;
        audit.Record("membership.cancelled", nameof(Membership), id, new { membership.MemberProfileId });
        await db.SaveChangesAsync(ct);

        return await LoadAsync(id, ct);
    }

    // ---------- helpers ----------

    private async Task<MembershipDto> LoadAsync(int id, CancellationToken ct)
    {
        var row = await Project(db.Memberships.AsNoTracking().Where(m => m.Id == id)).FirstAsync(ct);
        return ToDto(row, clock.Today);
    }

    private static IQueryable<MembershipRow> Project(IQueryable<Membership> memberships) =>
        memberships.Select(m => new MembershipRow
        {
            Id = m.Id,
            MemberProfileId = m.MemberProfileId,
            MemberName = m.MemberProfile.User.FirstName + " " + m.MemberProfile.User.LastName,
            MemberEmail = m.MemberProfile.User.Email!,
            MembershipPlanId = m.MembershipPlanId,
            PlanName = m.MembershipPlan.Name,
            StartDate = m.StartDate,
            EndDate = m.EndDate,
            PriceAtPurchase = m.PriceAtPurchase,
            AmountPaid = m.Payments.Sum(p => (decimal?)p.Amount) ?? 0m,
            Status = m.Status,
            CreatedUtc = m.CreatedUtc
        });

    private static MembershipDto ToDto(MembershipRow r, DateOnly today) =>
        new(r.Id, r.MemberProfileId, r.MemberName, r.MemberEmail, r.MembershipPlanId, r.PlanName, r.StartDate, r.EndDate,
            r.PriceAtPurchase, r.AmountPaid, Math.Max(0m, r.PriceAtPurchase - r.AmountPaid),
            MembershipRules.GetState(r.Status, r.StartDate, r.EndDate, today),
            MembershipRules.DaysRemaining(r.EndDate, today), r.CreatedUtc);

    private sealed class MembershipRow
    {
        public int Id { get; init; }
        public int MemberProfileId { get; init; }
        public string MemberName { get; init; } = string.Empty;
        public string MemberEmail { get; init; } = string.Empty;
        public int MembershipPlanId { get; init; }
        public string PlanName { get; init; } = string.Empty;
        public DateOnly StartDate { get; init; }
        public DateOnly EndDate { get; init; }
        public decimal PriceAtPurchase { get; init; }
        public decimal AmountPaid { get; init; }
        public MembershipStatus Status { get; init; }
        public DateTime CreatedUtc { get; init; }
    }
}
