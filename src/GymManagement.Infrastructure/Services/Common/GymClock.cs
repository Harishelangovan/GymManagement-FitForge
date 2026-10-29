using GymManagement.Application.Interfaces;
using Microsoft.Extensions.Options;

namespace GymManagement.Infrastructure.Services.Common;

/// <summary>Bound from the "Gym" configuration section.</summary>
public sealed class GymOptions
{
    public const string SectionName = "Gym";

    /// <summary>IANA time zone ID. .NET resolves it on Windows and Linux.</summary>
    public string TimeZone { get; set; } = "Asia/Kolkata";
}

public sealed class GymClock(TimeProvider timeProvider, IOptions<GymOptions> options) : IGymClock
{
    private readonly TimeZoneInfo _timeZone = TimeZoneInfo.FindSystemTimeZoneById(options.Value.TimeZone);

    public DateTime UtcNow => timeProvider.GetUtcNow().UtcDateTime;

    public DateOnly Today => ToGymDate(UtcNow);

    public DateOnly ToGymDate(DateTime utc) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), _timeZone));

    public DateTime StartOfGymDayUtc(DateOnly date) =>
        TimeZoneInfo.ConvertTimeToUtc(date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified), _timeZone);
}
