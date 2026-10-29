using GymManagement.Application.Common.Exceptions;
using GymManagement.Domain.Entities;
using Microsoft.AspNetCore.Identity;

namespace GymManagement.Infrastructure.Services.Common;

/// <summary>
/// Creates a login account with exactly one role. Used when an admin creates members and trainers.
/// The caller wraps it in a transaction together with the profile row.
/// </summary>
public sealed class UserAccountFactory(UserManager<ApplicationUser> userManager)
{
    public async Task<ApplicationUser> CreateAsync(
        string firstName, string lastName, string email, string? phoneNumber, string password, string role)
    {
        email = email.Trim();
        if (await userManager.FindByEmailAsync(email) is not null)
        {
            throw new ConflictException("An account with this email already exists.");
        }

        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            FirstName = firstName.Trim(),
            LastName = lastName.Trim(),
            PhoneNumber = string.IsNullOrWhiteSpace(phoneNumber) ? null : phoneNumber.Trim()
        };

        var created = await userManager.CreateAsync(user, password);
        if (!created.Succeeded)
        {
            if (created.Errors.Any(e => e.Code is "DuplicateEmail" or "DuplicateUserName"))
            {
                throw new ConflictException("An account with this email already exists.");
            }

            throw new RequestValidationException(new Dictionary<string, string[]>
            {
                ["temporaryPassword"] = created.Errors.Select(e => e.Description).ToArray()
            });
        }

        var roleResult = await userManager.AddToRoleAsync(user, role);
        if (!roleResult.Succeeded)
        {
            throw new InvalidOperationException(string.Join("; ", roleResult.Errors.Select(e => e.Description)));
        }

        return user;
    }
}
