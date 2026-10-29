using GymManagement.Domain.Entities;
using GymManagement.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymManagement.Infrastructure.Configurations;

public class FitnessClassConfiguration : IEntityTypeConfiguration<FitnessClass>
{
    public void Configure(EntityTypeBuilder<FitnessClass> builder)
    {
        builder.ToTable("FitnessClasses", t =>
        {
            t.HasCheckConstraint("CK_FitnessClasses_Times", "[EndUtc] > [StartUtc]");
            t.HasCheckConstraint("CK_FitnessClasses_Capacity", "[Capacity] > 0 AND [Capacity] <= 500");
        });

        builder.HasOne(c => c.TrainerProfile)
            .WithMany(t => t.FitnessClasses)
            .HasForeignKey(c => c.TrainerProfileId);

        builder.Property(c => c.Title).HasMaxLength(150).IsRequired();
        builder.Property(c => c.Description).HasMaxLength(1000);
        builder.Property(c => c.Location).HasMaxLength(100).IsRequired();

        builder.HasIndex(c => c.StartUtc);
        builder.HasIndex(c => new { c.TrainerProfileId, c.StartUtc });
    }
}

public class ClassBookingConfiguration : IEntityTypeConfiguration<ClassBooking>
{
    public void Configure(EntityTypeBuilder<ClassBooking> builder)
    {
        builder.HasOne(b => b.FitnessClass)
            .WithMany(c => c.Bookings)
            .HasForeignKey(b => b.FitnessClassId);

        builder.HasOne(b => b.MemberProfile)
            .WithMany(m => m.ClassBookings)
            .HasForeignKey(b => b.MemberProfileId);

        // A member can hold only one *active* booking per class, but may cancel and book again.
        builder.HasIndex(b => new { b.FitnessClassId, b.MemberProfileId })
            .IsUnique()
            .HasFilter($"[Status] = {(int)BookingStatus.Booked}")
            .HasDatabaseName("UX_ClassBookings_ActiveBooking");

        builder.HasIndex(b => new { b.MemberProfileId, b.Status });
    }
}

public class AttendanceConfiguration : IEntityTypeConfiguration<Attendance>
{
    public void Configure(EntityTypeBuilder<Attendance> builder)
    {
        builder.ToTable("Attendances");

        builder.HasOne(a => a.MemberProfile)
            .WithMany(m => m.Attendances)
            .HasForeignKey(a => a.MemberProfileId);

        builder.HasOne(a => a.FitnessClass)
            .WithMany(c => c.Attendances)
            .HasForeignKey(a => a.FitnessClassId);

        builder.HasOne(a => a.MarkedBy)
            .WithMany()
            .HasForeignKey(a => a.MarkedByUserId);

        // A member can be marked present for a given class only once.
        builder.HasIndex(a => new { a.MemberProfileId, a.FitnessClassId })
            .IsUnique()
            .HasFilter("[FitnessClassId] IS NOT NULL")
            .HasDatabaseName("UX_Attendances_MemberPerClass");

        builder.HasIndex(a => new { a.MemberProfileId, a.CheckInUtc });
        builder.HasIndex(a => a.CheckInUtc);
    }
}
