using FluentValidation;
using GymManagement.Application.DTOs.Billing;

namespace GymManagement.Application.Validators;

public sealed class UpsertMembershipPlanRequestValidator : AbstractValidator<UpsertMembershipPlanRequest>
{
    public UpsertMembershipPlanRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Description).MaximumLength(500);
        RuleFor(x => x.DurationDays).InclusiveBetween(1, 1825);
        RuleFor(x => x.Price).InclusiveBetween(0, 10_000_000).PrecisionScale(10, 2, ignoreTrailingZeros: true);
    }
}

public sealed class CreateMembershipRequestValidator : AbstractValidator<CreateMembershipRequest>
{
    public CreateMembershipRequestValidator()
    {
        RuleFor(x => x.MemberProfileId).GreaterThan(0);
        RuleFor(x => x.MembershipPlanId).GreaterThan(0);
    }
}

public sealed class CreatePaymentRequestValidator : AbstractValidator<CreatePaymentRequest>
{
    public CreatePaymentRequestValidator()
    {
        RuleFor(x => x.MembershipId).GreaterThan(0);
        RuleFor(x => x.Amount).GreaterThan(0).LessThanOrEqualTo(10_000_000).PrecisionScale(10, 2, ignoreTrailingZeros: true);
        RuleFor(x => x.Method).IsInEnum();
        RuleFor(x => x.ReferenceNumber).MaximumLength(100);
        RuleFor(x => x.Notes).MaximumLength(500);
    }
}
