using System;
using System.ComponentModel;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.SemanticKernel;
using Microsoft.Extensions.Configuration;

namespace GlobalAcademy.Plugins
{
    public class LangGraphCompliancePlugin
    {
        private readonly IConfiguration _configuration;
        private readonly string _baseAiEngineUrl;
        private readonly string _pythonBaseUrl;

        public LangGraphCompliancePlugin(IConfiguration configuration)
        {
            _configuration = configuration;
            // Reads your Docker bridge network routing URL directly out of appsettings
            _baseAiEngineUrl = configuration["AiEngineSettings:BaseUrl"] ?? "http://localhost:8000";
            _pythonBaseUrl = _baseAiEngineUrl.TrimEnd('/');
        }

        // Strongly typed payload parameters container matching Python SwarmExecutionPayload signatures
        public record PythonSwarmPayload(
            string tenant_id,
            string user_id,
            string user_role,
            string raw_user_prompt,
            string? court_id = null
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
        [KernelFunction, Description("Invokes the advanced Multi-Agent compliance, RAG auditing, and predictive analytics engine.")]
        public async Task<string> CallMultiAgentComplianceSwarmAsync(
            Kernel kernel,
            [Description("The raw user statement text carrying the explicit court context name.")] string rawUserQuery)
        {
            // 1. Unpack security claims mapped dynamically via universal controller context data dictionary
            if (!kernel.Data.TryGetValue("academyId", out var academyIdObj) || academyIdObj is not Guid academyGuid)
            {
                return "Transaction rejected: Missing or invalid security academy perimeter claim scope.";
            }
            if (!kernel.Data.TryGetValue("userId", out var userIdObj) || userIdObj is not string userId)
            {
                return "Transaction rejected: User context mapping verification fault (userId).";
            }
            if (!kernel.Data.TryGetValue("userRole", out var userRoleObj) || userRoleObj is not string userRole)
            {
                return "Transaction rejected: User context mapping verification fault (userRole).";
            }

            try
            {
                // 🚀 THE SECURE SANDWICH PASS:
                // We pass the rawUserQuery (which now contextually holds the court name from the LLM)
                // straight down to Python's LangGraph supervisor-worker state machine graph network!
                var requestPayload = new PythonSwarmPayload(
                    tenant_id: academyGuid.ToString(),
                    user_id: userId,
                    user_role: userRole,
                    raw_user_prompt: rawUserQuery,
                    court_id: null // Python's supervisor parses the court name directly out of raw_user_prompt!
                );

                string absoluteExecutionRoute = $"{_pythonBaseUrl}/api/v2/agent/execute-swarm-thread";
                
                using var httpClient = new HttpClient { Timeout = TimeSpan.FromMinutes(2) };
                var response = await httpClient.PostAsJsonAsync(absoluteExecutionRoute, requestPayload);

                if (!response.IsSuccessStatusCode)
                {
                    return "📟 CONTROL NOTICE: The advanced operational audit network layer returned an execution block.";
                }

                var resultData = await response.Content.ReadFromJsonAsync<PythonSwarmResponse>();
                return resultData?.final_response ?? "System validation settled successfully.";
            }
            catch (Exception ex)
            {
                return $"Harness Error: Failed to bridge data context loops: {ex.Message}";
            }
        }   
    }
}
