using GymManagement.Application.Common;
using GymManagement.Application.Common.Exceptions;
using GymManagement.Application.DTOs.Billing;
using GymManagement.Application.Interfaces;
using GymManagement.Domain.Entities;
using GymManagement.Domain.Enums;
using GymManagement.Infrastructure.Data;
using GymManagement.Infrastructure.Services.Common;
using Microsoft.EntityFrameworkCore;

namespace GymManagement.Infrastructure.Services;

public sealed class PaymentService(
    AppDbContext db,
    AccessControl access,
    ICurrentUser currentUser,
    IAuditService audit,
    IGymClock clock) : IPaymentService
{
    public async Task<PagedResult<PaymentDto>> ListAsync(PaymentQuery query, CancellationToken ct = default)
    {
        var payments = db.Payments.AsNoTracking();

        if (query.MemberId is int memberId)
        {
            payments = payments.Where(p => p.MemberProfileId == memberId);
        }

        if (query.Method is PaymentMethod method)
        {
            payments = payments.Where(p => p.Method == method);
        }

        // Date filters are gym-local calendar days, converted to a UTC range.
        if (query.From is DateOnly from)
        {
            var fromUtc = clock.StartOfGymDayUtc(from);
            payments = payments.Where(p => p.PaidUtc >= fromUtc);
        }

        if (query.To is DateOnly to)
        {
            var toUtcExclusive = clock.StartOfGymDayUtc(to.AddDays(1));
            payments = payments.Where(p => p.PaidUtc < toUtcExclusive);
        }

        if (query.SearchTerm is { } search)
        {
            payments = payments.Where(p => p.MemberProfile.User.FirstName.Contains(search)
                                           || p.MemberProfile.User.LastName.Contains(search)
                                           || (p.ReferenceNumber != null && p.ReferenceNumber.Contains(search)));
        }

        var sorted = query.SortBy?.ToLowerInvariant() switch
        {
            "amount" => payments.OrderByDirection(p => p.Amount, query.Descending),
            "member" => payments.OrderByDirection(p => p.MemberProfile.User.LastName, query.Descending),
            // Newest first unless the client explicitly asks for ascending.
            _ => payments.OrderByDirection(p => p.PaidUtc, query.SortDirection is null || query.Descending)
        };

        return await Project(sorted.ThenByDescending(p => p.Id)).ToPagedResultAsync(query, ct);
    }

    public async Task<PagedResult<PaymentDto>> ListMineAsync(PageQuery query, CancellationToken ct = default)
    {
        var memberId = await access.GetMyMemberProfileIdAsync(ct);
        return await Project(db.Payments.AsNoTracking()
                .Where(p => p.MemberProfileId == memberId)
                .OrderByDescending(p => p.PaidUtc).ThenByDescending(p => p.Id))
            .ToPagedResultAsync(query, ct);
    }

    public async Task<PaymentDto> CreateAsync(CreatePaymentRequest request, CancellationToken ct = default)
    {
        var membership = await db.Memberships
            .Where(m => m.Id == request.MembershipId)
            .Select(m => new
            {
                m.Id,
                m.MemberProfileId,
                m.Status,
                m.PriceAtPurchase,
                Paid = m.Payments.Sum(p => (decimal?)p.Amount) ?? 0m
            })
            .FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException("Membership", request.MembershipId);

        if (membership.Status == MembershipStatus.Cancelled)
        {
            throw new BusinessRuleException("Payments cannot be recorded against a cancelled membership.");
        }

        var balance = membership.PriceAtPurchase - membership.Paid;
        if (request.Amount > balance)
        {
            throw new BusinessRuleException(balance <= 0
                ? "This membership is already fully paid."
                : $"The amount is more than the outstanding balance of ₹{balance:N2}.");
        }

        var now = clock.UtcNow;
        var paidUtc = request.PaidUtc?.AsUtc() ?? now;
        if (paidUtc > now.AddMinutes(5))
        {
            throw new RequestValidationException("paidUtc", "Payment date cannot be in the future.");
        }

        var payment = new Payment
        {
            MembershipId = membership.Id,
            MemberProfileId = membership.MemberProfileId,
            Amount = request.Amount,
            Method = request.Method,
            ReferenceNumber = request.ReferenceNumber?.Trim(),
            Notes = request.Notes?.Trim(),
            PaidUtc = paidUtc,
            RecordedByUserId = currentUser.UserId
        };
        db.Payments.Add(payment);
        await db.SaveChangesAsync(ct);

        audit.Record("payment.recorded", nameof(Payment), payment.Id,
            new { payment.MembershipId, payment.Amount, Method = payment.Method.ToString() });
        await db.SaveChangesAsync(ct);

        return await Project(db.Payments.AsNoTracking().Where(p => p.Id == payment.Id)).FirstAsync(ct);
    }

    private static IQueryable<PaymentDto> Project(IQueryable<Payment> payments) =>
        payments.Select(p => new PaymentDto(
            p.Id,
            p.MembershipId,
            p.MemberProfileId,
            p.MemberProfile.User.FirstName + " " + p.MemberProfile.User.LastName,
            p.Membership.MembershipPlan.Name,
            p.Amount,
            p.Method,
            p.ReferenceNumber,
            p.Notes,
            p.PaidUtc,
            p.RecordedBy.FirstName + " " + p.RecordedBy.LastName));
}
