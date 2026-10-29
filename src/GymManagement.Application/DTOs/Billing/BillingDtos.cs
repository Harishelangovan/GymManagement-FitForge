using GymManagement.Application.Common;
using GymManagement.Domain.Enums;

namespace GymManagement.Application.DTOs.Billing;

// ---------- Membership plans ----------

public sealed record MembershipPlanDto(int Id, string Name, string? Description, int DurationDays, decimal Price, bool IsActive);

public sealed record UpsertMembershipPlanRequest(string Name, string? Description, int DurationDays, decimal Price, bool IsActive);

// ---------- Memberships ----------

public sealed class MembershipQuery : PageQuery
{
    public int? MemberId { get; set; }
    public MembershipState? State { get; set; }

    /// <summary>Only active memberships ending within the next 7 days.</summary>
    public bool ExpiringSoon { get; set; }
}

public sealed record MembershipDto(
    int Id,
    int MemberProfileId,
    string MemberName,
    string MemberEmail,
    int MembershipPlanId,
    string PlanName,
    DateOnly StartDate,
    DateOnly EndDate,
    decimal PriceAtPurchase,
    decimal AmountPaid,
    decimal Balance,
    MembershipState State,
    int DaysRemaining,
    DateTime CreatedUtc);

/// <summary>StartDate is optional: when omitted, the membership starts today or the day after the member's current one ends.</summary>
public sealed record CreateMembershipRequest(int MemberProfileId, int MembershipPlanId, DateOnly? StartDate);

// ---------- Payments ----------

public sealed class PaymentQuery : PageQuery
{
    public int? MemberId { get; set; }
    public PaymentMethod? Method { get; set; }
    public DateOnly? From { get; set; }
    public DateOnly? To { get; set; }
}

public sealed record PaymentDto(
    int Id,
    int MembershipId,
    int MemberProfileId,
    string MemberName,
    string PlanName,
    decimal Amount,
    PaymentMethod Method,
    string? ReferenceNumber,
    string? Notes,
    DateTime PaidUtc,
    string RecordedByName);

public sealed record CreatePaymentRequest(
    int MembershipId,
    decimal Amount,
    PaymentMethod Method,
    string? ReferenceNumber,
    string? Notes,
    DateTime? PaidUtc);
