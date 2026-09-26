// File: Controllers/V3SwarmOrchestrationController.cs
using System;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using System.Collections.Generic;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using GlobalAcademy.Data;
using GlobalAcademy.Models;
using GlobalAcademy.Security;

namespace GlobalAcademy.Controllers
{
    [ApiController]
    [Route("api/v3/swarm-orchestration")]
    [Authorize] // Enforces secure multi-tenant cryptographic verification automatically
    public class V3SwarmOrchestrationController : ControllerBase
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly IConfiguration _configuration;
        private readonly ITenantProvider _tenantProvider;
        private readonly string _baseAiEngineUrl;

        public V3SwarmOrchestrationController(
            ApplicationDbContext dbContext, 
            IConfiguration configuration,
            ITenantProvider tenantProvider)
        {
            _dbContext = dbContext;
            _configuration = configuration;
            _tenantProvider = tenantProvider;
            
            // Extract the isolated container bridge URL route dynamically out of appsettings
            _baseAiEngineUrl = _configuration["AiEngineSettings:BaseUrl"]?.TrimEnd('/') ?? "http://localhost:8000";
        }

        // =========================================================================
        // 📋 GREENFIELD STRONGLY TYPED DATA TRANSFER MATRIX RECORDS
        // =========================================================================
        public record V3SwarmRequestDto(string raw_user_prompt, string? court_id);
        public record PythonV3Payload(string tenant_id, string user_id, string user_role, string raw_user_prompt, string? court_id);
        public record PythonV3Response(string final_response, string execution_status, string thread_id);
        
        public record V3PendingApprovalDto(
            Guid ThreadId,
            Guid AcademyId,
            string CourtName,
            string StagedActionType,
            string StagedMaterialOrAmount,
            string CalculatedAuditLog,
            DateTime Timestamp
        );
        public record V3ResolveApprovalDto(Guid ThreadId, string HumanDecision);

        // =========================================================================
        // 📡 1. POST: EXECUTE INTENT CONTEXT THROUGH THE MULTI-AGENT SWARM
        // =========================================================================
        [HttpPost("execute-swarm-thread")]
        public async Task<IActionResult> ExecuteSwarmThread([FromBody] V3SwarmRequestDto model)
        {
            try
            {
                string userInput = model.raw_user_prompt?.Trim() ?? string.Empty;
                if (string.IsNullOrEmpty(userInput)) return BadRequest("Input prompt string empty.");

                // Extract authenticated user parameters from the secure identity token claims perimeter
                var tenantIdClaim = _tenantProvider.GetTenantId();
                var userId = HttpContext.User.Claims.FirstOrDefault(c => c.Type.Contains("nameidentifier"))?.Value 
                             ?? HttpContext.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                var userRole = HttpContext.User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "Player";

                // Compile the payload block to cross the microservice lines
                var pythonPayload = new PythonV3Payload(
                    tenant_id: tenantIdClaim.ToString(),
                    user_id: userId ?? Guid.Empty.ToString(),
                    user_role: userRole,
                    raw_user_prompt: userInput,
                    court_id: model.court_id
                );

                string targetRoute = $"{_baseAiEngineUrl}/api/v3/swarm/execute-swarm-thread";
                Console.WriteLine($"📡 [V3 SWARM PROXY]: Forwarding {userRole} thread context directly to route: {targetRoute}");

                using var httpClient = new HttpClient { Timeout = TimeSpan.FromMinutes(2) };
                var response = await httpClient.PostAsJsonAsync(targetRoute, pythonPayload);

                if (!response.IsSuccessStatusCode)
                {
                    var errorBody = await response.Content.ReadAsStringAsync();
                    return StatusCode((int)response.StatusCode, $"V3 Swarm Engine proxy rejection: {errorBody}");
                }

                var graphResult = await response.Content.ReadFromJsonAsync<PythonV3Response>();
                
                string finalOutputText = graphResult?.final_response ?? "Graph execution settled cleanly.";
                if (graphResult?.execution_status == "Paused_Pending_Approval")
                {
                    finalOutputText += $"\n\n⚠️ [V3 INTERCEPT]: High-impact transaction staged. Graph frozen under Thread ID: {graphResult.thread_id}. Awaiting director clearance in the Human-in-the-Loop sub-panel queue.";
                }

                return Ok(new { final_response = finalOutputText, thread_id = graphResult?.thread_id, execution_status = graphResult?.execution_status });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ [V3 SWARM EXECUTION ERROR]: {ex.Message} {ex.InnerException}");
                return StatusCode(500, $"V3 Gateway Handshake Failure: {ex.Message}");
            }
        }

