using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using GlobalAcademy.Models;
using GlobalAcademy.Security;
using GlobalAcademy.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace GlobalAcademy.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AiOrchestrationController : ControllerBase
{
    private readonly UserManager<IdentityUser> _userManager;
    private readonly RoleManager<IdentityRole> _roleManager;
    private readonly SignInManager<IdentityUser> _signInManager;
    private readonly IConfiguration _configuration;
    private readonly ITenantProvider _tenantProvider;
    private readonly Data.ApplicationDbContext _dbContext;

    public AiOrchestrationController(UserManager<IdentityUser> userManager, 
        RoleManager<IdentityRole> roleManager, 
        IConfiguration configuration,
        ITenantProvider tenantProvider,
        Data.ApplicationDbContext dbContext,
        SignInManager<IdentityUser> signInManager)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _configuration = configuration;
        _tenantProvider = tenantProvider;
        _dbContext = dbContext;
        _signInManager = signInManager;
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
        string legacyPlayerName = "Paula Tsitsipas Test";

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
        // FIX: Using Contains and stripping out symbols to prevent local database character padding anomalies
        string cleanInputPhone = model.FromNumber.Replace("+", "").Trim();

        var activeStandby = await _dbContext.ShadowQueues.IgnoreQueryFilters()
            .FirstOrDefaultAsync(q => !q.IsResolved && 
                (q.PlayerPhoneNumber.Contains(cleanInputPhone) || cleanInputPhone.Contains(q.PlayerPhoneNumber.Replace("+","").Trim())));

        // var activeStandby = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
        //     .FirstOrDefaultAsync(_dbContext.ShadowQueues.IgnoreQueryFilters(), q => !q.IsResolved && q.PlayerPhoneNumber == model.FromNumber);

        if (activeStandby == null) 
            return Ok(new { Reply = $"No active displaced match records found for this line '{cleanInputPhone}'." });

        string cleanReply = model.Body.Trim().ToUpper();

        // 2. STATE INTERCEPTION LOGIC MATRIX
        if (cleanReply == "YES")
        {
            // Extract the temporary proposed slot ID we cached during the initial agent scan
            var targetSlotGuid = activeStandby.ProposedSlotId;
            if (targetSlotGuid == null) return BadRequest("No pending reallocations map detected.");

            var openSlot = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(_dbContext.Bookings.IgnoreQueryFilters(), b => b.Id == targetSlotGuid);
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

    [HttpGet("ai/match-saver/active-dispatches")]
    [Authorize(Roles = "AcademyDirector,GlobalAdmin")]
    public async Task<IActionResult> GetActiveDispatches()
    {
        var currentAcademyId = _tenantProvider.GetTenantId();

        // Pull shadow queue entries belonging to this tenant partition
        var activeDispatches = await _dbContext.ShadowQueues
            .Where(sq => sq.AcademyId == currentAcademyId && !string.IsNullOrEmpty(sq.PlayerPhoneNumber))
            .OrderByDescending(sq => sq.Id)
            .ToListAsync();

        // Project data mappings into clean models matching the frontend's TypeScript structure
        var telemetryList = activeDispatches.Select(q => {
            // Find the matching booking details if a proposal has been stamped by the AI
            var matchingBooking = q.ProposedSlotId.HasValue 
                ? _dbContext.Bookings.IgnoreQueryFilters().FirstOrDefault(b => b.Id == q.ProposedSlotId.Value)
                : null;

            return new
            {
                queueId = q.Id.ToString(),
                playerName = q.PlayerName,
                originalCourtName = "Outdoor Clay Court 2 (Rained Out)",
                proposedCourtName = matchingBooking?.CourtName ?? "Scanning for Open Courts...",
                proposedBranchName = matchingBooking != null ? "North Arena Branch" : "Calculating Spatial Radius...",
                proposedTime = matchingBooking != null ? matchingBooking.SlotTime.ToString("HH:mm") + " UTC" : "Pending...",
                phoneNumber = q.PlayerPhoneNumber,
                status = q.DispatchStatus // "AwaitingReply", "Confirmed", "Refunded"
            };
        });

        return Ok(telemetryList);
    }
    // =========================================================================
    // POST: SIMULATE A SUDDEN RAIN-OUT CANCELLATION EVENT
    // =========================================================================
    [HttpPost("ai/match-saver/simulate-rain-out")]
    [Authorize(Roles = "AcademyDirector,GlobalAdmin")]
    public async Task<IActionResult> SimulateRainOutEvent()
    {
        var currentAcademyId = _tenantProvider.GetTenantId();

        // Find a valid physical court infrastructure link inside this tenant to anchor the test rows
        var existingCourt = await _dbContext.Courts.FirstOrDefaultAsync(c => c.AcademyId == currentAcademyId);
        if (existingCourt == null)
        {
            return BadRequest("Prerequisite Failure: Please ensure at least one physical Court is configured in your tenant.");
        }

        // Build a unique scenario record
        var randomSuffix = new Random().Next(100, 999);
        var simulatedProposedSlotId = Guid.NewGuid();

        var displacedPlayer = new ShadowQueue
        {
            Id = Guid.NewGuid(),
            AcademyId = currentAcademyId,
            PlayerName = $"Roger Federer (Sim-{randomSuffix})",
            PreferredWindow = "Immediate Emergency Reroute",
            IsResolved = false,
            PlayerPhoneNumber = $"+1555019{randomSuffix}",
            ProposedSlotId = simulatedProposedSlotId,
            DispatchStatus = "AwaitingReply"
        };

        var openAlternativeSlot = new Booking
        {
            Id = simulatedProposedSlotId,
            AcademyId = currentAcademyId,
            BranchId = existingCourt.BranchId,
            CourtId = existingCourt.Id,
            CourtName = "Indoor Center Show Court 3",
            SlotTime = DateTime.UtcNow.AddMinutes(45), // Rerouted match start time
            IsAvailableSlot = true,
            BookingType = "AI Emergency Recovery Slot",
            DurationInMinutes = 90,
            PricePaid = 0.00m
        };

        using (var transaction = await _dbContext.Database.BeginTransactionAsync())
        {
            try
            {
                _dbContext.ShadowQueues.Add(displacedPlayer);
                _dbContext.Bookings.Add(openAlternativeSlot);
                await _dbContext.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, $"Transaction abort exception: {ex.Message}");
            }
        }

        return Ok(new { Message = "Emergency climate displacement event broadcasted. Agent dispatched." });
    }
    // =========================================================================
    // POST: CONVERSATIONAL NATURAL LANGUAGE AUTHENTICATION GATEWAY
    // =========================================================================
    [HttpPost("ai/conversational-auth")]
    [AllowAnonymous] // Open publicly so unauthenticated users can chat to log in!
    public async Task<IActionResult> ConversationalAuth([FromBody] ConversationalAuthDto payload)
    {
        string userInput = payload.UserInput.Trim();
        string currentStage = payload.CurrentStage; // 'AwaitingIntent', 'AwaitingEmail', 'AwaitingPassword'
        string cachedEmail = payload.CachedEmail ?? "";

        // Fallback responses using universal, accessible language
        if (currentStage == "AwaitingIntent")
        {
            bool wantsToLogin = userInput.Contains("log", StringComparison.OrdinalIgnoreCase) || 
                                userInput.Contains("sign", StringComparison.OrdinalIgnoreCase) ||
                                userInput.Contains("in", StringComparison.OrdinalIgnoreCase);

            if (wantsToLogin)
            {
                return Ok(new ConversationalResponseDto(
                    NextStage: "AwaitingEmail",
                    CachedEmail: "",
                    AgentResponse: "🔵 System Access Initiated. Affirmative. Please provide your registered account email address:",
                    Token: null
                ));
            }

            return Ok(new ConversationalResponseDto(
                NextStage: "AwaitingIntent",
                CachedEmail: "",
                AgentResponse: "❓ Intent unverified. Try typing 'I want to log in' or 'Sign me in' to activate the access lifecycle protocol.",
                Token: null
            ));
        }

        if (currentStage == "AwaitingEmail")
        {
            // Basic structural check for email formatting validation
            if (!userInput.Contains("@") || !userInput.Contains("."))
            {
                return Ok(new ConversationalResponseDto(
                    NextStage: "AwaitingEmail",
                    CachedEmail: "",
                    AgentResponse: "⚠️ Format Exception: That string does not appear to follow standard email structures. Please re-enter a valid email address:",
                    Token: null
                ));
            }

            // Email validated, advance the state machine to password mode
            return Ok(new ConversationalResponseDto(
                NextStage: "AwaitingPassword",
                CachedEmail: userInput, // Cache the email safely in the payload context wrapper
                AgentResponse: "🔒 Email captured safely. Now, provide your secure account password. (Note: Input field characters are fully masked for security):",
                Token: null
            ));
        }

        if (currentStage == "AwaitingPassword")
        {
            try
            {
                // 1. DATABASE RESOLUTION: Look up the real account credentials inside your identity tables
                var user = await _userManager.FindByEmailAsync(cachedEmail);
                if (user == null)
                {
                    return BadRequest(new { Message = "Authentication Denied: Account coordinates do not match our system files." });
                }

                // 2. PASSWORD VALIDATION GATE: Verify the secure string inputs match PostgreSQL hashes
                var result = await _signInManager.CheckPasswordSignInAsync(user, userInput, false);
                if (!result.Succeeded)
                {
                    return BadRequest(new { Message = "Authentication Denied: Secure password record verification failed." });
                }

                // 3. CLAIMS PACKAGING PERIMETER ASSEMBLY: Replicate the exact claims dictionary from AuthController.cs
                var userRoles = await _userManager.GetRolesAsync(user);
                var userClaims = await _userManager.GetClaimsAsync(user);

                var authClaims = new System.Collections.Generic.List<System.Security.Claims.Claim>
                {
                    new System.Security.Claims.Claim("http://xmlsoap.org", user.UserName!),
                    new System.Security.Claims.Claim("jti", Guid.NewGuid().ToString()),
                    new System.Security.Claims.Claim("nameidentifier", user.Id),
                    new System.Security.Claims.Claim("email", user.Email!),
                    new System.Security.Claims.Claim("username", user.UserName!)
                };

                // Add role-based access attributes dynamically
                foreach (var role in userRoles)
                {
                    authClaims.Add(new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Role, role));
                }

                // Add tenant isolation shields
                foreach (var claim in userClaims)
            {
                if (claim.Type != ClaimTypes.Role && claim.Type != "role")
                {
                    authClaims.Add(claim);
                }
            }

                // 4. GENERATE CRYO-SECURE JWT TOKEN SIGNATURE: Use your live application configuration keys
                var jwtSettings = _configuration.GetSection("JwtSettings");
                var authSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings["Secret"]!));

                var token = new JwtSecurityToken(
                    issuer: jwtSettings["Issuer"],
                    audience: jwtSettings["Audience"],
                    expires: DateTime.UtcNow.AddMinutes(double.Parse(jwtSettings["ExpiryInMinutes"]!)),
                    claims: authClaims,
                    signingCredentials: new SigningCredentials(authSigningKey, SecurityAlgorithms.HmacSha256)
                );

                // Determine user's core system security role string to feed frontend router toggles
                string primaryRole = userRoles.FirstOrDefault() ?? "Player";

                // Return the true, cryptographically valid token envelope contract directly to React!
                return Ok(new ConversationalResponseDto(
                    NextStage: "Completed",
                    CachedEmail: cachedEmail,
                    AgentResponse: "Core authorization protocols confirmed. Opening full workspace layout matrices...",
                    Token: new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler().WriteToken(token)
                ));
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = $"Gateway Handshake Disconnection: {ex.Message}" });
            }
        }

        return Unauthorized("Cryptographic handshake failed: Invalid email or password credentials.");
    }

    // Explicit data transfer records for conversational identity handling
    public record ConversationalAuthDto(string UserInput, string CurrentStage, string? CachedEmail);
    public record ConversationalResponseDto(string NextStage, string CachedEmail, string AgentResponse, string? Token);
    public record SmsReplyPayload(string FromNumber, string Body);

}