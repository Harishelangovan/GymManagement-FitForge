using GymManagement.Domain.Common;
using GymManagement.Domain.Enums;

namespace GymManagement.Domain.Entities;

/// <summary>A sellable plan, e.g. "Quarterly – 90 days – ₹4,500".</summary>
public class MembershipPlan : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int DurationDays { get; set; }
    public decimal Price { get; set; }

    /// <summary>Inactive plans stay in history but cannot be sold.</summary>
    public bool IsActive { get; set; } = true;

    public ICollection<Membership> Memberships { get; set; } = new List<Membership>();
}

/// <summary>One period of membership for one member. Renewals create a new row.</summary>
public class Membership : AuditableEntity
{
    public int MemberProfileId { get; set; }
    public MemberProfile MemberProfile { get; set; } = null!;

    public int MembershipPlanId { get; set; }
    public MembershipPlan MembershipPlan { get; set; } = null!;

    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }

    /// <summary>Copied from the plan at purchase time so later price changes don't rewrite history.</summary>
    public decimal PriceAtPurchase { get; set; }

    public MembershipStatus Status { get; set; } = MembershipStatus.Active;

    public ICollection<Payment> Payments { get; set; } = new List<Payment>();

    /// <summary>True when the membership is not cancelled and the date is within its period (inclusive).</summary>
    public bool IsActiveOn(DateOnly date) =>
        Status == MembershipStatus.Active && date >= StartDate && date <= EndDate;
}