        // =========================================================================
        // 🔎 2. GET: FETCH ALL PAUSED V3 DISPATCH CHECKPOINTS
        // =========================================================================
        [HttpGet("pending-approvals")]
        [Authorize(Roles = "AcademyDirector, GlobalAdmin")]
        public async Task<ActionResult<IEnumerable<V3PendingApprovalDto>>> GetPendingApprovals()
        {
            // 🛡️ EF Core global interceptor appends WHERE AcademyId = currentTenantId automatically
            var checkpoints = await _dbContext.GraphStateCheckpoints
                .Where(g => g.ActiveNode != "Complete" && g.SerializedState.Contains("Paused_Pending_Approval"))
                .OrderByDescending(g => g.CreatedAtUtc)
                .ToListAsync();

            var listings = new List<V3PendingApprovalDto>();

            foreach (var cp in checkpoints)
            {
                try
                {
                    using var jsonDoc = JsonDocument.Parse(cp.SerializedState);
                    var root = jsonDoc.RootElement;

                    string actionType = "PlayerRefund";
                    string materialOrAmount = "$0.00";
                    string auditLog = "Staged multi-agent transaction awaiting authorization.";

                    if (root.TryGetProperty("staged_financial_actions", out var financials) && financials.GetArrayLength() > 0)
                    {
                        var firstAction = financials.EnumerateArray().First();
                        actionType = firstAction.TryGetProperty("type", out var t) ? (t.GetString() ?? "PlayerRefund") : "PlayerRefund";
                        materialOrAmount = firstAction.TryGetProperty("amount", out var am) ? (am.GetString() ?? "$0.00") : "$0.00";
                        auditLog = firstAction.TryGetProperty("reason", out var al) ? (al.GetString() ?? auditLog) : auditLog;
                    }

                    string courtIdStr = root.TryGetProperty("court_id", out var cId) ? (cId.GetString() ?? "") : "";
                    string targetCourtName = "Broad Facility Scope";
                    
                    if (!string.IsNullOrEmpty(courtIdStr) && Guid.TryParse(courtIdStr, out var courtGuid))
                    {
                        var court = await _dbContext.Courts.FindAsync(courtGuid);
                        if (court != null) targetCourtName = court.Name;
                    }

                    listings.Add(new V3PendingApprovalDto(
                        cp.ThreadId,
                        cp.AcademyId,
                        targetCourtName,
                        actionType,
                        materialOrAmount,
                        auditLog,
                        cp.CreatedAtUtc
                    ));
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"❌ [V3 TEXT DE-SERIALIZATION ERROR]: {ex.Message}");
                }
            }

            return Ok(listings);
        }

        // =========================================================================
        // 🟢 3. POST: UNFREEZE AND COMMIT PAUSED V3 RUNTIME GRAPH LINES
        // =========================================================================
        [HttpPost("resolve-approval")]
        [Authorize(Roles = "AcademyDirector, GlobalAdmin")]
        public async Task<IActionResult> ResolveApproval([FromBody] V3ResolveApprovalDto model)
        {
            // 🔎 Query the targeted conversation checkpoint tracking row from the database
            var activeCheckpoint = await _dbContext.GraphStateCheckpoints
                .Where(g => g.ThreadId == model.ThreadId)
                .OrderByDescending(g => g.CreatedAtUtc)
                .FirstOrDefaultAsync();

            if (activeCheckpoint == null)
            {
                return NotFound("Target paused agent conversation session thread was not discovered inside active storage arrays.");
            }

            if (model.HumanDecision.Equals("Approve", StringComparison.OrdinalIgnoreCase))
            {
                // 🔓 UNFREEZE CIRCUIT: Update status parameters to release the execution circuit breakers
                activeCheckpoint.SerializedState = activeCheckpoint.SerializedState.Replace("Paused_Pending_Approval", "Approved_By_Human");
                activeCheckpoint.ActiveNode = "V3_Supervisor_Resumed_Trigger";
                
                _dbContext.GraphStateCheckpoints.Update(activeCheckpoint);
                await _dbContext.SaveChangesAsync();
                
                return Ok(new { Message = "Graph state unfrozen successfully. Signoff transmitted to worker queues." });
            }
            else
            {
                // ❌ VOID CHAIN: Cleanly purge the stalled checkpoint from the database to halt execution paths permanently
                _dbContext.GraphStateCheckpoints.Remove(activeCheckpoint);
                await _dbContext.SaveChangesAsync();
                
                return Ok(new { Message = "Staged transaction aborted. Graph context deleted cleanly from storage repository channels." });
            }
        }
    }
}
