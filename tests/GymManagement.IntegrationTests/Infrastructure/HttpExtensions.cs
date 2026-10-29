using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace GymManagement.IntegrationTests.Infrastructure;

// Minimal client-side shapes: only the fields the tests read.
public sealed record CurrentUser(Guid Id, string Email, string Role, int? MemberProfileId, int? TrainerProfileId);
public sealed record AuthResponse(string AccessToken, DateTime AccessTokenExpiresUtc, CurrentUser User);
public sealed record IdOnly(int Id);
public sealed record Problem(int Status, string? Title, string? Detail, Dictionary<string, string[]>? Errors);

public static class HttpExtensions
{
    /// <summary>The API's JSON settings: camelCase, enums as strings.</summary>
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    public static async Task<T> ReadAsync<T>(this HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<T>(Json))!;

    public static Task<HttpResponseMessage> PostJsonAsync(this HttpClient client, string url, object? body = null) =>
        client.PostAsJsonAsync(url, body, Json);

    public static Task<HttpResponseMessage> PutJsonAsync(this HttpClient client, string url, object body) =>
        client.PutAsJsonAsync(url, body, Json);

    /// <summary>POST with the header the API requires on cookie-authenticated endpoints (CSRF protection).</summary>
    public static Task<HttpResponseMessage> PostWithClientHeaderAsync(this HttpClient client, string url)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Add("X-FitForge-Client", "web");
        return client.SendAsync(request);
    }

    public static async Task<Problem> ReadProblemAsync(this HttpResponseMessage response)
    {
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        return await response.ReadAsync<Problem>();
    }
}
