using System.Globalization;
using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.JsonWebTokens;

namespace GymManagement.Api.Extensions;

/// <summary>Bound from "RateLimiting". Integration tests can lower the limits or set Enabled=false.</summary>
public sealed class RateLimitingOptions
{
    public const string SectionName = "RateLimiting";

    public bool Enabled { get; set; } = true;
    public int LoginPerMinute { get; set; } = 5;
    public int RegisterPer10Minutes { get; set; } = 3;
    public int PasswordResetPer15Minutes { get; set; } = 3;
    public int AuthenticatedPerMinute { get; set; } = 100;
    public int AnonymousPerMinute { get; set; } = 60;
}

/// <summary>Names used with [EnableRateLimiting(...)] on sensitive endpoints.</summary>
public static class RateLimitPolicies
{
    public const string Login = "login";
    public const string Register = "register";
    public const string PasswordReset = "password-reset";
}

/// <summary>
/// Two layers of limits, both enforced by ASP.NET Core's built-in rate limiter:
/// 1. A global limit on every request: per user ID when signed in, per client IP otherwise.
/// 2. Stricter named policies on login, registration and password reset (per client IP).
/// The client IP is the TCP connection address, or X-Forwarded-For only when it comes from a
/// configured trusted proxy (see SecurityExtensions), so sending a fake header can't create new partitions.
/// Limits are kept in memory per app instance; several instances need a gateway or a shared store (Redis).
/// </summary>
public static class RateLimitingExtensions
{
    public static IServiceCollection AddFitForgeRateLimiting(this IServiceCollection services, IConfiguration configuration)
    {
        var settings = configuration.GetSection(RateLimitingOptions.SectionName).Get<RateLimitingOptions>() ?? new();

        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.OnRejected = WriteRejectionAsync;

            if (!settings.Enabled)
            {
                options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(_ => RateLimitPartition.GetNoLimiter("off"));
                options.AddPolicy(RateLimitPolicies.Login, _ => RateLimitPartition.GetNoLimiter("off"));
                options.AddPolicy(RateLimitPolicies.Register, _ => RateLimitPartition.GetNoLimiter("off"));
                options.AddPolicy(RateLimitPolicies.PasswordReset, _ => RateLimitPartition.GetNoLimiter("off"));
                return;
            }

            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(http =>
            {
                var userId = http.User.FindFirstValue(JwtRegisteredClaimNames.Sub);
                return userId is not null
                    ? RateLimitPartition.GetSlidingWindowLimiter($"user:{userId}", _ => new SlidingWindowRateLimiterOptions
                    {
                        PermitLimit = settings.AuthenticatedPerMinute,
                        Window = TimeSpan.FromMinutes(1),
                        SegmentsPerWindow = 6,
                        QueueLimit = 0
                    })
                    : RateLimitPartition.GetFixedWindowLimiter($"ip:{ClientIp(http)}", _ => FixedWindow(
                        settings.AnonymousPerMinute, TimeSpan.FromMinutes(1)));
            });

            options.AddPolicy(RateLimitPolicies.Login, http =>
                RateLimitPartition.GetFixedWindowLimiter(ClientIp(http), _ => FixedWindow(settings.LoginPerMinute, TimeSpan.FromMinutes(1))));

            options.AddPolicy(RateLimitPolicies.Register, http =>
                RateLimitPartition.GetFixedWindowLimiter(ClientIp(http), _ => FixedWindow(settings.RegisterPer10Minutes, TimeSpan.FromMinutes(10))));

            options.AddPolicy(RateLimitPolicies.PasswordReset, http =>
                RateLimitPartition.GetFixedWindowLimiter(ClientIp(http), _ => FixedWindow(settings.PasswordResetPer15Minutes, TimeSpan.FromMinutes(15))));
        });

        return services;
    }

    private static FixedWindowRateLimiterOptions FixedWindow(int permits, TimeSpan window) => new()
    {
        PermitLimit = permits,
        Window = window,
        QueueLimit = 0 // reject immediately instead of holding requests open
    };

    private static string ClientIp(HttpContext http) => http.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    private static async ValueTask WriteRejectionAsync(OnRejectedContext context, CancellationToken ct)
    {
        var http = context.HttpContext;
        int? retryAfterSeconds = null;

        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
        {
            retryAfterSeconds = (int)Math.Ceiling(retryAfter.TotalSeconds);
            http.Response.Headers.RetryAfter = retryAfterSeconds.Value.ToString(CultureInfo.InvariantCulture);
        }

        // Logged, not written to the audit table: a flood of rejected requests must not flood the database.
        http.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("RateLimiting")
            .LogWarning("Rate limit exceeded: {Method} {Path} from {ClientIp}",
                http.Request.Method, http.Request.Path, ClientIp(http));

        var problems = http.RequestServices.GetRequiredService<IProblemDetailsService>();
        await problems.WriteAsync(new ProblemDetailsContext
        {
            HttpContext = http,
            ProblemDetails = new ProblemDetails
            {
                Status = StatusCodes.Status429TooManyRequests,
                Title = "Too many requests",
                Detail = retryAfterSeconds is int seconds
                    ? $"Too many requests. Please try again in {seconds} seconds."
                    : "Too many requests. Please try again later."
            }
        });
    }
}
