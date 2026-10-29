namespace GymManagement.IntegrationTests.Infrastructure;

/// <summary>
/// Builders for test data created through the API itself (never directly in the database), so every test
/// owns its data and tests can run in parallel without affecting each other.
/// </summary>
public static class Scenario
{
    /// <summary>Admin creates a trainer with a unique email; returns the trainer profile id.</summary>
    public static async Task<int> CreateTrainerAsync(HttpClient admin)
    {
        var response = await admin.PostJsonAsync("/api/trainers", new
        {
            firstName = "Coach",
            lastName = Guid.NewGuid().ToString("N")[..8],
            email = $"coach.{Guid.NewGuid():N}@fitforge.test",
            temporaryPassword = "Temp!Pass1",
            specialization = "Testing",
            yearsOfExperience = 2
        });
        response.EnsureSuccessStatusCode();
        return (await response.ReadAsync<IdOnly>()).Id;
    }

    /// <summary>Admin sells the cheapest active plan to the member, starting today. Returns the membership id.</summary>
    public static async Task<int> GiveActiveMembershipAsync(HttpClient admin, int memberProfileId)
    {
        var plans = await (await admin.GetAsync("/api/membership-plans")).ReadAsync<List<IdOnly>>();
        var response = await admin.PostJsonAsync("/api/memberships", new { memberProfileId, membershipPlanId = plans[0].Id });
        response.EnsureSuccessStatusCode();
        return (await response.ReadAsync<IdOnly>()).Id;
    }

    /// <summary>Admin schedules a class for the given trainer, starting <paramref name="startsIn"/> from now.</summary>
    public static async Task<int> CreateClassAsync(HttpClient admin, int trainerProfileId, TimeSpan startsIn, int capacity = 10)
    {
        var start = DateTime.UtcNow.Add(startsIn);
        var response = await admin.PostJsonAsync("/api/classes", new
        {
            title = $"Test class {Guid.NewGuid():N}"[..20],
            startUtc = start,
            endUtc = start.AddMinutes(45),
            capacity,
            location = "Test studio",
            trainerProfileId
        });
        response.EnsureSuccessStatusCode();
        return (await response.ReadAsync<IdOnly>()).Id;
    }
}
