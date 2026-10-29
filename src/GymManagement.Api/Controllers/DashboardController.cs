using GymManagement.Api.Authorization;
using GymManagement.Application.DTOs.Dashboard;
using GymManagement.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GymManagement.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
public sealed class DashboardController(IDashboardService dashboards) : ControllerBase
{
    /// <summary>Gym-wide KPIs, 12-month revenue and member growth, membership status, 14-day attendance, recent activity.</summary>
    [HttpGet("admin")]
    [Authorize(Policy = Policies.AdminOnly)]
    public async Task<ActionResult<AdminDashboardDto>> Admin(CancellationToken ct) =>
        Ok(await dashboards.GetAdminAsync(ct));

    /// <summary>The signed-in trainer's members, sessions for the next 7 days, attendance and members without a plan.</summary>
    [HttpGet("trainer")]
    [Authorize(Policy = Policies.TrainerOnly)]
    public async Task<ActionResult<TrainerDashboardDto>> Trainer(CancellationToken ct) =>
        Ok(await dashboards.GetTrainerAsync(ct));

    /// <summary>The signed-in member's membership, today's workout, upcoming classes and weekly visits.</summary>
    [HttpGet("member")]
    [Authorize(Policy = Policies.MemberOnly)]
    public async Task<ActionResult<MemberDashboardDto>> Member(CancellationToken ct) =>
        Ok(await dashboards.GetMemberAsync(ct));
}
