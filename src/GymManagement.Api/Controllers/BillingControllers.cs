using GymManagement.Api.Authorization;
using GymManagement.Application.Common;
using GymManagement.Application.DTOs.Billing;
using GymManagement.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GymManagement.Api.Controllers;

[ApiController]
[Route("api/membership-plans")]
public sealed class MembershipPlansController(IMembershipPlanService plans) : ControllerBase
{
    /// <summary>Public, so the website can show prices. ?includeInactive=true only has an effect for admins.</summary>
    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<IReadOnlyList<MembershipPlanDto>>> List([FromQuery] bool includeInactive, CancellationToken ct) =>
        Ok(await plans.ListAsync(includeInactive, ct));

    [HttpGet("{id:int}")]
    [AllowAnonymous]
    public async Task<ActionResult<MembershipPlanDto>> Get(int id, CancellationToken ct) =>
        Ok(await plans.GetAsync(id, ct));

    [HttpPost]
    [Authorize(Policy = Policies.AdminOnly)]
    public async Task<ActionResult<MembershipPlanDto>> Create(UpsertMembershipPlanRequest request, CancellationToken ct)
    {
        var plan = await plans.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = plan.Id }, plan);
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = Policies.AdminOnly)]
    public async Task<ActionResult<MembershipPlanDto>> Update(int id, UpsertMembershipPlanRequest request, CancellationToken ct) =>
        Ok(await plans.UpdateAsync(id, request, ct));
}

[ApiController]
[Route("api/memberships")]
public sealed class MembershipsController(IMembershipService memberships) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = Policies.AdminOnly)]
    public async Task<ActionResult<PagedResult<MembershipDto>>> List([FromQuery] MembershipQuery query, CancellationToken ct) =>
        Ok(await memberships.ListAsync(query, ct));

    [HttpGet("my")]
    [Authorize(Policy = Policies.MemberOnly)]
    public async Task<ActionResult<IReadOnlyList<MembershipDto>>> ListMine(CancellationToken ct) =>
        Ok(await memberships.ListMineAsync(ct));

    /// <summary>Admin, the member's assigned trainer, or the member. Others get 404.</summary>
    [HttpGet("{id:int}")]
    public async Task<ActionResult<MembershipDto>> Get(int id, CancellationToken ct) =>
        Ok(await memberships.GetAsync(id, ct));

    [HttpPost]
    [Authorize(Policy = Policies.AdminOnly)]
    public async Task<ActionResult<MembershipDto>> Create(CreateMembershipRequest request, CancellationToken ct)
    {
        var membership = await memberships.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = membership.Id }, membership);
    }

    [HttpPost("{id:int}/cancel")]
    [Authorize(Policy = Policies.AdminOnly)]
    public async Task<ActionResult<MembershipDto>> Cancel(int id, CancellationToken ct) =>
        Ok(await memberships.CancelAsync(id, ct));
}

[ApiController]
[Route("api/payments")]
public sealed class PaymentsController(IPaymentService payments) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = Policies.AdminOnly)]
    public async Task<ActionResult<PagedResult<PaymentDto>>> List([FromQuery] PaymentQuery query, CancellationToken ct) =>
        Ok(await payments.ListAsync(query, ct));

    [HttpGet("my")]
    [Authorize(Policy = Policies.MemberOnly)]
    public async Task<ActionResult<PagedResult<PaymentDto>>> ListMine([FromQuery] PageQuery query, CancellationToken ct) =>
        Ok(await payments.ListMineAsync(query, ct));

    /// <summary>Records a front-desk payment. The amount may not exceed the membership's outstanding balance.</summary>
    [HttpPost]
    [Authorize(Policy = Policies.AdminOnly)]
    public async Task<ActionResult<PaymentDto>> Create(CreatePaymentRequest request, CancellationToken ct) =>
        StatusCode(StatusCodes.Status201Created, await payments.CreateAsync(request, ct));
}
