using GymManagement.Application.Common.Exceptions;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace GymManagement.Api.Middleware;

/// <summary>
/// Turns exceptions into RFC 7807 ProblemDetails responses. Expected errors (AppException subtypes)
/// return their safe message; anything else returns a generic 500 with only a traceId, so stack traces
/// and SQL errors never reach the client. Full details go to the server log.
/// </summary>
public sealed class GlobalExceptionHandler(
    IProblemDetailsService problemDetailsService,
    ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken ct)
    {
        var (status, title) = exception switch
        {
            RequestValidationException => (StatusCodes.Status400BadRequest, "Validation failed"),
            BusinessRuleException => (StatusCodes.Status400BadRequest, "Request could not be completed"),
            AuthenticationFailedException => (StatusCodes.Status401Unauthorized, "Unauthorized"),
            ForbiddenException => (StatusCodes.Status403Forbidden, "Forbidden"),
            NotFoundException => (StatusCodes.Status404NotFound, "Not found"),
            ConflictException => (StatusCodes.Status409Conflict, "Conflict"),
            _ => (StatusCodes.Status500InternalServerError, "An unexpected error occurred")
        };

        if (status == StatusCodes.Status500InternalServerError)
        {
            logger.LogError(exception, "Unhandled exception for {Method} {Path}",
                httpContext.Request.Method, httpContext.Request.Path);
        }

        ProblemDetails problem = exception is RequestValidationException validation
            ? new ValidationProblemDetails(validation.Errors)
            : new ProblemDetails();

        problem.Status = status;
        problem.Title = title;
        problem.Detail = status == StatusCodes.Status500InternalServerError ? null : exception.Message;

        httpContext.Response.StatusCode = status;
        return await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = problem
        });
    }
}
