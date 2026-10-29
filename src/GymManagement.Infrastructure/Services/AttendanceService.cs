using GymManagement.Application.Common;
using GymManagement.Application.Common.Exceptions;
using GymManagement.Application.DTOs.Training;
using GymManagement.Application.Interfaces;
using GymManagement.Domain.Entities;
using GymManagement.Domain.Enums;
using GymManagement.Infrastructure.Data;
using GymManagement.Infrastructure.Services.Common;
using Microsoft.EntityFrameworkCore;

namespace GymManagement.Infrastructure.Services;

/// <summary>
/// Class attendance: marked by the class's trainer (or an admin) for members who booked it.
/// General gym check-in (no class): marked by an admin or the member's assigned trainer, once per day.
/// </summary>
public sealed class AttendanceService(
    AppDbContext db,
    AccessControl access,
    ICurrentUser currentUser,
    IGymClock clock) : IAttendanceService
{
    private static readonly TimeSpan MarkingOpensBeforeStart = TimeSpan.FromMinutes(30);

    public async Task<AttendanceDto> MarkAsync(MarkAttendanceRequest request, CancellationToken ct = default)
    {
        var now = clock.UtcNow;

        if (request.FitnessClassId is int classId)
        {
            await ValidateClassAttendanceAsync(request.MemberProfileId, classId, now, ct);
        }
        else
        {
            await ValidateGymCheckInAsync(request.MemberProfileId, ct);
        }

        var attendance = new Attendance
        {
            MemberProfileId = request.MemberProfileId,
            FitnessClassId = request.FitnessClassId,
            CheckInUtc = now,
            MarkedByUserId = currentUser.UserId
        };
        db.Attendances.Add(attendance);
        await db.SaveChangesAsync(ct);

        return await Project(db.Attendances.AsNoTracking().Where(a => a.Id == attendance.Id)).FirstAsync(ct);
    }

    public async Task<PagedResult<AttendanceDto>> ListAsync(AttendanceQuery query, CancellationToken ct = default)
    {
        var records = db.Attendances.AsNoTracking();

        if (!access.IsAdmin)
        {
            // Trainers see their assigned members' check-ins and attendance at the classes they lead.
            var trainerId = await access.GetMyTrainerProfileIdAsync(ct);
            records = records.Where(a => a.MemberProfile.AssignedTrainerId == trainerId
                                         || (a.FitnessClass != null && a.FitnessClass.TrainerProfileId == trainerId));
        }

        if (query.MemberId is int memberId)
        {
            records = records.Where(a => a.MemberProfileId == memberId);
        }

        if (query.ClassId is int classId)
        {
            records = records.Where(a => a.FitnessClassId == classId);
        }

        if (query.From is DateOnly from)
        {
            var fromUtc = clock.StartOfGymDayUtc(from);
            records = records.Where(a => a.CheckInUtc >= fromUtc);
        }

        if (query.To is DateOnly to)
        {
            var toUtcExclusive = clock.StartOfGymDayUtc(to.AddDays(1));
            records = records.Where(a => a.CheckInUtc < toUtcExclusive);
        }

        if (query.SearchTerm is { } search)
        {
            records = records.Where(a => a.MemberProfile.User.FirstName.Contains(search)
                                         || a.MemberProfile.User.LastName.Contains(search));
        }

        return await Project(records.OrderByDescending(a => a.CheckInUtc).ThenByDescending(a => a.Id))
            .ToPagedResultAsync(query, ct);
    }

    public async Task<PagedResult<AttendanceDto>> ListMineAsync(PageQuery query, CancellationToken ct = default)
    {
        var memberId = await access.GetMyMemberProfileIdAsync(ct);
        return await Project(db.Attendances.AsNoTracking()
                .Where(a => a.MemberProfileId == memberId)
                .OrderByDescending(a => a.CheckInUtc).ThenByDescending(a => a.Id))
            .ToPagedResultAsync(query, ct);
    }

    // ---------- helpers ----------

    private async Task ValidateClassAttendanceAsync(int memberId, int classId, DateTime now, CancellationToken ct)
    {
        var fitnessClass = await db.FitnessClasses.AsNoTracking().FirstOrDefaultAsync(c => c.Id == classId, ct);

        var canManage = fitnessClass is not null
                        && (access.IsAdmin
                            || (access.IsTrainer && fitnessClass.TrainerProfileId == await access.GetMyTrainerProfileIdAsync(ct)));
        if (!canManage)
        {
            throw new NotFoundException("Class", classId);
        }

        if (fitnessClass!.IsCancelled)
        {
            throw new BusinessRuleException("This class has been cancelled.");
        }

        if (now < fitnessClass.StartUtc - MarkingOpensBeforeStart)
        {
            throw new BusinessRuleException("Attendance opens 30 minutes before the class starts.");
        }

        var booked = await db.ClassBookings.AnyAsync(b => b.FitnessClassId == classId
                                                          && b.MemberProfileId == memberId
                                                          && b.Status == BookingStatus.Booked, ct);
        if (!booked)
        {
            throw new BusinessRuleException("This member has not booked this class.");
        }

        if (await db.Attendances.AnyAsync(a => a.FitnessClassId == classId && a.MemberProfileId == memberId, ct))
        {
            throw new ConflictException("Attendance is already marked for this member.");
        }
    }

    private async Task ValidateGymCheckInAsync(int memberId, CancellationToken ct)
    {
        await access.EnsureCanManageMemberAsync(memberId, ct);

        var today = clock.Today;
        var hasMembership = await db.Memberships.AnyAsync(m => m.MemberProfileId == memberId
                                                               && m.Status == MembershipStatus.Active
                                                               && m.StartDate <= today
                                                               && m.EndDate >= today, ct);
        if (!hasMembership)
        {
            throw new BusinessRuleException("This member does not have an active membership today.");
        }

        var startOfToday = clock.StartOfGymDayUtc(today);
        if (await db.Attendances.AnyAsync(a => a.MemberProfileId == memberId
                                               && a.FitnessClassId == null
                                               && a.CheckInUtc >= startOfToday, ct))
        {
            throw new ConflictException("This member has already checked in today.");
        }
    }

    private static IQueryable<AttendanceDto> Project(IQueryable<Attendance> records) =>
        records.Select(a => new AttendanceDto(
            a.Id,
            a.MemberProfileId,
            a.MemberProfile.User.FirstName + " " + a.MemberProfile.User.LastName,
            a.FitnessClassId,
            a.FitnessClass != null ? a.FitnessClass.Title : null,
            a.CheckInUtc,
            a.MarkedBy.FirstName + " " + a.MarkedBy.LastName));
}
