namespace GymManagement.Application.Interfaces;

/// <summary>
/// The caller of the current HTTP request, read from the validated JWT.
/// Services use this instead of trusting IDs sent in the request body or URL.
/// </summary>
public interface ICurrentUser
{
    bool IsAuthenticated { get; }

    /// <summary>The user's ID from the token's "sub" claim. Throws if the request is anonymous.</summary>
    Guid UserId { get; }

    string? Role { get; }

    bool IsInRole(string role);

    /// <summary>Client IP as seen by the server (after trusted forwarded-header processing).</summary>
    string? IpAddress { get; }
}

public interface IEmailSender
{
    Task SendAsync(string toEmail, string subject, string body, CancellationToken ct = default);
}
