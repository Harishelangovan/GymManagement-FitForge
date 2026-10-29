using System.Security.Claims;
using GymManagement.Application.Common.Exceptions;
using GymManagement.Application.Interfaces;
using GymManagement.Infrastructure.Identity;
using Microsoft.IdentityModel.JsonWebTokens;

namespace GymManagement.Api.Authorization;

/// <summary>Reads the caller's identity from the JWT that the authentication middleware already validated.</summary>
public sealed class CurrentUser(IHttpContextAccessor httpContextAccessor) : ICurrentUser
{
    private ClaimsPrincipal? Principal => httpContextAccessor.HttpContext?.User;

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated == true;

    public Guid UserId =>
        Guid.TryParse(Principal?.FindFirstValue(JwtRegisteredClaimNames.Sub), out var id)
            ? id
            : throw new AuthenticationFailedException("You are not signed in.");

    public string? Role => Principal?.FindFirstValue(JwtTokenGenerator.RoleClaimType);

    public bool IsInRole(string role) => Principal?.IsInRole(role) == true;

    public string? IpAddress => httpContextAccessor.HttpContext?.Connection.RemoteIpAddress?.ToString();
}
