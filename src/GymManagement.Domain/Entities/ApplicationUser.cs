using Microsoft.AspNetCore.Identity;

namespace GymManagement.Domain.Entities;

/// <summary>
/// Login account (ASP.NET Core Identity). Email, password hash, lockout and security stamp
/// come from IdentityUser; the profile tables hold role-specific details.
/// </summary>
public class ApplicationUser : IdentityUser<Guid>
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;

    /// <summary>Deactivated users cannot log in. Users are never hard-deleted.</summary>
    public bool IsActive { get; set; } = true;

    public DateTime CreatedUtc { get; set; }

    public MemberProfile? MemberProfile { get; set; }
    public TrainerProfile? TrainerProfile { get; set; }
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();

    public string FullName => $"{FirstName} {LastName}".Trim();
}

public class ApplicationRole : IdentityRole<Guid>
{
    public ApplicationRole() { }

    public ApplicationRole(string roleName) : base(roleName) { }
}
