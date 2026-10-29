namespace GymManagement.Application.Common.Exceptions;

/// <summary>
/// Base type for expected errors. The API's global exception handler turns each subtype into an
/// HTTP status code with a ProblemDetails body. The message is safe to show to the client.
/// </summary>
public abstract class AppException(string message) : Exception(message);

/// <summary>400 — the request breaks a business rule (e.g. "class is full").</summary>
public sealed class BusinessRuleException(string message) : AppException(message);

/// <summary>401 — wrong credentials, or an invalid/expired/revoked token.</summary>
public sealed class AuthenticationFailedException(string message = "Invalid email or password.") : AppException(message);

/// <summary>403 — authenticated, but not allowed to do this.</summary>
public sealed class ForbiddenException(string message = "You do not have permission to perform this action.") : AppException(message);

/// <summary>
/// 404 — the record does not exist, or the caller may not see it.
/// Returning 404 (not 403) for other people's records avoids confirming that an ID exists.
/// </summary>
public sealed class NotFoundException(string resource, object key)
    : AppException($"{resource} '{key}' was not found.");

/// <summary>409 — the request conflicts with existing data (e.g. duplicate email).</summary>
public sealed class ConflictException(string message) : AppException(message);

/// <summary>400 — field-level validation errors, keyed by property name.</summary>
public sealed class RequestValidationException(IDictionary<string, string[]> errors)
    : AppException("One or more validation errors occurred.")
{
    public IDictionary<string, string[]> Errors { get; } = errors;

    public RequestValidationException(string field, string error)
        : this(new Dictionary<string, string[]> { [field] = [error] }) { }
}
