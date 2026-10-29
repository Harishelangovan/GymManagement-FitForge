using GymManagement.Domain.Common;
using GymManagement.Domain.Enums;

namespace GymManagement.Domain.Entities;

public class MemberProfile : AuditableEntity
{
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;

    public DateOnly? DateOfBirth { get; set; }
    public Gender? Gender { get; set; }
    public decimal? HeightCm { get; set; }
    public decimal? WeightKg { get; set; }
    public string? FitnessGoal { get; set; }
    public string? EmergencyContactName { get; set; }
    public string? EmergencyContactPhone { get; set; }
    public DateOnly JoinedOn { get; set; }

    /// <summary>A member has at most one assigned trainer.</summary>
    public int? AssignedTrainerId { get; set; }
    public TrainerProfile? AssignedTrainer { get; set; }

    public ICollection<Membership> Memberships { get; set; } = new List<Membership>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
    public ICollection<WorkoutPlan> WorkoutPlans { get; set; } = new List<WorkoutPlan>();
    public ICollection<DietPlan> DietPlans { get; set; } = new List<DietPlan>();
    public ICollection<ClassBooking> ClassBookings { get; set; } = new List<ClassBooking>();
    public ICollection<Attendance> Attendances { get; set; } = new List<Attendance>();
}
