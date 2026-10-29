using GymManagement.Domain.Common;

namespace GymManagement.Domain.Entities;

public class DietPlan : AuditableEntity
{
    public int MemberProfileId { get; set; }
    public MemberProfile MemberProfile { get; set; } = null!;

    public int TrainerProfileId { get; set; }
    public TrainerProfile TrainerProfile { get; set; } = null!;

    public string Title { get; set; } = string.Empty;
    public int DailyCalories { get; set; }
    public int ProteinGrams { get; set; }
    public string Breakfast { get; set; } = string.Empty;
    public string Lunch { get; set; } = string.Empty;
    public string Dinner { get; set; } = string.Empty;
    public string? Snacks { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;
}
