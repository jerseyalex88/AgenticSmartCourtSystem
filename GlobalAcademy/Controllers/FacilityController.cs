using GlobalAcademy.Data;
using GlobalAcademy.Models;
using GlobalAcademy.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace GlobalAcademy.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "AcademyDirector,Groundskeeper")]
public class FacilityController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILocalTimeEngine _timeEngine;

    public FacilityController(ApplicationDbContext context, ILocalTimeEngine timeEngine)
    {
        _context = context;
        _timeEngine = timeEngine;
    }

    // =========================================================================
    // BRANCH MANAGEMENT FULL CRUD MATRIX
    // =========================================================================

    [HttpGet("branches")]
    public async Task<IActionResult> GetBranches()
    {
        var branches = await _context.Branches.ToListAsync();
        return Ok(branches);
    }

    [HttpPost("branches")]
    public async Task<IActionResult> CreateBranch([FromBody] CreateBranchDto model)
    {
        // HIERARCHY GUARDRAIL: Verify the parent academy row physically exists BEFORE allowing branch inserts
        var academyExists = await _context.Academies.AnyAsync();
        if (!academyExists) return BadRequest("Relational Exception: Top-level Academy infrastructure profile record must be created first before deploying local branch venues.");

        var branch = new Branch
        {
            Id = Guid.NewGuid(),
            Name = model.Name,
            Description = model.Description,
            TimeZoneId = model.TimeZoneId,
            CreatedAtUtc = DateTime.UtcNow
        };

        _context.Branches.Add(branch);
        await _context.SaveChangesAsync();
        return Ok(branch);
    }

    // --- ADDED: BRANCH UPDATE METHOD ---
    [HttpPut("branches/{id:guid}")]
    public async Task<IActionResult> UpdateBranch(Guid id, [FromBody] UpdateBranchDto model)
    {
        var branch = await _context.Branches.FindAsync(id);
        if (branch == null) return NotFound("Target branch venue profile context missing or unauthorized.");

        branch.Name = model.Name;
        branch.Description = model.Description;
        branch.TimeZoneId = model.TimeZoneId;

        await _context.SaveChangesAsync();
        return Ok(new { Message = "Branch facility metadata updated smoothly.", Branch = branch });
    }

    [HttpDelete("branches/{id:guid}")]
    public async Task<IActionResult> DeleteBranch(Guid id)
    {
        var branch = await _context.Branches.FindAsync(id);
        if (branch == null) return NotFound("Branch not found or unauthorized access attempt.");

        _context.Branches.Remove(branch);
        await _context.SaveChangesAsync();
        return Ok(new { Message = "Branch and its downstream child courts removed successfully from database storage." });
    }

    // =========================================================================
    // COURT MANAGEMENT FULL CRUD MATRIX
    // =========================================================================

    [HttpGet("branches/{branchId:guid}/courts")]
    public async Task<IActionResult> GetCourtsForBranch(Guid branchId)
    {
        var branchExists = await _context.Branches.AnyAsync(b => b.Id == branchId);
        if (!branchExists) return NotFound("Target branch location does not exist under your tenant profile.");

        var courts = await _context.Courts.Where(c => c.BranchId == branchId).ToListAsync();
        return Ok(courts);
    }

    [HttpPost("courts")]
    public async Task<IActionResult> CreateCourt([FromBody] CreateCourtDto model)
    {
        var branchExists = await _context.Branches.AnyAsync(b => b.Id == model.BranchId);
        if (!branchExists) return BadRequest("Invalid operational request: Target branch parent assignment missing.");

        var court = new Court
        {
            Id = Guid.NewGuid(),
            BranchId = model.BranchId,
            Name = model.Name,
            Description = model.Description,
            SurfaceType = model.SurfaceType,
            IsIndoor = model.IsIndoor,
            DryCoefficient = model.DryCoefficient,
            CreatedAtUtc = DateTime.UtcNow
        };

        _context.Courts.Add(court);
        await _context.SaveChangesAsync();
        return Ok(court);
    }

    // --- ADDED: COURT UPDATE METHOD ---
    [HttpPut("courts/{id:guid}")]
    public async Task<IActionResult> UpdateCourt(Guid id, [FromBody] UpdateCourtDto model)
    {
        var court = await _context.Courts.FindAsync(id);
        if (court == null) return NotFound("Target court entity configuration layout missing.");

        court.Name = model.Name;
        court.Description = model.Description;
        court.SurfaceType = model.SurfaceType;
        court.IsIndoor = model.IsIndoor;
        court.DryCoefficient = model.DryCoefficient;

        await _context.SaveChangesAsync();
        return Ok(new { Message = "Court configuration telemetry matrix updated.", Court = court });
    }

    // --- ADDED: COURT EXPLICIT DELETE METHOD ---
    [HttpDelete("courts/{id:guid}")]
    public async Task<IActionResult> DeleteCourt(Guid id)
    {
        var court = await _context.Courts.FindAsync(id);
        if (court == null) return NotFound("Target court record missing.");

        _context.Courts.Remove(court);
        await _context.SaveChangesAsync();
        return Ok(new { Message = "Physical court asset unlinked and removed successfully." });
    }

    // =========================================================================
    // USER-ROSTER MAPPINGS MATRIX MANAGEMENT
    // =========================================================================

    [HttpGet("branches/{branchId:guid}/roster")]
    public async Task<IActionResult> GetBranchRoster(Guid branchId)
    {
        var branchExists = await _context.Branches.AnyAsync(b => b.Id == branchId);
        if (!branchExists) return NotFound("Target branch location does not exist under your tenant profile.");

        var roster = await _context.UserBranches
            .Include(ub => ub.AssignedCourts)
            .Where(ub => ub.BranchId == branchId)
            .ToListAsync();

        return Ok(roster);
    }

    [HttpPost("branches/assign-user")]
    public async Task<IActionResult> AssignUserToBranch([FromBody] AssignUserBranchDto model)
    {
        var branchExists = await _context.Branches.AnyAsync(b => b.Id == model.BranchId);
        if (!branchExists) return BadRequest("Invalid operational request: Target branch parent assignment missing.");

        var alreadyAssigned = await _context.UserBranches
            .AnyAsync(ub => ub.UserId == model.UserId && ub.BranchId == model.BranchId);
        if (alreadyAssigned) return BadRequest("This user is already mapped to the requested branch location.");

        var userBranch = new UserBranch
        {
            UserId = model.UserId,
            BranchId = model.BranchId,
            AssignmentRole = model.AssignmentRole,
            AssignedAtUtc = DateTime.UtcNow
        };

        _context.UserBranches.Add(userBranch);
        await _context.SaveChangesAsync();
        return Ok(userBranch);
    }

    [HttpDelete("branches/{branchId:guid}/remove-user/{userId}")]
    public async Task<IActionResult> RemoveUserFromBranch(Guid branchId, string userId)
    {
        var assignment = await _context.UserBranches
            .FirstOrDefaultAsync(ub => ub.BranchId == branchId && ub.UserId == userId);
            
        if (assignment == null) return NotFound("Target user-branch assignment context missing or unauthorized.");

        _context.UserBranches.Remove(assignment);
        await _context.SaveChangesAsync();
        return Ok(new { Message = "User successfully removed from branch roster. Nested court clearances purged." });
    }

    [HttpPost("courts/assign-user")]
    public async Task<IActionResult> AssignUserToCourt([FromBody] AssignUserCourtDto model)
    {
        var hasBranchAccess = await _context.UserBranches
            .AnyAsync(ub => ub.UserId == model.UserId && ub.BranchId == model.BranchId);
        if (!hasBranchAccess) 
        {
            return BadRequest("Security Exception: Target user must be explicitly added to the Branch Roster before receiving specific court tasks.");
        }

        var courtExists = await _context.Courts
            .AnyAsync(c => c.Id == model.CourtId && c.BranchId == model.BranchId);
        if (!courtExists) return BadRequest("Target court asset configuration missing inside the designated branch venue.");

        var alreadyAssigned = await _context.UserCourts
            .AnyAsync(uc => uc.UserId == model.UserId && uc.BranchId == model.BranchId && uc.CourtId == model.CourtId);
        if (alreadyAssigned) return BadRequest("This user already carries an active operational layout assignment on this court.");

        var userCourt = new UserCourt
        {
            UserId = model.UserId,
            BranchId = model.BranchId,
            CourtId = model.CourtId,
            AccessType = model.AccessType
        };

        _context.UserCourts.Add(userCourt);
        await _context.SaveChangesAsync();
        return Ok(userCourt);
    }

    [HttpDelete("branches/{branchId:guid}/courts/{courtId:guid}/remove-user/{userId}")]
    public async Task<IActionResult> RemoveUserFromCourt(Guid branchId, Guid courtId, string userId)
    {
        var courtAssignment = await _context.UserCourts
            .FirstOrDefaultAsync(uc => uc.BranchId == branchId && uc.CourtId == courtId && uc.UserId == userId);
            
        if (courtAssignment == null) return NotFound("Specific target user-court routing map could not be located.");

        _context.UserCourts.Remove(courtAssignment);
        await _context.SaveChangesAsync();
        return Ok(new { Message = "User court clearance task unlinked successfully." });
    }
        
    [HttpGet("branches/{branchId:guid}/current-local-time")]
    public async Task<IActionResult> GetBranchLocalTime(Guid branchId)
    {
        var branch = await _context.Branches.FindAsync(branchId);
        
        if (branch == null) return NotFound("Target branch profile missing.");
        
        var utcNow = DateTime.UtcNow;
        var localTime = _timeEngine.ToLocalTime(utcNow, branch.TimeZoneId);
        
        return Ok(new {ServerUtcAnchor = utcNow,BranchNativeTime = localTime,ActiveZoneIana = branch.TimeZoneId});
    }
}

public record CreateBranchDto(string Name, string Description, string TimeZoneId);
public record UpdateBranchDto(string Name, string Description, string TimeZoneId);
public record CreateCourtDto(Guid BranchId, string Name, string Description, string SurfaceType, bool IsIndoor, double DryCoefficient);
public record UpdateCourtDto(string Name, string Description, string SurfaceType, bool IsIndoor, double DryCoefficient);
public record AssignUserBranchDto(string UserId, Guid BranchId, string AssignmentRole);
public record AssignUserCourtDto(string UserId, Guid BranchId, Guid CourtId, string AccessType);