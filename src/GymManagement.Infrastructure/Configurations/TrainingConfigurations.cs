using GymManagement.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymManagement.Infrastructure.Configurations;

public class WorkoutPlanConfiguration : IEntityTypeConfiguration<WorkoutPlan>
{
    public void Configure(EntityTypeBuilder<WorkoutPlan> builder)
    {
        builder.ToTable("WorkoutPlans", t =>
            t.HasCheckConstraint("CK_WorkoutPlans_Dates", "[EndDate] IS NULL OR [EndDate] >= [StartDate]"));

        builder.HasOne(w => w.MemberProfile)
            .WithMany(m => m.WorkoutPlans)
            .HasForeignKey(w => w.MemberProfileId);

        builder.HasOne(w => w.TrainerProfile)
            .WithMany(t => t.WorkoutPlans)
            .HasForeignKey(w => w.TrainerProfileId);

        builder.Property(w => w.Title).HasMaxLength(150).IsRequired();
        builder.Property(w => w.Goal).HasMaxLength(500);

        builder.HasIndex(w => new { w.MemberProfileId, w.IsActive });
        builder.HasIndex(w => w.TrainerProfileId);
    }
}

public class WorkoutExerciseConfiguration : IEntityTypeConfiguration<WorkoutExercise>
{
    public void Configure(EntityTypeBuilder<WorkoutExercise> builder)
    {
        builder.ToTable("WorkoutExercises", t =>
        {
            t.HasCheckConstraint("CK_WorkoutExercises_Sets", "[Sets] > 0 AND [Sets] <= 20");
            t.HasCheckConstraint("CK_WorkoutExercises_Reps", "[Reps] > 0 AND [Reps] <= 200");
            t.HasCheckConstraint("CK_WorkoutExercises_RestSeconds", "[RestSeconds] >= 0 AND [RestSeconds] <= 900");
        });

        // Exercises belong entirely to their plan, so deleting a plan deletes its exercises.
        builder.HasOne(e => e.WorkoutPlan)
            .WithMany(w => w.Exercises)
            .HasForeignKey(e => e.WorkoutPlanId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Property(e => e.Name).HasMaxLength(150).IsRequired();
        builder.Property(e => e.WeightKg).HasPrecision(6, 2);
        builder.Property(e => e.Notes).HasMaxLength(500);

        builder.HasIndex(e => new { e.WorkoutPlanId, e.DayOfWeek, e.SortOrder });
    }
}

public class DietPlanConfiguration : IEntityTypeConfiguration<DietPlan>
{
    public void Configure(EntityTypeBuilder<DietPlan> builder)
    {
        builder.ToTable("DietPlans", t =>
        {
            t.HasCheckConstraint("CK_DietPlans_DailyCalories", "[DailyCalories] > 0 AND [DailyCalories] <= 10000");
            t.HasCheckConstraint("CK_DietPlans_ProteinGrams", "[ProteinGrams] >= 0 AND [ProteinGrams] <= 1000");
        });

        builder.HasOne(d => d.MemberProfile)
            .WithMany(m => m.DietPlans)
            .HasForeignKey(d => d.MemberProfileId);

        builder.HasOne(d => d.TrainerProfile)
            .WithMany(t => t.DietPlans)
            .HasForeignKey(d => d.TrainerProfileId);

        builder.Property(d => d.Title).HasMaxLength(150).IsRequired();
        builder.Property(d => d.Breakfast).HasMaxLength(1000).IsRequired();
        builder.Property(d => d.Lunch).HasMaxLength(1000).IsRequired();
        builder.Property(d => d.Dinner).HasMaxLength(1000).IsRequired();
        builder.Property(d => d.Snacks).HasMaxLength(1000);
        builder.Property(d => d.Notes).HasMaxLength(1000);

        builder.HasIndex(d => new { d.MemberProfileId, d.IsActive });
        builder.HasIndex(d => d.TrainerProfileId);
    }
}
