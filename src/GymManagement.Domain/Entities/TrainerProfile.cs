using GymManagement.Domain.Common;

namespace GymManagement.Domain.Entities;

public class TrainerProfile : AuditableEntity
{
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;

    public string Specialization { get; set; } = string.Empty;
    public string? Bio { get; set; }
    public int YearsOfExperience { get; set; }
    public bool IsAcceptingMembers { get; set; } = true;

    public ICollection<MemberProfile> AssignedMembers { get; set; } = new List<MemberProfile>();
    public ICollection<FitnessClass> FitnessClasses { get; set; } = new List<FitnessClass>();
    public ICollection<WorkoutPlan> WorkoutPlans { get; set; } = new List<WorkoutPlan>();
    public ICollection<DietPlan> DietPlans { get; set; } = new List<DietPlan>();
}
