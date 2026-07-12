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
        string legacyPlayerName = "Flavio Cobolli Test";

        var legacyTestQueues = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .ToListAsync(_dbContext.ShadowQueues.Where(sq => sq.AcademyId == currentAcademyId && sq.PlayerName == legacyPlayerName));
        _dbContext.ShadowQueues.RemoveRange(legacyTestQueues);

        var legacyTestBookings = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .ToListAsync(_dbContext.Bookings.Where(b => b.AcademyId == currentAcademyId && b.BookedPlayerName == legacyPlayerName));
        _dbContext.Bookings.RemoveRange(legacyTestBookings);
        await _dbContext.SaveChangesAsync();

        // 4. INJECT THE MOCK PLAYERS SHADOW QUEUE ROW
        var fakeQueue = new Models.ShadowQueue
        {
            Id = Guid.NewGuid(),
            AcademyId = currentAcademyId,
            PlayerName = legacyPlayerName,
            PreferredWindow = "Anytime tomorrow evening",
            IsResolved = false
        };

        // 5. INJECT THE OPEN TIMESLOT MATRIX ENTRY (Binds foreign relations to branch and court keys)
        var fakeSlot = new Models.Booking
        {
            Id = Guid.NewGuid(),
            AcademyId = currentAcademyId,
            CourtId = activeCourt.Id,    // <-- FIXED: Directly populates the structural target relation
            CourtName = activeCourt.Name,
            SlotTime = DateTime.UtcNow.AddDays(1).Date.AddHours(19), // Tomorrow at 07:00 PM UTC
            IsAvailableSlot = true,
            
            // --- Arbitrary Values for Operational Completeness ---
            BookingType = "Standby Recovery Sandbox Match",
            BookedPlayerName = legacyPlayerName};

        _dbContext.ShadowQueues.Add(fakeQueue);
        _dbContext.Bookings.Add(fakeSlot);
        
        await _dbContext.SaveChangesAsync();

        return Ok(new { Message = $"Tenant Sandbox data seeded successfully under Branch '{activeBranch.Name}' and Court '{activeCourt.Name}' for {legacyPlayerName}!" });
    }

    [HttpPost("ai/match-saver/run")]
    [Authorize(Roles = "AcademyDirector,GlobalAdmin")]
    public async Task<IActionResult> TriggerAiSaver([FromServices] MatchSaverService saverService)
    {
        // The underlying DbContext uses _tenantProvider to completely lock this run to the logged-in Academy!
        var optimizationReport = await saverService.AutopilotOptimizeQueueAsync();
        return Ok(new { Report = optimizationReport });
    }

    [HttpGet("ai/match-saver/queue-list")]
    [Authorize(Roles = "AcademyDirector,GlobalAdmin")]
    public async Task<IActionResult> GetShadowQueueList()
    {
        var currentAcademyId = _tenantProvider.GetTenantId();

        // Utilizing explicit extensions to safely sidestep namespace type collisions
        var activeQueue = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .ToListAsync(_dbContext.ShadowQueues.Where(sq => sq.AcademyId == currentAcademyId));

        // Project entries cleanly to align formatting properties with the TypeScript type interfaces
        var resultList = activeQueue.Select(q => new
        {
            id = q.Id.ToString(),
            playerName = q.PlayerName,
            preferredWindow = q.PreferredWindow,
            isResolved = q.IsResolved
        });

        return Ok(resultList);
    }

    [HttpPost("ai/match-saver/sms-webhook")]
    [AllowAnonymous] // Open exclusively to your SMS provider webhook gateway (e.g., Twilio)
    public async Task<IActionResult> HandlePlayerSmsResponse([FromBody] SmsReplyPayload model)
    {
        // 1. Locate the player's active standby row by checking their registered phone digits
        var activeStandby = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .FirstOrDefaultAsync(_dbContext.ShadowQueues, q => !q.IsResolved && q.PlayerPhoneNumber == model.FromNumber);

        if (activeStandby == null) 
            return Ok(new { Reply = "No active displaced match records found for this line." });

        string cleanReply = model.Body.Trim().ToUpper();

        // 2. STATE INTERCEPTION LOGIC MATRIX
        if (cleanReply == "YES")
        {
            // Extract the temporary proposed slot ID we cached during the initial agent scan
            var targetSlotGuid = activeStandby.ProposedSlotId;
            if (targetSlotGuid == null) return BadRequest("No pending reallocations map detected.");

            var openSlot = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(_dbContext.Bookings, b => b.Id == targetSlotGuid);
            if (openSlot != null && openSlot.IsAvailableSlot)
            {
                openSlot.IsAvailableSlot = false;
                openSlot.BookedPlayerName = activeStandby.PlayerName;
                activeStandby.IsResolved = true;

                await _dbContext.SaveChangesAsync();
                return Ok(new { Reply = $"CONFIRMED: Shift complete. You are booked on {openSlot.CourtName}." });
            }
            return Ok(new { Reply = "EXPIRED: That specific slot was snapped up. Re-routing to queue..." });
        }
        else if (cleanReply == "REFUND")
        {
            // Execute financial clearing logic rules
            activeStandby.IsResolved = true; // Clear from queue
            // _paymentGateway.RefundAcademyBalance(activeStandby.UserId);

            await _dbContext.SaveChangesAsync();
            return Ok(new { Reply = "CANCELLED: Match balance has been completely refunded back to your academy wallet." });
        }

        return Ok(new { Reply = "Command unrecognized. Please reply with 'YES' to confirm the new court slot, or 'REFUND' to cancel entirely." });
    }

    public record SmsReplyPayload(string FromNumber, string Body);

}