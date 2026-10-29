namespace GymManagement.Application.Interfaces;

/// <summary>
/// Current time for business rules. The gym's calendar date ("today") is in the gym's time zone
/// (Asia/Kolkata by default), not UTC: at 2 AM IST it is already the next day in India but not in UTC.
/// </summary>
public interface IGymClock
{
    DateTime UtcNow { get; }
    DateOnly Today { get; }
    DateOnly ToGymDate(DateTime utc);

    /// <summary>The UTC instant at which the given gym-local date begins (for date-range filters).</summary>
    DateTime StartOfGymDayUtc(DateOnly date);
}

/// <summary>Records sensitive actions. The entry is saved with the next SaveChanges of the request.</summary>
public interface IAuditService
{
    void Record(string action, string entityType, object entityId, object? details = null);
}
