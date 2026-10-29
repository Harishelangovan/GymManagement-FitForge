# FitForge — Modern Gym Management System

Full-stack gym management system built with ASP.NET Core Web API (.NET 10), Entity Framework Core, SQL Server and React (Vite + TypeScript).

> Work in progress. Completed so far: architecture, database (EF Core Code-First), authentication
> (JWT access tokens, rotating refresh tokens, role-based authorization) and the REST API for members,
> trainers, membership plans, memberships, payments, workout and diet plans, classes, bookings and attendance,
> with resource-level authorization so members and trainers only reach their own records.

## Quick start (development)

Requires .NET 10 SDK and SQL Server LocalDB.

```powershell
dotnet user-secrets set "Seed:AdminPassword" "<admin password>" --project src/GymManagement.Api
dotnet user-secrets set "Seed:DemoPassword"  "<demo password>"  --project src/GymManagement.Api
dotnet user-secrets set "Jwt:SigningKey"      "<random string, 32+ bytes>" --project src/GymManagement.Api
dotnet run --project src/GymManagement.Api --launch-profile http
```

The first run creates the `FitForgeDb` database, roles, the admin `admin@fitforge.test` and demo data. Check `http://localhost:5080/health`.

Setup instructions, screenshots and API documentation will be added as the phases are completed.
