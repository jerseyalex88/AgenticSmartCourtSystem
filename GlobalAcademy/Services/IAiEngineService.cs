using GlobalAcademy.Models.DTOs;

namespace GlobalAcademy.Services;

public interface IAiEngineService
{
    Task<AiPricingResponseDto> GetOptimizedPriceAsync(AiPricingRequestDto request);
}
