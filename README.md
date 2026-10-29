# FitForge — Modern Gym Management System

Full-stack gym management system built with ASP.NET Core Web API (.NET 10), Entity Framework Core, SQL Server and React (Vite + TypeScript).

> Work in progress. Completed so far: architecture, database (EF Core Code-First), authentication
> (JWT access tokens, rotating refresh tokens, role-based authorization) and the REST API for members,
> trainers, membership plans, memberships, payments, workout and diet plans, classes, bookings and attendance,
> with resource-level authorization so members and trainers only reach their own records.
> Hardened with rate limiting, strict CORS, security headers, audit logging of admin actions and security
> events, structured logging (Serilog) and Swagger documentation.
> The React frontend covers every role end to end: sign-in flows, live dashboards, member and trainer
> management, membership plans, memberships and payments, workout and diet plan editors, a weekly class
> schedule with booking and attendance, and an audit log viewer. Automated test suites and final
> documentation are next.

## Quick start (development)

Requires .NET 10 SDK, SQL Server LocalDB and Node.js 20+.

### 1. API

```powershell
dotnet user-secrets set "Seed:AdminPassword" "<admin password>" --project src/GymManagement.Api
dotnet user-secrets set "Seed:DemoPassword"  "<demo password>"  --project src/GymManagement.Api
dotnet user-secrets set "Jwt:SigningKey"      "<random string, 32+ bytes>" --project src/GymManagement.Api
dotnet run --project src/GymManagement.Api --launch-profile http
```

The first run creates the `FitForgeDb` database, roles, the admin `admin@fitforge.test` and demo data. Check `http://localhost:5080/health`, and explore the API at `http://localhost:5080/swagger` (sign in with `POST /api/auth/login`, then click **Authorize** and paste the access token).

### 2. Frontend

```powershell
cd client
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite dev server forwards `/api` to the API, so the browser talks to a single origin and the HttpOnly refresh-token cookie works without CORS.

Demo sign-ins: `admin@fitforge.test` (admin password), `arjun.trainer@fitforge.test` and `rahul.member@fitforge.test` (demo password).

Setup instructions, screenshots and API documentation will be added as the phases are completed.
