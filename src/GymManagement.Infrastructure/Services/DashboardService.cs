using GymManagement.Application.Common;
using GymManagement.Application.DTOs.Dashboard;
using GymManagement.Application.DTOs.Training;
using GymManagement.Application.Interfaces;
using GymManagement.Domain.Enums;
using GymManagement.Infrastructure.Data;
using GymManagement.Infrastructure.Services.Common;
using Microsoft.EntityFrameworkCore;

namespace GymManagement.Infrastructure.Services;

/// <summary>
/// Read-only aggregates for the three dashboards. Time buckets (months, days, weeks) use the gym's
/// calendar, so a payment at 01:00 IST on the 1st counts in the new month. Small, bounded row sets
/// (one year of payments, two weeks of check-ins) are bucketed in memory, which keeps the time-zone
/// logic in one place; everything else is aggregated by SQL Server.
/// </summary>
public sealed class DashboardService(AppDbContext db, AccessControl access, IGymClock clock) : IDashboardService
{
    private const int MonthsOfHistory = 12;
    private const int DaysOfAttendance = 14;
    private const int WeeksOfVisits = 8;

    // ======================================================================== Admin

    public async Task<AdminDashboardDto> GetAdminAsync(CancellationToken ct = default)
    {
        var today = clock.Today;
        var thisMonth = new DateOnly(today.Year, today.Month, 1);
        var historyStart = thisMonth.AddMonths(-(MonthsOfHistory - 1));
        var todayStartUtc = clock.StartOfGymDayUtc(today);
        var tomorrowStartUtc = clock.StartOfGymDayUtc(today.AddDays(1));
        var expiringLimit = today.AddDays(MembershipRules.ExpiringSoonDays);

        // ---- Membership status of every active member ----
        var activeMemberIds = await db.MemberProfiles.Where(m => m.User.IsActive).Select(m => m.Id).ToListAsync(ct);
        var memberships = await db.Memberships
            .Where(m => m.Status == MembershipStatus.Active && m.MemberProfile.User.IsActive)
            .Select(m => new MembershipSpan(m.MemberProfileId, m.StartDate, m.EndDate))
            .ToListAsync(ct);
        var breakdown = BuildBreakdown(activeMemberIds, memberships, today);

        // ---- Revenue (bucketed by gym-local month) ----
        var payments = await db.Payments
            .Where(p => p.PaidUtc >= clock.StartOfGymDayUtc(historyStart))
            .Select(p => new { p.PaidUtc, p.Amount })
            .ToListAsync(ct);
        var revenueByMonth = MonthKeys(historyStart)
            .Select(month => new MonthlyAmountDto(month, payments.Where(p => MonthKey(clock.ToGymDate(p.PaidUtc)) == month).Sum(p => p.Amount)))
            .ToList();

        var outstanding = await db.Memberships
            .Where(m => m.Status == MembershipStatus.Active)
            .Select(m => m.PriceAtPurchase - (m.Payments.Sum(p => (decimal?)p.Amount) ?? 0m))
            .Where(balance => balance > 0)
            .SumAsync(ct);

        // ---- New members per month (JoinedOn is already a gym-local date) ----
        var joined = await db.MemberProfiles
            .Where(m => m.JoinedOn >= historyStart)
            .GroupBy(m => new { m.JoinedOn.Year, m.JoinedOn.Month })
            .Select(g => new { g.Key.Year, g.Key.Month, Count = g.Count() })
            .ToListAsync(ct);
        var newMembersByMonth = MonthKeys(historyStart)
            .Select(month => new MonthlyCountDto(month, joined.Where(j => $"{j.Year:D4}-{j.Month:D2}" == month).Sum(j => j.Count)))
            .ToList();

        // ---- Attendance, last 14 days ----
        var attendanceByDay = await AttendanceByDayAsync(db.Attendances, today, ct);

        // ---- Lists ----
        var expiring = await db.Memberships
            .Where(m => m.Status == MembershipStatus.Active
                        && m.MemberProfile.User.IsActive
                        && m.StartDate <= today && m.EndDate >= today && m.EndDate <= expiringLimit
                        // already renewed → not "expiring"
                        && !m.MemberProfile.Memberships.Any(n => n.Status == MembershipStatus.Active && n.StartDate > m.EndDate))
            .OrderBy(m => m.EndDate)
            .Take(5)
            .Select(m => new
            {
                m.Id,
                m.MemberProfileId,
                Name = m.MemberProfile.User.FirstName + " " + m.MemberProfile.User.LastName,
                Plan = m.MembershipPlan.Name,
                m.EndDate
            })
            .ToListAsync(ct);

        var recentPayments = await db.Payments
            .OrderByDescending(p => p.PaidUtc).ThenByDescending(p => p.Id)
            .Take(5)
            .Select(p => new RecentPaymentDto(
                p.Id,
                p.MemberProfile.User.FirstName + " " + p.MemberProfile.User.LastName,
                p.Membership.MembershipPlan.Name,
                p.Amount,
                p.Method.ToString(),
                p.PaidUtc))
            .ToListAsync(ct);

        var recentMembers = await db.MemberProfiles
            .OrderByDescending(m => m.User.CreatedUtc)
            .Take(5)
            .Select(m => new RecentMemberDto(
                m.Id,
                m.User.FirstName + " " + m.User.LastName,
                m.User.Email!,
                m.JoinedOn,
                m.AssignedTrainer != null ? m.AssignedTrainer.User.FirstName + " " + m.AssignedTrainer.User.LastName : null))
            .ToListAsync(ct);

        var kpis = new AdminKpisDto(
            ActiveMembers: breakdown.Active + breakdown.ExpiringSoon,
            TotalMembers: activeMemberIds.Count,
            ActiveTrainers: await db.TrainerProfiles.CountAsync(t => t.User.IsActive, ct),
            ExpiringSoon: breakdown.ExpiringSoon,
            RevenueThisMonth: revenueByMonth[^1].Amount,
            RevenueLastMonth: revenueByMonth[^2].Amount,
            OutstandingBalance: outstanding,
            CheckInsToday: attendanceByDay[^1].ClassVisits + attendanceByDay[^1].GymCheckIns,
            ClassesToday: await db.FitnessClasses.CountAsync(
                c => !c.IsCancelled && c.StartUtc >= todayStartUtc && c.StartUtc < tomorrowStartUtc, ct));

        return new AdminDashboardDto(
            kpis,
            revenueByMonth,
            newMembersByMonth,
            breakdown,
            attendanceByDay,
            expiring.Select(e => new ExpiringMembershipDto(e.Id, e.MemberProfileId, e.Name, e.Plan, e.EndDate,
                MembershipRules.DaysRemaining(e.EndDate, today))).ToList(),
            recentPayments,
            recentMembers);
    }

