using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using GlobalAcademy.Data;
using GlobalAcademy.Models;
using GlobalAcademy.Security;

namespace GlobalAcademy.Controllers;

/// <summary>
/// 💼 CONTROLLER: Secure Multi-Tenant Overlord Dashboard Panel for GlobalAdmin Roles
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "GlobalAdmin")] // Gates access strictly to the master system guardian role
public class AcademiesController : ControllerBase
{
    private readonly ApplicationDbContext _dbContext;
    private readonly UserManager<IdentityUser> _userManager;

    public AcademiesController(ApplicationDbContext dbContext, UserManager<IdentityUser> userManager)
    {
        _dbContext = dbContext;
        _userManager = userManager;
    }

    /// <summary>
    /// 1. READ ALL: Displays the complete list of available academies from the system table
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetAllAcademies()
    {
        // .IgnoreQueryFilters() is vital here to let the GlobalAdmin view all entries un-partitioned

        var academies = await _dbContext.Academies
            .IgnoreQueryFilters()
            .OrderByDescending(a => a.CreatedAtUtc)
            .Select(a => new {
                a.Id,
                a.Name,
                a.Description,
                a.CreatedAtUtc,
                BranchCount = _dbContext.Branches.IgnoreQueryFilters().Count(b => b.AcademyId == a.Id)
            })
            .ToListAsync();

        return Ok(academies);
    }

    /// <summary>
    /// 2. READ SINGLE: Fetches data for an explicit academy node
    /// </summary>
    [HttpGet("{id}")]

    public async Task<IActionResult> GetAcademyById(Guid id)
    {
        var academy = await _dbContext.Academies
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(a => a.Id == id);

        if (academy == null)
        {
            return NotFound(new { Message = "Target academy record does not exist." });
        }

        return Ok(academy);
    }

    /// <summary>
    /// 3. CREATE: Deploys a brand new academy entity node into the global infrastructure grid
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateAcademy([FromBody] AcademyDto model)

    {
        if (string.IsNullOrWhiteSpace(model.Name))
        {
            return BadRequest(new { Message = "Validation Error: Academy designation title cannot be empty." });
        }

        var newAcademy = new Academy
        {
            Id = Guid.NewGuid(),
            Name = model.Name.Trim(),
            Description = model.Description?.Trim() ?? string.Empty,
            CreatedAtUtc = DateTime.UtcNow
        };

        _dbContext.Academies.Add(newAcademy);
        await _dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetAcademyById), new { id = newAcademy.Id }, newAcademy);
    }


    /// <summary>
    /// 4. UPDATE: Modifies structural configurations for a specific academy location row
    /// </summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateAcademy(Guid id, [FromBody] AcademyDto model)
    {
        var academy = await _dbContext.Academies
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(a => a.Id == id);

        if (academy == null)
        {
            return NotFound(new { Message = "Target academy profile row not found." });
        }

        if (string.IsNullOrWhiteSpace(model.Name))
        {
            return BadRequest(new { Message = "Validation Error: Academy designation title cannot be empty." });
        }


        academy.Name = model.Name.Trim();
        academy.Description = model.Description?.Trim() ?? string.Empty;

        await _dbContext.SaveChangesAsync();
        return Ok(new { Message = "Academy parameters updated successfully.", Academy = academy });
    }

    /// <summary>
    /// 5. DELETE: Purges an academy and cascading branch architectures safely
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteAcademy(Guid id)
    {
        var academy = await _dbContext.Academies
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(a => a.Id == id);

        if (academy == null)
        {

            return NotFound(new { Message = "Target academy structure not flagged for removal." });
        }

        // Cascade cleanup protections are executed cleanly based on your PostgreSQL constraint structures
        _dbContext.Academies.Remove(academy);
        await _dbContext.SaveChangesAsync();

        return Ok(new { Message = $"Academy '{academy.Name}' has been permanently decommissioned from the system." });
    }

    /// <summary>
    /// 🌟 6. TENANT OVERRIDE SELECTOR: Assigns a target academy as the active management workspace for the admin session
    /// </summary>
    [HttpPost("{id}/set-active")]
    public async Task<IActionResult> SetActiveAcademyOverride(Guid id)
    {
        // Verify target academy identity exists before establishing session overrides
        var academyExists = await _dbContext.Academies.IgnoreQueryFilters().AnyAsync(a => a.Id == id);
        if (!academyExists)

        {
            return BadRequest(new { Message = "Impersonation Denied: The target academy node does not exist." });
        }

        var user = await _userManager.GetUserAsync(User);
        if (user == null)
        {
            return Unauthorized(new { Message = "Security Gate Failure: Active security principal session context is missing." });
        }

        // Check if an override claim row already exists in the database for this specific user identity
        var existingClaims = await _userManager.GetClaimsAsync(user);
        var activeOverrideClaim = existingClaims.FirstOrDefault(c => c.Type.Equals(TenantProvider.AcademyOverrideClaimType, StringComparison.OrdinalIgnoreCase));

        if (activeOverrideClaim != null)
        {
            // Remove out-of-date allocation configuration claims
            await _userManager.RemoveClaimAsync(user, activeOverrideClaim);
        }


        // Inject the fresh multi-tenant mapping target claim assignment
        var newOverrideClaim = new Claim(TenantProvider.AcademyOverrideClaimType, id.ToString());
        var result = await _userManager.AddClaimAsync(user, newOverrideClaim);

        if (!result.Succeeded)
        {
            var originalError = result.Errors.FirstOrDefault()?.Description ?? "Unknown injection error.";
            return StatusCode(500, new { Error = $"Identity Layer Rejection: {originalError}" });
        }

        return Ok(new { 
            Message = "Master tenant tracking shifted successfully.", 
            ActiveAcademyId = id 
        });
    }
}

/// <summary>
/// Data Transfer Object parsing inbound data parameters securely.

/// </summary>
public class AcademyDto
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}

