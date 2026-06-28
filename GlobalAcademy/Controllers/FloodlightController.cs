using GlobalAcademy.Data;
using GlobalAcademy.Security;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace GlobalAcademy.Controllers;

[ApiController]
[Route("api/[controller]")]
public class FloodlightController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public FloodlightController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpPost("solar-telemetry")]
    [HmacAuthorize] // Cryptographic Handshake Filter: Blocks malicious or spoofed hardware triggers!
    public async Task<IActionResult> ProcessSolarTelemetry([FromBody] SolarTelemetryPayload model)
    {
        // 1. Locate the physical branch location asset routing vector
        var branch = await _context.Branches.FindAsync(model.BranchId);
        if (branch == null) return NotFound("Target branch venue telemetry routing vector missing.");

        // 2. Fetch all courts nested inside this branch location
        var courts = await _context.Courts.Where(c => c.BranchId == model.BranchId).ToListAsync();
        
        // Define standard astronomical boundaries (Civil Twilight = Sun is 6 degrees below horizon)
        double civilTwilightAngle = -6.0;
        var currentTimeUtc = DateTime.UtcNow;

        Console.WriteLine($"--> IoT Light Matrix: Processing telemetry for {branch.Name}. Sun Angle: {model.SunElevationAngle}°");

        int lightsActivatedCount = 0;

        foreach (var court in courts)
        {
            // Indoor courts do not rely on natural solar geometry shifts
            if (court.IsIndoor) continue;

            // Condition A: If the sun is above civil twilight, natural ambient light suffices. Keep lights off.
            if (model.SunElevationAngle > civilTwilightAngle)
            {
                court.FloodlightState = "Off";
                continue;
            }

            // Condition B: The sun is below civil twilight (It is dark). 
            // Check the database to see if a match is actively playing right now on this specific court.
            var isCurrentlyOccupied = await _context.Bookings
                .AnyAsync(b => b.CourtId == court.Id && 
                               currentTimeUtc >= b.StartTimeUtc && 
                               currentTimeUtc <= b.EndTimeUtc);

            if (isCurrentlyOccupied)
            {
                // Only ignite the high-power grid if players are physically on site!
                if (court.FloodlightState == "Off")
                {
                    court.FloodlightState = "On";
                    lightsActivatedCount++;
                    Console.WriteLine($"   * [LIGHTS IGNITED] -> {court.Name} automatic solar toggle fired successfully.");
                }
            }
            else
            {
                // Energy Conservation Matrix Rule: Court is dark, but vacant. Kill the power.
                if (court.FloodlightState == "On")
                {
                    court.FloodlightState = "Off";
                    Console.WriteLine($"   * [LIGHTS EXTINGUISHED] -> {court.Name} is vacant. Extinguishing grid array to conserve energy.");
                }
            }
        }

        // Commit updated physical infrastructure states live to PostgreSQL
        await _context.SaveChangesAsync();

        return Ok(new { 
            Message = "Solar metrics ingested smoothly. Automated electrical profiles updated.", 
            TotalCourtsEvaluated = courts.Count,
            LightsTurnedOnThisCycle = lightsActivatedCount
        });
    }
}

public record SolarTelemetryPayload(Guid BranchId, double SunElevationAngle);
