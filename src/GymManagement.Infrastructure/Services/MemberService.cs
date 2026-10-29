using GymManagement.Application.Common;
using GymManagement.Application.Common.Exceptions;
using GymManagement.Application.DTOs.People;
using GymManagement.Application.Interfaces;
using GymManagement.Domain.Common;
using GymManagement.Domain.Entities;
using GymManagement.Domain.Enums;
using GymManagement.Infrastructure.Data;
using GymManagement.Infrastructure.Services.Common;
using Microsoft.EntityFrameworkCore;

namespace GymManagement.Infrastructure.Services;

public sealed class MemberService(
    AppDbContext db,
    AccessControl access,
    UserAccountFactory accounts,
    IAuditService audit,
    IGymClock clock) : IMemberService
{
    public async Task<PagedResult<MemberListItemDto>> ListAsync(MemberQuery query, CancellationToken ct = default)
    {
        var members = db.MemberProfiles.AsNoTracking();

        if (access.IsAdmin)
        {
            if (query.TrainerId is int trainerId)
            {
                members = members.Where(m => m.AssignedTrainerId == trainerId);
            }
        }
        else
        {
            // Trainers only ever see their own assigned members (the controller blocks members entirely).
            var myTrainerId = await access.GetMyTrainerProfileIdAsync(ct);
            members = members.Where(m => m.AssignedTrainerId == myTrainerId);
        }

        if (query.IsActive is bool isActive)
        {
            members = members.Where(m => m.User.IsActive == isActive);
        }

        if (query.SearchTerm is { } search)
        {
            members = members.Where(m => m.User.FirstName.Contains(search)
                                         || m.User.LastName.Contains(search)
                                         || m.User.Email!.Contains(search)
                                         || (m.User.PhoneNumber != null && m.User.PhoneNumber.Contains(search)));
        }

        var sorted = query.SortBy?.ToLowerInvariant() switch
        {
            "email" => members.OrderByDirection(m => m.User.Email, query.Descending),
            "joined" => members.OrderByDirection(m => m.JoinedOn, query.Descending),
            _ => members.OrderByDirection(m => m.User.LastName, query.Descending).ThenBy(m => m.User.FirstName)
        };

        var today = clock.Today;
        var page = await ProjectRows(sorted.ThenBy(m => m.Id), today).ToPagedResultAsync(query, ct);
        return page.Map(row => ToListItem(row, today));
    }

    public async Task<MemberDetailDto> GetAsync(int id, CancellationToken ct = default)
    {
        await access.EnsureCanViewMemberAsync(id, ct);
        return await LoadDetailAsync(id, ct);
    }

    public async Task<MemberDetailDto> GetMineAsync(CancellationToken ct = default) =>
        await LoadDetailAsync(await access.GetMyMemberProfileIdAsync(ct), ct);

    public async Task<MemberDetailDto> UpdateMineAsync(UpdateMemberProfileRequest request, CancellationToken ct = default)
    {
        var id = await access.GetMyMemberProfileIdAsync(ct);
        await ApplyProfileUpdateAsync(id, request, ct);
        await db.SaveChangesAsync(ct);
        return await LoadDetailAsync(id, ct);
    }

    public async Task<MemberDetailDto> UpdateAsync(int id, UpdateMemberProfileRequest request, CancellationToken ct = default)
    {
        await ApplyProfileUpdateAsync(id, request, ct);
        audit.Record("member.updated", nameof(MemberProfile), id);
        await db.SaveChangesAsync(ct);
        return await LoadDetailAsync(id, ct);
    }

    public async Task<MemberDetailDto> CreateAsync(CreateMemberRequest request, CancellationToken ct = default)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);

        if (request.AssignedTrainerId is int trainerId)
        {
            await EnsureTrainerAcceptsMembersAsync(trainerId, ct);
        }

        var user = await accounts.CreateAsync(request.FirstName, request.LastName, request.Email,
            request.PhoneNumber, request.TemporaryPassword, Roles.Member);

        var profile = new MemberProfile
        {
            UserId = user.Id,
            JoinedOn = clock.Today,
            AssignedTrainerId = request.AssignedTrainerId
        };
        db.MemberProfiles.Add(profile);
        await db.SaveChangesAsync(ct);

        audit.Record("member.created", nameof(MemberProfile), profile.Id, new { user.Email });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        return await LoadDetailAsync(profile.Id, ct);
    }

    public async Task<MemberDetailDto> AssignTrainerAsync(int id, AssignTrainerRequest request, CancellationToken ct = default)
    {
        var profile = await db.MemberProfiles.FirstOrDefaultAsync(m => m.Id == id, ct)
            ?? throw new NotFoundException("Member", id);

        if (request.TrainerProfileId is int trainerId && trainerId != profile.AssignedTrainerId)
        {
            await EnsureTrainerAcceptsMembersAsync(trainerId, ct);
        }

        var previous = profile.AssignedTrainerId;
        profile.AssignedTrainerId = request.TrainerProfileId;
        audit.Record("member.trainer_assigned", nameof(MemberProfile), id,
            new { From = previous, To = request.TrainerProfileId });
        await db.SaveChangesAsync(ct);

        return await LoadDetailAsync(id, ct);
    }

    // ---------- helpers ----------

    private async Task ApplyProfileUpdateAsync(int id, UpdateMemberProfileRequest request, CancellationToken ct)
    {
        var profile = await db.MemberProfiles.Include(m => m.User).FirstOrDefaultAsync(m => m.Id == id, ct)
            ?? throw new NotFoundException("Member", id);

        profile.User.FirstName = request.FirstName.Trim();
        profile.User.LastName = request.LastName.Trim();
        profile.User.PhoneNumber = string.IsNullOrWhiteSpace(request.PhoneNumber) ? null : request.PhoneNumber.Trim();
        profile.DateOfBirth = request.DateOfBirth;
        profile.Gender = request.Gender;
        profile.HeightCm = request.HeightCm;
        profile.WeightKg = request.WeightKg;
        profile.FitnessGoal = request.FitnessGoal?.Trim();
        profile.EmergencyContactName = request.EmergencyContactName?.Trim();
        profile.EmergencyContactPhone = request.EmergencyContactPhone?.Trim();
    }

    private async Task EnsureTrainerAcceptsMembersAsync(int trainerId, CancellationToken ct)
    {
        var trainer = await db.TrainerProfiles
            .Where(t => t.Id == trainerId)
            .Select(t => new { t.IsAcceptingMembers, t.User.IsActive })
            .FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException("Trainer", trainerId);

        if (!trainer.IsActive || !trainer.IsAcceptingMembers)
        {
            throw new BusinessRuleException("This trainer is not accepting new members.");
        }
    }

    private async Task<MemberDetailDto> LoadDetailAsync(int id, CancellationToken ct)
    {
        var today = clock.Today;
        var row = await ProjectRows(db.MemberProfiles.AsNoTracking().Where(m => m.Id == id), today)
            .FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException("Member", id);

        return new MemberDetailDto(row.Id, row.UserId, row.FirstName, row.LastName, row.Email, row.PhoneNumber,
            row.IsActive, row.JoinedOn, row.DateOfBirth, row.Gender, row.HeightCm, row.WeightKg, row.FitnessGoal,
            row.EmergencyContactName, row.EmergencyContactPhone, row.AssignedTrainerId, row.AssignedTrainerName,
            ToSummary(row.CurrentMembership, today));
    }

    /// <summary>
    /// One SQL query per page. "Current membership" = the non-cancelled membership covering today,
    /// otherwise the one with the latest end date (shows upcoming or most recently expired).
    /// </summary>
    private static IQueryable<MemberRow> ProjectRows(IQueryable<MemberProfile> members, DateOnly today) =>
        members.Select(m => new MemberRow
        {
            Id = m.Id,
            UserId = m.UserId,
            FirstName = m.User.FirstName,
            LastName = m.User.LastName,
            Email = m.User.Email!,
            PhoneNumber = m.User.PhoneNumber,
            IsActive = m.User.IsActive,
            JoinedOn = m.JoinedOn,
            DateOfBirth = m.DateOfBirth,
            Gender = m.Gender,
            HeightCm = m.HeightCm,
            WeightKg = m.WeightKg,
            FitnessGoal = m.FitnessGoal,
            EmergencyContactName = m.EmergencyContactName,
            EmergencyContactPhone = m.EmergencyContactPhone,
            AssignedTrainerId = m.AssignedTrainerId,
            AssignedTrainerName = m.AssignedTrainer != null
                ? m.AssignedTrainer.User.FirstName + " " + m.AssignedTrainer.User.LastName
                : null,
            CurrentMembership = m.Memberships
                .Where(x => x.Status == MembershipStatus.Active)
                .OrderBy(x => x.StartDate <= today && x.EndDate >= today ? 0 : 1)
                .ThenByDescending(x => x.EndDate)
                .Select(x => new MembershipRow
                {
                    Id = x.Id,
                    PlanName = x.MembershipPlan.Name,
                    StartDate = x.StartDate,
                    EndDate = x.EndDate,
                    Status = x.Status
                })
                .FirstOrDefault()
        });

    private static MemberListItemDto ToListItem(MemberRow row, DateOnly today) =>
        new(row.Id, row.UserId, row.FirstName, row.LastName, row.Email, row.PhoneNumber, row.IsActive, row.JoinedOn,
            row.AssignedTrainerId, row.AssignedTrainerName, ToSummary(row.CurrentMembership, today));

    private static MembershipSummaryDto? ToSummary(MembershipRow? row, DateOnly today) =>
        row is null
            ? null
            : new MembershipSummaryDto(row.Id, row.PlanName, row.StartDate, row.EndDate,
                MembershipRules.GetState(row.Status, row.StartDate, row.EndDate, today),
                MembershipRules.DaysRemaining(row.EndDate, today));

    private sealed class MemberRow
    {
        public int Id { get; init; }
        public Guid UserId { get; init; }
        public string FirstName { get; init; } = string.Empty;
        public string LastName { get; init; } = string.Empty;
        public string Email { get; init; } = string.Empty;
        public string? PhoneNumber { get; init; }
        public bool IsActive { get; init; }
        public DateOnly JoinedOn { get; init; }
        public DateOnly? DateOfBirth { get; init; }
        public Gender? Gender { get; init; }
        public decimal? HeightCm { get; init; }
        public decimal? WeightKg { get; init; }
        public string? FitnessGoal { get; init; }
        public string? EmergencyContactName { get; init; }
        public string? EmergencyContactPhone { get; init; }
        public int? AssignedTrainerId { get; init; }
        public string? AssignedTrainerName { get; init; }
        public MembershipRow? CurrentMembership { get; init; }
    }

    private sealed class MembershipRow
    {
        public int Id { get; init; }
        public string PlanName { get; init; } = string.Empty;
        public DateOnly StartDate { get; init; }
        public DateOnly EndDate { get; init; }
        public MembershipStatus Status { get; init; }
    }
}
