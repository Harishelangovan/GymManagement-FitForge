using System.Text.Json.Serialization;
using GymManagement.Api.Authorization;
using GymManagement.Api.Extensions;
using GymManagement.Api.Filters;
using GymManagement.Api.Middleware;
using GymManagement.Application;
using GymManagement.Application.Interfaces;
using GymManagement.Infrastructure;
using GymManagement.Infrastructure.Data.Seed;
using Serilog;
using Serilog.Formatting.Compact;

// Bootstrap logger: captures errors that happen before the host (and its configuration) is built.
Log.Logger = new LoggerConfiguration().WriteTo.Console().CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    // ---------- Logging: readable console output + structured JSON files (logs/fitforge-YYYYMMDD.json) ----------
    builder.Host.UseSerilog((context, services, logger) => logger
        .ReadFrom.Configuration(context.Configuration)
        .ReadFrom.Services(services)
        .Enrich.FromLogContext()
        .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {SourceContext}: {Message:lj}{NewLine}{Exception}")
        .WriteTo.File(new CompactJsonFormatter(),
            Path.Combine(context.HostingEnvironment.ContentRootPath, "logs", "fitforge-.json"),
            rollingInterval: RollingInterval.Day,
            retainedFileCountLimit: 14));

    builder.WebHost.ConfigureKestrel(kestrel =>
    {
        kestrel.AddServerHeader = false;                  // don't advertise the server software
        kestrel.Limits.MaxRequestBodySize = 1024 * 1024;  // 1 MB: the API only accepts small JSON bodies
    });

    // ---------- Services ----------
    builder.Services
        .AddControllers(options =>
        {
            options.Filters.Add<ValidationFilter>();
            // FluentValidation owns all field rules, so every validation error has the same camelCase format.
            options.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true;
        })
        // Enums travel as readable strings ("Upi", "Monday", "Active") instead of numbers.
        .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

    builder.Services.AddProblemDetails();
    builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

    builder.Services.AddHttpContextAccessor();
    builder.Services.AddScoped<ICurrentUser, CurrentUser>();

    builder.Services.AddApplication();
    builder.Services.AddInfrastructure(builder.Configuration);
    builder.Services.AddJwtAuthentication();
    builder.Services.AddAppAuthorization();

    builder.Services.AddTrustedForwardedHeaders(builder.Configuration);
    builder.Services.AddFrontendCors(builder.Configuration);
    builder.Services.AddFitForgeRateLimiting(builder.Configuration);
    builder.Services.AddFitForgeSwagger();

    var app = builder.Build();

    // ---------- Database: migrations (if enabled), roles, and development seed data ----------
    await app.Services.InitializeDatabaseAsync(app.Environment.IsDevelopment());

    // ---------- HTTP pipeline (order matters) ----------
    app.UseForwardedHeaders();      // real client IP, only from trusted proxies
    app.UseExceptionHandler();      // exceptions → ProblemDetails
    app.UseStatusCodePages();       // empty 401/403/404/405 → ProblemDetails
    app.UseMiddleware<SecurityHeadersMiddleware>();

    if (app.Environment.IsDevelopment())
    {
        app.UseFitForgeSwagger();   // /swagger (development only)
    }
    else
    {
        app.UseHsts();
        app.UseHttpsRedirection();
    }

    app.UseSerilogRequestLogging(); // one line per request: method, path, status, duration (no bodies or query strings)
    app.UseCors(SecurityExtensions.FrontendCorsPolicy);
    app.UseAuthentication();        // before rate limiting, so limits can be per user
    app.UseRateLimiter();
    app.UseAuthorization();

    app.MapControllers();
    app.MapHealthChecks("/health").AllowAnonymous();

    app.Run();
}
catch (Exception ex) when (ex is not HostAbortedException) // HostAbortedException = normal stop by the EF Core tools
{
    Log.Fatal(ex, "FitForge API terminated unexpectedly");
    throw;
}
finally
{
    Log.CloseAndFlush();
}

// Makes the auto-generated Program class visible to the integration-test project (Phase 9).
public partial class Program;
