using GymManagement.Application.Common;
using GymManagement.Domain.Enums;

namespace GymManagement.Application.DTOs.People;

// ---------- Users (admin account management) ----------

public sealed class UserQuery : PageQuery
{
    public string? Role { get; set; }
    public bool? IsActive { get; set; }
}

public sealed record UserListItemDto(
    Guid Id,
    string Email,
    string FirstName,
    string LastName,
    string? PhoneNumber,
    string Role,
    bool IsActive,
    bool IsLockedOut,
    DateTime CreatedUtc);

public sealed record UpdateUserStatusRequest(bool IsActive);

// ---------- Members ----------

public sealed class MemberQuery : PageQuery
{
    public int? TrainerId { get; set; }
    public bool? IsActive { get; set; }
}

public sealed record MembershipSummaryDto(
    int Id,
    string PlanName,
    DateOnly StartDate,
    DateOnly EndDate,
    MembershipState State,
    int DaysRemaining);

public sealed record MemberListItemDto(
    int Id,
    Guid UserId,
    string FirstName,
    string LastName,
    string Email,
    string? PhoneNumber,
    bool IsActive,
    DateOnly JoinedOn,
    int? AssignedTrainerId,
    string? AssignedTrainerName,
    MembershipSummaryDto? CurrentMembership);

public sealed record MemberDetailDto(
    int Id,
    Guid UserId,
    string FirstName,
    string LastName,
    string Email,
    string? PhoneNumber,
    bool IsActive,
    DateOnly JoinedOn,
    DateOnly? DateOfBirth,
    Gender? Gender,
    decimal? HeightCm,
    decimal? WeightKg,
    string? FitnessGoal,
    string? EmergencyContactName,
    string? EmergencyContactPhone,
    int? AssignedTrainerId,
    string? AssignedTrainerName,
    MembershipSummaryDto? CurrentMembership);

/// <summary>
/// Fields a member may change about themselves (and an admin may change for them).
/// Email, role, trainer assignment and active status are deliberately absent.
/// </summary>
public sealed record UpdateMemberProfileRequest(
    string FirstName,
    string LastName,
    string? PhoneNumber,
    DateOnly? DateOfBirth,
    Gender? Gender,
    decimal? HeightCm,
    decimal? WeightKg,
    string? FitnessGoal,
    string? EmergencyContactName,
    string? EmergencyContactPhone);

/// <summary>Admin creates a member at the front desk with a temporary password.</summary>
public sealed record CreateMemberRequest(
    string FirstName,
    string LastName,
    string Email,
    string? PhoneNumber,
    string TemporaryPassword,
    int? AssignedTrainerId);

public sealed record AssignTrainerRequest(int? TrainerProfileId);

// ---------- Trainers ----------

public sealed class TrainerQuery : PageQuery
{
    public bool? IsAcceptingMembers { get; set; }
    public bool? IsActive { get; set; }
}

/// <summary>PhoneNumber is only filled in for admins.</summary>
public sealed record TrainerDto(
    int Id,
    Guid UserId,
    string FirstName,
    string LastName,
    string Email,
    string? PhoneNumber,
    string Specialization,
    string? Bio,
    int YearsOfExperience,
    bool IsAcceptingMembers,
    bool IsActive,
    int AssignedMemberCount);

public sealed record CreateTrainerRequest(
    string FirstName,
    string LastName,
    string Email,
    string? PhoneNumber,
    string TemporaryPassword,
    string Specialization,
    string? Bio,
    int YearsOfExperience);

public sealed record UpdateTrainerRequest(
    string FirstName,
    string LastName,
    string? PhoneNumber,
    string Specialization,
    string? Bio,
    int YearsOfExperience,
    bool IsAcceptingMembers);
