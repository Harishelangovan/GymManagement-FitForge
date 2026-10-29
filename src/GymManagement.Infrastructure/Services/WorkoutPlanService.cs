using GymManagement.Application.Common;
using GymManagement.Application.Common.Exceptions;
using GymManagement.Application.DTOs.Training;
using GymManagement.Application.Interfaces;
using GymManagement.Domain.Entities;
using GymManagement.Infrastructure.Data;
using GymManagement.Infrastructure.Services.Common;
using Microsoft.EntityFrameworkCore;

namespace GymManagement.Infrastructure.Services;

/// <summary>
/// Trainers write plans for their assigned members; admins may write for any member (the plan is then
/// attributed to the member's assigned trainer). Members only read their own plans.
/// A member has at most one active workout plan: activating a plan deactivates the others.
/// </summary>
public sealed class WorkoutPlanService(AppDbContext db, AccessControl access) : IWorkoutPlanService
{
    public async Task<PagedResult<WorkoutPlanDto>> ListAsync(TrainingPlanQuery query, CancellationToken ct = default)
    {
        var plans = db.WorkoutPlans.AsNoTracking();

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

    public async Task<IReadOnlyList<WorkoutPlanDto>> ListMineAsync(CancellationToken ct = default)
    {
        var memberId = await access.GetMyMemberProfileIdAsync(ct);
        return await Project(db.WorkoutPlans.AsNoTracking()
                .Where(p => p.MemberProfileId == memberId)
                .OrderByDescending(p => p.IsActive).ThenByDescending(p => p.CreatedUtc))
            .ToListAsync(ct);
    }

    public async Task<WorkoutPlanDto> GetAsync(int id, CancellationToken ct = default)
    {
        var memberId = await db.WorkoutPlans.Where(p => p.Id == id).Select(p => (int?)p.MemberProfileId).FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException("Workout plan", id);

        try
        {
            await access.EnsureCanViewMemberAsync(memberId, ct);
        }
        catch (NotFoundException)
        {
            throw new NotFoundException("Workout plan", id);
        }

        return await LoadAsync(id, ct);
    }

    public async Task<WorkoutPlanDto> CreateAsync(CreateWorkoutPlanRequest request, CancellationToken ct = default)
    {
        await access.EnsureCanManageMemberAsync(request.MemberProfileId, ct);
        var trainerId = await ResolveTrainerIdAsync(request.MemberProfileId, ct);

        await DeactivateActivePlansAsync(request.MemberProfileId, exceptPlanId: null, ct);

        var plan = new WorkoutPlan
        {
            MemberProfileId = request.MemberProfileId,
            TrainerProfileId = trainerId,
            IsActive = true
        };
        Apply(plan, request);
        db.WorkoutPlans.Add(plan);
        await db.SaveChangesAsync(ct);

        return await LoadAsync(plan.Id, ct);
    }

    public async Task<WorkoutPlanDto> UpdateAsync(int id, UpdateWorkoutPlanRequest request, CancellationToken ct = default)
    {
        var plan = await db.WorkoutPlans.Include(p => p.Exercises).FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new NotFoundException("Workout plan", id);

        try
        {
            await access.EnsureCanManageMemberAsync(plan.MemberProfileId, ct);
        }
        catch (NotFoundException)
        {
            throw new NotFoundException("Workout plan", id);
        }

        if (request.IsActive && !plan.IsActive)
        {
            await DeactivateActivePlansAsync(plan.MemberProfileId, exceptPlanId: plan.Id, ct);
        }

        db.WorkoutExercises.RemoveRange(plan.Exercises);
        plan.Exercises.Clear();
        plan.IsActive = request.IsActive;
        Apply(plan, request);

        await db.SaveChangesAsync(ct);
        return await LoadAsync(id, ct);
    }

    // ---------- helpers ----------

    private static void Apply(WorkoutPlan plan, IWorkoutPlanContent content)
    {
        plan.Title = content.Title.Trim();
        plan.Goal = content.Goal?.Trim();
        plan.StartDate = content.StartDate;
        plan.EndDate = content.EndDate;

        // SortOrder = position of the exercise within its day, in the order the client sent them.
        foreach (var day in content.Exercises.GroupBy(e => e.DayOfWeek))
        {
            var order = 1;
            foreach (var e in day)
            {
                plan.Exercises.Add(new WorkoutExercise
                {
                    DayOfWeek = e.DayOfWeek,
                    Name = e.Name.Trim(),
                    Sets = e.Sets,
                    Reps = e.Reps,
                    WeightKg = e.WeightKg,
                    RestSeconds = e.RestSeconds,
                    Notes = e.Notes?.Trim(),
                    SortOrder = order++
                });
            }
        }
    }

    /// <summary>Trainers own the plans they write; admins write on behalf of the member's assigned trainer.</summary>
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
        var active = await db.WorkoutPlans
            .Where(p => p.MemberProfileId == memberProfileId && p.IsActive && p.Id != exceptPlanId)
            .ToListAsync(ct);

        foreach (var p in active)
        {
            p.IsActive = false;
        }
    }

    private async Task<WorkoutPlanDto> LoadAsync(int id, CancellationToken ct) =>
        await Project(db.WorkoutPlans.AsNoTracking().Where(p => p.Id == id)).FirstAsync(ct);

    private static IQueryable<WorkoutPlanDto> Project(IQueryable<WorkoutPlan> plans) =>
        plans.Select(p => new WorkoutPlanDto(
            p.Id,
            p.MemberProfileId,
            p.MemberProfile.User.FirstName + " " + p.MemberProfile.User.LastName,
            p.TrainerProfileId,
            p.TrainerProfile.User.FirstName + " " + p.TrainerProfile.User.LastName,
            p.Title,
            p.Goal,
            p.StartDate,
            p.EndDate,
            p.IsActive,
            p.CreatedUtc,
            p.UpdatedUtc,
            p.Exercises
                .OrderBy(e => e.DayOfWeek).ThenBy(e => e.SortOrder)
                .Select(e => new WorkoutExerciseDto(e.Id, e.DayOfWeek, e.Name, e.Sets, e.Reps, e.WeightKg,
                    e.RestSeconds, e.Notes, e.SortOrder))
                .ToList()));
}
