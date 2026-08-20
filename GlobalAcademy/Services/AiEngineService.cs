using System.Net.Http.Json;
using Microsoft.Extensions.Logging;
using GlobalAcademy.Models.DTOs;

namespace GlobalAcademy.Services;

public class AiEngineService : IAiEngineService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<AiEngineService> _logger;

    // The HttpClient is injected automatically via the IHttpClientFactory container
    public AiEngineService(HttpClient httpClient, ILogger<AiEngineService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<AiPricingResponseDto> GetOptimizedPriceAsync(AiPricingRequestDto request)
    {
        try
        {
            _logger.LogInformation("Relaying financial context matrix to Python AI Engine...");

            // 🚀 System serialization & HTTP POST executed in one optimized line
            var response = await _httpClient.PostAsJsonAsync("api/ai/predict-pricing", request);

            // Ensure we hit a successful 200 OK status code, otherwise throw an exception
            response.EnsureSuccessStatusCode();

            // Catch the successful JSON text string stream and morph it back into our typed C# DTO
            var result = await response.Content.ReadFromJsonAsync<AiPricingResponseDto>();

            if (result == null)
            {
                throw new InvalidOperationException("Python AI engine returned an empty data payload framework context.");
            }

            _logger.LogInformation("Successfully received optimized rate from AI Engine: {Price}", result.AiOptimizedPrice);
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Network Bridge Fault: Failed to compute predictive pricing via Python interface.");
            throw; // Bubble up error cleanly for the parent multi-tenant transaction invoice handler
        }
    }
}
