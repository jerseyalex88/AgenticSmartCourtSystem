// =========================================================================
// FILE 3: INDOOR DELUGE CRISIS CORE SEMANTIC KERNEL PLUGIN
// PATH: Plugins/DelugeCompliancePlugin.cs
// DESCRIPTION: Relational interceptor proxy packing the 72% humidity payload
// =========================================================================

using System;
using System.ComponentModel;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.SemanticKernel;
using Microsoft.Extensions.Configuration;
using GlobalAcademy.Data; // Ensure ApplicationDbContext namespace is populated

namespace GlobalAcademy.Plugins
{
    public class DelugeCompliancePlugin
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly IConfiguration _configuration;
        private readonly string _baseAiEngineUrl;

        public DelugeCompliancePlugin(ApplicationDbContext dbContext, IConfiguration configuration)
        {
            _dbContext = dbContext;
            _configuration = configuration;
            _baseAiEngineUrl = _configuration["AiEngineSettings:BaseUrl"]?.TrimEnd('/') ?? "http://global_academy_ai_engine:8000";
        }

        // 🚀 PYDANTIC LOWERCASE CONTRACT MATCHING PYTHON'S DELUGETRIGGERPAYLOAD EXACTLY
        public record PythonDelugePayload(
            string tenant_id,
            string branch_id,
            string court_id,
            double telemetry_reading_value,
            string user_id,
            string user_role
        );

        public record PythonDelugeResponse(
            string final_response,
            string execution_status,
            string thread_id,
            string checkpoint_id
        );

        [KernelFunction, Description("Triggers the emergency Multi-Agent Indoor Deluge environmental crisis swarm loop. " +
                                    "Invoke this tool immediately whenever live telemetry logs an indoor humidity spike " +
                                    "breaching the critical safety thresholds (e.g., 72% humidity).")]
        public async Task<string> TriggerIndoorDelugeCrisisSwarmAsync(
            Kernel kernel,
            [Description("The exact string identifier Guid token of the physical court experiencing the breach.")] string courtGuidToken,
            [Description("The real-time numeric reading value showing the humidity percentage surge.")] double humidityBreachValue)
        {
            // 1. EXTRACTION: Pull authenticated multi-tenant profile context boundaries from the universal data pool
            if (!kernel.Data.TryGetValue("academyId", out var academyIdObj) || academyIdObj is not Guid academyGuid)
                return "Crisis Execution Aborted: Missing or invalid security academy perimeter claim scope.";
            if (!kernel.Data.TryGetValue("userId", out var userIdObj) || userIdObj is not string userId)
                return "Crisis Execution Aborted: User context mapping verification fault (userId).";
            if (!kernel.Data.TryGetValue("userRole", out var userRoleObj) || userRoleObj is not string userRole)
                return "Crisis Execution Aborted: User context mapping verification fault (userRole).";

            if (!Guid.TryParse(courtGuidToken, out Guid courtGuid))
            {
                return "Crisis Execution Aborted: Supplied court token identifier is not a valid GUID framework format.";
            }

            string derivedBranchId = string.Empty;

            try
            {
                // 2. RELATION LOOKUP: Query courts table natively to find the parent branch holding this asset
                // Calling the extension method explicitly with the generic model parameter to block any IAsyncEnumerable conflicts
                var targetCourt = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
                    .FirstOrDefaultAsync(_dbContext.Courts, c => c.Id == courtGuid && c.AcademyId == academyGuid);

                if (targetCourt == null)
                {
                    return $"Crisis Execution Aborted: Asset tracking failure. Court '{courtGuidToken}' not found inside this tenant partition layout.";
                }

                // Extract the true parent branch ID cleanly with 0 hardcoding!
                derivedBranchId = targetCourt.BranchId.ToString();
                Console.WriteLine($"🎯 [C# DELUGE PRE-FLIGHT INTERCEPT]: Target Asset Verified. Court GUID: {courtGuidToken} | Resolved Parent Branch GUID: {derivedBranchId}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"⚠️ [C# DELUGE PRE-FLIGHT EXCEPTION]: Failed to resolve relational branch map: {ex.Message}");
                return $"Crisis Execution Aborted: Relational lookup connection database failure: {ex.Message}";
            }

            try
            {
                // 3. ASSEMBLE JSON ENVELOPE CONTRACT
                var requestPayload = new PythonDelugePayload(
                    tenant_id: academyGuid.ToString(),
                    branch_id: derivedBranchId,
                    court_id: courtGuidToken,
                    telemetry_reading_value: humidityBreachValue,
                    user_id: userId,
                    user_role: userRole
                );

                string absoluteRouterRoute = $"{_baseAiEngineUrl}/api/v3/deluge-swarm/execute";
                using var httpClient = new HttpClient { Timeout = TimeSpan.FromMinutes(2) };
                
                // Transmit the fully parameterized packet across the inner Docker network wires
                var response = await httpClient.PostAsJsonAsync(absoluteRouterRoute, requestPayload);

                if (!response.IsSuccessStatusCode)
                {
                    string errorText = await response.Content.ReadAsStringAsync();
                    return $"📟 CONTROL NOTICE: The advanced deluge swarm network layer returned an execution block: {errorText}";
                }

                var resultData = await response.Content.ReadFromJsonAsync<PythonDelugeResponse>();
                
                if (resultData != null)
                {
                    // Cache the thread and checkpoint keys directly inside the kernel memory dictionary
                    // This lets the downstream UI and controller find the frozen state for human approvals later!
                    kernel.Data["active_deluge_thread_id"] = resultData.thread_id;
                    kernel.Data["active_deluge_checkpoint_id"] = resultData.checkpoint_id;
                    kernel.Data["active_deluge_execution_status"] = resultData.execution_status;
                }

                return resultData?.final_response ?? "Emergency environmental swarm executed and logged successfully.";
            }
            catch (Exception ex)
            {
                return $"Harness Error: Failed to bridge crisis data loops to AI Engine: {ex.Message}";
            }
        }
    }
}
