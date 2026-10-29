using FluentValidation;
using GymManagement.Application.DTOs.People;

namespace GymManagement.Application.Validators;

internal static class CommonRules
{
    public const string PhonePattern = @"^\+?[0-9 \-]{7,20}$";

    public static IRuleBuilderOptions<T, string?> OptionalPhone<T>(this IRuleBuilder<T, string?> rule) =>
        rule.Matches(PhonePattern).WithMessage("Enter a valid phone number.");
}

public sealed class UpdateMemberProfileRequestValidator : AbstractValidator<UpdateMemberProfileRequest>
{
    public UpdateMemberProfileRequestValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.PhoneNumber).OptionalPhone().When(x => !string.IsNullOrWhiteSpace(x.PhoneNumber));
        RuleFor(x => x.DateOfBirth)
            .Must(d => d!.Value <= DateOnly.FromDateTime(DateTime.UtcNow).AddYears(-10)).WithMessage("Members must be at least 10 years old.")
            .Must(d => d!.Value >= new DateOnly(1900, 1, 1)).WithMessage("Enter a valid date of birth.")
            .When(x => x.DateOfBirth.HasValue);
        RuleFor(x => x.Gender).IsInEnum().When(x => x.Gender.HasValue);
        RuleFor(x => x.HeightCm).InclusiveBetween(50, 250).When(x => x.HeightCm.HasValue);
        RuleFor(x => x.WeightKg).InclusiveBetween(20, 300).When(x => x.WeightKg.HasValue);
        RuleFor(x => x.FitnessGoal).MaximumLength(500);
        RuleFor(x => x.EmergencyContactName).MaximumLength(150);
        RuleFor(x => x.EmergencyContactPhone).OptionalPhone().When(x => !string.IsNullOrWhiteSpace(x.EmergencyContactPhone));
    }
}

public sealed class CreateMemberRequestValidator : AbstractValidator<CreateMemberRequest>
{
    public CreateMemberRequestValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.PhoneNumber).OptionalPhone().When(x => !string.IsNullOrWhiteSpace(x.PhoneNumber));
        RuleFor(x => x.TemporaryPassword).StrongPassword();
        RuleFor(x => x.AssignedTrainerId).GreaterThan(0).When(x => x.AssignedTrainerId.HasValue);
    }
}

public sealed class AssignTrainerRequestValidator : AbstractValidator<AssignTrainerRequest>
{
    public AssignTrainerRequestValidator()
    {
        RuleFor(x => x.TrainerProfileId).GreaterThan(0).When(x => x.TrainerProfileId.HasValue);
    }
}

public sealed class CreateTrainerRequestValidator : AbstractValidator<CreateTrainerRequest>
{
    public CreateTrainerRequestValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.PhoneNumber).OptionalPhone().When(x => !string.IsNullOrWhiteSpace(x.PhoneNumber));
        RuleFor(x => x.TemporaryPassword).StrongPassword();
        RuleFor(x => x.Specialization).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Bio).MaximumLength(1000);
        RuleFor(x => x.YearsOfExperience).InclusiveBetween(0, 60);
    }
}

public sealed class UpdateTrainerRequestValidator : AbstractValidator<UpdateTrainerRequest>
{
    public UpdateTrainerRequestValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.PhoneNumber).OptionalPhone().When(x => !string.IsNullOrWhiteSpace(x.PhoneNumber));
        RuleFor(x => x.Specialization).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Bio).MaximumLength(1000);
        RuleFor(x => x.YearsOfExperience).InclusiveBetween(0, 60);
    }
}
