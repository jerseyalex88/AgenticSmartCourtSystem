using System;
using GlobalAcademy.Models;

namespace GlobalAcademy.Services;

public interface IWeatherGuardEngine
{
    DateTime CalculateEstimatedReopenTime(Court court, double rainVolumeMm, DateTime stormEndTimeUtc);
}

public class WeatherGuardEngine : IWeatherGuardEngine
{
    // High-precision environmental formula determining exactly when a court dries completely
    public DateTime CalculateEstimatedReopenTime(Court court, double rainVolumeMm, DateTime stormEndTimeUtc)
    {
        // Indoor courts are insulated from microclimatic precipitation events
        if (court.IsIndoor)
        {
            return stormEndTimeUtc;
        }

        // Baseline Drying Rule: 1mm of water takes exactly 60 minutes to evaporate under normal atmospheric parameters
        double baselineDryingMinutesPerMm = 60.0;
        
        // Compute raw environmental evaporation duration scaled against the physical asset's construction material layout
        double totalDryingMinutes = rainVolumeMm * baselineDryingMinutesPerMm * court.DryCoefficient;

        // Return the precise future UTC timestamp when the asset safely clears structural moisture limits
        return stormEndTimeUtc.AddMinutes(totalDryingMinutes);
    }
}
