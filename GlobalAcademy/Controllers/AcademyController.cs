using GlobalAcademy.Data;
using GlobalAcademy.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Threading.Tasks;

namespace GlobalAcademy.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "AcademyDirector,GlobalAdmin")] // Open to executives and system administrators
public class AcademyController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public AcademyController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet("my-profile")]
    public async Task<IActionResult> GetMyAcademy()
    {
        var academy = await _context.Academies.FirstOrDefaultAsync();
        if (academy == null) return NotFound("Academy tenant profile profile matching your secure claim could not be located.");
        return Ok(academy);
    }

    // --- ADDED: NEW ACADEMY RECORD CREATION ENDPOINT ---
    [HttpPost("create-profile")]
    public async Task<IActionResult> CreateAcademy([FromBody] CreateAcademyDto model)
    {
        // Extract the target AcademyId from the user's secure token claim badges
        var academyClaim = User.Claims.FirstOrDefault(c => c.Type == "AcademyId")?.Value;
        if (string.IsNullOrEmpty(academyClaim) || !Guid.TryParse(academyClaim, out var tenantGuid))
        {
            return BadRequest("Security Exception: Your authenticated identity profile does not possess a valid tenant claim badge mapping root assets.");
        }

        // Check if this specific tenant has already provisioned an academy record row
        var alreadyExists = await _context.Academies.AnyAsync(a => a.Id == tenantGuid);
        if (alreadyExists) return BadRequest("Operational Rule: An infrastructure academy profile record has already been assigned to your active tenant context boundary.");

        var academy = new Academy
        {
            Id = tenantGuid, // Sync the database primary key exactly to the identity claim identifier badge!
            Name = model.Name,
            Description = model.Description,
            CreatedAtUtc = DateTime.UtcNow
        };

        _context.Academies.Add(academy);
        await _context.SaveChangesAsync();
        return Ok(new { Message = "Physical top-level Academy infrastructure record created successfully.", Academy = academy });
    }

    [HttpPut("update-profile")]
    public async Task<IActionResult> UpdateAcademy([FromBody] UpdateAcademyDto model)
    {
        var academy = await _context.Academies.FirstOrDefaultAsync();
        if (academy == null) return NotFound("Academy context missing.");

        academy.Name = model.Name;
        academy.Description = model.Description;

        await _context.SaveChangesAsync();
        return Ok(new { Message = "Academy structural metadata updated successfully.", academy });
    }

    // --- ADDED: ACADEMY PURGE RECORD DELETE ENDPOINT ---
    [HttpDelete("purge-profile")]
    public async Task<IActionResult> DeleteAcademy()
    {
        var academy = await _context.Academies.FirstOrDefaultAsync();
        if (academy == null) return NotFound("Target academy profile configuration record missing.");

        _context.Academies.Remove(academy);
        await _context.SaveChangesAsync();
        return Ok(new { Message = "Top-level Academy record permanently removed. All cascade dependencies purged." });
    }
}

public record CreateAcademyDto(string Name, string Description);
public record UpdateAcademyDto(string Name, string Description);
