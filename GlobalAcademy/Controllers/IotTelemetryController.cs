using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using GlobalAcademy.Security;
using GlobalAcademy.Data;
using GlobalAcademy.Services;
using Microsoft.EntityFrameworkCore;
using System;
using System.Threading.Tasks;

namespace GlobalAcademy.Security;

[ApiController]
[Route("api/[controller]")]
public class IotTelemetryController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IWeatherGuardEngine _weatherEngine;

    public IotTelemetryController(ApplicationDbContext context, IWeatherGuardEngine weatherEngine)
    {
        _context = context;
        _weatherEngine = weatherEngine;
    }

    [HttpPost("precipitation-trigger")]
    [HmacAuthorize] // Cryptographic Handshake Filter: Rejects tampered signatures instantly at the doorstep!
    public async Task<IActionResult> IngestPrecipitationTelemetry([FromBody] RainTelemetryPayload model)
    {
        // 1. Locate the physical branch location asset experiencing the storm event
        var branch = await _context.Branches.FindAsync(model.BranchId);
        if (branch == null) return NotFound("Target venue branch telemetry routing vector missing.");

        // 2. Extract all outdoor courts nested inside that specific club branch boundary
        var outdoorCourts = await _context.Courts
            .Where(c => c.BranchId == model.BranchId && !c.IsIndoor)
            .ToListAsync();

        Console.WriteLine($"--> IoT Telemetry Ingested: Branch {branch.Name} experienced {model.RainVolumeMm}mm of rain.");

        // 3. Process every outdoor court asset through our evaporation calculator
        foreach (var court in outdoorCourts)
        {
            // Flip the physical scheduling availability switch to Rained_Out
            court.Status = "Rained_Out";
            
            // Execute the microclimatic formula calculation
            DateTime calculatedReopen = _weatherEngine.CalculateEstimatedReopenTime(court, model.RainVolumeMm, model.StormEndTimeUtc);
            court.EstimatedReopenTimeUtc = calculatedReopen;

            Console.WriteLine($"   * Asset {court.Name} (Surface: {court.SurfaceType}) locked down. Estimated dry time: {calculatedReopen} UTC.");
        }

        // Commit all calculated telemetry states live onto your PostgreSQL storage layer
        await _context.SaveChangesAsync();

        return Ok(new { 
            Message = "Telemetry processed successfully. Facility asset matrices updated.", 
            CourtsImpactedCount = outdoorCourts.Count 
        });
    }

    [HttpPost("weather-alert")]
    [HmacAuthorize] // ◄— The firewall is instantly locked down right here!
    public IActionResult HandleWeatherAlert([FromBody] WeatherPayload data)
    {
        // Core logical processes inside your sports engine only awaken if the hash matches.
        return Ok(new { Message = "Weather metrics ingested safely." });
    }
}
public record RainTelemetryPayload(Guid BranchId, double RainVolumeMm, DateTime StormEndTimeUtc);
public record WeatherPayload(string EventType, double RainVolumeMillimeters);
