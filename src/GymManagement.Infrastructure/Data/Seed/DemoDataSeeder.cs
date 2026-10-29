using GymManagement.Domain.Common;
using GymManagement.Domain.Entities;
using GymManagement.Domain.Enums;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace GymManagement.Infrastructure.Data.Seed;

/// <summary>
/// Development-only demo data. Every demo account uses the reserved ".test" email domain,
/// so it is obvious which records are fake. Dates are relative to today, so the dashboards
/// always show active, expiring and expired memberships, plus past and upcoming classes.
/// </summary>
internal static class DemoDataSeeder
{
    private const string DemoEmailDomain = "fitforge.test";

    // The gym operates in India (UTC+05:30). Class times are written in local time and stored as UTC.
    private static readonly TimeSpan GymUtcOffset = TimeSpan.FromHours(5.5);

    public static async Task SeedAsync(
        AppDbContext db, UserManager<ApplicationUser> userManager, SeedOptions options, ILogger logger)
    {
        // Membership plans are the marker: if any exist, demo data was already seeded (or real data exists).
        if (await db.MembershipPlans.AnyAsync())
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(options.DemoPassword))
        {
            logger.LogWarning("Demo data not created: set Seed:DemoPassword with 'dotnet user-secrets'");
            return;
        }

        var admin = await userManager.FindByEmailAsync(options.AdminEmail ?? string.Empty)
            ?? throw new InvalidOperationException("Demo data needs the development admin; set Seed:AdminEmail/AdminPassword.");

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // ---------- Membership plans ----------
        var monthly = new MembershipPlan { Name = "Monthly", DurationDays = 30, Price = 1500m, Description = "Full gym access for 30 days." };
        var quarterly = new MembershipPlan { Name = "Quarterly", DurationDays = 90, Price = 4000m, Description = "Full gym access for 90 days." };
        var halfYearly = new MembershipPlan { Name = "Half-Yearly", DurationDays = 180, Price = 7500m, Description = "Full gym access plus 2 personal training sessions." };
        var annual = new MembershipPlan { Name = "Annual", DurationDays = 365, Price = 13000m, Description = "Full gym access, 6 personal training sessions and a diet consultation." };
        db.MembershipPlans.AddRange(monthly, quarterly, halfYearly, annual);

        // ---------- Trainers ----------
        var arjun = await CreateTrainerAsync(userManager, options.DemoPassword, "arjun.trainer", "Arjun", "Mehta",
            "Strength & Conditioning", 6, "Certified strength coach focused on progressive overload and form.");
        var priya = await CreateTrainerAsync(userManager, options.DemoPassword, "priya.trainer", "Priya", "Nair",
            "Yoga & Mobility", 4, "Yoga instructor specialising in mobility, posture and recovery.");
        db.TrainerProfiles.AddRange(arjun, priya);

        // ---------- Members ----------
        // (login prefix, first, last, gender, assigned trainer, plan, membership start offset in days)
        var memberSeeds = new (string Login, string First, string Last, Gender Gender, TrainerProfile Trainer, MembershipPlan Plan, int StartOffset)[]
        {
            ("rahul.member",   "Rahul",   "Sharma", Gender.Male,   arjun, annual,     -120), // active, long way to go
            ("sneha.member",   "Sneha",   "Iyer",   Gender.Female, priya, quarterly,  -30),  // active
            ("karthik.member", "Karthik", "Raj",    Gender.Male,   arjun, monthly,    -25),  // expires in ~5 days
            ("divya.member",   "Divya",   "Menon",  Gender.Female, priya, halfYearly, -10),  // active, partly paid
            ("vikram.member",  "Vikram",  "Singh",  Gender.Male,   arjun, monthly,    -45),  // expired 15 days ago
            ("ananya.member",  "Ananya",  "Das",    Gender.Female, priya, quarterly,  -5),   // new member
        };

