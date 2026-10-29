using GymManagement.Api.Authorization;
using GymManagement.Application.Common;
using GymManagement.Application.DTOs.People;
using GymManagement.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GymManagement.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize(Policy = Policies.AdminOnly)]
public sealed class UsersController(IUserService users) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<UserListItemDto>>> List([FromQuery] UserQuery query, CancellationToken ct) =>
        Ok(await users.ListAsync(query, ct));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<UserListItemDto>> Get(Guid id, CancellationToken ct) =>
        Ok(await users.GetAsync(id, ct));

    /// <summary>Activate or deactivate an account. Deactivation signs the user out of every device.</summary>
    [HttpPatch("{id:guid}/status")]
    public async Task<ActionResult<UserListItemDto>> SetStatus(Guid id, UpdateUserStatusRequest request, CancellationToken ct) =>
        Ok(await users.SetStatusAsync(id, request, ct));
}

[ApiController]
[Route("api/members")]
public sealed class MembersController(IMemberService members) : ControllerBase
{
    /// <summary>Admin: all members. Trainer: assigned members only.</summary>
    [HttpGet]
    [Authorize(Policy = Policies.TrainerOrAdmin)]
    public async Task<ActionResult<PagedResult<MemberListItemDto>>> List([FromQuery] MemberQuery query, CancellationToken ct) =>
        Ok(await members.ListAsync(query, ct));

    [HttpPost]
    [Authorize(Policy = Policies.AdminOnly)]
    public async Task<ActionResult<MemberDetailDto>> Create(CreateMemberRequest request, CancellationToken ct)
    {
        var member = await members.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = member.Id }, member);
    }

    [HttpGet("me")]
    [Authorize(Policy = Policies.MemberOnly)]
    public async Task<ActionResult<MemberDetailDto>> GetMine(CancellationToken ct) =>
        Ok(await members.GetMineAsync(ct));

    [HttpPut("me")]
    [Authorize(Policy = Policies.MemberOnly)]
    public async Task<ActionResult<MemberDetailDto>> UpdateMine(UpdateMemberProfileRequest request, CancellationToken ct) =>
        Ok(await members.UpdateMineAsync(request, ct));

    /// <summary>Admin, the member's assigned trainer, or the member themselves. Others get 404.</summary>
    [HttpGet("{id:int}")]
    public async Task<ActionResult<MemberDetailDto>> Get(int id, CancellationToken ct) =>
        Ok(await members.GetAsync(id, ct));

    [HttpPut("{id:int}")]
    [Authorize(Policy = Policies.AdminOnly)]
    public async Task<ActionResult<MemberDetailDto>> Update(int id, UpdateMemberProfileRequest request, CancellationToken ct) =>
        Ok(await members.UpdateAsync(id, request, ct));

    [HttpPut("{id:int}/trainer")]
    [Authorize(Policy = Policies.AdminOnly)]
    public async Task<ActionResult<MemberDetailDto>> AssignTrainer(int id, AssignTrainerRequest request, CancellationToken ct) =>
        Ok(await members.AssignTrainerAsync(id, request, ct));
}

[ApiController]
[Route("api/trainers")]
public sealed class TrainersController(ITrainerService trainers) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<TrainerDto>>> List([FromQuery] TrainerQuery query, CancellationToken ct) =>
        Ok(await trainers.ListAsync(query, ct));

    [HttpGet("me")]
    [Authorize(Policy = Policies.TrainerOnly)]
    public async Task<ActionResult<TrainerDto>> GetMine(CancellationToken ct) =>
        Ok(await trainers.GetMineAsync(ct));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<TrainerDto>> Get(int id, CancellationToken ct) =>
        Ok(await trainers.GetAsync(id, ct));

    [HttpPost]
    [Authorize(Policy = Policies.AdminOnly)]
    public async Task<ActionResult<TrainerDto>> Create(CreateTrainerRequest request, CancellationToken ct)
    {
        var trainer = await trainers.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = trainer.Id }, trainer);
    }

    /// <summary>Admin, or a trainer editing their own profile.</summary>
    [HttpPut("{id:int}")]
    [Authorize(Policy = Policies.TrainerOrAdmin)]
    public async Task<ActionResult<TrainerDto>> Update(int id, UpdateTrainerRequest request, CancellationToken ct) =>
        Ok(await trainers.UpdateAsync(id, request, ct));
}