    // ======================================================================== Trainer

    public async Task<TrainerDashboardDto> GetTrainerAsync(CancellationToken ct = default)
    {
        var trainerId = await access.GetMyTrainerProfileIdAsync(ct);
        var today = clock.Today;
        var todayStartUtc = clock.StartOfGymDayUtc(today);
        var tomorrowStartUtc = clock.StartOfGymDayUtc(today.AddDays(1));
        var weekEndUtc = clock.StartOfGymDayUtc(today.AddDays(7));

        var assignedMembers = db.MemberProfiles.Where(m => m.AssignedTrainerId == trainerId && m.User.IsActive);

        var sessions = await db.FitnessClasses
            .Where(c => c.TrainerProfileId == trainerId && !c.IsCancelled && c.StartUtc >= todayStartUtc && c.StartUtc < weekEndUtc)
            .OrderBy(c => c.StartUtc)
            .Select(c => new SessionDto(c.Id, c.Title, c.StartUtc, c.EndUtc, c.Location, c.Capacity,
                c.Bookings.Count(b => b.Status == BookingStatus.Booked)))
            .ToListAsync(ct);

        var withoutPlan = await assignedMembers
            .Where(m => !m.WorkoutPlans.Any(p => p.IsActive))
            .OrderBy(m => m.User.FirstName)
            .Select(m => new MemberNeedingPlanDto(m.Id, m.User.FirstName + " " + m.User.LastName, m.FitnessGoal))
            .ToListAsync(ct);

        // Attendance this trainer is responsible for: their classes + gym check-ins of their members.
        var myAttendance = db.Attendances.Where(a =>
            (a.FitnessClass != null && a.FitnessClass.TrainerProfileId == trainerId)
            || (a.FitnessClassId == null && a.MemberProfile.AssignedTrainerId == trainerId));

        var recentActivity = await myAttendance
            .OrderByDescending(a => a.CheckInUtc)
            .Take(8)
            .Select(a => new ActivityDto(
                a.CheckInUtc,
                a.MemberProfileId,
                a.MemberProfile.User.FirstName + " " + a.MemberProfile.User.LastName,
                a.FitnessClass != null ? "Attended " + a.FitnessClass.Title : "Checked in at the gym"))
            .ToListAsync(ct);

        var todaySessions = sessions.Where(s => s.StartUtc < tomorrowStartUtc).ToList();

        var kpis = new TrainerKpisDto(
            AssignedMembers: await assignedMembers.CountAsync(ct),
            SessionsToday: todaySessions.Count,
            BookingsThisWeek: sessions.Sum(s => s.BookedCount),
            ActiveWorkoutPlans: await db.WorkoutPlans.CountAsync(
                p => p.IsActive && p.MemberProfile.AssignedTrainerId == trainerId && p.MemberProfile.User.IsActive, ct),
            MembersWithoutWorkoutPlan: withoutPlan.Count);

        return new TrainerDashboardDto(
            kpis,
            todaySessions,
            sessions,
            await AttendanceByDayAsync(myAttendance, today, ct),
            recentActivity,
            withoutPlan.Take(5).ToList());
    }

