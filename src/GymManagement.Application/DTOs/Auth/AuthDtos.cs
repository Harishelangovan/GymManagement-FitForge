namespace GymManagement.Application.DTOs.Auth;

// ---------- Requests ----------
// Note: RegisterRequest has no Role property. Public registration always creates a Member,
// and any "role" field a client sends is simply ignored by model binding (over-posting protection).

public sealed record RegisterRequest(
    string FirstName,
    string LastName,
    string Email,
    string Password,
    string ConfirmPassword,
    string? PhoneNumber);

public sealed record LoginRequest(string Email, string Password);

public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword, string ConfirmNewPassword);

public sealed record ForgotPasswordRequest(string Email);

public sealed record ResetPasswordRequest(string Email, string Token, string NewPassword, string ConfirmNewPassword);

// ---------- Responses ----------

public sealed record CurrentUserDto(
    Guid Id,
    string Email,
    string FirstName,
    string LastName,
    string Role,
    int? MemberProfileId,
    int? TrainerProfileId);

/// <summary>Returned to the client. The refresh token is NOT here: it travels only in an HttpOnly cookie.</summary>
public sealed record AuthResponse(string AccessToken, DateTime AccessTokenExpiresUtc, CurrentUserDto User);

/// <summary>
/// Internal result from IAuthService: the response body plus the raw refresh token,
/// which the controller writes to the cookie and never puts in a response body.
/// </summary>
public sealed record AuthResult(AuthResponse Response, string RefreshToken, DateTime RefreshTokenExpiresUtc);
