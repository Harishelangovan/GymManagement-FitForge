using GymManagement.Api.Authorization;
using GymManagement.Application.Common;
using GymManagement.Application.DTOs.Training;
using GymManagement.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GymManagement.Api.Controllers;

[ApiController]
[Route("api/workout-plans")]
public sealed class WorkoutPlansController(IWorkoutPlanService plans) : ControllerBase
{
    /// <summary>Admin: all plans. Trainer: plans of their assigned members.</summary>
    [HttpGet]
    [Authorize(Policy = Policies.TrainerOrAdmin)]
    public async Task<ActionResult<PagedResult<WorkoutPlanDto>>> List([FromQuery] TrainingPlanQuery query, CancellationToken ct) =>
        Ok(await plans.ListAsync(query, ct));

    [HttpGet("my")]
    [Authorize(Policy = Policies.MemberOnly)]
    public async Task<ActionResult<IReadOnlyList<WorkoutPlanDto>>> ListMine(CancellationToken ct) =>
        Ok(await plans.ListMineAsync(ct));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<WorkoutPlanDto>> Get(int id, CancellationToken ct) =>
        Ok(await plans.GetAsync(id, ct));

    [HttpPost]
    [Authorize(Policy = Policies.TrainerOrAdmin)]
    public async Task<ActionResult<WorkoutPlanDto>> Create(CreateWorkoutPlanRequest request, CancellationToken ct)
    {
        var plan = await plans.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = plan.Id }, plan);
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = Policies.TrainerOrAdmin)]
    public async Task<ActionResult<WorkoutPlanDto>> Update(int id, UpdateWorkoutPlanRequest request, CancellationToken ct) =>
        Ok(await plans.UpdateAsync(id, request, ct));
}

[ApiController]
[Route("api/diet-plans")]
public sealed class DietPlansController(IDietPlanService plans) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = Policies.TrainerOrAdmin)]
    public async Task<ActionResult<PagedResult<DietPlanDto>>> List([FromQuery] TrainingPlanQuery query, CancellationToken ct) =>
        Ok(await plans.ListAsync(query, ct));

    [HttpGet("my")]
    [Authorize(Policy = Policies.MemberOnly)]
    public async Task<ActionResult<IReadOnlyList<DietPlanDto>>> ListMine(CancellationToken ct) =>
        Ok(await plans.ListMineAsync(ct));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<DietPlanDto>> Get(int id, CancellationToken ct) =>
        Ok(await plans.GetAsync(id, ct));

    [HttpPost]
    [Authorize(Policy = Policies.TrainerOrAdmin)]
    public async Task<ActionResult<DietPlanDto>> Create(CreateDietPlanRequest request, CancellationToken ct)
    {
        var plan = await plans.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = plan.Id }, plan);
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = Policies.TrainerOrAdmin)]
    public async Task<ActionResult<DietPlanDto>> Update(int id, UpdateDietPlanRequest request, CancellationToken ct) =>
        Ok(await plans.UpdateAsync(id, request, ct));
}

[ApiController]
[Route("api/classes")]
public sealed class ClassesController(IClassService classes) : ControllerBase
{
    /// <summary>Schedule visible to every signed-in user. Defaults to classes from today onwards.</summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<FitnessClassDto>>> List([FromQuery] ClassQuery query, CancellationToken ct) =>
        Ok(await classes.ListAsync(query, ct));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<FitnessClassDto>> Get(int id, CancellationToken ct) =>
        Ok(await classes.GetAsync(id, ct));

    [HttpPost]
    [Authorize(Policy = Policies.TrainerOrAdmin)]
    public async Task<ActionResult<FitnessClassDto>> Create(CreateClassRequest request, CancellationToken ct)
    {
        var created = await classes.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    /// <summary>Admin, or the trainer leading the class.</summary>
    [HttpPut("{id:int}")]
    [Authorize(Policy = Policies.TrainerOrAdmin)]
    public async Task<ActionResult<FitnessClassDto>> Update(int id, UpdateClassRequest request, CancellationToken ct) =>
        Ok(await classes.UpdateAsync(id, request, ct));

    /// <summary>Cancels the class and every booking for it.</summary>
    [HttpPost("{id:int}/cancel")]
    [Authorize(Policy = Policies.TrainerOrAdmin)]
    public async Task<ActionResult<FitnessClassDto>> Cancel(int id, CancellationToken ct) =>
        Ok(await classes.CancelAsync(id, ct));

    [HttpPost("{id:int}/bookings")]
    [Authorize(Policy = Policies.MemberOnly)]
    public async Task<ActionResult<ClassBookingDto>> Book(int id, CancellationToken ct) =>
        StatusCode(StatusCodes.Status201Created, await classes.BookAsync(id, ct));

    /// <summary>Allowed until 2 hours before the class starts.</summary>
    [HttpDelete("{id:int}/bookings/me")]
    [Authorize(Policy = Policies.MemberOnly)]
    public async Task<IActionResult> CancelMyBooking(int id, CancellationToken ct)
    {
        await classes.CancelMyBookingAsync(id, ct);
        return NoContent();
    }

    /// <summary>Members booked into the class, with an attended flag (admin or the class's trainer).</summary>
    [HttpGet("{id:int}/bookings")]
    [Authorize(Policy = Policies.TrainerOrAdmin)]
    public async Task<ActionResult<IReadOnlyList<ClassRosterEntryDto>>> Roster(int id, CancellationToken ct) =>
        Ok(await classes.GetRosterAsync(id, ct));

    [HttpGet("/api/bookings/my")]
    [Authorize(Policy = Policies.MemberOnly)]
    public async Task<ActionResult<PagedResult<ClassBookingDto>>> MyBookings([FromQuery] MyBookingsQuery query, CancellationToken ct) =>
        Ok(await classes.ListMyBookingsAsync(query, ct));
}

[ApiController]
[Route("api/attendance")]
public sealed class AttendanceController(IAttendanceService attendance) : ControllerBase
{
    /// <summary>Class attendance (with fitnessClassId) or a general gym check-in (without).</summary>
    [HttpPost]
    [Authorize(Policy = Policies.TrainerOrAdmin)]
    public async Task<ActionResult<AttendanceDto>> Mark(MarkAttendanceRequest request, CancellationToken ct) =>
        StatusCode(StatusCodes.Status201Created, await attendance.MarkAsync(request, ct));

    [HttpGet]
    [Authorize(Policy = Policies.TrainerOrAdmin)]
    public async Task<ActionResult<PagedResult<AttendanceDto>>> List([FromQuery] AttendanceQuery query, CancellationToken ct) =>
        Ok(await attendance.ListAsync(query, ct));

    [HttpGet("my")]
    [Authorize(Policy = Policies.MemberOnly)]
    public async Task<ActionResult<PagedResult<AttendanceDto>>> ListMine([FromQuery] PageQuery query, CancellationToken ct) =>
        Ok(await attendance.ListMineAsync(query, ct));
}
