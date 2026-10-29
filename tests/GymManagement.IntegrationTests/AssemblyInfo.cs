using GymManagement.IntegrationTests.Infrastructure;

// One API instance + one freshly seeded database shared by every test class in this assembly.
[assembly: AssemblyFixture(typeof(FitForgeApiFactory))]
