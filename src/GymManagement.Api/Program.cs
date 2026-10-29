using GymManagement.Infrastructure;
using GymManagement.Infrastructure.Data.Seed;

var builder = WebApplication.CreateBuilder(args);

// ---------- Services ----------
builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddInfrastructure(builder.Configuration);

var app = builder.Build();

// ---------- Database: migrations (if enabled), roles, and development seed data ----------
await app.Services.InitializeDatabaseAsync(app.Environment.IsDevelopment());

// ---------- HTTP pipeline ----------
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi(); // raw OpenAPI JSON at /openapi/v1.json; Swagger UI is added in Phase 5
}

app.UseHttpsRedirection();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health");

app.Run();

// Makes the auto-generated Program class visible to the integration-test project (Phase 9).
public partial class Program;
