using System.Net.Http.Headers;
using System.Net.Http.Json;
using GymManagement.Infrastructure.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace GymManagement.IntegrationTests.Infrastructure;

/// <summary>
/// Runs the real API in memory against a dedicated LocalDB database that is dropped and re-created
/// (migrations + development seed data) at the start of every test run. Test-only secrets are supplied
/// here, so the developer's user secrets are neither needed nor used.
/// </summary>
public class FitForgeApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    public const string AdminEmail = "admin@fitforge.test";
    public const string AdminPassword = "Test!Admin2026";
    public const string DemoPassword = "Test!Demo2026";

    protected virtual string DatabaseName => "FitForge_IntegrationTests";

    /// <summary>Rate limiting is off by default so tests can sign in freely; <see cref="RateLimitedApiFactory"/> turns it on.</summary>
    protected virtual IReadOnlyDictionary<string, string?> ExtraSettings => new Dictionary<string, string?> { ["RateLimiting:Enabled"] = "false" };

    private string ConnectionString =>
        $"Server=(localdb)\\MSSQLLocalDB;Database={DatabaseName};Trusted_Connection=True;MultipleActiveResultSets=False;TrustServerCertificate=True";

    private Dictionary<string, string?> Settings()
    {
        var settings = new Dictionary<string, string?>
        {
            ["ConnectionStrings:DefaultConnection"] = ConnectionString,
            ["Jwt:SigningKey"] = "integration-tests-only-signing-key-0123456789abcdef",
            ["Seed:ApplyMigrationsOnStartup"] = "true",
            ["Seed:SeedDemoData"] = "true",
            ["Seed:AdminEmail"] = AdminEmail,
            ["Seed:AdminPassword"] = AdminPassword,
            ["Seed:DemoPassword"] = DemoPassword,
            ["Serilog:MinimumLevel:Default"] = "Warning",
        };
        foreach (var (key, value) in ExtraSettings) settings[key] = value;
        return settings;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Development = admin + demo data are seeded (the same data the app is demoed with).
        builder.UseEnvironment("Development");

        var settings = Settings();

        // UseSetting reaches values that Program.cs reads while registering services (connection string,
        // rate-limit options); the in-memory source is added last, so it also wins over user secrets.
        foreach (var (key, value) in settings) builder.UseSetting(key, value);
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(settings));
    }

    public async ValueTask InitializeAsync()
    {
        // Start every run from a clean database; the app's startup then migrates and seeds it.
        await using (var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(ConnectionString).Options))
        {
            await db.Database.EnsureDeletedAsync();
        }

        _ = Server; // boots the host now, so the first test doesn't pay for migrations
    }

    // ---------- helpers for tests ----------

    /// <summary>An HTTPS client that keeps cookies (the refresh-token cookie is Secure).</summary>
    public HttpClient NewClient() =>
        CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost"), HandleCookies = true, AllowAutoRedirect = false });

    /// <summary>Signs in and returns a client that sends the access token (and holds the refresh cookie).</summary>
    public async Task<HttpClient> SignInAsync(string email, string password)
    {
        var client = NewClient();
        var response = await client.PostAsJsonAsync("/api/auth/login", new { email, password });
        response.EnsureSuccessStatusCode();
        var auth = await response.ReadAsync<AuthResponse>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        return client;
    }

    public Task<HttpClient> AdminAsync() => SignInAsync(AdminEmail, AdminPassword);
    public Task<HttpClient> DemoUserAsync(string loginPrefix) => SignInAsync($"{loginPrefix}@fitforge.test", DemoPassword);

    /// <summary>Registers a brand-new member (unique email) and returns a signed-in client plus their profile id.</summary>
    public async Task<TestMember> RegisterMemberAsync(string firstName = "Test")
    {
        var email = $"{firstName.ToLowerInvariant()}.{Guid.NewGuid():N}@fitforge.test";
        const string password = "Str0ng!Pass";
        var client = NewClient();
        var response = await client.PostAsJsonAsync("/api/auth/register",
            new { firstName, lastName = "Member", email, password, confirmPassword = password });
        response.EnsureSuccessStatusCode();
        var auth = await response.ReadAsync<AuthResponse>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        return new TestMember(client, auth.User.MemberProfileId!.Value, email, password);
    }
}

/// <summary>Same API with rate limiting ON and very low limits, on its own database.</summary>
public sealed class RateLimitedApiFactory : FitForgeApiFactory
{
    protected override string DatabaseName => "FitForge_IntegrationTests_RateLimits";

    protected override IReadOnlyDictionary<string, string?> ExtraSettings => new Dictionary<string, string?>
    {
        ["RateLimiting:Enabled"] = "true",
        ["RateLimiting:LoginPerMinute"] = "3",
        ["RateLimiting:RegisterPer10Minutes"] = "100",
        ["RateLimiting:AnonymousPerMinute"] = "1000",
    };
}

public sealed record TestMember(HttpClient Client, int MemberProfileId, string Email, string Password);
