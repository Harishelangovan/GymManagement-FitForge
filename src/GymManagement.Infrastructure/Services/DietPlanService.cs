using GymManagement.Application.Common;
using GymManagement.Application.Common.Exceptions;
using GymManagement.Application.DTOs.Training;
using GymManagement.Application.Interfaces;
using GymManagement.Domain.Entities;
using GymManagement.Infrastructure.Data;
using GymManagement.Infrastructure.Services.Common;
using Microsoft.EntityFrameworkCore;

namespace GymManagement.Infrastructure.Services;

/// <summary>Same access rules as workout plans: one active diet plan per member.</summary>
public sealed class DietPlanService(AppDbContext db, AccessControl access) : IDietPlanService
{
    public async Task<PagedResult<DietPlanDto>> ListAsync(TrainingPlanQuery query, CancellationToken ct = default)
    {
        var plans = db.DietPlans.AsNoTracking();

        if (!access.IsAdmin)
        {
            var trainerId = await access.GetMyTrainerProfileIdAsync(ct);
            plans = plans.Where(p => p.MemberProfile.AssignedTrainerId == trainerId);
        }

        if (query.MemberId is int memberId)
        {
            plans = plans.Where(p => p.MemberProfileId == memberId);
        }

        if (query.IsActive is bool isActive)
        {
            plans = plans.Where(p => p.IsActive == isActive);
        }

        if (query.SearchTerm is { } search)
        {
            plans = plans.Where(p => p.Title.Contains(search)
                                     || p.MemberProfile.User.FirstName.Contains(search)
                                     || p.MemberProfile.User.LastName.Contains(search));
        }

        return await Project(plans.OrderByDescending(p => p.CreatedUtc).ThenByDescending(p => p.Id))
            .ToPagedResultAsync(query, ct);
    }

    public async Task<IReadOnlyList<DietPlanDto>> ListMineAsync(CancellationToken ct = default)
    {
        var memberId = await access.GetMyMemberProfileIdAsync(ct);
        return await Project(db.DietPlans.AsNoTracking()
                .Where(p => p.MemberProfileId == memberId)
                .OrderByDescending(p => p.IsActive).ThenByDescending(p => p.CreatedUtc))
            .ToListAsync(ct);
    }

    public async Task<DietPlanDto> GetAsync(int id, CancellationToken ct = default)
    {
        var memberId = await db.DietPlans.Where(p => p.Id == id).Select(p => (int?)p.MemberProfileId).FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException("Diet plan", id);

        try
        {
            await access.EnsureCanViewMemberAsync(memberId, ct);
        }
        catch (NotFoundException)
        {
            throw new NotFoundException("Diet plan", id);
        }

        return await LoadAsync(id, ct);
    }

    public async Task<DietPlanDto> CreateAsync(CreateDietPlanRequest request, CancellationToken ct = default)
    {
        await access.EnsureCanManageMemberAsync(request.MemberProfileId, ct);
        var trainerId = await ResolveTrainerIdAsync(request.MemberProfileId, ct);

        await DeactivateActivePlansAsync(request.MemberProfileId, exceptPlanId: null, ct);

        var plan = new DietPlan
        {
            MemberProfileId = request.MemberProfileId,
            TrainerProfileId = trainerId,
            IsActive = true
        };
        Apply(plan, request);
        db.DietPlans.Add(plan);
        await db.SaveChangesAsync(ct);

        return await LoadAsync(plan.Id, ct);
    }

    public async Task<DietPlanDto> UpdateAsync(int id, UpdateDietPlanRequest request, CancellationToken ct = default)
    {
        var plan = await db.DietPlans.FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new NotFoundException("Diet plan", id);

        try
        {
            await access.EnsureCanManageMemberAsync(plan.MemberProfileId, ct);
        }
        catch (NotFoundException)
        {
            throw new NotFoundException("Diet plan", id);
        }

        if (request.IsActive && !plan.IsActive)
        {
            await DeactivateActivePlansAsync(plan.MemberProfileId, exceptPlanId: plan.Id, ct);
        }

        plan.IsActive = request.IsActive;
        Apply(plan, request);

        await db.SaveChangesAsync(ct);
        return await LoadAsync(id, ct);
    }

    // ---------- helpers ----------

    private static void Apply(DietPlan plan, IDietPlanContent content)
    {
        plan.Title = content.Title.Trim();
        plan.DailyCalories = content.DailyCalories;
        plan.ProteinGrams = content.ProteinGrams;
        plan.Breakfast = content.Breakfast.Trim();
        plan.Lunch = content.Lunch.Trim();
        plan.Dinner = content.Dinner.Trim();
        plan.Snacks = content.Snacks?.Trim();
        plan.Notes = content.Notes?.Trim();
    }

    private async Task<int> ResolveTrainerIdAsync(int memberProfileId, CancellationToken ct)
    {
        if (!access.IsAdmin)
        {
            return await access.GetMyTrainerProfileIdAsync(ct);
        }

        return await db.MemberProfiles.Where(m => m.Id == memberProfileId).Select(m => m.AssignedTrainerId).FirstOrDefaultAsync(ct)
            ?? throw new BusinessRuleException("Assign a trainer to this member before creating a plan.");
    }

    private async Task DeactivateActivePlansAsync(int memberProfileId, int? exceptPlanId, CancellationToken ct)
    {
        var active = await db.DietPlans
            .Where(p => p.MemberProfileId == memberProfileId && p.IsActive && p.Id != exceptPlanId)
            .ToListAsync(ct);

        foreach (var p in active)
        {
            p.IsActive = false;
        }
    }

    private async Task<DietPlanDto> LoadAsync(int id, CancellationToken ct) =>
        await Project(db.DietPlans.AsNoTracking().Where(p => p.Id == id)).FirstAsync(ct);

    private static IQueryable<DietPlanDto> Project(IQueryable<DietPlan> plans) =>
        plans.Select(p => new DietPlanDto(
            p.Id,
            p.MemberProfileId,
            p.MemberProfile.User.FirstName + " " + p.MemberProfile.User.LastName,
            p.TrainerProfileId,
            p.TrainerProfile.User.FirstName + " " + p.TrainerProfile.User.LastName,
            p.Title,
            p.DailyCalories,
            p.ProteinGrams,
            p.Breakfast,
            p.Lunch,
            p.Dinner,
            p.Snacks,
            p.Notes,
            p.IsActive,
            p.CreatedUtc,
            p.UpdatedUtc));
}
