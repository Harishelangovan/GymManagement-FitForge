using System.Net;
using GymManagement.Api.Filters;
using GymManagement.Infrastructure.Identity;
using Microsoft.AspNetCore.HttpOverrides;

namespace GymManagement.Api.Extensions;

public static class SecurityExtensions
{
    public const string FrontendCorsPolicy = "Frontend";

    /// <summary>
    /// Only the configured frontend origin(s) may call the API from a browser, with cookies, and only
    /// with the headers FitForge actually uses. Any other website's request is blocked by the browser.
    /// </summary>
    public static IServiceCollection AddFrontendCors(this IServiceCollection services, IConfiguration configuration)
    {
        var frontend = configuration.GetSection(FrontendOptions.SectionName).Get<FrontendOptions>() ?? new();
        var origins = new[] { frontend.BaseUrl }
            .Concat(configuration.GetSection("Cors:AdditionalOrigins").Get<string[]>() ?? [])
            .Select(o => o.TrimEnd('/'))
            .Where(o => !string.IsNullOrWhiteSpace(o))
            .Distinct()
            .ToArray();

        services.AddCors(options => options.AddPolicy(FrontendCorsPolicy, policy => policy
            .WithOrigins(origins)
            .AllowCredentials() // needed for the HttpOnly refresh-token cookie
            .WithHeaders("Authorization", "Content-Type", RequireClientHeaderAttribute.HeaderName)
            .WithMethods("GET", "POST", "PUT", "PATCH", "DELETE")
            .WithExposedHeaders("Location", "Retry-After")
            .SetPreflightMaxAge(TimeSpan.FromMinutes(10))));

        return services;
    }

    /// <summary>
    /// Behind a reverse proxy (NGINX, IIS, a load balancer) the TCP connection comes from the proxy, and the real
    /// client IP is in X-Forwarded-For. That header is honoured ONLY when the connection comes from an address listed
    /// in ReverseProxy:KnownProxies. With no proxies configured (local development) the header is ignored, so a client
    /// can't pick its own IP to escape rate limits or to fake audit-log entries.
    /// </summary>
    public static IServiceCollection AddTrustedForwardedHeaders(this IServiceCollection services, IConfiguration configuration)
    {
        var knownProxies = configuration.GetSection("ReverseProxy:KnownProxies").Get<string[]>() ?? [];

        services.Configure<ForwardedHeadersOptions>(options =>
        {
            // Remove the defaults (loopback) so only explicitly configured proxies are trusted.
            options.KnownIPNetworks.Clear();
            options.KnownProxies.Clear();

            if (knownProxies.Length == 0)
            {
                // IMPORTANT: with empty KnownProxies/KnownIPNetworks the middleware would trust X-Forwarded-For from
                // ANY client. With no proxy configured, forwarded headers are switched off entirely.
                options.ForwardedHeaders = ForwardedHeaders.None;
                return;
            }

            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            options.ForwardLimit = 1;
            foreach (var proxy in knownProxies)
            {
                options.KnownProxies.Add(IPAddress.Parse(proxy));
            }
        });

        return services;
    }
}
