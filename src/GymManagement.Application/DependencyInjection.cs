using System.Text.Json;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;

namespace GymManagement.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        // Registers every AbstractValidator<T> in this assembly as IValidator<T>.
        services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly);

        // Error keys use camelCase ("email", not "Email") to match the JSON the frontend sends.
        ValidatorOptions.Global.PropertyNameResolver = (_, member, _) =>
            member is null ? null : JsonNamingPolicy.CamelCase.ConvertName(member.Name);
        return services;
    }
}
