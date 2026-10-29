namespace GymManagement.Infrastructure.Data.Seed;

/// <summary>
/// Bound from the "Seed" configuration section. Passwords must come from user secrets or
/// environment variables, never from appsettings files committed to Git.
/// </summary>
public class SeedOptions
{
    public const string SectionName = "Seed";

    /// <summary>Apply pending EF Core migrations when the app starts (development convenience).</summary>
    public bool ApplyMigrationsOnStartup { get; set; }

    public string? AdminEmail { get; set; }
    public string? AdminPassword { get; set; }

    /// <summary>Create demo trainers, members, plans, classes etc. (development only).</summary>
    public bool SeedDemoData { get; set; }

    /// <summary>Password given to every demo trainer and member account.</summary>
    public string? DemoPassword { get; set; }
}
