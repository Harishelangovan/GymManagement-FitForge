using GymManagement.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymManagement.Infrastructure.Configurations;

public class MembershipPlanConfiguration : IEntityTypeConfiguration<MembershipPlan>
{
    public void Configure(EntityTypeBuilder<MembershipPlan> builder)
    {
        builder.ToTable("MembershipPlans", t =>
        {
            t.HasCheckConstraint("CK_MembershipPlans_DurationDays", "[DurationDays] > 0 AND [DurationDays] <= 1825");
            t.HasCheckConstraint("CK_MembershipPlans_Price", "[Price] >= 0");
        });

        builder.Property(p => p.Name).HasMaxLength(100).IsRequired();
        builder.Property(p => p.Description).HasMaxLength(500);
        builder.Property(p => p.Price).HasPrecision(10, 2);

        builder.HasIndex(p => p.Name).IsUnique();
    }
}

public class MembershipConfiguration : IEntityTypeConfiguration<Membership>
{
    public void Configure(EntityTypeBuilder<Membership> builder)
    {
        builder.ToTable("Memberships", t =>
        {
            t.HasCheckConstraint("CK_Memberships_Dates", "[EndDate] >= [StartDate]");
            t.HasCheckConstraint("CK_Memberships_PriceAtPurchase", "[PriceAtPurchase] >= 0");
        });

        builder.HasOne(m => m.MemberProfile)
            .WithMany(p => p.Memberships)
            .HasForeignKey(m => m.MemberProfileId);

        builder.HasOne(m => m.MembershipPlan)
            .WithMany(p => p.Memberships)
            .HasForeignKey(m => m.MembershipPlanId);

        builder.Property(m => m.PriceAtPurchase).HasPrecision(10, 2);

        // "Current membership for member X" and "memberships expiring soon" both filter on these columns.
        builder.HasIndex(m => new { m.MemberProfileId, m.EndDate });
        builder.HasIndex(m => m.EndDate);
    }
}

public class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> builder)
    {
        builder.ToTable("Payments", t => t.HasCheckConstraint("CK_Payments_Amount", "[Amount] > 0"));

        builder.HasOne(p => p.Membership)
            .WithMany(m => m.Payments)
            .HasForeignKey(p => p.MembershipId);

        builder.HasOne(p => p.MemberProfile)
            .WithMany(m => m.Payments)
            .HasForeignKey(p => p.MemberProfileId);

        builder.HasOne(p => p.RecordedBy)
            .WithMany()
            .HasForeignKey(p => p.RecordedByUserId);

        builder.Property(p => p.Amount).HasPrecision(10, 2);
        builder.Property(p => p.ReferenceNumber).HasMaxLength(100);
        builder.Property(p => p.Notes).HasMaxLength(500);

        builder.HasIndex(p => new { p.MemberProfileId, p.PaidUtc });
        builder.HasIndex(p => p.PaidUtc);
    }
}
