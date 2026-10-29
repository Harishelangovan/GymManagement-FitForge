using GymManagement.Application.Common;
using GymManagement.Domain.Enums;

namespace GymManagement.Application.DTOs.Training;

public sealed class TrainingPlanQuery : PageQuery
{
    public int? MemberId { get; set; }
    public bool? IsActive { get; set; }
}

// ---------- Workout plans ----------

public sealed record WorkoutExerciseDto(
    int Id,
    DayOfWeek DayOfWeek,
    string Name,
    int Sets,
    int Reps,
    decimal? WeightKg,
    int RestSeconds,
    string? Notes,
    int SortOrder);

public sealed record WorkoutPlanDto(
    int Id,
    int MemberProfileId,
    string MemberName,
    int TrainerProfileId,
    string TrainerName,
    string Title,
    string? Goal,
    DateOnly StartDate,
    DateOnly? EndDate,
    bool IsActive,
    DateTime CreatedUtc,
    DateTime? UpdatedUtc,
    IReadOnlyList<WorkoutExerciseDto> Exercises);

/// <summary>Exercise order within a day follows the order in the request.</summary>
public sealed record WorkoutExerciseInput(
    DayOfWeek DayOfWeek,
    string Name,
    int Sets,
    int Reps,
    decimal? WeightKg,
    int RestSeconds,
    string? Notes);

public sealed record CreateWorkoutPlanRequest(
    int MemberProfileId,
    string Title,
    string? Goal,
    DateOnly StartDate,
    DateOnly? EndDate,
    IReadOnlyList<WorkoutExerciseInput> Exercises) : IWorkoutPlanContent;

/// <summary>Replaces the plan's details and its full exercise list.</summary>
public sealed record UpdateWorkoutPlanRequest(
    string Title,
    string? Goal,
    DateOnly StartDate,
    DateOnly? EndDate,
    bool IsActive,
    IReadOnlyList<WorkoutExerciseInput> Exercises) : IWorkoutPlanContent;

/// <summary>Fields shared by create and update, validated by one validator.</summary>
public interface IWorkoutPlanContent
{
    string Title { get; }
    string? Goal { get; }
    DateOnly StartDate { get; }
    DateOnly? EndDate { get; }
    IReadOnlyList<WorkoutExerciseInput> Exercises { get; }
}

// ---------- Diet plans ----------

public sealed record DietPlanDto(
    int Id,
    int MemberProfileId,
    string MemberName,
    int TrainerProfileId,
    string TrainerName,
    string Title,
    int DailyCalories,
    int ProteinGrams,
    string Breakfast,
    string Lunch,
    string Dinner,
    string? Snacks,
    string? Notes,
    bool IsActive,
    DateTime CreatedUtc,
    DateTime? UpdatedUtc);

public sealed record CreateDietPlanRequest(
    int MemberProfileId,
    string Title,
    int DailyCalories,
    int ProteinGrams,
    string Breakfast,
    string Lunch,
    string Dinner,
    string? Snacks,
    string? Notes) : IDietPlanContent;

public sealed record UpdateDietPlanRequest(
    string Title,
    int DailyCalories,
    int ProteinGrams,
    string Breakfast,
    string Lunch,
    string Dinner,
    string? Snacks,
    string? Notes,
    bool IsActive) : IDietPlanContent;

public interface IDietPlanContent
{
    string Title { get; }
    int DailyCalories { get; }
    int ProteinGrams { get; }
    string Breakfast { get; }
    string Lunch { get; }
    string Dinner { get; }
    string? Snacks { get; }
    string? Notes { get; }
}

// ---------- Classes, bookings, attendance ----------

public sealed class ClassQuery : PageQuery
{
    public DateTime? FromUtc { get; set; }
    public DateTime? ToUtc { get; set; }
    public int? TrainerId { get; set; }
    public bool IncludeCancelled { get; set; }
}

public sealed record FitnessClassDto(
    int Id,
    string Title,
    string? Description,
    int TrainerProfileId,
    string TrainerName,
    DateTime StartUtc,
    DateTime EndUtc,
    int Capacity,
    int BookedCount,
    int SpotsLeft,
    string Location,
    bool IsCancelled,
    bool IsBookedByMe);

/// <summary>TrainerProfileId is used only when an admin creates the class; trainers always create their own.</summary>
public sealed record CreateClassRequest(
    string Title,
    string? Description,
    DateTime StartUtc,
    DateTime EndUtc,
    int Capacity,
    string Location,
    int? TrainerProfileId) : IClassSchedule;

public sealed record UpdateClassRequest(
    string Title,
    string? Description,
    DateTime StartUtc,
    DateTime EndUtc,
    int Capacity,
    string Location) : IClassSchedule;

public interface IClassSchedule
{
    string Title { get; }
    string? Description { get; }
    DateTime StartUtc { get; }
    DateTime EndUtc { get; }
    int Capacity { get; }
    string Location { get; }
}

public sealed class MyBookingsQuery : PageQuery
{
    /// <summary>true = classes that haven't started yet (default), false = past classes.</summary>
    public bool Upcoming { get; set; } = true;
}

public sealed record ClassBookingDto(
    int Id,
    int FitnessClassId,
    string ClassTitle,
    DateTime ClassStartUtc,
    DateTime ClassEndUtc,
    string Location,
    string TrainerName,
    BookingStatus Status,
    DateTime BookedUtc,
    DateTime? CancelledUtc,
    bool IsClassCancelled);

public sealed record ClassRosterEntryDto(
    int BookingId,
    int MemberProfileId,
    string MemberName,
    string MemberEmail,
    DateTime BookedUtc,
    bool Attended);

public sealed class AttendanceQuery : PageQuery
{
    public int? MemberId { get; set; }
    public int? ClassId { get; set; }
    public DateOnly? From { get; set; }
    public DateOnly? To { get; set; }
}

/// <summary>FitnessClassId null = a general gym check-in rather than a class.</summary>
public sealed record MarkAttendanceRequest(int MemberProfileId, int? FitnessClassId);

public sealed record AttendanceDto(
    int Id,
    int MemberProfileId,
    string MemberName,
    int? FitnessClassId,
    string? ClassTitle,
    DateTime CheckInUtc,
    string MarkedByName);
