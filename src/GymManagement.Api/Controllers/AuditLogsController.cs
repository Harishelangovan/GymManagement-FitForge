using GymManagement.Api.Authorization;
using GymManagement.Application.Common;
using GymManagement.Application.DTOs.Audit;
using GymManagement.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GymManagement.Api.Controllers;

[ApiController]
[Route("api/audit-logs")]
[Authorize(Policy = Policies.AdminOnly)]
public sealed class AuditLogsController(IAuditLogService auditLogs) : ControllerBase
{
    /// <summary>
    /// Admin actions and security events, newest first.
    /// Use ?action=auth. for security events only, or an exact action such as payment.recorded.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<AuditLogDto>>> List([FromQuery] AuditLogQuery query, CancellationToken ct) =>
        Ok(await auditLogs.ListAsync(query, ct));
}
