using GymManagement.Application.Common;
using GymManagement.Application.Common.Exceptions;
using GymManagement.Application.DTOs.People;
using GymManagement.Application.Interfaces;
using GymManagement.Domain.Entities;
using GymManagement.Infrastructure.Data;
using GymManagement.Infrastructure.Identity;
using GymManagement.Infrastructure.Services.Common;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace GymManagement.Infrastructure.Services;

/// <summary>Admin-only account management (the controller applies the AdminOnly policy).</summary>
public sealed class UserService(
    AppDbContext db,
    UserManager<ApplicationUser> userManager,
    RefreshTokenService refreshTokens,
    ICurrentUser currentUser,
    IAuditService audit,
    IGymClock clock) : IUserService
{
    public async Task<PagedResult<UserListItemDto>> ListAsync(UserQuery query, CancellationToken ct = default)
    {
        var rows =
            from user in db.Users.AsNoTracking()
            join userRole in db.UserRoles on user.Id equals userRole.UserId
            join role in db.Roles on userRole.RoleId equals role.Id
            select new { User = user, Role = role.Name! };

        if (!string.IsNullOrWhiteSpace(query.Role))
        {
            rows = rows.Where(x => x.Role == query.Role);
        }

        if (query.IsActive is bool isActive)
        {
            rows = rows.Where(x => x.User.IsActive == isActive);
        }

        if (query.SearchTerm is { } search)
        {
            rows = rows.Where(x => x.User.FirstName.Contains(search)
                                   || x.User.LastName.Contains(search)
                                   || x.User.Email!.Contains(search));
        }

        var sorted = query.SortBy?.ToLowerInvariant() switch
        {
            "email" => rows.OrderByDirection(x => x.User.Email, query.Descending),
            "role" => rows.OrderByDirection(x => x.Role, query.Descending),
            "created" => rows.OrderByDirection(x => x.User.CreatedUtc, query.Descending),
            _ => rows.OrderByDirection(x => x.User.LastName, query.Descending).ThenBy(x => x.User.FirstName)
        };

        var now = new DateTimeOffset(clock.UtcNow);
        return await sorted
            .ThenBy(x => x.User.Id)
            .Select(x => new UserListItemDto(
                x.User.Id, x.User.Email!, x.User.FirstName, x.User.LastName, x.User.PhoneNumber, x.Role,
                x.User.IsActive, x.User.LockoutEnd != null && x.User.LockoutEnd > now, x.User.CreatedUtc))
            .ToPagedResultAsync(query, ct);
    }

    public async Task<UserListItemDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var user = await userManager.FindByIdAsync(id.ToString()) ?? throw new NotFoundException("User", id);
        var roles = await userManager.GetRolesAsync(user);
        var lockedOut = user.LockoutEnd is { } end && end > new DateTimeOffset(clock.UtcNow);

        return new UserListItemDto(user.Id, user.Email!, user.FirstName, user.LastName, user.PhoneNumber,
            roles.FirstOrDefault() ?? string.Empty, user.IsActive, lockedOut, user.CreatedUtc);
    }

    public async Task<UserListItemDto> SetStatusAsync(Guid id, UpdateUserStatusRequest request, CancellationToken ct = default)
    {
        if (id == currentUser.UserId)
        {
            throw new BusinessRuleException("You cannot change the status of your own account.");
        }

        var user = await userManager.FindByIdAsync(id.ToString()) ?? throw new NotFoundException("User", id);

        if (user.IsActive != request.IsActive)
        {
            user.IsActive = request.IsActive;
            audit.Record(request.IsActive ? "user.activated" : "user.deactivated", "User", user.Id, new { user.Email });

            var result = await userManager.UpdateAsync(user); // also saves the audit entry (same DbContext)
            if (!result.Succeeded)
            {
                throw new InvalidOperationException(string.Join("; ", result.Errors.Select(e => e.Description)));
            }

            if (!request.IsActive)
            {
                // Deactivation takes effect immediately for refresh; existing access tokens expire within 15 minutes.
                await refreshTokens.RevokeAllForUserAsync(user.Id, ct);
            }
        }

        return await GetAsync(id, ct);
    }
}
