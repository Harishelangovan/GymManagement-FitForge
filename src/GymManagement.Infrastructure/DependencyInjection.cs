using GymManagement.Domain.Entities;
using GymManagement.Infrastructure.Data;
using GymManagement.Infrastructure.Data.Seed;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace GymManagement.Infrastructure;

public static class DependencyInjection
{
    /// <summary>Registers the database, Identity stores and health checks. Called once from Program.cs.</summary>
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "Connection string 'DefaultConnection' is missing. Set it in appsettings.Development.json or the ConnectionStrings__DefaultConnection environment variable.");
        }

        services.AddDbContext<AppDbContext>(options =>
            options.UseSqlServer(connectionString, sql =>
                sql.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName)));

        // AddIdentityCore registers UserManager, RoleManager and the password hasher without
        // cookie authentication; JWT authentication is added in Phase 3.
        services.AddIdentityCore<ApplicationUser>(options =>
            {
                options.User.RequireUniqueEmail = true;

                options.Password.RequiredLength = 8;
                options.Password.RequireDigit = true;
                options.Password.RequireLowercase = true;
                options.Password.RequireUppercase = true;
                options.Password.RequireNonAlphanumeric = true;

                // Account-aware brute-force protection: 5 wrong passwords lock the account for 15 minutes.
                options.Lockout.AllowedForNewUsers = true;
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
            })
            .AddRoles<ApplicationRole>()
            .AddEntityFrameworkStores<AppDbContext>();

        services.Configure<SeedOptions>(configuration.GetSection(SeedOptions.SectionName));

        services.AddHealthChecks().AddDbContextCheck<AppDbContext>("database");

        return services;
    }
}
