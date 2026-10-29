using System.Net;
using GymManagement.IntegrationTests.Infrastructure;

namespace GymManagement.IntegrationTests;

/// <summary>Role policies (403) and resource-level checks (404 for other people's records, no IDOR).</summary>
public class AuthorizationTests(FitForgeApiFactory api)
{
    [Theory]
    [InlineData("/api/members")]
    [InlineData("/api/users")]
    [InlineData("/api/dashboard/admin")]
    [InlineData("/api/anything-not-mapped")] // fallback policy: authenticated by default
    public async Task Anonymous_requests_are_rejected_with_401(string url) =>
        Assert.Equal(HttpStatusCode.Unauthorized, (await api.NewClient().GetAsync(url)).StatusCode);

    [Theory]
    [InlineData("rahul.member", "/api/users")]
    [InlineData("rahul.member", "/api/members")]
    [InlineData("rahul.member", "/api/payments")]
    [InlineData("arjun.trainer", "/api/users")]
    [InlineData("arjun.trainer", "/api/dashboard/admin")]
    [InlineData("arjun.trainer", "/api/audit-logs")]
    public async Task Wrong_role_gets_403(string user, string url)
    {
        var client = await api.DemoUserAsync(user);

        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync(url)).StatusCode);
    }

    [Fact]
    public async Task Public_plan_list_needs_no_sign_in() =>
        Assert.Equal(HttpStatusCode.OK, (await api.NewClient().GetAsync("/api/membership-plans")).StatusCode);

    [Fact]
    public async Task Member_can_read_own_record_but_gets_404_for_another_members()
    {
        var alice = await api.RegisterMemberAsync("Alice");
        var bob = await api.RegisterMemberAsync("Bob");

        Assert.Equal(HttpStatusCode.OK, (await alice.Client.GetAsync($"/api/members/{alice.MemberProfileId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await alice.Client.GetAsync($"/api/members/{bob.MemberProfileId}")).StatusCode);
    }

    [Fact]
    public async Task Member_gets_404_for_another_members_membership_and_workout_plan()
    {
        var admin = await api.AdminAsync();
        var owner = await api.RegisterMemberAsync("Owner");
        var other = await api.RegisterMemberAsync("Other");
        var membershipId = await Scenario.GiveActiveMembershipAsync(admin, owner.MemberProfileId);

        Assert.Equal(HttpStatusCode.NotFound, (await other.Client.GetAsync($"/api/memberships/{membershipId}")).StatusCode);

        // Seeded plan 1 belongs to Rahul.
        Assert.Equal(HttpStatusCode.NotFound, (await other.Client.GetAsync("/api/workout-plans/1")).StatusCode);
    }

    [Fact]
    public async Task Trainer_sees_assigned_members_only()
    {
        var arjun = await api.DemoUserAsync("arjun.trainer");
        var sneha = await api.DemoUserAsync("sneha.member"); // assigned to Priya, not Arjun
        var snehaId = (await (await sneha.GetAsync("/api/members/me")).ReadAsync<IdOnly>()).Id;
        var rahul = await api.DemoUserAsync("rahul.member"); // assigned to Arjun
        var rahulId = (await (await rahul.GetAsync("/api/members/me")).ReadAsync<IdOnly>()).Id;

        Assert.Equal(HttpStatusCode.OK, (await arjun.GetAsync($"/api/members/{rahulId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await arjun.GetAsync($"/api/members/{snehaId}")).StatusCode);
    }

    [Fact]
    public async Task Trainer_cannot_write_a_plan_for_an_unassigned_member()
    {
        var arjun = await api.DemoUserAsync("arjun.trainer");
        var stranger = await api.RegisterMemberAsync("Stranger");

        var response = await arjun.PostJsonAsync("/api/workout-plans", new
        {
            memberProfileId = stranger.MemberProfileId,
            title = "Not allowed",
            startDate = DateOnly.FromDateTime(DateTime.UtcNow),
            exercises = new[] { new { dayOfWeek = "Monday", name = "Squat", sets = 3, reps = 5, restSeconds = 60 } }
        });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Over_posted_fields_are_ignored()
    {
        var member = await api.RegisterMemberAsync();

        var response = await member.Client.PutJsonAsync("/api/members/me", new { firstName = "Test", lastName = "Member", assignedTrainerId = 1 });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var detail = await (await member.Client.GetAsync("/api/members/me")).ReadAsync<Dictionary<string, object?>>();
        Assert.Null(detail["assignedTrainerId"]);
    }
}
