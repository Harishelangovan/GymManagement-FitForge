using GymManagement.Application.Common;
using GymManagement.Application.DTOs.Audit;
using GymManagement.Application.DTOs.Billing;
using GymManagement.Application.DTOs.People;
using GymManagement.Application.DTOs.Training;

namespace GymManagement.Application.Interfaces;

// Every service enforces its own authorization (who may see or change which record).
// Controllers add role policies on top, but never rely on the frontend hiding buttons.

public interface IUserService
{
    Task<PagedResult<UserListItemDto>> ListAsync(UserQuery query, CancellationToken ct = default);
    Task<UserListItemDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<UserListItemDto> SetStatusAsync(Guid id, UpdateUserStatusRequest request, CancellationToken ct = default);
}

public interface IMemberService
{
    /// <summary>Admin: all members. Trainer: only members assigned to them.</summary>
    Task<PagedResult<MemberListItemDto>> ListAsync(MemberQuery query, CancellationToken ct = default);

    /// <summary>Admin: any member. Trainer: assigned members. Member: only themselves.</summary>
    Task<MemberDetailDto> GetAsync(int id, CancellationToken ct = default);

    Task<MemberDetailDto> GetMineAsync(CancellationToken ct = default);
    Task<MemberDetailDto> UpdateMineAsync(UpdateMemberProfileRequest request, CancellationToken ct = default);
    Task<MemberDetailDto> CreateAsync(CreateMemberRequest request, CancellationToken ct = default);
    Task<MemberDetailDto> UpdateAsync(int id, UpdateMemberProfileRequest request, CancellationToken ct = default);
    Task<MemberDetailDto> AssignTrainerAsync(int id, AssignTrainerRequest request, CancellationToken ct = default);
}

public interface ITrainerService
{
    /// <summary>Non-admins only see active trainers and never see phone numbers.</summary>
    Task<PagedResult<TrainerDto>> ListAsync(TrainerQuery query, CancellationToken ct = default);
    Task<TrainerDto> GetAsync(int id, CancellationToken ct = default);
    Task<TrainerDto> GetMineAsync(CancellationToken ct = default);
    Task<TrainerDto> CreateAsync(CreateTrainerRequest request, CancellationToken ct = default);

    /// <summary>Admin, or the trainer updating their own profile.</summary>
    Task<TrainerDto> UpdateAsync(int id, UpdateTrainerRequest request, CancellationToken ct = default);
}

public interface IMembershipPlanService
{
    /// <summary>Inactive plans are only included for admins.</summary>
    Task<IReadOnlyList<MembershipPlanDto>> ListAsync(bool includeInactive, CancellationToken ct = default);
    Task<MembershipPlanDto> GetAsync(int id, CancellationToken ct = default);
    Task<MembershipPlanDto> CreateAsync(UpsertMembershipPlanRequest request, CancellationToken ct = default);
    Task<MembershipPlanDto> UpdateAsync(int id, UpsertMembershipPlanRequest request, CancellationToken ct = default);
}

public interface IMembershipService
{
    Task<PagedResult<MembershipDto>> ListAsync(MembershipQuery query, CancellationToken ct = default);
    Task<IReadOnlyList<MembershipDto>> ListMineAsync(CancellationToken ct = default);
    Task<MembershipDto> GetAsync(int id, CancellationToken ct = default);
    Task<MembershipDto> CreateAsync(CreateMembershipRequest request, CancellationToken ct = default);
    Task<MembershipDto> CancelAsync(int id, CancellationToken ct = default);
}

public interface IPaymentService
{
    Task<PagedResult<PaymentDto>> ListAsync(PaymentQuery query, CancellationToken ct = default);
    Task<PagedResult<PaymentDto>> ListMineAsync(PageQuery query, CancellationToken ct = default);
    Task<PaymentDto> CreateAsync(CreatePaymentRequest request, CancellationToken ct = default);
}

public interface IWorkoutPlanService
{
    /// <summary>Admin: any (filter by member). Trainer: plans for their assigned members.</summary>
    Task<PagedResult<WorkoutPlanDto>> ListAsync(TrainingPlanQuery query, CancellationToken ct = default);
    Task<IReadOnlyList<WorkoutPlanDto>> ListMineAsync(CancellationToken ct = default);
    Task<WorkoutPlanDto> GetAsync(int id, CancellationToken ct = default);
    Task<WorkoutPlanDto> CreateAsync(CreateWorkoutPlanRequest request, CancellationToken ct = default);
    Task<WorkoutPlanDto> UpdateAsync(int id, UpdateWorkoutPlanRequest request, CancellationToken ct = default);
}

public interface IDietPlanService
{
    Task<PagedResult<DietPlanDto>> ListAsync(TrainingPlanQuery query, CancellationToken ct = default);
    Task<IReadOnlyList<DietPlanDto>> ListMineAsync(CancellationToken ct = default);
    Task<DietPlanDto> GetAsync(int id, CancellationToken ct = default);
    Task<DietPlanDto> CreateAsync(CreateDietPlanRequest request, CancellationToken ct = default);
    Task<DietPlanDto> UpdateAsync(int id, UpdateDietPlanRequest request, CancellationToken ct = default);
}

public interface IClassService
{
    Task<PagedResult<FitnessClassDto>> ListAsync(ClassQuery query, CancellationToken ct = default);
    Task<FitnessClassDto> GetAsync(int id, CancellationToken ct = default);
    Task<FitnessClassDto> CreateAsync(CreateClassRequest request, CancellationToken ct = default);
    Task<FitnessClassDto> UpdateAsync(int id, UpdateClassRequest request, CancellationToken ct = default);
    Task<FitnessClassDto> CancelAsync(int id, CancellationToken ct = default);

    Task<ClassBookingDto> BookAsync(int classId, CancellationToken ct = default);
    Task CancelMyBookingAsync(int classId, CancellationToken ct = default);
    Task<PagedResult<ClassBookingDto>> ListMyBookingsAsync(MyBookingsQuery query, CancellationToken ct = default);
    Task<IReadOnlyList<ClassRosterEntryDto>> GetRosterAsync(int classId, CancellationToken ct = default);
}

public interface IAuditLogService
{
    /// <summary>Admin only (enforced by the controller policy). Newest first.</summary>
    Task<PagedResult<AuditLogDto>> ListAsync(AuditLogQuery query, CancellationToken ct = default);
}

public interface IAttendanceService
{
    Task<AttendanceDto> MarkAsync(MarkAttendanceRequest request, CancellationToken ct = default);
    Task<PagedResult<AttendanceDto>> ListAsync(AttendanceQuery query, CancellationToken ct = default);
    Task<PagedResult<AttendanceDto>> ListMineAsync(PageQuery query, CancellationToken ct = default);
}
