using System;
using Xunit;
using GlobalAcademy.Models;
using GlobalAcademy.Services;

namespace GlobalAcademy.Tests;

public class WeatherGuardTests
{
    [Fact]
    public void WeatherEngine_IndoorCourts_AreInsulatedFromPrecipitation_ReturnStormEndTime()
    {
        // --- ARRANGE ---
        var engine = new WeatherGuardEngine();
        var indoorCourt = new Court 
        { 
            Id = Guid.NewGuid(), 
            Name = "Indoor Court 1", 
            IsIndoor = true, 
            DryCoefficient = 0.0 
        };
        
        var stormEnd = DateTime.UtcNow;
        double rainVolumeMm = 15.5; // Heavy downpour

        // --- ACT ---
        var estimatedReopen = engine.CalculateEstimatedReopenTime(indoorCourt, rainVolumeMm, stormEnd);

        // --- ASSERT ---
        // Indoor courts must never be forced offline by external rain volumes
        Assert.Equal(stormEnd, estimatedReopen);
    }

    [Fact]
    public void WeatherEngine_OutdoorHardcourt_CalculatesFastDryingWindow_MatchesFormula()
    {
        // --- ARRANGE ---
        var engine = new WeatherGuardEngine();
        var dubaiHardcourt = new Court 
        { 
            Id = Guid.NewGuid(), 
            Name = "Grand Oasis Stadium", 
            IsIndoor = false, 
            DryCoefficient = 0.5 // Dries rapidly under local climate factors
        };
        
        var stormEnd = new DateTime(2026, 6, 28, 10, 0, 0, DateTimeKind.Utc); // 10:00 UTC
        double rainVolumeMm = 4.0; // Moderate rain shower

        // Formula: 4.0mm * 60 minutes * 0.5 (DryCoefficient) = 120 minutes (2 hours)
        var expectedReopen = stormEnd.AddHours(2); // 12:00 UTC

        // --- ACT ---
        var actualReopen = engine.CalculateEstimatedReopenTime(dubaiHardcourt, rainVolumeMm, stormEnd);

        // --- ASSERT ---
        Assert.Equal(expectedReopen, actualReopen);
    }

    [Fact]
    public void WeatherEngine_OutdoorClayCourt_AppliesSlowerDryingMultiplier_MatchesFormula()
    {
        // --- ARRANGE ---
        var engine = new WeatherGuardEngine();
        var londonClayCourt = new Court 
        { 
            Id = Guid.NewGuid(), 
            Name = "Stadium Center Clay", 
            IsIndoor = false, 
            DryCoefficient = 1.5 // Holds moisture significantly longer
        };
        
        var stormEnd = new DateTime(2026, 6, 28, 14, 0, 0, DateTimeKind.Utc); // 14:00 UTC
        double rainVolumeMm = 10.0; // Heavy rainfall

        // Formula: 10.0mm * 60 minutes * 1.5 (DryCoefficient) = 900 minutes (15 hours)
        var expectedReopen = stormEnd.AddHours(15); // Next day at 05:00 UTC

        // --- ACT ---
        var actualReopen = engine.CalculateEstimatedReopenTime(londonClayCourt, rainVolumeMm, stormEnd);

        // --- ASSERT ---
        Assert.Equal(expectedReopen, actualReopen);
    }
}
