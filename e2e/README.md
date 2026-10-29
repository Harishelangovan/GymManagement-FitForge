# Browser end-to-end checks

Real-browser checks that drive the React app through headless Edge (or Chrome) with `puppeteer-core`.
They complement the .NET integration tests by covering what only a browser can show: routing and guards,
forms, charts, session refresh, responsive layout and console errors.

| Suite | What it covers |
|---|---|
| `dashboards.e2e.mjs` | Admin, trainer and member dashboards against the seed data (light/dark, mobile) |
| `workflows.e2e.mjs` | Admin → trainer → member flows: members, plans, payments, classes, bookings, workouts |
| `auth.e2e.mjs` | Sign-in, guards, registration, password change and reset, silent token refresh |

## Running

1. Start from a freshly seeded database (the dashboard suite asserts exact seed figures):
   `dotnet ef database drop --force --project src/GymManagement.Infrastructure --startup-project src/GymManagement.Api`
2. Start the API with rate limiting off (the suites sign in many times):
   `RateLimiting__Enabled=false dotnet run --project src/GymManagement.Api`
3. Start the client: `npm run dev` in `client/`.
4. In `e2e/`, install once with `npm install`, then:

```bash
export FITFORGE_ADMIN_PASSWORD=...   # the API's Seed:AdminPassword
export FITFORGE_DEMO_PASSWORD=...    # the API's Seed:DemoPassword
npm test
```

Optional: `FITFORGE_APP_URL` (default `http://localhost:5173`), `BROWSER_PATH` (if Edge/Chrome is not in a
standard location), `HEADED=1` to watch the browser. Screenshots are written to `e2e/shots/` (gitignored).
Each suite prints PASS/FAIL per check and exits non-zero if anything failed.
