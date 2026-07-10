using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using GlobalAcademy.Models;
using GlobalAcademy.Security;
using GlobalAcademy.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace GlobalAcademy.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AiOrchestrationController : ControllerBase
{
    private readonly UserManager<IdentityUser> _userManager;
    private readonly RoleManager<IdentityRole> _roleManager;
    private readonly IConfiguration _configuration;
    private readonly ITenantProvider _tenantProvider;
    private readonly Data.ApplicationDbContext _dbContext;

    public AiOrchestrationController(UserManager<IdentityUser> userManager, 
        RoleManager<IdentityRole> roleManager, 
        IConfiguration configuration,
        ITenantProvider tenantProvider,
        Data.ApplicationDbContext dbContext)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _configuration = configuration;
        _tenantProvider = tenantProvider;
        _dbContext = dbContext;
    }

    [HttpPost("ai/match-saver/seed-test-data")]
    [Authorize(Roles = "AcademyDirector,GlobalAdmin")]
    public async Task<IActionResult> SeedTestData()
    {
        var currentAcademyId = _tenantProvider.GetTenantId();

        // 1. DYNAMIC BRANCH RESOLUTION: Fetch or provision a parent Branch for this active tenant
        var activeBranch = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .FirstOrDefaultAsync(_dbContext.Branches, b => b.AcademyId == currentAcademyId);

        if (activeBranch == null)
        {
            activeBranch = new Models.Branch
            {
                Id = Guid.NewGuid(),
                AcademyId = currentAcademyId,
                Name = "Downtown Premier Arena Hub"
                // Add any other structural branch properties your model demands here
            };
            _dbContext.Branches.Add(activeBranch);
            await _dbContext.SaveChangesAsync();
        }

        // 2. DYNAMIC COURT RESOLUTION: Fetch or provision a court linked explicitly to that parent branch
        var activeCourt = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .FirstOrDefaultAsync(_dbContext.Courts, c => c.AcademyId == currentAcademyId && c.BranchId == activeBranch.Id);

        if (activeCourt == null)
        {
            activeCourt = new Models.Court 
            {
                Id = Guid.NewGuid(), 
                AcademyId = currentAcademyId,
                BranchId = activeBranch.Id, // <-- FIXED: Establishing the mandatory relational tie
                Name = "Stadium Show Court 1",
                
                // --- Arbitrary Values for Core Operational Mappings ---
                SurfaceType = "Hard",
                IsIndoor = true,
                Status = "Open",
                DryCoefficient = 0
            };
            _dbContext.Courts.Add(activeCourt);
            await _dbContext.SaveChangesAsync();
        }

        // 3. CLEAN UP HOUSES: Clear out legacy test rows to avoid constraint noise anomalies
        var legacyTestQueues = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .ToListAsync(_dbContext.ShadowQueues.Where(sq => sq.AcademyId == currentAcademyId && sq.PlayerName == "Serena Williams (Test)"));
        _dbContext.ShadowQueues.RemoveRange(legacyTestQueues);

        var legacyTestBookings = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .ToListAsync(_dbContext.Bookings.Where(b => b.AcademyId == currentAcademyId && b.BookedPlayerName == "Serena Williams (Test)"));
        _dbContext.Bookings.RemoveRange(legacyTestBookings);
        await _dbContext.SaveChangesAsync();

        // 4. INJECT THE MOCK PLAYERS SHADOW QUEUE ROW
        var fakeQueue = new Models.ShadowQueue
        {
            Id = Guid.NewGuid(),
            AcademyId = currentAcademyId,
            PlayerName = "Serena Williams (Test)",
            PreferredWindow = "Anytime tomorrow morning",
            IsResolved = false
        };

        // 5. INJECT THE OPEN TIMESLOT MATRIX ENTRY (Binds foreign relations to branch and court keys)
        var fakeSlot = new Models.Booking
        {
            Id = Guid.NewGuid(),
            AcademyId = currentAcademyId,
            CourtId = activeCourt.Id,    // <-- FIXED: Directly populates the structural target relation
            CourtName = activeCourt.Name,
            SlotTime = DateTime.UtcNow.AddDays(1).Date.AddHours(9), // Tomorrow at 09:00 AM UTC
            IsAvailableSlot = true,
            
            // --- Arbitrary Values for Operational Completeness ---
            BookingType = "Standby Recovery Sandbox Match",
            BookedPlayerName = "Serena Williams (Test)"};

        _dbContext.ShadowQueues.Add(fakeQueue);
        _dbContext.Bookings.Add(fakeSlot);
        
        await _dbContext.SaveChangesAsync();

        return Ok(new { Message = $"Tenant Sandbox data seeded successfully under Branch '{activeBranch.Name}' and Court '{activeCourt.Name}'!" });
    }

    [HttpPost("ai/match-saver/run")]
    [Authorize(Roles = "AcademyDirector,GlobalAdmin")]
    public async Task<IActionResult> TriggerAiSaver([FromServices] MatchSaverService saverService)
    {
        // The underlying DbContext uses _tenantProvider to completely lock this run to the logged-in Academy!
        var optimizationReport = await saverService.AutopilotOptimizeQueueAsync();
        return Ok(new { Report = optimizationReport });
    }
}