        var members = new List<MemberProfile>();
        foreach (var seed in memberSeeds)
        {
            var member = await CreateMemberAsync(userManager, options.DemoPassword, seed.Login, seed.First, seed.Last, seed.Gender, today.AddDays(seed.StartOffset));
            member.AssignedTrainer = seed.Trainer;
            members.Add(member);

            var membership = new Membership
            {
                MemberProfile = member,
                MembershipPlan = seed.Plan,
                StartDate = today.AddDays(seed.StartOffset),
                EndDate = today.AddDays(seed.StartOffset + seed.Plan.DurationDays - 1),
                PriceAtPurchase = seed.Plan.Price,
                Status = MembershipStatus.Active
            };

            // Divya has paid only part of her plan, so the "outstanding balance" feature has something to show.
            var amountPaid = seed.Login == "divya.member" ? 4000m : seed.Plan.Price;
            membership.Payments.Add(new Payment
            {
                MemberProfile = member,
                Amount = amountPaid,
                Method = members.Count % 2 == 0 ? PaymentMethod.Upi : PaymentMethod.Card,
                ReferenceNumber = $"DEMO-{seed.Login.Split('.')[0].ToUpperInvariant()}-001",
                PaidUtc = membership.StartDate.ToDateTime(new TimeOnly(5, 0), DateTimeKind.Utc),
                RecordedByUserId = admin.Id,
                Notes = "Demo payment"
            });

            db.MemberProfiles.Add(member);
            db.Memberships.Add(membership);
        }

        // ---------- Classes: past 7 days (with attendance) and next 7 days (with bookings) ----------
        var activeMembers = members.Take(4).ToList(); // Rahul, Sneha, Karthik, Divya have active memberships
        for (var dayOffset = -7; dayOffset <= 7; dayOffset++)
        {
            if (dayOffset == 0)
            {
                continue;
            }

            var date = today.AddDays(dayOffset);
            if (date.DayOfWeek == DayOfWeek.Sunday)
            {
                continue; // gym closed on Sundays
            }

            var strength = NewClass("Strength Circuit", "Full-body barbell and dumbbell circuit.", arjun, date, new TimeOnly(7, 0), 60, 15, "Weights Floor");
            var yoga = NewClass("Morning Yoga Flow", "Mobility-focused vinyasa flow for all levels.", priya, date, new TimeOnly(6, 30), 45, 20, "Studio A");
            db.FitnessClasses.AddRange(strength, yoga);

            foreach (var (fitnessClass, attendees) in new[] { (strength, activeMembers.Take(3)), (yoga, activeMembers.Skip(1)) })
            {
                foreach (var member in attendees)
                {
                    fitnessClass.Bookings.Add(new ClassBooking
                    {
                        MemberProfile = member,
                        Status = BookingStatus.Booked,
                        BookedUtc = fitnessClass.StartUtc.AddDays(-2)
                    });

                    if (dayOffset < 0)
                    {
                        fitnessClass.Attendances.Add(new Attendance
                        {
                            MemberProfile = member,
                            CheckInUtc = fitnessClass.StartUtc.AddMinutes(-5),
                            MarkedByUserId = fitnessClass == strength ? arjun.UserId : priya.UserId
                        });
                    }
                }
            }
        }

        // ---------- Workout plans ----------
        db.WorkoutPlans.Add(new WorkoutPlan
        {
            MemberProfile = members[0],
            TrainerProfile = arjun,
            Title = "Hypertrophy Phase 1",
            Goal = "Build muscle with a 3-day push / pull / legs split.",
            StartDate = today.AddDays(-14),
            Exercises =
            {
                new WorkoutExercise { DayOfWeek = DayOfWeek.Monday, SortOrder = 1, Name = "Barbell Bench Press", Sets = 4, Reps = 8, WeightKg = 60, RestSeconds = 120 },
                new WorkoutExercise { DayOfWeek = DayOfWeek.Monday, SortOrder = 2, Name = "Overhead Press", Sets = 3, Reps = 10, WeightKg = 35, RestSeconds = 90 },
                new WorkoutExercise { DayOfWeek = DayOfWeek.Wednesday, SortOrder = 1, Name = "Deadlift", Sets = 4, Reps = 5, WeightKg = 100, RestSeconds = 180 },
                new WorkoutExercise { DayOfWeek = DayOfWeek.Wednesday, SortOrder = 2, Name = "Lat Pulldown", Sets = 3, Reps = 12, WeightKg = 45, RestSeconds = 90 },
                new WorkoutExercise { DayOfWeek = DayOfWeek.Friday, SortOrder = 1, Name = "Back Squat", Sets = 4, Reps = 8, WeightKg = 80, RestSeconds = 150 },
                new WorkoutExercise { DayOfWeek = DayOfWeek.Friday, SortOrder = 2, Name = "Walking Lunges", Sets = 3, Reps = 12, RestSeconds = 90, Notes = "12 reps per leg" }
            }
        });

