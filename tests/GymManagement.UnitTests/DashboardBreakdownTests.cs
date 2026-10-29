using GymManagement.Infrastructure.Services;

namespace GymManagement.UnitTests;

/// <summary>Every member must land in exactly one membership-status bucket on the admin dashboard.</summary>
public class DashboardBreakdownTests
{
    private static readonly DateOnly Today = new(2026, 10, 29);

    private static DashboardService.MembershipSpan Span(int member, string start, string end) =>
        new(member, DateOnly.Parse(start), DateOnly.Parse(end));

    [Fact]
    public void Classifies_each_member_into_one_bucket()
    {
        var members = new[] { 1, 2, 3, 4, 5, 6 };
        var spans = new[]
        {
            Span(1, "2026-10-01", "2026-12-31"), // active, plenty of time
            Span(2, "2026-10-01", "2026-11-02"), // covered today, ends in 4 days → expiring
            Span(3, "2026-10-01", "2026-11-02"), // ends soon BUT already renewed → active
            Span(3, "2026-11-03", "2026-12-02"),
            Span(4, "2026-08-01", "2026-09-30"), // ended, nothing new → lapsed
            Span(5, "2026-11-15", "2026-12-14"), // only a future membership → not started
            // member 6: never had one → not started
        };

        var result = DashboardService.BuildBreakdown(members, spans, Today);

        Assert.Equal(2, result.Active);
        Assert.Equal(1, result.ExpiringSoon);
        Assert.Equal(1, result.Lapsed);
        Assert.Equal(2, result.NotStarted);
        Assert.Equal(members.Length, result.Active + result.ExpiringSoon + result.Lapsed + result.NotStarted);
    }

    [Fact]
    public void Lapsed_member_with_an_upcoming_membership_counts_as_not_started()
    {
        var spans = new[] { Span(1, "2026-08-01", "2026-09-30"), Span(1, "2026-11-01", "2026-11-30") };

        var result = DashboardService.BuildBreakdown([1], spans, Today);

        Assert.Equal(1, result.NotStarted);
        Assert.Equal(0, result.Lapsed);
    }

    [Fact]
    public void Coverage_ending_exactly_seven_days_out_is_expiring_soon()
    {
        var result = DashboardService.BuildBreakdown([1], [Span(1, "2026-10-01", "2026-11-05")], Today);

        Assert.Equal(1, result.ExpiringSoon);
    }
}
