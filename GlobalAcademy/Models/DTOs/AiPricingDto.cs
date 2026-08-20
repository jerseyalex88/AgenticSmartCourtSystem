namespace GlobalAcademy.Models.DTOs;

public class AiPricingRequestDto
{
    public decimal BasePrice { get; set; }
    public int MonthOfYear { get; set; }
    public double CurrentOccupancyPct { get; set; }
    public int DaysUntilArrival { get; set; }
    public bool IsProgramDemandSpiking { get; set; }
}

public class AiPricingResponseDto
{
    public bool Success { get; set; }
    public decimal OriginalBasePrice { get; set; }
    public decimal AiOptimizedPrice { get; set; }
    public decimal VarianceDelta { get; set; }
}