    // ======================================================================== Member

    public async Task<MemberDashboardDto> GetMemberAsync(CancellationToken ct = default)
    {
        var memberId = await access.GetMyMemberProfileIdAsync(ct);
        var today = clock.Today;
        var now = clock.UtcNow;

        var profile = await db.MemberProfiles
            .Where(m => m.Id == memberId)
            .Select(m => new
            {
                m.User.FirstName,
                Trainer = m.AssignedTrainer == null
                    ? null
                    : new TrainerSummaryDto(m.AssignedTrainer.Id,
                        m.AssignedTrainer.User.FirstName + " " + m.AssignedTrainer.User.LastName,
                        m.AssignedTrainer.Specialization,
                        m.AssignedTrainer.User.Email!)
            })
            .FirstAsync(ct);

        // Current membership: the one covering today, else the next upcoming, else the most recent.
        var membership = await db.Memberships
            .Where(m => m.MemberProfileId == memberId && m.Status == MembershipStatus.Active)
            .OrderBy(m => m.StartDate <= today && m.EndDate >= today ? 0 : m.StartDate > today ? 1 : 2)
            .ThenBy(m => m.StartDate > today ? m.StartDate : DateOnly.MinValue)
            .ThenByDescending(m => m.EndDate)
            .Select(m => new
            {
                m.Id,
                Plan = m.MembershipPlan.Name,
                m.StartDate,
                m.EndDate,
                m.Status,
                Balance = m.PriceAtPurchase - (m.Payments.Sum(p => (decimal?)p.Amount) ?? 0m)
            })
            .FirstOrDefaultAsync(ct);

        var workout = await db.WorkoutPlans
            .Where(p => p.MemberProfileId == memberId && p.IsActive)
            .OrderByDescending(p => p.CreatedUtc)
            .Select(p => new
            {
                p.Id,
                p.Title,
                Exercises = p.Exercises
                    .Where(e => e.DayOfWeek == today.DayOfWeek)
                    .OrderBy(e => e.SortOrder)
                    .Select(e => new WorkoutExerciseDto(e.Id, e.DayOfWeek, e.Name, e.Sets, e.Reps, e.WeightKg, e.RestSeconds, e.Notes, e.SortOrder))
                    .ToList()
            })
            .FirstOrDefaultAsync(ct);

        var diet = await db.DietPlans
            .Where(p => p.MemberProfileId == memberId && p.IsActive)
            .OrderByDescending(p => p.CreatedUtc)
            .Select(p => new DietSummaryDto(p.Id, p.Title, p.DailyCalories, p.ProteinGrams))
            .FirstOrDefaultAsync(ct);

        var upcomingBookings = db.ClassBookings.Where(b =>
            b.MemberProfileId == memberId && b.Status == BookingStatus.Booked && !b.FitnessClass.IsCancelled && b.FitnessClass.StartUtc >= now);

        var upcomingClasses = await upcomingBookings
            .OrderBy(b => b.FitnessClass.StartUtc)
            .Take(5)
            .Select(b => new UpcomingClassDto(b.FitnessClassId, b.FitnessClass.Title, b.FitnessClass.StartUtc, b.FitnessClass.EndUtc,
                b.FitnessClass.Location, b.FitnessClass.TrainerProfile.User.FirstName + " " + b.FitnessClass.TrainerProfile.User.LastName))
            .ToListAsync(ct);

        // ---- Visits per week (Monday-based, gym-local) ----
        var thisWeekStart = today.AddDays(-(((int)today.DayOfWeek + 6) % 7));
        var firstWeekStart = thisWeekStart.AddDays(-7 * (WeeksOfVisits - 1));
        var myAttendance = db.Attendances.Where(a => a.MemberProfileId == memberId);

        var checkIns = await myAttendance
            .Where(a => a.CheckInUtc >= clock.StartOfGymDayUtc(firstWeekStart))
            .Select(a => a.CheckInUtc)
            .ToListAsync(ct);
        var visitsByWeek = Enumerable.Range(0, WeeksOfVisits)
            .Select(i => firstWeekStart.AddDays(7 * i))
            .Select(start => new WeeklyVisitsDto(start, checkIns.Count(c =>
            {
                var day = clock.ToGymDate(c);
                return day >= start && day < start.AddDays(7);
            })))
            .ToList();

        var recentAttendance = await myAttendance
            .OrderByDescending(a => a.CheckInUtc)
            .Take(5)
            .Select(a => new AttendanceItemDto(a.CheckInUtc, a.FitnessClass != null ? a.FitnessClass.Title : null))
            .ToListAsync(ct);

        var kpis = new MemberKpisDto(
            VisitsThisWeek: visitsByWeek[^1].Visits,
            VisitsLast30Days: await myAttendance.CountAsync(a => a.CheckInUtc >= clock.StartOfGymDayUtc(today.AddDays(-29)), ct),
            UpcomingClasses: await upcomingBookings.CountAsync(ct),
            ClassesAttended: await myAttendance.CountAsync(a => a.FitnessClassId != null, ct));

        return new MemberDashboardDto(
            profile.FirstName,
            kpis,
            membership is null
                ? null
                : new MembershipCardDto(membership.Id, membership.Plan, membership.StartDate, membership.EndDate,
                    MembershipRules.GetState(membership.Status, membership.StartDate, membership.EndDate, today),
                    MembershipRules.DaysRemaining(membership.EndDate, today),
                    membership.EndDate.DayNumber - membership.StartDate.DayNumber + 1,
                    Math.Max(0m, membership.Balance)),
            profile.Trainer,
            workout is null ? null : new TodayWorkoutDto(workout.Id, workout.Title, today.DayOfWeek, workout.Exercises),
            diet,
            upcomingClasses,
            visitsByWeek,
            recentAttendance);
    }

