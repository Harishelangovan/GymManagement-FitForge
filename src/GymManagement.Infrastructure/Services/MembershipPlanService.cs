using GymManagement.Application.Common.Exceptions;
using GymManagement.Application.DTOs.Billing;
using GymManagement.Application.Interfaces;
using GymManagement.Domain.Entities;
using GymManagement.Infrastructure.Data;
using GymManagement.Infrastructure.Services.Common;
using Microsoft.EntityFrameworkCore;

namespace GymManagement.Infrastructure.Services;

public sealed class MembershipPlanService(AppDbContext db, AccessControl access, IAuditService audit) : IMembershipPlanService
{
    public async Task<IReadOnlyList<MembershipPlanDto>> ListAsync(bool includeInactive, CancellationToken ct = default)
    {
        var plans = db.MembershipPlans.AsNoTracking();
        if (!(includeInactive && access.IsAdmin))
        {
            plans = plans.Where(p => p.IsActive);
        }

        return await plans
            .OrderBy(p => p.DurationDays).ThenBy(p => p.Price)
            .Select(p => new MembershipPlanDto(p.Id, p.Name, p.Description, p.DurationDays, p.Price, p.IsActive))
            .ToListAsync(ct);
    }

    public async Task<MembershipPlanDto> GetAsync(int id, CancellationToken ct = default)
    {
        var plan = await db.MembershipPlans.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id, ct);
        if (plan is null || (!plan.IsActive && !access.IsAdmin))
        {
            throw new NotFoundException("Membership plan", id);
        }

        return ToDto(plan);
    }

    public async Task<MembershipPlanDto> CreateAsync(UpsertMembershipPlanRequest request, CancellationToken ct = default)
    {
        await EnsureUniqueNameAsync(request.Name, excludeId: null, ct);

        var plan = new MembershipPlan();
        Apply(plan, request);
        db.MembershipPlans.Add(plan);
        await db.SaveChangesAsync(ct);

        audit.Record("plan.created", nameof(MembershipPlan), plan.Id, new { plan.Name, plan.Price, plan.DurationDays });
        await db.SaveChangesAsync(ct);
        return ToDto(plan);
    }

    public async Task<MembershipPlanDto> UpdateAsync(int id, UpsertMembershipPlanRequest request, CancellationToken ct = default)
    {
        var plan = await db.MembershipPlans.FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new NotFoundException("Membership plan", id);

        await EnsureUniqueNameAsync(request.Name, excludeId: id, ct);

        var before = new { plan.Name, plan.Price, plan.DurationDays, plan.IsActive };
        Apply(plan, request);

        // Existing memberships keep their PriceAtPurchase, so a price change only affects new sales.
        audit.Record("plan.updated", nameof(MembershipPlan), id,
            new { Before = before, After = new { plan.Name, plan.Price, plan.DurationDays, plan.IsActive } });
        await db.SaveChangesAsync(ct);
        return ToDto(plan);
    }

    private async Task EnsureUniqueNameAsync(string name, int? excludeId, CancellationToken ct)
    {
        var trimmed = name.Trim();
        if (await db.MembershipPlans.AnyAsync(p => p.Name == trimmed && p.Id != excludeId, ct))
        {
            throw new ConflictException($"A plan named '{trimmed}' already exists.");
        }
    }

    private static void Apply(MembershipPlan plan, UpsertMembershipPlanRequest request)
    {
        plan.Name = request.Name.Trim();
        plan.Description = request.Description?.Trim();
        plan.DurationDays = request.DurationDays;
        plan.Price = request.Price;
        plan.IsActive = request.IsActive;
    }

    private static MembershipPlanDto ToDto(MembershipPlan p) =>
        new(p.Id, p.Name, p.Description, p.DurationDays, p.Price, p.IsActive);
}
