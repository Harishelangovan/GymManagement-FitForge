using GymManagement.Domain.Common;
using GymManagement.Domain.Enums;

namespace GymManagement.Domain.Entities;

/// <summary>
/// A payment recorded by an admin at the front desk. No card data is stored;
/// ReferenceNumber is only the receipt/UPI transaction reference.
/// </summary>
public class Payment : BaseEntity
{
    public int MembershipId { get; set; }
    public Membership Membership { get; set; } = null!;

    /// <summary>Stored directly (also reachable via Membership) to make "my payments" queries cheap.</summary>
    public int MemberProfileId { get; set; }
    public MemberProfile MemberProfile { get; set; } = null!;

    public decimal Amount { get; set; }
    public PaymentMethod Method { get; set; }
    public string? ReferenceNumber { get; set; }
    public string? Notes { get; set; }
    public DateTime PaidUtc { get; set; }

    public Guid RecordedByUserId { get; set; }
    public ApplicationUser RecordedBy { get; set; } = null!;
}
