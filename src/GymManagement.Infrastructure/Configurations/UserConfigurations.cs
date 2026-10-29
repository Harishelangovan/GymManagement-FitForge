using GymManagement.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymManagement.Infrastructure.Configurations;

public class ApplicationUserConfiguration : IEntityTypeConfiguration<ApplicationUser>
{
    public void Configure(EntityTypeBuilder<ApplicationUser> builder)
    {
        builder.Property(u => u.FirstName).HasMaxLength(100).IsRequired();
        builder.Property(u => u.LastName).HasMaxLength(100).IsRequired();
        builder.Property(u => u.IsActive).HasDefaultValue(true);

        // FullName is computed in C#, not stored.
        builder.Ignore(u => u.FullName);
    }
}

public class MemberProfileConfiguration : IEntityTypeConfiguration<MemberProfile>
{
    public void Configure(EntityTypeBuilder<MemberProfile> builder)
    {
        builder.ToTable("MemberProfiles", t =>
        {
            t.HasCheckConstraint("CK_MemberProfiles_HeightCm", "[HeightCm] IS NULL OR ([HeightCm] > 0 AND [HeightCm] < 300)");
            t.HasCheckConstraint("CK_MemberProfiles_WeightKg", "[WeightKg] IS NULL OR ([WeightKg] > 0 AND [WeightKg] < 500)");
        });

        builder.HasOne(m => m.User)
            .WithOne(u => u.MemberProfile)
            .HasForeignKey<MemberProfile>(m => m.UserId);

        builder.HasIndex(m => m.UserId).IsUnique();

        builder.HasOne(m => m.AssignedTrainer)
            .WithMany(t => t.AssignedMembers)
            .HasForeignKey(m => m.AssignedTrainerId);

        builder.HasIndex(m => m.AssignedTrainerId);

        builder.Property(m => m.HeightCm).HasPrecision(5, 2);
        builder.Property(m => m.WeightKg).HasPrecision(5, 2);
        builder.Property(m => m.FitnessGoal).HasMaxLength(500);
        builder.Property(m => m.EmergencyContactName).HasMaxLength(150);
        builder.Property(m => m.EmergencyContactPhone).HasMaxLength(20);
    }
}

public class TrainerProfileConfiguration : IEntityTypeConfiguration<TrainerProfile>
{
    public void Configure(EntityTypeBuilder<TrainerProfile> builder)
    {
        builder.ToTable("TrainerProfiles", t =>
            t.HasCheckConstraint("CK_TrainerProfiles_YearsOfExperience", "[YearsOfExperience] >= 0 AND [YearsOfExperience] <= 60"));

        builder.HasOne(t => t.User)
            .WithOne(u => u.TrainerProfile)
            .HasForeignKey<TrainerProfile>(t => t.UserId);

        builder.HasIndex(t => t.UserId).IsUnique();

        builder.Property(t => t.Specialization).HasMaxLength(150).IsRequired();
        builder.Property(t => t.Bio).HasMaxLength(1000);
    }
}

public class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> builder)
    {
        builder.HasOne(r => r.User)
            .WithMany(u => u.RefreshTokens)
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // SHA-256 hex string is always 64 characters.
        builder.Property(r => r.TokenHash).HasMaxLength(64).IsFixedLength().IsRequired();
        builder.Property(r => r.ReplacedByTokenHash).HasMaxLength(64).IsFixedLength();
        builder.Property(r => r.CreatedByIp).HasMaxLength(45); // fits IPv6

        builder.HasIndex(r => r.TokenHash).IsUnique();
        builder.HasIndex(r => new { r.UserId, r.FamilyId });
    }
}

public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> builder)
    {
        // ActorUserId is deliberately not a foreign key: audit history must survive any change to users.
        builder.Property(a => a.Action).HasMaxLength(100).IsRequired();
        builder.Property(a => a.EntityType).HasMaxLength(100).IsRequired();
        builder.Property(a => a.EntityId).HasMaxLength(64).IsRequired();
        builder.Property(a => a.Details).HasMaxLength(4000);
        builder.Property(a => a.IpAddress).HasMaxLength(45);

        builder.HasIndex(a => a.CreatedUtc);
        builder.HasIndex(a => new { a.EntityType, a.EntityId });
        builder.HasIndex(a => a.ActorUserId);
    }
}
