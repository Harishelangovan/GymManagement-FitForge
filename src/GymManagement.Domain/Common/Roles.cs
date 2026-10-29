namespace GymManagement.Domain.Common;

/// <summary>Role names used by Identity, JWT role claims and authorization policies.</summary>
public static class Roles
{
    public const string Admin = "Admin";
    public const string Trainer = "Trainer";
    public const string Member = "Member";

    public static readonly IReadOnlyList<string> All = [Admin, Trainer, Member];
}
