using GymManagement.Domain.Common;
using GymManagement.Domain.Enums;

namespace GymManagement.Domain.Entities;

/// <summary>One dated class session (e.g. "HIIT, Mon 7:00–7:45 AM") led by one trainer.</summary>
public class FitnessClass : AuditableEntity
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }

    public int TrainerProfileId { get; set; }
    public TrainerProfile TrainerProfile { get; set; } = null!;

    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public int Capacity { get; set; }
    public string Location { get; set; } = string.Empty;
    public bool IsCancelled { get; set; }

    public ICollection<ClassBooking> Bookings { get; set; } = new List<ClassBooking>();
    public ICollection<Attendance> Attendances { get; set; } = new List<Attendance>();
}

public class ClassBooking : BaseEntity
{
    public int FitnessClassId { get; set; }
    public FitnessClass FitnessClass { get; set; } = null!;

    public int MemberProfileId { get; set; }
    public MemberProfile MemberProfile { get; set; } = null!;

    public BookingStatus Status { get; set; } = BookingStatus.Booked;
    public DateTime BookedUtc { get; set; }
    public DateTime? CancelledUtc { get; set; }
}

/// <summary>A check-in. FitnessClassId is null for a general gym visit.</summary>
public class Attendance : BaseEntity
{
    public int MemberProfileId { get; set; }
    public MemberProfile MemberProfile { get; set; } = null!;

    public int? FitnessClassId { get; set; }
    public FitnessClass? FitnessClass { get; set; }

    public DateTime CheckInUtc { get; set; }

    public Guid MarkedByUserId { get; set; }
    public ApplicationUser MarkedBy { get; set; } = null!;
}