    // ======================================================================== helpers

    internal sealed record MembershipSpan(int MemberProfileId, DateOnly StartDate, DateOnly EndDate);

    /// <summary>
    /// Active = covered today and beyond the next 7 days; ExpiringSoon = covered today but coverage (including any
    /// renewal) ends within 7 days; Lapsed = had a membership, none now or later; NotStarted = never had one, or only
    /// a future one.
    /// </summary>
    internal static MembershipBreakdownDto BuildBreakdown(IEnumerable<int> memberIds, IEnumerable<MembershipSpan> memberships, DateOnly today)
    {
        var byMember = memberships.ToLookup(m => m.MemberProfileId);
        var expiringLimit = today.AddDays(MembershipRules.ExpiringSoonDays);
        int active = 0, expiring = 0, lapsed = 0, notStarted = 0;

        foreach (var memberId in memberIds)
        {
            var spans = byMember[memberId].ToList();
            var coveredToday = spans.Any(s => s.StartDate <= today && s.EndDate >= today);

            if (coveredToday)
            {
                var coverageEnds = spans.Where(s => s.EndDate >= today).Max(s => s.EndDate);
                if (coverageEnds <= expiringLimit) expiring++; else active++;
            }
            else if (spans.Any(s => s.EndDate < today) && !spans.Any(s => s.StartDate > today))
            {
                lapsed++;
            }
            else
            {
                notStarted++;
            }
        }

        return new MembershipBreakdownDto(active, expiring, lapsed, notStarted);
    }

    private async Task<List<DailyAttendanceDto>> AttendanceByDayAsync(
        IQueryable<Domain.Entities.Attendance> attendance, DateOnly today, CancellationToken ct)
    {
        var firstDay = today.AddDays(-(DaysOfAttendance - 1));
        var rows = await attendance
            .Where(a => a.CheckInUtc >= clock.StartOfGymDayUtc(firstDay))
            .Select(a => new { a.CheckInUtc, IsClass = a.FitnessClassId != null })
            .ToListAsync(ct);

        var byDay = rows.ToLookup(r => clock.ToGymDate(r.CheckInUtc));
        return Enumerable.Range(0, DaysOfAttendance)
            .Select(i => firstDay.AddDays(i))
            .Select(day => new DailyAttendanceDto(day, byDay[day].Count(r => r.IsClass), byDay[day].Count(r => !r.IsClass)))
            .ToList();
    }

    private static string MonthKey(DateOnly date) => $"{date.Year:D4}-{date.Month:D2}";

    private static IEnumerable<string> MonthKeys(DateOnly firstMonth) =>
        Enumerable.Range(0, MonthsOfHistory).Select(i => MonthKey(firstMonth.AddMonths(i)));
}