        db.WorkoutPlans.Add(new WorkoutPlan
        {
            MemberProfile = members[1],
            TrainerProfile = priya,
            Title = "Mobility & Core",
            Goal = "Improve flexibility and core stability.",
            StartDate = today.AddDays(-7),
            Exercises =
            {
                new WorkoutExercise { DayOfWeek = DayOfWeek.Tuesday, SortOrder = 1, Name = "Plank", Sets = 3, Reps = 1, RestSeconds = 60, Notes = "Hold 45 seconds" },
                new WorkoutExercise { DayOfWeek = DayOfWeek.Tuesday, SortOrder = 2, Name = "Bird Dog", Sets = 3, Reps = 12, RestSeconds = 45 },
                new WorkoutExercise { DayOfWeek = DayOfWeek.Thursday, SortOrder = 1, Name = "Hip Flexor Stretch", Sets = 2, Reps = 1, RestSeconds = 30, Notes = "Hold 60 seconds per side" },
                new WorkoutExercise { DayOfWeek = DayOfWeek.Thursday, SortOrder = 2, Name = "Glute Bridge", Sets = 3, Reps = 15, RestSeconds = 45 }
            }
        });

        // ---------- Diet plans ----------
        db.DietPlans.AddRange(
            new DietPlan
            {
                MemberProfile = members[0],
                TrainerProfile = arjun,
                Title = "Lean Bulk – 2,800 kcal",
                DailyCalories = 2800,
                ProteinGrams = 150,
                Breakfast = "Oats with milk, banana and 2 boiled eggs",
                Lunch = "Rice, dal, chicken curry (150 g) and salad",
                Dinner = "Chapati (3), paneer bhurji and sautéed vegetables",
                Snacks = "Greek yogurt, peanuts, whey protein shake"
            },
            new DietPlan
            {
                MemberProfile = members[1],
                TrainerProfile = priya,
                Title = "Balanced Vegetarian – 1,900 kcal",
                DailyCalories = 1900,
                ProteinGrams = 90,
                Breakfast = "Vegetable poha and a glass of buttermilk",
                Lunch = "Brown rice, rajma, curd and cucumber salad",
                Dinner = "Millet roti (2), mixed vegetable curry and tofu",
                Snacks = "Fruit bowl, roasted chana"
            });

        await db.SaveChangesAsync();
        logger.LogInformation("Seeded demo data: 2 trainers, {MemberCount} members, 4 plans, classes for ±7 days", members.Count);
    }

    private static FitnessClass NewClass(string title, string description, TrainerProfile trainer, DateOnly date,
        TimeOnly localStart, int durationMinutes, int capacity, string location)
    {
        var startUtc = DateTime.SpecifyKind(date.ToDateTime(localStart) - GymUtcOffset, DateTimeKind.Utc);
        return new FitnessClass
        {
            Title = title,
            Description = description,
            TrainerProfile = trainer,
            StartUtc = startUtc,
            EndUtc = startUtc.AddMinutes(durationMinutes),
            Capacity = capacity,
            Location = location
        };
    }

    private static async Task<TrainerProfile> CreateTrainerAsync(UserManager<ApplicationUser> userManager, string password,
        string login, string firstName, string lastName, string specialization, int years, string bio)
    {
        var user = await CreateUserAsync(userManager, password, login, firstName, lastName, Roles.Trainer);
        return new TrainerProfile
        {
            UserId = user.Id,
            Specialization = specialization,
            YearsOfExperience = years,
            Bio = bio
        };
    }

    private static async Task<MemberProfile> CreateMemberAsync(UserManager<ApplicationUser> userManager, string password,
        string login, string firstName, string lastName, Gender gender, DateOnly joinedOn)
    {
        var user = await CreateUserAsync(userManager, password, login, firstName, lastName, Roles.Member);
        return new MemberProfile
        {
            UserId = user.Id,
            Gender = gender,
            JoinedOn = joinedOn,
            FitnessGoal = "General fitness",
            HeightCm = gender == Gender.Male ? 175m : 162m,
            WeightKg = gender == Gender.Male ? 74m : 58m
        };
    }

    private static async Task<ApplicationUser> CreateUserAsync(UserManager<ApplicationUser> userManager, string password,
        string login, string firstName, string lastName, string role)
    {
        var email = $"{login}@{DemoEmailDomain}";
        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            FirstName = firstName,
            LastName = lastName,
            PhoneNumber = "+91 90000 00000"
        };

        DatabaseInitializer.EnsureSucceeded(await userManager.CreateAsync(user, password), $"create demo user {email}");
        DatabaseInitializer.EnsureSucceeded(await userManager.AddToRoleAsync(user, role), $"assign {role} to {email}");
        return user;
    }
}
