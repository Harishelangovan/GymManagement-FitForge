using GymManagement.Api.Authorization;
using GymManagement.Api.Extensions;
using GymManagement.Api.Filters;
using GymManagement.Api.Middleware;
using GymManagement.Application;
using GymManagement.Application.Interfaces;
using GymManagement.Infrastructure;
using GymManagement.Infrastructure.Data.Seed;

var builder = WebApplication.CreateBuilder(args);

// ---------- Services ----------
builder.Services.AddControllers(options => options.Filters.Add<ValidationFilter>());
builder.Services.AddOpenApi();

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUser>();

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddJwtAuthentication();
builder.Services.AddAppAuthorization();

var app = builder.Build();

// ---------- Database: migrations (if enabled), roles, and development seed data ----------
await app.Services.InitializeDatabaseAsync(app.Environment.IsDevelopment());

// ---------- HTTP pipeline ----------
app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi().AllowAnonymous(); // raw OpenAPI JSON at /openapi/v1.json; Swagger UI is added in Phase 5
}
else
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health").AllowAnonymous();

app.Run();

// Makes the auto-generated Program class visible to the integration-test project (Phase 9).
public partial class Program;
