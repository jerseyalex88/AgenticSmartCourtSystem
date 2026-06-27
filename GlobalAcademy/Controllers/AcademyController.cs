using GlobalAcademy.Data;
using GlobalAcademy.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GlobalAcademy.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "RequireDirector")] // Protect operations under the Academy Director role
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
        // Our EF Core Global Query Filter restricts this array down to only the user's active tenant
        var academy = await _context.Academies.FirstOrDefaultAsync();
        if (academy == null) return NotFound("Academy tenant profile profile matching your secure claim could not be located.");
        return Ok(academy);
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
}

public record UpdateAcademyDto(string Name, string Description);
