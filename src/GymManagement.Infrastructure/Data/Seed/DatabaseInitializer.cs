using GymManagement.Domain.Common;
using GymManagement.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace GymManagement.Infrastructure.Data.Seed;

public static class DatabaseInitializer
{
    /// <summary>
    /// Runs at startup: applies migrations (if enabled), always ensures the three roles exist,
    /// and in development creates the admin account and demo data.
    /// Every step checks before inserting, so running it again does nothing.
    /// </summary>
    public static async Task InitializeDatabaseAsync(this IServiceProvider services, bool isDevelopment)
    {
        using var scope = services.CreateScope();
        var provider = scope.ServiceProvider;

        var options = provider.GetRequiredService<IOptions<SeedOptions>>().Value;
        var logger = provider.GetRequiredService<ILoggerFactory>().CreateLogger(nameof(DatabaseInitializer));
        var db = provider.GetRequiredService<AppDbContext>();

        if (options.ApplyMigrationsOnStartup)
        {
            logger.LogInformation("Applying database migrations");
            await db.Database.MigrateAsync();
        }

        await SeedRolesAsync(provider.GetRequiredService<RoleManager<ApplicationRole>>(), logger);

        // The admin account and demo data are never created outside development.
        if (!isDevelopment)
        {
            return;
        }

        var userManager = provider.GetRequiredService<UserManager<ApplicationUser>>();
        await SeedDevelopmentAdminAsync(userManager, options, logger);

        if (options.SeedDemoData)
        {
            await DemoDataSeeder.SeedAsync(db, userManager, options, logger);
        }
    }

    private static async Task SeedRolesAsync(RoleManager<ApplicationRole> roleManager, ILogger logger)
    {
        foreach (var roleName in Roles.All)
        {
            if (await roleManager.RoleExistsAsync(roleName))
            {
                continue;
            }

            var result = await roleManager.CreateAsync(new ApplicationRole(roleName));
            EnsureSucceeded(result, $"create role '{roleName}'");
            logger.LogInformation("Created role {Role}", roleName);
        }
    }

    private static async Task SeedDevelopmentAdminAsync(
        UserManager<ApplicationUser> userManager, SeedOptions options, ILogger logger)
    {
        if (string.IsNullOrWhiteSpace(options.AdminEmail) || string.IsNullOrWhiteSpace(options.AdminPassword))
        {
            logger.LogWarning(
                "Development admin not created: set Seed:AdminEmail and Seed:AdminPassword with 'dotnet user-secrets'");
            return;
        }

        if (await userManager.FindByEmailAsync(options.AdminEmail) is not null)
        {
            return;
        }

        var admin = new ApplicationUser
        {
            UserName = options.AdminEmail,
            Email = options.AdminEmail,
            EmailConfirmed = true,
            FirstName = "FitForge",
            LastName = "Admin"
        };

        EnsureSucceeded(await userManager.CreateAsync(admin, options.AdminPassword), "create development admin");
        EnsureSucceeded(await userManager.AddToRoleAsync(admin, Roles.Admin), "assign Admin role");

        // Log the email only. Never log the password.
        logger.LogInformation("Created development admin {Email}", options.AdminEmail);
    }

    internal static void EnsureSucceeded(IdentityResult result, string action)
    {
        if (!result.Succeeded)
        {
            var errors = string.Join("; ", result.Errors.Select(e => e.Description));
            throw new InvalidOperationException($"Seeding failed to {action}: {errors}");
        }
    }
}
