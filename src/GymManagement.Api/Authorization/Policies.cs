using GymManagement.Domain.Common;
using Microsoft.AspNetCore.Authorization;

namespace GymManagement.Api.Authorization;

public static class Policies
{
    public const string AdminOnly = nameof(AdminOnly);
    public const string TrainerOrAdmin = nameof(TrainerOrAdmin);
    public const string TrainerOnly = nameof(TrainerOnly);
    public const string MemberOnly = nameof(MemberOnly);

    public static IServiceCollection AddAppAuthorization(this IServiceCollection services)
    {
        services.AddAuthorizationBuilder()
            // Secure by default: every endpoint requires a valid token unless it says [AllowAnonymous].
            .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build())
            .AddPolicy(AdminOnly, p => p.RequireRole(Roles.Admin))
            .AddPolicy(TrainerOrAdmin, p => p.RequireRole(Roles.Trainer, Roles.Admin))
            .AddPolicy(TrainerOnly, p => p.RequireRole(Roles.Trainer))
            .AddPolicy(MemberOnly, p => p.RequireRole(Roles.Member));

        return services;
    }
}
