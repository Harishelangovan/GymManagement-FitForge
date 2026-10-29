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

public sealed class ClassService(
    AppDbContext db,
    AccessControl access,
    IAuditService audit,
    IGymClock clock) : IClassService
{
    // ---------- Classes ----------

    public async Task<PagedResult<FitnessClassDto>> ListAsync(ClassQuery query, CancellationToken ct = default)
    {
        var classes = db.FitnessClasses.AsNoTracking();

        if (!query.IncludeCancelled)
        {
            classes = classes.Where(c => !c.IsCancelled);
        }

        // Default window: from the start of today (gym time) onwards.
        var fromUtc = query.FromUtc?.AsUtc() ?? clock.StartOfGymDayUtc(clock.Today);
        classes = classes.Where(c => c.EndUtc >= fromUtc);

        if (query.ToUtc is DateTime to)
        {
            var toUtc = to.AsUtc();
            classes = classes.Where(c => c.StartUtc < toUtc);
        }

        if (query.TrainerId is int trainerId)
        {
            classes = classes.Where(c => c.TrainerProfileId == trainerId);
        }

        if (query.SearchTerm is { } search)
        {
            classes = classes.Where(c => c.Title.Contains(search) || c.Location.Contains(search));
        }

        var myMemberId = await GetMyMemberIdOrNullAsync(ct);
        return await Project(classes.OrderBy(c => c.StartUtc).ThenBy(c => c.Id), myMemberId)
            .ToPagedResultAsync(query, ct);
    }

    public async Task<FitnessClassDto> GetAsync(int id, CancellationToken ct = default)
    {
        var myMemberId = await GetMyMemberIdOrNullAsync(ct);
        return await Project(db.FitnessClasses.AsNoTracking().Where(c => c.Id == id), myMemberId).FirstOrDefaultAsync(ct)
               ?? throw new NotFoundException("Class", id);
    }

    public async Task<FitnessClassDto> CreateAsync(CreateClassRequest request, CancellationToken ct = default)
    {
        var trainerId = await ResolveTrainerForNewClassAsync(request.TrainerProfileId, ct);
        var (start, end) = (request.StartUtc.AsUtc(), request.EndUtc.AsUtc());

        EnsureInFuture(start);
        await EnsureNoTrainerClashAsync(trainerId, start, end, excludeClassId: null, ct);

        var fitnessClass = new FitnessClass
        {
            TrainerProfileId = trainerId,
            Title = request.Title.Trim(),
            Description = request.Description?.Trim(),
            StartUtc = start,
            EndUtc = end,
            Capacity = request.Capacity,
            Location = request.Location.Trim()
        };
        db.FitnessClasses.Add(fitnessClass);
        await db.SaveChangesAsync(ct);

        return await GetAsync(fitnessClass.Id, ct);
    }

    public async Task<FitnessClassDto> UpdateAsync(int id, UpdateClassRequest request, CancellationToken ct = default)
    {
        var fitnessClass = await LoadManageableClassAsync(id, ct);
        EnsureEditable(fitnessClass);

        var (start, end) = (request.StartUtc.AsUtc(), request.EndUtc.AsUtc());
        EnsureInFuture(start);
        await EnsureNoTrainerClashAsync(fitnessClass.TrainerProfileId, start, end, excludeClassId: id, ct);

        var booked = await db.ClassBookings.CountAsync(b => b.FitnessClassId == id && b.Status == BookingStatus.Booked, ct);
        if (request.Capacity < booked)
        {
            throw new BusinessRuleException($"Capacity cannot be lower than the {booked} members already booked.");
        }

        fitnessClass.Title = request.Title.Trim();
        fitnessClass.Description = request.Description?.Trim();
        fitnessClass.StartUtc = start;
        fitnessClass.EndUtc = end;
        fitnessClass.Capacity = request.Capacity;
        fitnessClass.Location = request.Location.Trim();

        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<FitnessClassDto> CancelAsync(int id, CancellationToken ct = default)
    {
        var fitnessClass = await LoadManageableClassAsync(id, ct);
        EnsureEditable(fitnessClass);

        var now = clock.UtcNow;
        fitnessClass.IsCancelled = true;

        var bookings = await db.ClassBookings
            .Where(b => b.FitnessClassId == id && b.Status == BookingStatus.Booked)
            .ToListAsync(ct);
        foreach (var booking in bookings)
        {
            booking.Status = BookingStatus.Cancelled;
            booking.CancelledUtc = now;
        }

        audit.Record("class.cancelled", nameof(FitnessClass), id,
            new { fitnessClass.Title, fitnessClass.StartUtc, BookingsCancelled = bookings.Count });
        await db.SaveChangesAsync(ct);

        return await GetAsync(id, ct);
    }

    // ---------- Bookings ----------

    public async Task<ClassBookingDto> BookAsync(int classId, CancellationToken ct = default)
    {
        var memberId = await access.GetMyMemberProfileIdAsync(ct);

        // The class row is locked (UPDLOCK) for the rest of the transaction, so two members booking the
        // last spot at the same moment are processed one after the other and the class can't be overbooked.
        await using var transaction = await db.Database.BeginTransactionAsync(ct);

        var fitnessClass = await db.FitnessClasses
            .FromSql($"SELECT * FROM FitnessClasses WITH (UPDLOCK, ROWLOCK) WHERE Id = {classId}")
            .SingleOrDefaultAsync(ct)
            ?? throw new NotFoundException("Class", classId);

        if (fitnessClass.IsCancelled)
        {
            throw new BusinessRuleException("This class has been cancelled.");
        }

        if (fitnessClass.StartUtc <= clock.UtcNow)
        {
            throw new BusinessRuleException("This class has already started.");
        }

        var classDate = clock.ToGymDate(fitnessClass.StartUtc);
        var hasMembership = await db.Memberships.AnyAsync(m => m.MemberProfileId == memberId
                                                               && m.Status == MembershipStatus.Active
                                                               && m.StartDate <= classDate
                                                               && m.EndDate >= classDate, ct);
        if (!hasMembership)
        {
            throw new BusinessRuleException("You need an active membership on the day of the class to book it.");
        }

        var bookings = await db.ClassBookings
            .Where(b => b.FitnessClassId == classId && b.Status == BookingStatus.Booked)
            .Select(b => b.MemberProfileId)
            .ToListAsync(ct);

        if (bookings.Contains(memberId))
        {
            throw new ConflictException("You have already booked this class.");
        }

        if (bookings.Count >= fitnessClass.Capacity)
        {
            throw new BusinessRuleException("This class is full.");
        }

        var booking = new ClassBooking
        {
            FitnessClassId = classId,
            MemberProfileId = memberId,
            Status = BookingStatus.Booked,
            BookedUtc = clock.UtcNow
        };
        db.ClassBookings.Add(booking);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        return await ProjectBookings(db.ClassBookings.AsNoTracking().Where(b => b.Id == booking.Id)).FirstAsync(ct);
    }

    public async Task CancelMyBookingAsync(int classId, CancellationToken ct = default)
    {
        var memberId = await access.GetMyMemberProfileIdAsync(ct);

        var booking = await db.ClassBookings
            .Include(b => b.FitnessClass)
            .FirstOrDefaultAsync(b => b.FitnessClassId == classId
                                      && b.MemberProfileId == memberId
                                      && b.Status == BookingStatus.Booked, ct)
            ?? throw new NotFoundException("Booking for class", classId);

        var now = clock.UtcNow;
        if (!MembershipRules.CanCancelBooking(booking.FitnessClass.StartUtc, now))
        {
            throw new BusinessRuleException("Bookings can only be cancelled up to 2 hours before the class starts.");
        }

        booking.Status = BookingStatus.Cancelled;
        booking.CancelledUtc = now;
        await db.SaveChangesAsync(ct);
    }

    public async Task<PagedResult<ClassBookingDto>> ListMyBookingsAsync(MyBookingsQuery query, CancellationToken ct = default)
    {
        var memberId = await access.GetMyMemberProfileIdAsync(ct);
        var now = clock.UtcNow;

        var bookings = db.ClassBookings.AsNoTracking().Where(b => b.MemberProfileId == memberId);
        var ordered = query.Upcoming
            ? bookings.Where(b => b.FitnessClass.StartUtc >= now).OrderBy(b => b.FitnessClass.StartUtc)
            : bookings.Where(b => b.FitnessClass.StartUtc < now).OrderByDescending(b => b.FitnessClass.StartUtc);

        return await ProjectBookings(ordered.ThenBy(b => b.Id)).ToPagedResultAsync(query, ct);
    }

    public async Task<IReadOnlyList<ClassRosterEntryDto>> GetRosterAsync(int classId, CancellationToken ct = default)
    {
        await LoadManageableClassAsync(classId, ct);

        return await db.ClassBookings.AsNoTracking()
            .Where(b => b.FitnessClassId == classId && b.Status == BookingStatus.Booked)
            .OrderBy(b => b.MemberProfile.User.FirstName).ThenBy(b => b.MemberProfile.User.LastName)
            .Select(b => new ClassRosterEntryDto(
                b.Id,
                b.MemberProfileId,
                b.MemberProfile.User.FirstName + " " + b.MemberProfile.User.LastName,
                b.MemberProfile.User.Email!,
                b.BookedUtc,
                b.FitnessClass.Attendances.Any(a => a.MemberProfileId == b.MemberProfileId)))
            .ToListAsync(ct);
    }

    // ---------- helpers ----------

    private async Task<int?> GetMyMemberIdOrNullAsync(CancellationToken ct) =>
        access.IsMember ? await access.GetMyMemberProfileIdAsync(ct) : null;

    /// <summary>Admin: any class. Trainer: only classes they lead. Everyone else: 404.</summary>
    private async Task<FitnessClass> LoadManageableClassAsync(int id, CancellationToken ct)
    {
        var fitnessClass = await db.FitnessClasses.FirstOrDefaultAsync(c => c.Id == id, ct);

        if (fitnessClass is null
            || (!access.IsAdmin && (!access.IsTrainer || fitnessClass.TrainerProfileId != await access.GetMyTrainerProfileIdAsync(ct))))
        {
            throw new NotFoundException("Class", id);
        }

        return fitnessClass;
    }

    private async Task<int> ResolveTrainerForNewClassAsync(int? requestedTrainerId, CancellationToken ct)
    {
        if (!access.IsAdmin)
        {
            var myTrainerId = await access.GetMyTrainerProfileIdAsync(ct);
            if (requestedTrainerId is int other && other != myTrainerId)
            {
                throw new ForbiddenException("Trainers can only schedule their own classes.");
            }
            return myTrainerId;
        }

        if (requestedTrainerId is not int trainerId)
        {
            throw new RequestValidationException("trainerProfileId", "Choose the trainer who will lead this class.");
        }

        var trainerActive = await db.TrainerProfiles.Where(t => t.Id == trainerId).Select(t => (bool?)t.User.IsActive)
                                .FirstOrDefaultAsync(ct)
                            ?? throw new NotFoundException("Trainer", trainerId);
        if (!trainerActive)
        {
            throw new BusinessRuleException("This trainer's account is deactivated.");
        }

        return trainerId;
    }

    private void EnsureInFuture(DateTime startUtc)
    {
        if (startUtc <= clock.UtcNow)
        {
            throw new RequestValidationException("startUtc", "The class must start in the future.");
        }
    }

    private void EnsureEditable(FitnessClass fitnessClass)
    {
        if (fitnessClass.IsCancelled)
        {
            throw new BusinessRuleException("This class has been cancelled.");
        }

        if (fitnessClass.StartUtc <= clock.UtcNow)
        {
            throw new BusinessRuleException("A class that has already started cannot be changed.");
        }
    }

    private async Task EnsureNoTrainerClashAsync(int trainerId, DateTime start, DateTime end, int? excludeClassId, CancellationToken ct)
    {
        var clash = await db.FitnessClasses.AnyAsync(c => c.TrainerProfileId == trainerId
                                                          && !c.IsCancelled
                                                          && c.Id != excludeClassId
                                                          && c.StartUtc < end
                                                          && c.EndUtc > start, ct);
        if (clash)
        {
            throw new ConflictException("The trainer already has a class at this time.");
        }
    }

    private static IQueryable<FitnessClassDto> Project(IQueryable<FitnessClass> classes, int? myMemberId) =>
        classes.Select(c => new FitnessClassDto(
            c.Id,
            c.Title,
            c.Description,
            c.TrainerProfileId,
            c.TrainerProfile.User.FirstName + " " + c.TrainerProfile.User.LastName,
            c.StartUtc,
            c.EndUtc,
            c.Capacity,
            c.Bookings.Count(b => b.Status == BookingStatus.Booked),
            c.Capacity - c.Bookings.Count(b => b.Status == BookingStatus.Booked),
            c.Location,
            c.IsCancelled,
            myMemberId != null && c.Bookings.Any(b => b.MemberProfileId == myMemberId && b.Status == BookingStatus.Booked)));

    private static IQueryable<ClassBookingDto> ProjectBookings(IQueryable<ClassBooking> bookings) =>
        bookings.Select(b => new ClassBookingDto(
            b.Id,
            b.FitnessClassId,
            b.FitnessClass.Title,
            b.FitnessClass.StartUtc,
            b.FitnessClass.EndUtc,
            b.FitnessClass.Location,
            b.FitnessClass.TrainerProfile.User.FirstName + " " + b.FitnessClass.TrainerProfile.User.LastName,
            b.Status,
            b.BookedUtc,
            b.CancelledUtc,
            b.FitnessClass.IsCancelled));
}
