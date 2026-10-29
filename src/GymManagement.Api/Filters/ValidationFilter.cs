using FluentValidation;
using GymManagement.Application.Common.Exceptions;
using Microsoft.AspNetCore.Mvc.Filters;

namespace GymManagement.Api.Filters;

/// <summary>
/// Runs the FluentValidation validator (if one exists) for every action argument before the
/// controller method executes. Invalid requests never reach the services.
/// </summary>
public sealed class ValidationFilter : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        foreach (var argument in context.ActionArguments.Values)
        {
            if (argument is null)
            {
                continue;
            }

            var validatorType = typeof(IValidator<>).MakeGenericType(argument.GetType());
            if (context.HttpContext.RequestServices.GetService(validatorType) is not IValidator validator)
            {
                continue;
            }

            var result = await validator.ValidateAsync(
                new ValidationContext<object>(argument), context.HttpContext.RequestAborted);

            if (!result.IsValid)
            {
                throw new RequestValidationException(result.ToDictionary());
            }
        }

        await next();
    }
}
