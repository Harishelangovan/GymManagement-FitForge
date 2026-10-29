using GymManagement.Domain.Common;
using GymManagement.Domain.Entities;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace GymManagement.Infrastructure.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options)
    : IdentityDbContext<ApplicationUser, ApplicationRole, Guid>(options)
{
    public DbSet<MemberProfile> MemberProfiles => Set<MemberProfile>();
    public DbSet<TrainerProfile> TrainerProfiles => Set<TrainerProfile>();
    public DbSet<MembershipPlan> MembershipPlans => Set<MembershipPlan>();
    public DbSet<Membership> Memberships => Set<Membership>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<WorkoutPlan> WorkoutPlans => Set<WorkoutPlan>();
    public DbSet<WorkoutExercise> WorkoutExercises => Set<WorkoutExercise>();
    public DbSet<DietPlan> DietPlans => Set<DietPlan>();
    public DbSet<FitnessClass> FitnessClasses => Set<FitnessClass>();
    public DbSet<ClassBooking> ClassBookings => Set<ClassBooking>();
    public DbSet<Attendance> Attendances => Set<Attendance>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    // Only these relationships may cascade. Everything else in the domain is Restrict,
    // so deleting a row can never silently wipe financial or attendance history.
    private static readonly HashSet<Type> CascadingDependents = [typeof(WorkoutExercise), typeof(RefreshToken)];

    protected override void OnModelCreating(ModelBuilder builder)
    {
        // Identity tables (AspNetUsers, AspNetRoles, ...) must be configured first.
        base.OnModelCreating(builder);

        // Picks up every IEntityTypeConfiguration<T> in Infrastructure/Configurations.
        builder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        var domainForeignKeys = builder.Model.GetEntityTypes()
            .Where(e => e.ClrType.Namespace == typeof(MemberProfile).Namespace)
            .SelectMany(e => e.GetForeignKeys())
            .Where(fk => !fk.IsOwnership && !CascadingDependents.Contains(fk.DeclaringEntityType.ClrType));

        foreach (var foreignKey in domainForeignKeys)
        {
            foreignKey.DeleteBehavior = DeleteBehavior.Restrict;
        }
    }

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        // SQL Server's datetime2 has no time-zone information, so values come back as DateTimeKind.Unspecified.
        // Every DateTime in this app is UTC, so mark it as UTC when reading. This makes JSON output end in "Z".
        configurationBuilder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
        configurationBuilder.Properties<DateTime?>().HaveConversion<NullableUtcDateTimeConverter>();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var utcNow = DateTime.UtcNow;

        foreach (var entry in ChangeTracker.Entries<AuditableEntity>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedUtc = utcNow;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Property(e => e.CreatedUtc).IsModified = false;
                entry.Entity.UpdatedUtc = utcNow;
            }
        }

        foreach (var entry in ChangeTracker.Entries<ApplicationUser>().Where(e => e.State == EntityState.Added))
        {
            entry.Entity.CreatedUtc = utcNow;
        }

        return base.SaveChangesAsync(cancellationToken);
    }

    private sealed class UtcDateTimeConverter() : ValueConverter<DateTime, DateTime>(
        toDb => toDb.Kind == DateTimeKind.Local ? toDb.ToUniversalTime() : toDb,
        fromDb => DateTime.SpecifyKind(fromDb, DateTimeKind.Utc));

    private sealed class NullableUtcDateTimeConverter() : ValueConverter<DateTime?, DateTime?>(
        toDb => toDb.HasValue && toDb.Value.Kind == DateTimeKind.Local ? toDb.Value.ToUniversalTime() : toDb,
        fromDb => fromDb.HasValue ? DateTime.SpecifyKind(fromDb.Value, DateTimeKind.Utc) : fromDb);
}
