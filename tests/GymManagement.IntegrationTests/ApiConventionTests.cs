using System.Net;
using System.Net.Http.Json;
using GymManagement.IntegrationTests.Infrastructure;

namespace GymManagement.IntegrationTests;

/// <summary>Cross-cutting behaviour: error format, security headers, CORS, audit trail, health.</summary>
public class ApiConventionTests(FitForgeApiFactory api)
{
    [Fact]
    public async Task Validation_errors_are_ProblemDetails_with_nested_camelCase_keys()
    {
        var arjun = await api.DemoUserAsync("arjun.trainer");

        var response = await arjun.PostJsonAsync("/api/workout-plans", new
        {
            memberProfileId = 1,
            title = "",
            startDate = "2026-10-29",
            exercises = new[] { new { dayOfWeek = "Monday", name = "Squat", sets = 0, reps = 5, restSeconds = 60 } }
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.ReadProblemAsync();
        Assert.Equal(400, problem.Status);
        Assert.Contains("title", problem.Errors!.Keys);
        Assert.Contains("exercises[0].sets", problem.Errors.Keys);
    }

    [Fact]
    public async Task Unknown_records_return_404_ProblemDetails()
    {
        var admin = await api.AdminAsync();

        var response = await admin.GetAsync("/api/members/999999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(404, (await response.ReadProblemAsync()).Status);
    }

    [Fact]
    public async Task Responses_carry_security_headers_and_no_server_banner()
    {
        var response = await api.NewClient().GetAsync("/api/membership-plans");

        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("DENY", response.Headers.GetValues("X-Frame-Options").Single());
        Assert.Contains("default-src 'none'", response.Headers.GetValues("Content-Security-Policy").Single());
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
        Assert.False(response.Headers.Contains("Server"));
    }

    [Fact]
    public async Task CORS_allows_the_frontend_origin_and_nobody_else()
    {
        async Task<HttpResponseMessage> Preflight(string origin)
        {
            var request = new HttpRequestMessage(HttpMethod.Options, "/api/auth/refresh");
            request.Headers.Add("Origin", origin);
            request.Headers.Add("Access-Control-Request-Method", "POST");
            request.Headers.Add("Access-Control-Request-Headers", "x-fitforge-client");
            return await api.NewClient().SendAsync(request);
        }

        var allowed = await Preflight("http://localhost:5173");
        var blocked = await Preflight("https://evil.example");

        Assert.Equal("http://localhost:5173", allowed.Headers.GetValues("Access-Control-Allow-Origin").Single());
        Assert.False(blocked.Headers.Contains("Access-Control-Allow-Origin"));
    }

    [Fact]
    public async Task Admin_actions_and_failed_logins_are_audited()
    {
        var admin = await api.AdminAsync();
        var member = await api.RegisterMemberAsync();
        await Scenario.GiveActiveMembershipAsync(admin, member.MemberProfileId);
        await api.NewClient().PostJsonAsync("/api/auth/login", new { email = member.Email, password = "Wrong!Pass1" });

        var created = await admin.GetFromJsonAsync<Paged>("/api/audit-logs?action=membership.created&pageSize=100", HttpExtensions.Json);
        var failed = await admin.GetFromJsonAsync<Paged>("/api/audit-logs?action=auth.&pageSize=100", HttpExtensions.Json);

        Assert.Contains(created!.Items, e => e.Action == "membership.created");
        Assert.Contains(failed!.Items, e => e.Action == "auth.login_failed");
        Assert.DoesNotContain(failed.Items, e => (e.Details ?? "").Contains("Wrong!Pass1")); // never log passwords
    }

    [Fact]
    public async Task Health_endpoint_reports_healthy_database()
    {
        var response = await api.NewClient().GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Healthy", await response.Content.ReadAsStringAsync());
    }

    private sealed record AuditItem(string Action, string? Details);
    private sealed record Paged(List<AuditItem> Items);
}
