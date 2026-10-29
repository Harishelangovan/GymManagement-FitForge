using System.Net;
using GymManagement.IntegrationTests.Infrastructure;

namespace GymManagement.IntegrationTests;

/// <summary>Runs against its own API instance (rate limiting ON, 3 logins per minute) and its own database.</summary>
public class RateLimitingTests : IClassFixture<RateLimitedApiFactory>
{
    private readonly RateLimitedApiFactory _api;

    public RateLimitingTests(RateLimitedApiFactory api) => _api = api;

    [Fact]
    public async Task Fourth_login_in_a_minute_gets_429_with_Retry_After_even_with_a_spoofed_client_IP()
    {
        HttpResponseMessage? last = null;
        for (var attempt = 1; attempt <= 4; attempt++)
        {
            var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login")
            {
                Content = System.Net.Http.Json.JsonContent.Create(new { email = "nobody@fitforge.test", password = "Wrong!Pass1" })
            };
            // A different fake IP each time: ignored because no trusted proxy is configured.
            request.Headers.Add("X-Forwarded-For", $"203.0.113.{attempt}");
            last = await _api.NewClient().SendAsync(request);

            if (attempt <= 3) Assert.Equal(HttpStatusCode.Unauthorized, last.StatusCode);
        }

        Assert.Equal(HttpStatusCode.TooManyRequests, last!.StatusCode);
        Assert.True(last.Headers.RetryAfter is not null);
        Assert.Equal(429, (await last.ReadProblemAsync()).Status);
    }
}
