using System;
using System.ComponentModel;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.SemanticKernel;
using Microsoft.Extensions.Configuration;
using GlobalAcademy.Data;
using GlobalAcademy.Models;
using Microsoft.EntityFrameworkCore;

namespace GlobalAcademy.Plugins
{
    public class LangGraphCompliancePlugin
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly IConfiguration _configuration;
        private readonly string _baseAiEngineUrl;

        public LangGraphCompliancePlugin(IConfiguration configuration, ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
            _configuration = configuration;
            // Reads your Docker bridge network routing URL directly out of appsettings
            _baseAiEngineUrl = configuration["AiEngineSettings:BaseUrl"]?.TrimEnd('/') ?? "http://localhost:8000";
        }

        // Strongly typed payload parameters container matching Python SwarmExecutionPayload signatures
        public record PythonSwarmPayload(
            string tenant_id,
            string user_id,
            string user_role,
            string raw_user_prompt,
            string? court_id,
            string? branch_id 
        );

        // Strongly typed return format container matching Python response shapes
        public record PythonSwarmResponse(
            string final_response,
            string execution_status,
            string thread_id
        );

        // =========================================================================
        // 🧠 KERNEL FUNCTION: DELEGATE MULTIFACETED OPERATIONS TO PYTHON SWARM
        // =========================================================================
        [KernelFunction, Description("Invokes the advanced Multi-Agent compliance, RAG auditing, and predictive analytics engine. " +
                                    "Call this tool immediately whenever a user asks about complex facility exceptions, weather rainouts, " +
                                    "insurance liabilities, racquet tension decay curves, or material tickets.")]
        public async Task<string> CallMultiAgentComplianceSwarmAsync(
            Kernel kernel,
            [Description("The exact raw user text statement carrying the court context name.")] string rawUserQuery)
        {
            // 1. Unpack security claims mapped dynamically via universal controller context data dictionary
            if (!kernel.Data.TryGetValue("academyId", out var academyIdObj) || academyIdObj is not Guid academyGuid)
                return "Transaction rejected: Missing or invalid security academy perimeter claim scope.";
            if (!kernel.Data.TryGetValue("userId", out var userIdObj) || userIdObj is not string userId)
                return "Transaction rejected: User context mapping verification fault (userId).";
            if (!kernel.Data.TryGetValue("userRole", out var userRoleObj) || userRoleObj is not string userRole)
                return "Transaction rejected: User context mapping verification fault (userRole).";

            string? derivedCourtId = null;
            string? derivedBranchId = null;

            try
            {
                // 🚀 2. DYNAMIC RELATION RESOLUTION: Query active courts to find which one is named inside the query string
                var activeCourts = await _dbContext.Courts
                    .Where(c => c.AcademyId == academyGuid && !c.IsDecommissioned)
                    .ToListAsync<Court>();

                Console.WriteLine($"Debug Courts count: {activeCourts.Count}");
                Console.WriteLine($"Debug rawUserQuery: {rawUserQuery}");

                var matchedCourt = activeCourts.FirstOrDefault(c => 
                    !string.IsNullOrEmpty(c.Name) && 
                    rawUserQuery.Contains(c.Name, StringComparison.OrdinalIgnoreCase));

                if (matchedCourt != null)
                {
                    derivedCourtId = matchedCourt.Id.ToString();
                    // Natively extracts the mandatory non-nullable property with 0 hardcoding!
                    derivedBranchId = matchedCourt.BranchId.ToString(); 
                    Console.WriteLine($"🎯 [C# PRE-FLIGHT INTERCEPT]: Found '{matchedCourt.Name}'. Court GUID: {derivedCourtId} | Resolved Branch GUID: {derivedBranchId}");
                }
                else
                {
                    Console.WriteLine($"🎯 [C# PRE-FLIGHT INTERCEPT]: Nothing Found");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"⚠️ [C# PRE-FLIGHT EXCEPTION]: Failed to run relational data queries: {ex.Message}");
            }

            try
            {
                // 3. Assemble the payload contract containing 100% complete state parameters
                var requestPayload = new PythonSwarmPayload(
                    tenant_id: academyGuid.ToString(),
                    user_id: userId,
                    user_role: userRole,
                    raw_user_prompt: rawUserQuery,
                    court_id: derivedCourtId,
                    branch_id: derivedBranchId
                );

                string absoluteExecutionRoute = $"{_baseAiEngineUrl}/api/v3/swarm/execute-swarm-thread";
                using var httpClient = new HttpClient { Timeout = TimeSpan.FromMinutes(2) };
                var response = await httpClient.PostAsJsonAsync(absoluteExecutionRoute, requestPayload);

                if (!response.IsSuccessStatusCode)
                    return "📟 CONTROL NOTICE: The advanced operational audit network layer returned an execution block.";

                var resultData = await response.Content.ReadFromJsonAsync<PythonSwarmResponse>();

                if (resultData != null && !string.IsNullOrEmpty(resultData.thread_id))
                {
                    // 🚀 FIXED: Cache the live multi-agent thread ID securely inside the Kernel's state data loop!
                    kernel.Data["active_swarm_thread_id"] = resultData.thread_id;
                    Console.WriteLine($"💾 [C# CORE PLUGIN]: Cached Active Swarm Thread GUID inside Kernel state: {resultData.thread_id}");
                }

                return resultData?.final_response ?? "System validation settled successfully.";
            }
            catch (Exception ex)
            {
                return $"Harness Error: Failed to bridge data context loops: {ex.Message}";
            }
        } 
    }
}
