using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace GymManagement.Api.Filters;

/// <summary>
/// CSRF protection for the cookie-authenticated endpoints (/api/auth/refresh and /api/auth/logout).
/// A cross-site HTML form or image tag cannot add custom headers, and a cross-site fetch() with a custom
/// header needs a CORS preflight that our CORS policy rejects. Together with SameSite=Strict on the cookie,
/// this stops another website from triggering these endpoints with the user's cookie.
/// </summary>
[AttributeUsage(AttributeTargets.Method)]
public sealed class RequireClientHeaderAttribute : Attribute, IAuthorizationFilter
{
    public const string HeaderName = "X-FitForge-Client";
    public const string ExpectedValue = "web";

    public void OnAuthorization(AuthorizationFilterContext context)
    {
        if (context.HttpContext.Request.Headers[HeaderName] != ExpectedValue)
        {
            context.Result = new ObjectResult(new ProblemDetails
            {
                Status = StatusCodes.Status403Forbidden,
                Title = "Forbidden",
                Detail = $"Missing or invalid {HeaderName} header."
            })
            { StatusCode = StatusCodes.Status403Forbidden };
        }
    }
}
