using GymManagement.Application.Common;
using GymManagement.Domain.Enums;

namespace GymManagement.UnitTests;

public class MembershipRulesTests
{
    private static readonly DateOnly Today = new(2026, 10, 29);

    [Theory]
    [InlineData("2026-10-01", "2026-10-31", MembershipStatus.Active, MembershipState.Active)]
    [InlineData("2026-10-29", "2026-10-29", MembershipStatus.Active, MembershipState.Active)] // single-day plan, today
    [InlineData("2026-10-30", "2026-11-28", MembershipStatus.Active, MembershipState.Upcoming)]
    [InlineData("2026-09-01", "2026-10-28", MembershipStatus.Active, MembershipState.Expired)]
    [InlineData("2026-10-01", "2026-10-31", MembershipStatus.Cancelled, MembershipState.Cancelled)] // cancelled wins over dates
    public void GetState_derives_state_from_status_and_dates(string start, string end, MembershipStatus status, MembershipState expected)
    {
        var state = MembershipRules.GetState(status, DateOnly.Parse(start), DateOnly.Parse(end), Today);

        Assert.Equal(expected, state);
    }

    [Theory]
    [InlineData("2026-11-05", 7)]
    [InlineData("2026-10-29", 0)] // last day: nothing left after today
    [InlineData("2026-10-01", 0)] // expired never goes negative
    public void DaysRemaining_counts_days_after_today(string end, int expected) =>
        Assert.Equal(expected, MembershipRules.DaysRemaining(DateOnly.Parse(end), Today));

    [Fact]
    public void EndDateFor_is_inclusive_of_the_start_day()
    {
        // A 30-day plan starting 1 Oct covers 1–30 Oct.
        Assert.Equal(new DateOnly(2026, 10, 30), MembershipRules.EndDateFor(new DateOnly(2026, 10, 1), 30));
    }

    [Theory]
    [InlineData("2026-10-01", "2026-10-31", "2026-10-31", "2026-11-29", true)]  // touching on the same day overlaps
    [InlineData("2026-10-01", "2026-10-31", "2026-11-01", "2026-11-30", false)] // back-to-back renewal
    [InlineData("2026-10-10", "2026-10-20", "2026-10-01", "2026-10-31", true)]  // contained
    [InlineData("2026-12-01", "2026-12-31", "2026-10-01", "2026-10-31", false)]
    public void Overlaps_detects_shared_days(string startA, string endA, string startB, string endB, bool expected) =>
        Assert.Equal(expected, MembershipRules.Overlaps(DateOnly.Parse(startA), DateOnly.Parse(endA), DateOnly.Parse(startB), DateOnly.Parse(endB)));

    [Theory]
    [InlineData(180, true)]
    [InlineData(120, true)]  // exactly 2 hours before: still allowed
    [InlineData(119, false)]
    [InlineData(0, false)]
    public void CanCancelBooking_allows_cancellation_up_to_two_hours_before(int minutesBeforeStart, bool expected)
    {
        var now = new DateTime(2026, 10, 29, 10, 0, 0, DateTimeKind.Utc);
        var classStart = now.AddMinutes(minutesBeforeStart);

        Assert.Equal(expected, MembershipRules.CanCancelBooking(classStart, now));
    }
}
