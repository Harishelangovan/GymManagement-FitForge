using FluentValidation;
using GymManagement.Application.DTOs.Training;

namespace GymManagement.Application.Validators;

// Create and update requests share an interface (IWorkoutPlanContent, IDietPlanContent, IClassSchedule),
// so their common fields are validated once and reused with Include(...).

public sealed class WorkoutExerciseInputValidator : AbstractValidator<WorkoutExerciseInput>
{
    public WorkoutExerciseInputValidator()
    {
        RuleFor(x => x.DayOfWeek).IsInEnum();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Sets).InclusiveBetween(1, 20);
        RuleFor(x => x.Reps).InclusiveBetween(1, 200);
        RuleFor(x => x.WeightKg).InclusiveBetween(0, 1000).When(x => x.WeightKg.HasValue);
        RuleFor(x => x.RestSeconds).InclusiveBetween(0, 900);
        RuleFor(x => x.Notes).MaximumLength(500);
    }
}

public sealed class WorkoutPlanContentValidator : AbstractValidator<IWorkoutPlanContent>
{
    public WorkoutPlanContentValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Goal).MaximumLength(500);
        RuleFor(x => x.EndDate).GreaterThanOrEqualTo(x => x.StartDate).When(x => x.EndDate.HasValue)
            .WithMessage("End date must be on or after the start date.");
        RuleFor(x => x.Exercises).NotEmpty()
            .Must(e => e.Count <= 60).WithMessage("A plan can have at most 60 exercises.");
        RuleForEach(x => x.Exercises).SetValidator(new WorkoutExerciseInputValidator());
    }
}

public sealed class CreateWorkoutPlanRequestValidator : AbstractValidator<CreateWorkoutPlanRequest>
{
    public CreateWorkoutPlanRequestValidator()
    {
        RuleFor(x => x.MemberProfileId).GreaterThan(0);
        Include(new WorkoutPlanContentValidator());
    }
}

public sealed class UpdateWorkoutPlanRequestValidator : AbstractValidator<UpdateWorkoutPlanRequest>
{
    public UpdateWorkoutPlanRequestValidator() => Include(new WorkoutPlanContentValidator());
}

public sealed class DietPlanContentValidator : AbstractValidator<IDietPlanContent>
{
    public DietPlanContentValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(150);
        RuleFor(x => x.DailyCalories).InclusiveBetween(500, 10000);
        RuleFor(x => x.ProteinGrams).InclusiveBetween(0, 1000);
        RuleFor(x => x.Breakfast).NotEmpty().MaximumLength(1000);
        RuleFor(x => x.Lunch).NotEmpty().MaximumLength(1000);
        RuleFor(x => x.Dinner).NotEmpty().MaximumLength(1000);
        RuleFor(x => x.Snacks).MaximumLength(1000);
        RuleFor(x => x.Notes).MaximumLength(1000);
    }
}

public sealed class CreateDietPlanRequestValidator : AbstractValidator<CreateDietPlanRequest>
{
    public CreateDietPlanRequestValidator()
    {
        RuleFor(x => x.MemberProfileId).GreaterThan(0);
        Include(new DietPlanContentValidator());
    }
}

public sealed class UpdateDietPlanRequestValidator : AbstractValidator<UpdateDietPlanRequest>
{
    public UpdateDietPlanRequestValidator() => Include(new DietPlanContentValidator());
}

public sealed class ClassScheduleValidator : AbstractValidator<IClassSchedule>
{
    private static readonly TimeSpan MaxDuration = TimeSpan.FromHours(4);

    public ClassScheduleValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Description).MaximumLength(1000);
        RuleFor(x => x.Location).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Capacity).InclusiveBetween(1, 500);
        RuleFor(x => x.EndUtc)
            .GreaterThan(x => x.StartUtc).WithMessage("The class must end after it starts.")
            .Must((x, end) => end - x.StartUtc <= MaxDuration).WithMessage("A class can last at most 4 hours.");
    }
}

public sealed class CreateClassRequestValidator : AbstractValidator<CreateClassRequest>
{
    public CreateClassRequestValidator()
    {
        Include(new ClassScheduleValidator());
        RuleFor(x => x.TrainerProfileId).GreaterThan(0).When(x => x.TrainerProfileId.HasValue);
    }
}

public sealed class UpdateClassRequestValidator : AbstractValidator<UpdateClassRequest>
{
    public UpdateClassRequestValidator() => Include(new ClassScheduleValidator());
}

public sealed class MarkAttendanceRequestValidator : AbstractValidator<MarkAttendanceRequest>
{
    public MarkAttendanceRequestValidator()
    {
        RuleFor(x => x.MemberProfileId).GreaterThan(0);
        RuleFor(x => x.FitnessClassId).GreaterThan(0).When(x => x.FitnessClassId.HasValue);
    }
}
