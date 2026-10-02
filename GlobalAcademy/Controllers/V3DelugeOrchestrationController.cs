// =========================================================================
// FILE 4: INDOOR DELUGE CRISIS CORE GATEWAY CONTROLLER
// PATH: Controllers/V3DelugeOrchestrationController.cs
// DESCRIPTION: Drives emergency sensor ingestion and administrative override loops
// =========================================================================

using System;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Configuration;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using GlobalAcademy.Data; // Ensure ApplicationDbContext namespace is populated

namespace GlobalAcademy.Controllers
{
    [ApiController]
    [Route("api/v3/deluge-orchestration")]
    [Authorize] // Enforces secure JWT token extraction on inbound request streams
    public class V3DelugeOrchestrationController : ControllerBase
    {
        private readonly Kernel _kernel;
        private readonly IConfiguration _configuration;
        private readonly string _baseAiEngineUrl;

        public V3DelugeOrchestrationController(Kernel kernel, IConfiguration configuration)
        {
            _kernel = kernel;
            _configuration = configuration;
            _baseAiEngineUrl = _configuration["AiEngineSettings:BaseUrl"]?.TrimEnd('/') ?? "http://global_academy_ai_engine:8000";
        }

        // =========================================================================
        // 🧾 DTO REQUEST/RESPONSE CONTRACT OBJECTS
        // =========================================================================
        public record DelugeIngestRequestDto(
            [property: JsonPropertyName("court_id")] string CourtId,
            [property: JsonPropertyName("humidity_value")] double HumidityValue
        );

        public record DelugeOverrideRequestDto(
            [property: JsonPropertyName("thread_id")] string ThreadId,
            [property: JsonPropertyName("checkpoint_id")] string CheckpointId
        );

        public record PythonApprovalPayload(
            [property: JsonPropertyName("thread_id")] string thread_id,
            [property: JsonPropertyName("checkpoint_id")] string checkpoint_id,
            [property: JsonPropertyName("tenant_id")] string tenant_id,
            [property: JsonPropertyName("user_id")] string user_id
        );

        public record PythonApprovalResponse(
            [property: JsonPropertyName("final_response")] string final_response,
            [property: JsonPropertyName("execution_status")] string execution_status,
            [property: JsonPropertyName("thread_id")] string thread_id
        );

