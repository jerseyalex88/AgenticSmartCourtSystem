using GlobalAcademy.Data;
using GlobalAcademy.Models;
using GlobalAcademy.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GlobalAcademy.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "RequireDirector")]
public class FacilityController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILocalTimeEngine _timeEngine;

    public FacilityController(ApplicationDbContext context, ILocalTimeEngine timeEngine)
    {
        _context = context;
        _timeEngine = timeEngine;
    }

    // --- BRANCH MANAGEMENT CRUD ---

    [HttpGet("branches")]
    public async Task<IActionResult> GetBranches()
    {
        var branches = await _context.Branches.ToListAsync();
        return Ok(branches);
    }

    [HttpPost("branches")]
    public async Task<IActionResult> CreateBranch([FromBody] CreateBranchDto model)
    {
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

    [HttpDelete("branches/{id:guid}")]
    public async Task<IActionResult> DeleteBranch(Guid id)
    {
        var branch = await _context.Branches.FindAsync(id);
        if (branch == null) return NotFound("Branch not found or unauthorized access attempt.");

        _context.Branches.Remove(branch);
        await _context.SaveChangesAsync();
        return Ok(new { Message = "Branch and its downstream child courts removed successfully from database storage." });
    }

    // --- COURT MANAGEMENT CRUD ---

    [HttpGet("branches/{branchId:guid}/courts")]
    public async Task<IActionResult> GetCourtsForBranch(Guid branchId)
    {
        // Enforce the physical location validation constraint hierarchy
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

    // --- TIME Engine TRANSLATION INSPECTION ENDPOINT ---
    [HttpGet("branches/{branchId:guid}/current-local-time")]
    public async Task<IActionResult> GetBranchLocalTime(Guid branchId)
    {
        var branch = await _context.Branches.FindAsync(branchId);
        if (branch == null) return NotFound("Target branch profile missing.");

        var utcNow = DateTime.UtcNow;
        var localTime = _timeEngine.ToLocalTime(utcNow, branch.TimeZoneId);

        return Ok(new {
            ServerUtcAnchor = utcNow,
            BranchNativeTime = localTime,
            ActiveZoneIana = branch.TimeZoneId
        });
    }

        // --- USER-BRANCH MANAGEMENT CRUD ---

    [HttpGet("branches/{branchId:guid}/roster")]
    public async Task<IActionResult> GetBranchRoster(Guid branchId)
    {
        // Enforce data hierarchy validation
        var branchExists = await _context.Branches.AnyAsync(b => b.Id == branchId);
        if (!branchExists) return NotFound("Target branch location does not exist under your tenant profile.");

        // Pull down all staff/players assigned to this branch, including their specific court restrictions
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

        // Check if the user assignment mapping is already active in the system
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

        // Cascade rule: Removing a user from a branch automatically clears down their nested court files
        _context.UserBranches.Remove(assignment);
        await _context.SaveChangesAsync();
        return Ok(new { Message = "User successfully removed from branch roster. Nested court clearances purged." });
    }

    // --- USER-COURT MANAGEMENT CRUD ---

    [HttpPost("courts/assign-user")]
    public async Task<IActionResult> AssignUserToCourt([FromBody] AssignUserCourtDto model)
    {
        // HIERARCHY GUARDRAIL: Verify the user is a registered member of the branch BEFORE locking them to a court
        var hasBranchAccess = await _context.UserBranches
            .AnyAsync(ub => ub.UserId == model.UserId && ub.BranchId == model.BranchId);
        if (!hasBranchAccess) 
        {
            return BadRequest("Security Exception: Target user must be explicitly added to the Branch Roster before receiving specific court tasks.");
        }

        // Verify the court actually exists inside that specific branch boundary
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

}

public record CreateBranchDto(string Name, string Description, string TimeZoneId);
public record CreateCourtDto(Guid BranchId, string Name, string Description, string SurfaceType, bool IsIndoor, double DryCoefficient);
public record AssignUserBranchDto(string UserId, Guid BranchId, string AssignmentRole);
public record AssignUserCourtDto(string UserId, Guid BranchId, Guid CourtId, string AccessType);
