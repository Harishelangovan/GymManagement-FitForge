using System.Reflection;
using Microsoft.OpenApi;

namespace GymManagement.Api.Extensions;

public static class SwaggerExtensions
{
    public static IServiceCollection AddFitForgeSwagger(this IServiceCollection services)
    {
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen(options =>
        {
            options.SwaggerDoc("v1", new OpenApiInfo
            {
                Title = "FitForge API",
                Version = "v1",
                Description = "Gym management API. Sign in with POST /api/auth/login, then click Authorize and paste the accessToken. " +
                              "/api/auth/refresh and /api/auth/logout use the HttpOnly cookie and need the header X-FitForge-Client: web."
            });

            options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
            {
                Type = SecuritySchemeType.Http,
                Scheme = "bearer",
                BearerFormat = "JWT",
                Description = "Paste the accessToken only (without the word 'Bearer')."
            });

            options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
            {
                [new OpenApiSecuritySchemeReference("Bearer", document)] = []
            });

            // The /// comments on controller actions become endpoint descriptions.
            var xmlFile = Path.Combine(AppContext.BaseDirectory, $"{Assembly.GetExecutingAssembly().GetName().Name}.xml");
            if (File.Exists(xmlFile))
            {
                options.IncludeXmlComments(xmlFile);
            }
        });

        return services;
    }

    public static WebApplication UseFitForgeSwagger(this WebApplication app)
    {
        app.UseSwagger();
        app.UseSwaggerUI(options =>
        {
            options.SwaggerEndpoint("/swagger/v1/swagger.json", "FitForge API v1");
            options.DocumentTitle = "FitForge API";
            options.DisplayRequestDuration();
        });
        return app;
    }
}