        // =========================================================================
        // 📡 ENDPOINT A: ALARM VECTOR INGESTION & KERNEL COMPLETION LANE
        // =========================================================================
        [HttpPost("universal-deluge-alert")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> ProcessDelugeSensorAlarm([FromBody] DelugeIngestRequestDto model)
        {
            try
            {
                if (string.IsNullOrEmpty(model.CourtId)) return BadRequest("Invalid Data State: Target Court ID cannot be blank.");

                // 1. EXTRACTION: Securely pull authenticated user identity parameters out of JWT claims tokens
                var currentUserName = HttpContext.User.Claims.FirstOrDefault(c => c.Type.Contains("username"))?.Value ?? HttpContext.User.Identity?.Name;
                var tenantIdClaim = HttpContext.User.FindFirst("AcademyId")?.Value;
                var userRole = HttpContext.User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "Player";
                var userId = HttpContext.User.Claims.FirstOrDefault(c => c.Type.Contains("nameidentifier"))?.Value ?? HttpContext.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                var userEmail = HttpContext.User.Claims.FirstOrDefault(c => c.Type.Contains("email"))?.Value;

                if (string.IsNullOrEmpty(currentUserName) || !Guid.TryParse(tenantIdClaim, out Guid academyGuid))
                {
                    return Unauthorized(new { message = "Security Perimeter Exception: Isolation claims unreadable." });
                }

                // =========================================================================
                // INJECT VARIABLES INTO THE KERNEL'S STATE DATA DICTIONARY
                // This hydrates the shared context that the plugin plucks out dynamically!
                // =========================================================================
                _kernel.Data["currentUserName"] = currentUserName;
                _kernel.Data["academyId"] = academyGuid;
                _kernel.Data["userRole"] = userRole;
                _kernel.Data["userId"] = userId ?? "usr_dev_sandbox";
                _kernel.Data["userEmail"] = userEmail ?? "sandbox@globalacademy.com";

                // 2. CONSTRUCT CONVERSATIONAL BOUNDS HISTORY FOR INTENT EVALUATIONS
                var chatCompletionService = _kernel.GetRequiredService<IChatCompletionService>();
                var chatHistory = new ChatHistory();

                chatHistory.AddSystemMessage(
                    $"You are the Smart Court OS Crisis Ambient Assistant. You are currently talking to {currentUserName} ({userRole}). " +
                    $"Your tenant boundary is locked to AcademyId: {academyGuid}. " +
                    "\n\nCRITICAL INCIDENT PROTOCOLS:" +
                    "\n1. ENVIRONMENTAL BREACH: If the incoming prompt statement indicates an indoor humidity sensor spike reaching or exceeding 65%, you MUST immediately invoke 'TriggerIndoorDelugeCrisisSwarmAsync' inside the DelugeCompliancePlugin." +
                    "\n2. DO NOT make assumptions or attempt to calculate database fields yourself. Pass the arguments directly down to the tool layout layer."
                );

                // Build a structured, context-rich statement query for the semantic analyzer
                string intentPrompt = $"CRITICAL EMERGENCY TELEMETRY REPORT: Court with registry index GUID '{model.CourtId}' has just registered a sustained indoor humidity level of {model.HumidityValue}%. Fire all mitigation swarms instantly.";
                chatHistory.AddUserMessage(intentPrompt);

                var openAiPromptExecutionSettings = new Microsoft.SemanticKernel.Connectors.OpenAI.OpenAIPromptExecutionSettings
                {
                    ToolCallBehavior = Microsoft.SemanticKernel.Connectors.OpenAI.ToolCallBehavior.AutoInvokeKernelFunctions
                };

                // Execute the completion loop—the Kernel intercepts the prompt and fires DelugeCompliancePlugin automatically!
                var agentResponseContent = await chatCompletionService.GetChatMessageContentAsync(
                    chatHistory: chatHistory,
                    executionSettings: openAiPromptExecutionSettings,
                    kernel: _kernel);

                string rawAgentText = agentResponseContent.Content ?? "Emergency operational loops committed smoothly with zero text line returns.";

                // 3. READ BACK RE-HYDRATED VARIABLES CACHED BY THE PLUGIN TRANSITIONS
                string? activeThreadId = _kernel.Data.TryGetValue("active_deluge_thread_id", out var tid) ? tid?.ToString() : null;
                string? activeCheckpointId = _kernel.Data.TryGetValue("active_deluge_checkpoint_id", out var cid) ? cid?.ToString() : null;
                string? executionStatus = _kernel.Data.TryGetValue("active_deluge_execution_status", out var status) ? status?.ToString() : "Complete";

                return Ok(new {
                    final_response = rawAgentText,
                    thread_id = activeThreadId,
                    checkpoint_id = activeCheckpointId,
                    execution_status = executionStatus
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"V3 Deluge Ingestion Pipeline Fault: {ex.Message}" });
            }
        }

        // =========================================================================
        // 📡 ENDPOINT B: HARNESS ENGINEERING HUMAN APPROVAL MANUAL OVERRIDE
        // =========================================================================
        [HttpPost("execute-harness-override")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> ExecuteHarnessApprovalOverride([FromBody] DelugeOverrideRequestDto model)
        {
            try
            {
                // Extract multi-tenant session parameters from claims to keep the database firewall secure
                var tenantIdClaim = HttpContext.User.FindFirst("AcademyId")?.Value;
                var userId = HttpContext.User.Claims.FirstOrDefault(c => c.Type.Contains("nameidentifier"))?.Value ?? HttpContext.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "usr_admin_override";

                if (!Guid.TryParse(tenantIdClaim, out Guid academyGuid))
                {
                    return Unauthorized(new { message = "Security Perimeter Exception: Isolation claims unreadable." });
                }

                // 1. ASSEMBLE LOWERCASE UNFREEZE PACKET FOR FASTAPI
                var approvalPayload = new PythonApprovalPayload(
                    thread_id: model.ThreadId,
                    checkpoint_id: model.CheckpointId,
                    tenant_id: academyGuid.ToString(),
                    user_id: userId
                );

                string absoluteRouterRoute = $"{_baseAiEngineUrl}/api/v3/deluge-swarm/approve";
                using var httpClient = new HttpClient { Timeout = TimeSpan.FromMinutes(2) };

                Console.WriteLine($"📡 [C# HARNESS OVERRIDE]: Dispatching administrative release sign-off for Thread {model.ThreadId}");
                
                // 2. TRANSMIT DOWN THE WIRE TO UNFREEZE LANGGRAPH FROM POSTGRESQL ROW
                var response = await httpClient.PostAsJsonAsync(absoluteRouterRoute, approvalPayload);

                if (!response.IsSuccessStatusCode)
                {
                    string errorText = await response.Content.ReadAsStringAsync();
                    return StatusCode(500, new { message = $"AI Engine unfreeze handshake returned an operational block: {errorText}" });
                }
                var resultData = await response.Content.ReadFromJsonAsync<PythonApprovalResponse>();
                return Ok(new {
                    final_response = resultData?.final_response ?? "Staged financial entries released and executed atomically.",
                    execution_status = resultData?.execution_status ?? "Complete"
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Failed to execute system override unfreeze: {ex.Message}" });
            }
        }
    }
}
