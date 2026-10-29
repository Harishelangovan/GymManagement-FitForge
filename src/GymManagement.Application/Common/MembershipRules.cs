using GymManagement.Domain.Enums;

namespace GymManagement.Application.Common;

/// <summary>What a membership means on a given day. Derived, never stored, so it can't go stale.</summary>
public enum MembershipState
{
    Upcoming,
    Active,
    Expired,
    Cancelled
}

/// <summary>Pure membership/booking rules with no database access, so they are easy to unit-test.</summary>
public static class MembershipRules
{
    public const int ExpiringSoonDays = 7;
    public const int MaxBackdatedStartDays = 30;
    public static readonly TimeSpan BookingCancellationCutoff = TimeSpan.FromHours(2);

    public static MembershipState GetState(MembershipStatus status, DateOnly start, DateOnly end, DateOnly today) =>
        status == MembershipStatus.Cancelled ? MembershipState.Cancelled
        : today < start ? MembershipState.Upcoming
        : today > end ? MembershipState.Expired
        : MembershipState.Active;

    /// <summary>Days left after today (0 on the last day, 0 once expired).</summary>
    public static int DaysRemaining(DateOnly end, DateOnly today) => Math.Max(0, end.DayNumber - today.DayNumber);

    /// <summary>A plan of N days starting on <paramref name="start"/> ends on start + N - 1 (inclusive).</summary>
    public static DateOnly EndDateFor(DateOnly start, int durationDays) => start.AddDays(durationDays - 1);

    public static bool Overlaps(DateOnly startA, DateOnly endA, DateOnly startB, DateOnly endB) =>
        startA <= endB && startB <= endA;

    public static bool CanCancelBooking(DateTime classStartUtc, DateTime utcNow) =>
        classStartUtc - utcNow >= BookingCancellationCutoff;
}
