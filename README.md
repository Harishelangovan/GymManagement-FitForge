# FitForge — Modern Gym Management System

Full-stack gym management system built with ASP.NET Core Web API (.NET 10), Entity Framework Core, SQL Server and React (Vite + TypeScript).

> Work in progress. Current status: **Phase 2 (database, entities, migrations, seed data) complete.**
> - [Phase 1 — Architecture](docs/phase-1-architecture.md)
> - [Phase 2 — Database setup](docs/phase-2-database.md)

## Quick start (development)

Requires .NET 10 SDK and SQL Server LocalDB.

```powershell
dotnet user-secrets set "Seed:AdminPassword" "<admin password>" --project src/GymManagement.Api
dotnet user-secrets set "Seed:DemoPassword"  "<demo password>"  --project src/GymManagement.Api
dotnet run --project src/GymManagement.Api --launch-profile http
```

The first run creates the `FitForgeDb` database, roles, the admin `admin@fitforge.test` and demo data. Check `http://localhost:5080/health`.

Setup instructions, screenshots and API documentation will be added as the phases are completed.
