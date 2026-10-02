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
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;

namespace GlobalAcademy.Controllers
{
    [ApiController]
    [Route("api/v3/swarm-orchestration")]
    [Authorize] // Enforces secure multi-tenant cryptographic verification automatically
    public class V3SwarmOrchestrationController : ControllerBase
    {
        private readonly Kernel _kernel;
        private readonly ApplicationDbContext _dbContext;
        private readonly IConfiguration _configuration;
        private readonly ITenantProvider _tenantProvider;
        private readonly string _baseAiEngineUrl;

        public V3SwarmOrchestrationController(
            Kernel kernel, 
            ApplicationDbContext dbContext, 
            IConfiguration configuration,
            ITenantProvider tenantProvider)
        {
            _kernel = kernel;
            _dbContext = dbContext;
            _configuration = configuration;
            _tenantProvider = tenantProvider;
            
            // Extract the isolated container bridge URL route dynamically out of appsettings
            _baseAiEngineUrl = _configuration["AiEngineSettings:BaseUrl"]?.TrimEnd('/') ?? "http://localhost:8000";
        }

        // =========================================================================
        // 📋 GREENFIELD STRONGLY TYPED DATA TRANSFER MATRIX RECORDS
        // =========================================================================
        public record V3SwarmRequestDto(string raw_user_prompt, string? court_id, string? voice_key);
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

