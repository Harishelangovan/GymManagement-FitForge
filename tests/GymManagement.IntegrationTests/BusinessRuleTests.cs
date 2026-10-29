using System.Net;
using GymManagement.IntegrationTests.Infrastructure;

namespace GymManagement.IntegrationTests;

public class BusinessRuleTests(FitForgeApiFactory api)
{
    private sealed record MembershipView(int Id, DateOnly StartDate, DateOnly EndDate, decimal Balance, string State);
    private sealed record ClassView(int Id, int BookedCount, int SpotsLeft, bool IsBookedByMe);

    // ---------- Memberships & payments ----------

    [Fact]
    public async Task Renewal_starts_the_day_after_the_current_membership_and_overlaps_are_rejected()
    {
        var admin = await api.AdminAsync();
        var member = await api.RegisterMemberAsync();
        var firstId = await Scenario.GiveActiveMembershipAsync(admin, member.MemberProfileId);
        var first = await (await admin.GetAsync($"/api/memberships/{firstId}")).ReadAsync<MembershipView>();

        var renewalId = await Scenario.GiveActiveMembershipAsync(admin, member.MemberProfileId);
        var renewal = await (await admin.GetAsync($"/api/memberships/{renewalId}")).ReadAsync<MembershipView>();
        Assert.Equal(first.EndDate.AddDays(1), renewal.StartDate);
        Assert.Equal("Upcoming", renewal.State);

        var plans = await (await admin.GetAsync("/api/membership-plans")).ReadAsync<List<IdOnly>>();
        var overlapping = await admin.PostJsonAsync("/api/memberships", new { memberProfileId = member.MemberProfileId, membershipPlanId = plans[0].Id, startDate = first.StartDate });
        Assert.Equal(HttpStatusCode.Conflict, overlapping.StatusCode);
    }

    [Fact]
    public async Task Payments_cannot_exceed_the_outstanding_balance()
    {
        var admin = await api.AdminAsync();
        var member = await api.RegisterMemberAsync();
        var membershipId = await Scenario.GiveActiveMembershipAsync(admin, member.MemberProfileId);
        var balance = (await (await admin.GetAsync($"/api/memberships/{membershipId}")).ReadAsync<MembershipView>()).Balance;

        var tooMuch = await admin.PostJsonAsync("/api/payments", new { membershipId, amount = balance + 1, method = "Cash" });
        var exact = await admin.PostJsonAsync("/api/payments", new { membershipId, amount = balance, method = "Upi" });
        var again = await admin.PostJsonAsync("/api/payments", new { membershipId, amount = 1, method = "Cash" });

        Assert.Equal(HttpStatusCode.BadRequest, tooMuch.StatusCode);
        Assert.Equal(HttpStatusCode.Created, exact.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, again.StatusCode); // fully paid
        Assert.Equal(0m, (await (await admin.GetAsync($"/api/memberships/{membershipId}")).ReadAsync<MembershipView>()).Balance);
    }

    // ---------- Class bookings ----------

