namespace GymManagement.Domain.Enums;

// Enums are stored as int columns. Explicit values keep the database stable if members are reordered.

public enum Gender
{
    Male = 0,
    Female = 1,
    Other = 2,
    PreferNotToSay = 3
}

/// <summary>"Expired" is not stored: it is derived from Membership.EndDate so it can never go stale.</summary>
public enum MembershipStatus
{
    Active = 0,
    Cancelled = 1
}

public enum PaymentMethod
{
    Cash = 0,
    Card = 1,
    Upi = 2,
    BankTransfer = 3
}

public enum BookingStatus
{
    Booked = 0,
    Cancelled = 1
}
