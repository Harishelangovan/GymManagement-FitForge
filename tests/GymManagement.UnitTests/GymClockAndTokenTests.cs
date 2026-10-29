using GymManagement.Infrastructure.Identity;
using GymManagement.Infrastructure.Services.Common;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Time.Testing;

namespace GymManagement.UnitTests;

public class GymClockTests
{
    private static GymClock ClockAt(DateTimeOffset utc) =>
        new(new FakeTimeProvider(utc), Options.Create(new GymOptions { TimeZone = "Asia/Kolkata" }));

    [Fact]
    public void Today_uses_the_gym_calendar_not_UTC()
    {
        // 20:00 UTC on 29 Oct is 01:30 IST on 30 Oct.
        var clock = ClockAt(new DateTimeOffset(2026, 10, 29, 20, 0, 0, TimeSpan.Zero));

        Assert.Equal(new DateOnly(2026, 10, 30), clock.Today);
    }

    [Fact]
    public void StartOfGymDayUtc_is_midnight_IST_in_UTC()
    {
        var clock = ClockAt(DateTimeOffset.UtcNow);

        // Midnight IST on 30 Oct = 18:30 UTC on 29 Oct.
        Assert.Equal(new DateTime(2026, 10, 29, 18, 30, 0, DateTimeKind.Utc), clock.StartOfGymDayUtc(new DateOnly(2026, 10, 30)));
    }

    [Fact]
    public void ToGymDate_and_StartOfGymDayUtc_round_trip()
    {
        var clock = ClockAt(DateTimeOffset.UtcNow);
        var day = new DateOnly(2027, 1, 1);

        Assert.Equal(day, clock.ToGymDate(clock.StartOfGymDayUtc(day)));
        Assert.Equal(day.AddDays(-1), clock.ToGymDate(clock.StartOfGymDayUtc(day).AddTicks(-1)));
    }
}

public class RefreshTokenHashTests
{
    [Fact]
    public void Hash_is_a_deterministic_64_character_hex_SHA256()
    {
        var first = RefreshTokenService.Hash("token-value");
        var second = RefreshTokenService.Hash("token-value");

        Assert.Equal(first, second);
        Assert.Equal(64, first.Length);
        Assert.Matches("^[0-9A-F]{64}$", first);
        Assert.NotEqual(first, RefreshTokenService.Hash("token-valuf"));
    }
}
