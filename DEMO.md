# FitForge — 5-minute demo

A guided walkthrough that shows each role, the main business rules and the security model. Start from a **freshly seeded database** so the numbers match:

```powershell
dotnet ef database drop --force --project src/GymManagement.Infrastructure --startup-project src/GymManagement.Api
dotnet run --project src/GymManagement.Api --launch-profile http     # re-creates and seeds the database
cd client; npm run dev                                                # http://localhost:5173
```

Passwords are the ones you set with `dotnet user-secrets` (see the README). The sign-in page has **Admin / Trainer / Member** buttons that fill in the demo emails.

---

## 1. Admin: run the gym (about 2 min)

Sign in as **admin@fitforge.test**.

1. **Dashboard.** 5 of 6 members active, ₹9,500 revenue this month (+72.7% vs last month), 1 membership expiring within 7 days, ₹3,500 dues open.
   - Hover a revenue bar for the tooltip, and switch a chart to **Table** (accessible view).
   - Toggle the theme (sun/moon icon): the charts repaint with a light-mode palette.
2. **Members → Rahul Sharma.** Profile, assigned trainer (Arjun), membership and payment history.
3. **Memberships → Expiring soon.** Karthik is listed. Click **Sell membership** for him: the renewal **starts the day after** his current one ends, so nobody loses paid days.
4. **Memberships → Divya.** She has a **₹3,500 balance**. Click **Collect balance** and try ₹4,000: the API rejects overpayment. Pay ₹3,500 and the balance becomes ₹0.
5. **Classes.** The week view shows capacity bars. Schedule a class for Arjun at the same time as one of his existing classes: rejected, because a trainer can't be double-booked.
6. **Audit log.** Every action you just took is listed, with who, what and when. Switch to **Security events** to see failed sign-ins.

## 2. Trainer: coach your members (about 1 min)

Sign out, then sign in as **arjun.trainer@fitforge.test**.

1. **Dashboard.** Today's sessions, bookings for the next 7 days, and members who still need a workout plan.
2. **My members.** Only Arjun's assigned members appear. Opening another trainer's member (e.g. `/trainer/members/2`) shows "Member not found": the API returns 404, not just a hidden button.
3. **Workout plans → New plan.** Pick **Rahul**, add exercises per weekday (sets, reps, weight, rest) and save. The new plan becomes his active plan and retires the previous one.

## 3. Member: train and book (about 1 min)

Sign out, then sign in as **rahul.member@fitforge.test**.

1. **Dashboard.** Membership progress, trainer card, today's workout (or a rest day) and upcoming classes.
2. **Classes.** Book an open class. Then try to cancel one that starts within 2 hours: blocked with a clear message.
3. **Workouts.** The plan Arjun just wrote appears, grouped by day.
4. Resize the browser to phone width: every screen adapts, with no sideways scrolling.

Optional: sign in as **vikram.member@fitforge.test** (expired membership) and try to book a class. The API refuses because the membership isn't active.

## 4. Security, in 1 minute

- **Session:** open DevTools → Application. Local Storage holds only the theme preference, never a token. The refresh token is an **HttpOnly** cookie the page can't read, and the access token lives only in memory and expires in 15 minutes. Reload the page: you stay signed in through a silent refresh.
- **Brute force:** sign out and enter a wrong password for **vikram.member@fitforge.test** 5 times. The account locks (even the right password is refused for a while), and a further quick attempt from the same IP is rate-limited (HTTP 429). Use Vikram so the accounts you're still demoing stay usable.
- **Swagger** (`http://localhost:5080/swagger`): call `GET /api/members` without a token (401), with a member token (403), then `GET /api/members/2` as Rahul (404).

## 5. Tests

```powershell
dotnet test        # 80 .NET tests in about 10 s, including a 5-way concurrent booking race for the last spot
cd client; npm test
```
