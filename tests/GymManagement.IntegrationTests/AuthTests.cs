using System.Net;
using System.Net.Http.Json;
using GymManagement.IntegrationTests.Infrastructure;

namespace GymManagement.IntegrationTests;

public class AuthTests(FitForgeApiFactory api)
{
    [Fact]
    public async Task Register_always_creates_a_Member_even_if_the_body_asks_for_Admin()
    {
        var client = api.NewClient();
        var email = $"sneaky.{Guid.NewGuid():N}@fitforge.test";

        var response = await client.PostJsonAsync("/api/auth/register",
            new { firstName = "Sneaky", lastName = "User", email, password = "Str0ng!Pass", confirmPassword = "Str0ng!Pass", role = "Admin" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal("Member", (await response.ReadAsync<AuthResponse>()).User.Role);
    }

    [Fact]
    public async Task Register_with_an_existing_email_in_any_case_returns_409()
    {
        var member = await api.RegisterMemberAsync();

        var response = await api.NewClient().PostJsonAsync("/api/auth/register",
            new { firstName = "Dup", lastName = "User", email = member.Email.ToUpperInvariant(), password = "Str0ng!Pass", confirmPassword = "Str0ng!Pass" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Weak_password_returns_400_with_camelCase_field_errors()
    {
        var response = await api.NewClient().PostJsonAsync("/api/auth/register",
            new { firstName = "Weak", lastName = "Pass", email = $"weak.{Guid.NewGuid():N}@fitforge.test", password = "password", confirmPassword = "password" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.ReadProblemAsync();
        Assert.True(problem.Errors!.ContainsKey("password"));
    }

    [Fact]
    public async Task Wrong_password_and_unknown_email_get_the_same_generic_401()
    {
        var wrongPassword = await api.NewClient().PostJsonAsync("/api/auth/login", new { email = FitForgeApiFactory.AdminEmail, password = "Wrong!Pass1" });
        var unknownEmail = await api.NewClient().PostJsonAsync("/api/auth/login", new { email = "nobody@fitforge.test", password = "Wrong!Pass1" });

        Assert.Equal(HttpStatusCode.Unauthorized, wrongPassword.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, unknownEmail.StatusCode);
        Assert.Equal((await wrongPassword.ReadProblemAsync()).Detail, (await unknownEmail.ReadProblemAsync()).Detail);
    }

    [Fact]
    public async Task Refresh_rotates_the_token_and_reusing_the_old_one_revokes_the_session()
    {
        var member = await api.RegisterMemberAsync();
        var login = await api.NewClient().PostJsonAsync("/api/auth/login", new { email = member.Email, password = member.Password });
        var oldCookie = login.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith("fitforge_refresh="));
        var oldToken = oldCookie.Split(';')[0];

        // First refresh with the old token: succeeds and issues a new token.
        var first = await RefreshWithCookieAsync(oldToken);
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        var newToken = first.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith("fitforge_refresh=")).Split(';')[0];
        Assert.NotEqual(oldToken, newToken);

        // Reusing the old (rotated) token is treated as theft: rejected, and the new token dies with it.
        Assert.Equal(HttpStatusCode.Unauthorized, (await RefreshWithCookieAsync(oldToken)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await RefreshWithCookieAsync(newToken)).StatusCode);
    }

    [Fact]
    public async Task Refresh_requires_the_CSRF_header()
    {
        var member = await api.RegisterMemberAsync();

        var response = await member.Client.PostAsync("/api/auth/refresh", null);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Logout_revokes_the_refresh_token()
    {
        var member = await api.RegisterMemberAsync(); // the client holds the refresh cookie from registration

        Assert.Equal(HttpStatusCode.NoContent, (await member.Client.PostWithClientHeaderAsync("/api/auth/logout")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await member.Client.PostWithClientHeaderAsync("/api/auth/refresh")).StatusCode);
    }

    [Fact]
    public async Task Changing_the_password_ends_other_sessions_and_the_old_password_stops_working()
    {
        var member = await api.RegisterMemberAsync();

        var change = await member.Client.PostJsonAsync("/api/auth/change-password",
            new { currentPassword = member.Password, newPassword = "N3w!Passw0rd", confirmNewPassword = "N3w!Passw0rd" });

        Assert.Equal(HttpStatusCode.NoContent, change.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await member.Client.PostWithClientHeaderAsync("/api/auth/refresh")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await api.NewClient().PostJsonAsync("/api/auth/login", new { email = member.Email, password = member.Password })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await api.NewClient().PostJsonAsync("/api/auth/login", new { email = member.Email, password = "N3w!Passw0rd" })).StatusCode);
    }

    [Fact]
    public async Task Five_wrong_passwords_lock_the_account_even_for_the_correct_password()
    {
        var member = await api.RegisterMemberAsync();
        for (var i = 0; i < 5; i++)
        {
            await api.NewClient().PostJsonAsync("/api/auth/login", new { email = member.Email, password = $"Wrong!Pass{i}" });
        }

        var correct = await api.NewClient().PostJsonAsync("/api/auth/login", new { email = member.Email, password = member.Password });

        Assert.Equal(HttpStatusCode.Unauthorized, correct.StatusCode);
    }

    [Fact]
    public async Task Me_requires_a_valid_token()
    {
        var anonymous = await api.NewClient().GetAsync("/api/auth/me");
        var member = await api.RegisterMemberAsync();
        var me = await member.Client.GetFromJsonAsync<CurrentUser>("/api/auth/me", HttpExtensions.Json);

        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
        Assert.Equal(member.Email, me!.Email);
    }

    private Task<HttpResponseMessage> RefreshWithCookieAsync(string cookie)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/refresh");
        request.Headers.Add("X-FitForge-Client", "web");
        request.Headers.Add("Cookie", cookie);
        // A cookie-less client, so only the explicitly supplied token is sent.
        var client = api.CreateClient(new() { BaseAddress = new Uri("https://localhost"), HandleCookies = false });
        return client.SendAsync(request);
    }
}
