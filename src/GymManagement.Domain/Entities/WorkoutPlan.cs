using GymManagement.Domain.Common;

namespace GymManagement.Domain.Entities;

public class WorkoutPlan : AuditableEntity
{
    public int MemberProfileId { get; set; }
    public MemberProfile MemberProfile { get; set; } = null!;

    public int TrainerProfileId { get; set; }
    public TrainerProfile TrainerProfile { get; set; } = null!;

    public string Title { get; set; } = string.Empty;
    public string? Goal { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<WorkoutExercise> Exercises { get; set; } = new List<WorkoutExercise>();
}

public class WorkoutExercise : BaseEntity
{
    public int WorkoutPlanId { get; set; }
    public WorkoutPlan WorkoutPlan { get; set; } = null!;

    public DayOfWeek DayOfWeek { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Sets { get; set; }
    public int Reps { get; set; }
    public decimal? WeightKg { get; set; }
    public int RestSeconds { get; set; }
    public string? Notes { get; set; }

    /// <summary>Order of the exercise within its day.</summary>
    public int SortOrder { get; set; }
}
