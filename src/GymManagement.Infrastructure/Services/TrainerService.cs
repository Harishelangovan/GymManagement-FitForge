using GymManagement.Application.Common;
using GymManagement.Application.Common.Exceptions;
using GymManagement.Application.DTOs.People;
using GymManagement.Application.Interfaces;
using GymManagement.Domain.Common;
using GymManagement.Domain.Entities;
using GymManagement.Infrastructure.Data;
using GymManagement.Infrastructure.Services.Common;
using Microsoft.EntityFrameworkCore;

namespace GymManagement.Infrastructure.Services;

public sealed class TrainerService(
    AppDbContext db,
    AccessControl access,
    UserAccountFactory accounts,
    IAuditService audit) : ITrainerService
{
    public async Task<PagedResult<TrainerDto>> ListAsync(TrainerQuery query, CancellationToken ct = default)
    {
        var trainers = VisibleTrainers();

        if (access.IsAdmin && query.IsActive is bool isActive)
        {
            trainers = trainers.Where(t => t.User.IsActive == isActive);
        }

        if (query.IsAcceptingMembers is bool accepting)
        {
            trainers = trainers.Where(t => t.IsAcceptingMembers == accepting);
        }

        if (query.SearchTerm is { } search)
        {
            trainers = trainers.Where(t => t.User.FirstName.Contains(search)
                                           || t.User.LastName.Contains(search)
                                           || t.Specialization.Contains(search));
        }

        var sorted = query.SortBy?.ToLowerInvariant() switch
        {
            "experience" => trainers.OrderByDirection(t => t.YearsOfExperience, query.Descending),
            "members" => trainers.OrderByDirection(t => t.AssignedMembers.Count, query.Descending),
            _ => trainers.OrderByDirection(t => t.User.LastName, query.Descending).ThenBy(t => t.User.FirstName)
        };

        return await Project(sorted.ThenBy(t => t.Id)).ToPagedResultAsync(query, ct);
    }

    public async Task<TrainerDto> GetAsync(int id, CancellationToken ct = default) =>
        await Project(VisibleTrainers().Where(t => t.Id == id)).FirstOrDefaultAsync(ct)
        ?? throw new NotFoundException("Trainer", id);

    public async Task<TrainerDto> GetMineAsync(CancellationToken ct = default) =>
        await GetAsync(await access.GetMyTrainerProfileIdAsync(ct), ct);

    public async Task<TrainerDto> CreateAsync(CreateTrainerRequest request, CancellationToken ct = default)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);

        var user = await accounts.CreateAsync(request.FirstName, request.LastName, request.Email,
            request.PhoneNumber, request.TemporaryPassword, Roles.Trainer);

        var profile = new TrainerProfile
        {
            UserId = user.Id,
            Specialization = request.Specialization.Trim(),
            Bio = request.Bio?.Trim(),
            YearsOfExperience = request.YearsOfExperience
        };
        db.TrainerProfiles.Add(profile);
        await db.SaveChangesAsync(ct);

        audit.Record("trainer.created", nameof(TrainerProfile), profile.Id, new { user.Email });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        return await GetAsync(profile.Id, ct);
    }

    public async Task<TrainerDto> UpdateAsync(int id, UpdateTrainerRequest request, CancellationToken ct = default)
    {
        if (!access.IsAdmin && await access.GetMyTrainerProfileIdAsync(ct) != id)
        {
            throw new ForbiddenException("You can only edit your own trainer profile.");
        }

        var profile = await db.TrainerProfiles.Include(t => t.User).FirstOrDefaultAsync(t => t.Id == id, ct)
            ?? throw new NotFoundException("Trainer", id);

        profile.User.FirstName = request.FirstName.Trim();
        profile.User.LastName = request.LastName.Trim();
        profile.User.PhoneNumber = string.IsNullOrWhiteSpace(request.PhoneNumber) ? null : request.PhoneNumber.Trim();
        profile.Specialization = request.Specialization.Trim();
        profile.Bio = request.Bio?.Trim();
        profile.YearsOfExperience = request.YearsOfExperience;
        profile.IsAcceptingMembers = request.IsAcceptingMembers;

        if (access.IsAdmin)
        {
            audit.Record("trainer.updated", nameof(TrainerProfile), id);
        }

        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    /// <summary>Admins see every trainer; everyone else only sees active trainers.</summary>
    private IQueryable<TrainerProfile> VisibleTrainers()
    {
        var trainers = db.TrainerProfiles.AsNoTracking();
        return access.IsAdmin ? trainers : trainers.Where(t => t.User.IsActive);
    }

    private IQueryable<TrainerDto> Project(IQueryable<TrainerProfile> trainers)
    {
        var showContactDetails = access.IsAdmin;
        return trainers.Select(t => new TrainerDto(
            t.Id, t.UserId, t.User.FirstName, t.User.LastName, t.User.Email!,
            showContactDetails ? t.User.PhoneNumber : null,
            t.Specialization, t.Bio, t.YearsOfExperience, t.IsAcceptingMembers, t.User.IsActive,
            t.AssignedMembers.Count));
    }
}