        [HttpPost("universal-chat")]
        public async Task<IActionResult> DispatchUniversalQuery([FromBody] V3SwarmRequestDto model)
        {
            try
            {
                string userInput = model.raw_user_prompt.Trim();
                if (string.IsNullOrEmpty(userInput)) return BadRequest("Input text vector empty.");

                // 1. EXTRACTION: Pull the authenticated user's profile context tokens safely out of HTTP claims
                var currentUserName = HttpContext.User.Claims.FirstOrDefault(c => c.Type.Contains("username"))?.Value ?? HttpContext.User.Identity?.Name;
                var tenantIdClaim = HttpContext.User.FindFirst("AcademyId")?.Value;
                var userRole = HttpContext.User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "Player";
                var userId = HttpContext.User.Claims.FirstOrDefault(c => c.Type.Contains("nameidentifier"))?.Value ?? HttpContext.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                var userEmail = HttpContext.User.Claims.FirstOrDefault(c => c.Type.Contains("email"))?.Value;

                if (string.IsNullOrEmpty(currentUserName) || !Guid.TryParse(tenantIdClaim, out Guid academyGuid))
                {
                    return Unauthorized("Security Exception: Security perimeter claims unreadable.");
                }

                // 2. CONSTRUCT EXCLUSIVE CONVERSATIONAL BOUNDS HISTORY
                var chatCompletionService = _kernel.GetRequiredService<IChatCompletionService>(); 
                var chatHistory = new ChatHistory(); 

                // Establish strict role-based guardrails so the LLM acts as an assistant within boundaries 
                chatHistory.AddSystemMessage( 
                    $"You are the Smart Court OS Ambient Assistant. You are currently talking to {currentUserName}, user Id is {userId} who is a {userRole}. " + 
                    $"Your tenant partition boundary is hardlocked to AcademyId: {academyGuid}. " + 
                    "\n\nINTENT CLASSIFICATION RULES:" + 
                    "\n1. EXPLORATORY (Checking Availability): If the user asks to see open slots, check availability, or scan what is free (e.g., 'find me slots on july 21...'), you MUST use 'CheckCourtAvailabilityAsync'. This function does NOT require a court name or court ID. Call it immediately with the extracted target date." + 
                    "\n2. TRANSACTIONAL (Booking/Reserving): Only enforce mandatory parameter slot-filling rules (courtId, courtName, targetDate, startHour) if the user explicitly states they want to book, secure, reserve, or claim a specific slot." + 
                    "\n\n🚀 3. COMPLIANCE AUDITING / WEATHER EXCEPTIONS:" +
                    "\nIf the user query targets a weather cancellation, rain-out match recovery priority, racquet string performance decay curves, or lighting ballast procurement purchase orders, you MUST immediately call 'CallMultiAgentComplianceSwarmAsync' to execute the advanced LangGraph worker swarms layout paths." +
                    "\n\nCRITICAL RULES FOR FRONTEND SYNCHRONIZATION:" + 
                    "\nWhenever a plugin returns a response containing a structural action token like '[FRONTEND_ACTION:SET_DATE:YYYY-MM-DD]', you MUST preserve and append that exact token string at the absolute end of your final markdown text response to the user." 
                ); 

                chatHistory.AddUserMessage(userInput); 

                var openAiPromptExecutionSettings = new Microsoft.SemanticKernel.Connectors.OpenAI.OpenAIPromptExecutionSettings 
                { 
                    ToolCallBehavior = Microsoft.SemanticKernel.Connectors.OpenAI.ToolCallBehavior.AutoInvokeKernelFunctions 
                }; 

                // ========================================================================= 
                // INJECT VARIABLES INTO THE KERNEL'S STATE DATA DICTIONARY 
                // ========================================================================= 
                _kernel.Data["currentUserName"] = currentUserName; 
                _kernel.Data["academyId"] = academyGuid; 
                _kernel.Data["userRole"] = userRole; 
                _kernel.Data["userId"] = userId; 
                _kernel.Data["userEmail"] = userEmail; 
                _kernel.Data["voiceKey"] = model.voice_key;

                var agentResponseContent = await chatCompletionService.GetChatMessageContentAsync( 
                    chatHistory: chatHistory, 
                    executionSettings: openAiPromptExecutionSettings, 
                    kernel: _kernel); 

                string rawAgentText = agentResponseContent.Content ?? "Operation processed cleanly with no text feedback output lines.";

                string? activeThreadId = null;
                if (_kernel.Data.TryGetValue("active_swarm_thread_id", out var cachedThreadIdObj) && cachedThreadIdObj is string cachedThreadId)
                {
                    activeThreadId = cachedThreadId;
                }

                string? audio_base64 = null;
                if (_kernel.Data.TryGetValue("audio_base64", out var cachedAudioBase64Obj) && cachedAudioBase64Obj is string cachedAudioBase64)
                {
                    audio_base64 = cachedAudioBase64;
                }

                // Deliver a complete JSON object matching what your React timeline component expects!
                return Ok(new { 
                    final_response = rawAgentText,
                    audio_base64 = audio_base64,
                    thread_id = activeThreadId // 🚀 SHIPPED SECURELY DOWN TO THE REACT FRONTEND CANVAS
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Debug: {ex.Message} {ex.InnerException} ");
                return StatusCode(500, $"V3 Ingestion Pipeline Exception: {ex.Message}");
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

        [HttpGet("threads/{threadId}/footprints")]
        [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(System.Collections.Generic.IEnumerable<SwarmFootprintStepDto>))]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> GetSwarmExecutionFootprints([FromRoute] Guid threadId)
        {
            try
            {
                // 1. EXTRACTION: Securely extract multi-tenant partition scope from user claims token
                var tenantIdClaim = HttpContext.User.FindFirst("AcademyId")?.Value;
                if (!Guid.TryParse(tenantIdClaim, out Guid academyGuid))
                {
                    return Unauthorized(new { message = "Security Exception: Multi-tenant perimeter claims unreadable." });
                }

                // 2. QUERY DESIGN: Pull all recorded snapshot steps matching this specific conversation trace
                // Explicitly typing Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions to clear any IAsyncEnumerable compiler conflicts
                var checkpointSteps = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
                    .ToListAsync(_dbContext.Set<GlobalAcademy.Models.GraphStateCheckpoint>()
                        .Where(c => c.ThreadId == threadId && c.AcademyId == academyGuid)
                        .OrderBy(c => c.CreatedAtUtc) // Arrange chronologically so the timeline reads step 0 to step 31 down the screen
                        .Select(c => new SwarmFootprintStepDto(
                            c.ThreadId,
                            c.CheckpointId,
                            c.UserId,
                            c.ActiveNode,
                            c.LoopIterationCount,
                            c.SerializedState,
                            c.CreatedAtUtc
                        ))
                    );

                if (checkpointSteps == null || !checkpointSteps.Any())
                {
                    return NotFound(new { message = $"No agentic execution footprints discovered matching ThreadId '{threadId}'." });
                }

                Console.WriteLine($"📡 [C# AUDIT TRACE]: Successfully loaded {checkpointSteps.Count} swarm checkpoint steps for Thread {threadId}");
                return Ok(checkpointSteps);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Failed to extract graph tracking snapshot datasets: {ex.Message}" });
            }
        }

    }

    // 🧾 DTO to project a scannable, lightweight footprint metadata object
    public record SwarmFootprintStepDto(
        Guid ThreadId,
        string CheckpointId,
        string UserId,
        string ActiveNode,
        int LoopIterationCount,
        string SerializedState,
        DateTime CreatedAtUtc
    );

    public record V3UniversalChatRequestDto(string UserInput, string VoiceKey = "en-US-AriaNeural");
    public record V3UniversalChatResponseDto(string AgentResponse, string? AudioBase64 = null);
}
