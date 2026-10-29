using GymManagement.Application.Common;
using GymManagement.Application.DTOs.Training;

namespace GymManagement.Application.DTOs.Dashboard;

// Each dashboard is one request returning everything the page shows, so the numbers on screen
// always come from the same moment. Months are "yyyy-MM" and days are gym-local dates.

public sealed record MonthlyAmountDto(string Month, decimal Amount);
public sealed record MonthlyCountDto(string Month, int Count);
public sealed record DailyAttendanceDto(DateOnly Date, int ClassVisits, int GymCheckIns);

// ---------- Admin ----------

public sealed record AdminKpisDto(
    int ActiveMembers,
    int TotalMembers,
    int ActiveTrainers,
    int ExpiringSoon,
    decimal RevenueThisMonth,
    decimal RevenueLastMonth,
    decimal OutstandingBalance,
    int CheckInsToday,
    int ClassesToday);

/// <summary>Every active member falls in exactly one bucket.</summary>
public sealed record MembershipBreakdownDto(int Active, int ExpiringSoon, int Lapsed, int NotStarted);

public sealed record ExpiringMembershipDto(int MembershipId, int MemberProfileId, string MemberName, string PlanName, DateOnly EndDate, int DaysRemaining);
public sealed record RecentPaymentDto(int Id, string MemberName, string PlanName, decimal Amount, string Method, DateTime PaidUtc);
public sealed record RecentMemberDto(int MemberProfileId, string Name, string Email, DateOnly JoinedOn, string? TrainerName);

public sealed record AdminDashboardDto(
    AdminKpisDto Kpis,
    IReadOnlyList<MonthlyAmountDto> RevenueByMonth,
    IReadOnlyList<MonthlyCountDto> NewMembersByMonth,
    MembershipBreakdownDto MembershipBreakdown,
    IReadOnlyList<DailyAttendanceDto> AttendanceByDay,
    IReadOnlyList<ExpiringMembershipDto> ExpiringMemberships,
    IReadOnlyList<RecentPaymentDto> RecentPayments,
    IReadOnlyList<RecentMemberDto> RecentRegistrations);

// ---------- Trainer ----------

public sealed record TrainerKpisDto(
    int AssignedMembers,
    int SessionsToday,
    int BookingsThisWeek,
    int ActiveWorkoutPlans,
    int MembersWithoutWorkoutPlan);

public sealed record SessionDto(int Id, string Title, DateTime StartUtc, DateTime EndUtc, string Location, int Capacity, int BookedCount);
public sealed record ActivityDto(DateTime AtUtc, int MemberProfileId, string MemberName, string Description);
public sealed record MemberNeedingPlanDto(int MemberProfileId, string MemberName, string? FitnessGoal);

public sealed record TrainerDashboardDto(
    TrainerKpisDto Kpis,
    IReadOnlyList<SessionDto> TodaySessions,
    IReadOnlyList<SessionDto> NextSevenDays,
    IReadOnlyList<DailyAttendanceDto> AttendanceByDay,
    IReadOnlyList<ActivityDto> RecentActivity,
    IReadOnlyList<MemberNeedingPlanDto> MembersWithoutWorkoutPlan);

// ---------- Member ----------

public sealed record MembershipCardDto(
    int Id,
    string PlanName,
    DateOnly StartDate,
    DateOnly EndDate,
    MembershipState State,
    int DaysRemaining,
    int TotalDays,
    decimal Balance);

public sealed record TrainerSummaryDto(int Id, string Name, string Specialization, string Email);

/// <summary>Exercises is empty on a rest day.</summary>
public sealed record TodayWorkoutDto(int PlanId, string PlanTitle, DayOfWeek Day, IReadOnlyList<WorkoutExerciseDto> Exercises);

public sealed record UpcomingClassDto(int ClassId, string Title, DateTime StartUtc, DateTime EndUtc, string Location, string TrainerName);
public sealed record WeeklyVisitsDto(DateOnly WeekStart, int Visits);
public sealed record MemberKpisDto(int VisitsThisWeek, int VisitsLast30Days, int UpcomingClasses, int ClassesAttended);
public sealed record AttendanceItemDto(DateTime CheckInUtc, string? ClassTitle);
public sealed record DietSummaryDto(int Id, string Title, int DailyCalories, int ProteinGrams);

public sealed record MemberDashboardDto(
    string FirstName,
    MemberKpisDto Kpis,
    MembershipCardDto? Membership,
    TrainerSummaryDto? Trainer,
    TodayWorkoutDto? TodayWorkout,
    DietSummaryDto? Diet,
    IReadOnlyList<UpcomingClassDto> UpcomingClasses,
    IReadOnlyList<WeeklyVisitsDto> VisitsByWeek,
    IReadOnlyList<AttendanceItemDto> RecentAttendance);