    [Fact]
    public async Task Booking_needs_an_active_membership()
    {
        var admin = await api.AdminAsync();
        var trainer = await Scenario.CreateTrainerAsync(admin);
        var classId = await Scenario.CreateClassAsync(admin, trainer, TimeSpan.FromDays(1));
        var noMembership = await api.RegisterMemberAsync();

        var response = await noMembership.Client.PostAsync($"/api/classes/{classId}/bookings", null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task A_full_class_rejects_the_next_booking_and_double_booking_is_a_conflict()
    {
        var admin = await api.AdminAsync();
        var trainer = await Scenario.CreateTrainerAsync(admin);
        var classId = await Scenario.CreateClassAsync(admin, trainer, TimeSpan.FromDays(1), capacity: 1);
        var first = await api.RegisterMemberAsync("First");
        var second = await api.RegisterMemberAsync("Second");
        await Scenario.GiveActiveMembershipAsync(admin, first.MemberProfileId);
        await Scenario.GiveActiveMembershipAsync(admin, second.MemberProfileId);

        Assert.Equal(HttpStatusCode.Created, (await first.Client.PostAsync($"/api/classes/{classId}/bookings", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await first.Client.PostAsync($"/api/classes/{classId}/bookings", null)).StatusCode);

        var full = await second.Client.PostAsync($"/api/classes/{classId}/bookings", null);
        Assert.Equal(HttpStatusCode.BadRequest, full.StatusCode);
        Assert.Equal("This class is full.", (await full.ReadProblemAsync()).Detail);
    }

    [Fact]
    public async Task Concurrent_bookings_for_the_last_spot_never_overbook()
    {
        var admin = await api.AdminAsync();
        var trainer = await Scenario.CreateTrainerAsync(admin);
        var classId = await Scenario.CreateClassAsync(admin, trainer, TimeSpan.FromDays(1), capacity: 1);
        var members = await Task.WhenAll(Enumerable.Range(0, 5).Select(_ => api.RegisterMemberAsync("Racer")));
        foreach (var m in members) await Scenario.GiveActiveMembershipAsync(admin, m.MemberProfileId);

        // Five members try to take one spot at the same moment.
        var results = await Task.WhenAll(members.Select(m => m.Client.PostAsync($"/api/classes/{classId}/bookings", null)));

        Assert.Equal(1, results.Count(r => r.StatusCode == HttpStatusCode.Created));
        var view = await (await admin.GetAsync($"/api/classes/{classId}")).ReadAsync<ClassView>();
        Assert.Equal(1, view.BookedCount);
    }

    [Fact]
    public async Task Cancelling_is_allowed_until_two_hours_before_the_class()
    {
        var admin = await api.AdminAsync();
        var trainer = await Scenario.CreateTrainerAsync(admin);
        var soon = await Scenario.CreateClassAsync(admin, trainer, TimeSpan.FromMinutes(60));
        var later = await Scenario.CreateClassAsync(admin, trainer, TimeSpan.FromDays(2));
        var member = await api.RegisterMemberAsync();
        await Scenario.GiveActiveMembershipAsync(admin, member.MemberProfileId);
        await member.Client.PostAsync($"/api/classes/{soon}/bookings", null);
        await member.Client.PostAsync($"/api/classes/{later}/bookings", null);

        Assert.Equal(HttpStatusCode.BadRequest, (await member.Client.DeleteAsync($"/api/classes/{soon}/bookings/me")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await member.Client.DeleteAsync($"/api/classes/{later}/bookings/me")).StatusCode);
        // ...and can book again after cancelling.
        Assert.Equal(HttpStatusCode.Created, (await member.Client.PostAsync($"/api/classes/{later}/bookings", null)).StatusCode);
    }

    [Fact]
    public async Task A_trainer_cannot_be_double_booked()
    {
        var admin = await api.AdminAsync();
        var trainer = await Scenario.CreateTrainerAsync(admin);
        await Scenario.CreateClassAsync(admin, trainer, TimeSpan.FromDays(3));

        var start = DateTime.UtcNow.AddDays(3).AddMinutes(10);
        var clash = await admin.PostJsonAsync("/api/classes", new { title = "Clash", startUtc = start, endUtc = start.AddMinutes(30), capacity = 5, location = "X", trainerProfileId = trainer });

        Assert.Equal(HttpStatusCode.Conflict, clash.StatusCode);
    }

    [Fact]
    public async Task Expired_member_cannot_check_in()
    {
        var admin = await api.AdminAsync();
        var vikram = await api.DemoUserAsync("vikram.member"); // seeded with an expired membership
        var vikramId = (await (await vikram.GetAsync("/api/members/me")).ReadAsync<IdOnly>()).Id;

        var response = await admin.PostJsonAsync("/api/attendance", new { memberProfileId = vikramId });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
