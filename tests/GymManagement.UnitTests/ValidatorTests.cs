using FluentValidation;
using GymManagement.Application;
using GymManagement.Application.DTOs.Billing;
using GymManagement.Application.DTOs.Auth;
using GymManagement.Application.DTOs.Training;
using GymManagement.Application.Validators;
using GymManagement.Domain.Enums;
using Microsoft.Extensions.DependencyInjection;

namespace GymManagement.UnitTests;

public class ValidatorTests
{
    // Same registration the API runs at startup: it also switches error keys to camelCase ("password").
    static ValidatorTests() => new ServiceCollection().AddApplication();

    [Theory]
    [InlineData("short1!", "Password must be at least 8 characters.")]
    [InlineData("alllower1!", "Password must contain an uppercase letter.")]
    [InlineData("ALLUPPER1!", "Password must contain a lowercase letter.")]
    [InlineData("NoDigits!!", "Password must contain a digit.")]
    [InlineData("NoSymbol11", "Password must contain a symbol.")]
    public void Register_rejects_weak_passwords_with_a_specific_message(string password, string expectedMessage)
    {
        var result = new RegisterRequestValidator().Validate(new RegisterRequest("A", "B", "a@b.test", password, password, null));

        Assert.Contains(result.Errors, e => e.PropertyName == "password" && e.ErrorMessage == expectedMessage);
    }

    [Fact]
    public void Register_accepts_a_strong_password_and_matching_confirmation()
    {
        var result = new RegisterRequestValidator().Validate(new RegisterRequest("Asha", "Rao", "asha@fitforge.test", "Str0ng!Pass", "Str0ng!Pass", "+91 98765 43210"));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Register_requires_matching_confirmation()
    {
        var result = new RegisterRequestValidator().Validate(new RegisterRequest("A", "B", "a@b.test", "Str0ng!Pass", "Different!1", null));

        Assert.Contains(result.Errors, e => e.PropertyName == "confirmPassword");
    }

    [Fact]
    public void Workout_plan_reports_nested_exercise_errors_by_index()
    {
        var request = new CreateWorkoutPlanRequest(1, "Plan", null, new DateOnly(2026, 10, 29), null,
            [new WorkoutExerciseInput(DayOfWeek.Monday, "Squat", Sets: 0, Reps: 5, WeightKg: null, RestSeconds: 60, Notes: null)]);

        var result = new CreateWorkoutPlanRequestValidator().Validate(request);

        Assert.Contains(result.Errors, e => e.PropertyName == "exercises[0].sets");
    }

    [Fact]
    public void Workout_plan_end_date_cannot_precede_start_date()
    {
        var request = new CreateWorkoutPlanRequest(1, "Plan", null, new DateOnly(2026, 10, 29), new DateOnly(2026, 10, 1),
            [new WorkoutExerciseInput(DayOfWeek.Monday, "Squat", 3, 5, null, 60, null)]);

        Assert.Contains(new CreateWorkoutPlanRequestValidator().Validate(request).Errors, e => e.PropertyName == "endDate");
    }

    [Theory]
    [InlineData(-30, "The class must end after it starts.")]
    [InlineData(5 * 60, "A class can last at most 4 hours.")]
    public void Class_schedule_validates_duration(int minutes, string expectedMessage)
    {
        var start = new DateTime(2026, 11, 1, 2, 0, 0, DateTimeKind.Utc);
        var request = new CreateClassRequest("HIIT", null, start, start.AddMinutes(minutes), 10, "Studio", null);

        var result = new CreateClassRequestValidator().Validate(request);

        Assert.Contains(result.Errors, e => e.PropertyName == "endUtc" && e.ErrorMessage == expectedMessage);
    }

    [Theory]
    [InlineData(299.555, false)] // three decimals
    [InlineData(299.50, true)]
    [InlineData(-1, false)]
    public void Plan_price_must_be_non_negative_with_two_decimals(double price, bool valid)
    {
        var result = new UpsertMembershipPlanRequestValidator().Validate(new UpsertMembershipPlanRequest("Plan", null, 30, (decimal)price, true));

        Assert.Equal(valid, result.IsValid);
    }

    [Fact]
    public void Payment_amount_must_be_positive()
    {
        var result = new CreatePaymentRequestValidator().Validate(new CreatePaymentRequest(1, 0, PaymentMethod.Cash, null, null, null));

        Assert.Contains(result.Errors, e => e.PropertyName == "amount");
    }
}
