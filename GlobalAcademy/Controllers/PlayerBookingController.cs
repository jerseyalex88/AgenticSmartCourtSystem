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

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Player,AcademyDirector,GlobalAdmin")] // Secure multi-role permission locks
public class PlayerBookingController : ControllerBase
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ITenantProvider _tenantProvider;

    public PlayerBookingController(
        ApplicationDbContext dbContext,
        ITenantProvider tenantProvider)
    {
        _dbContext = dbContext;
        _tenantProvider = tenantProvider;
    }

    // =========================================================================
    // 1. GET: FETCH ACTIVE RESERVATIONS LINKED TO THIS LOGGED-IN PLAYER
    // =========================================================================
    [HttpGet("my-reservations")]
    public async Task<IActionResult> GetMyReservations()
    {
        var currentAcademyId = _tenantProvider.GetTenantId();

        var currentUserName = HttpContext.User.Claims
            .FirstOrDefault(c => c.Type.Contains("xmlsoap.org"))?.Value;

        if (string.IsNullOrEmpty(currentUserName))
        {
            // Fallback: Check standard default name mapping keys if the array elements shuffle
            currentUserName = HttpContext.User.Identity?.Name;
        }

        if (string.IsNullOrEmpty(currentUserName)) 
        {
            return Unauthorized(new { Message = "Security Obstacle: User identity claim string (username) was not detected inside the active session token." });
        }

        var userIdClaimString = HttpContext.User.Claims
            .FirstOrDefault(c => c.Type.Contains("nameidentifier") || c.Type == "sub" || c.Type == "nameid")?.Value;

        Guid bookedByUserIdGuid = Guid.Empty;
        
        // Safely parse the extracted token string value into a valid structural Guid token type
        if (!string.IsNullOrEmpty(userIdClaimString) && Guid.TryParse(userIdClaimString, out Guid parsedGuid))
        {
            bookedByUserIdGuid = parsedGuid;
        }
        else
        {
            return Unauthorized(new { Message = "Security Obstacle: User identity claim string (id) was not detected inside the active session token." });
        }
        
        // Pull active occupant rows matching this specific player username signature string
        var userBookings = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .ToListAsync(_dbContext.Bookings.Where(b => 
                b.AcademyId == currentAcademyId && 
                b.BookedByUserId == bookedByUserIdGuid.ToString() &&
                b.BookedPlayerName == currentUserName && 
                !b.IsAvailableSlot));

        var payload = userBookings.Select(b => new
        {
            id = b.Id.ToString(),
            courtName = b.CourtName,
            branchName = "Main Central Arena Complex", 
            slotTime = b.StartTimeUtc, // Anchored to our precise timestamps
            durationMinutes = b.DurationInMinutes
        });

        return Ok(payload);
    }

    // =========================================================================
    // 2. GET: FETCH STANDBY STATUS BUFFER ENTRIES FOR ACTIVE LOGGED-IN USER
    // =========================================================================
    [HttpGet("my-standby")]
    public async Task<IActionResult> GetMyStandbyStatus()
    {
        var currentAcademyId = _tenantProvider.GetTenantId();
        var currentUserName = HttpContext.User.Identity?.Name;

        var standbyRows = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .ToListAsync(_dbContext.ShadowQueues.Where(sq => 
                sq.AcademyId == currentAcademyId && 
                sq.PlayerName == currentUserName && 
                !sq.IsResolved));

        var payload = standbyRows.Select(sq => new
        {
            id = sq.Id.ToString(),
            preferredWindow = sq.PreferredWindow,
            isResolved = sq.IsResolved
        });

        return Ok(payload);
    }

    // =========================================================================
    // 3. GET: COMPILE THE 7-DAY DYNAMIC AVAILABILITY AVAILABILITY MATRIX
    // =========================================================================
    [HttpGet("available-matrix")]
    public async Task<IActionResult> Get7DayAvailableMatrix([FromQuery] string startDate)
    {
        var currentAcademyId = _tenantProvider.GetTenantId();
        
        if (!DateTime.TryParse(startDate, out DateTime parsedStart))
            return BadRequest("Invalid starting date formatting token.");

        // FIX: Force the unassigned Date structure to declare its Kind as explicit Utc
        var rangeStartUtc = DateTime.SpecifyKind(parsedStart.Date, DateTimeKind.Utc);
        var rangeEndUtc = DateTime.SpecifyKind(rangeStartUtc.AddDays(7), DateTimeKind.Utc);

        // A. Fetch all active courts belonging strictly to this tenant partition
        var courts = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .ToListAsync(_dbContext.Courts.Where(c => c.AcademyId == currentAcademyId));

        // B. Fetch all live booked event rows committed for the 7-day timeframe segment
        var overlappingBookings = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .ToListAsync(_dbContext.Bookings.Where(b => 
                b.AcademyId == currentAcademyId && 
                b.StartTimeUtc >= rangeStartUtc && 
                b.StartTimeUtc < rangeEndUtc));

        // C. CONFIGURATION HOOK: Generate daily hourly slots grid (8:00 AM to 8:00 PM track list)
        int startHour = 8;
        int endHour = 20;

        var matrixReport = new System.Collections.Generic.List<object>();

        // Core 3-tier looping system generating: Day -> Hour -> Court metrics mappings
        for (int dayOffset = 0; dayOffset < 7; dayOffset++)
        {
            var targetDay = rangeStartUtc.AddDays(dayOffset);
            var slotsInDay = new System.Collections.Generic.List<object>();

            for (int hour = startHour; hour < endHour; hour++)
            {
                // FIX: Ensure the loop tokens match the exact Utc Kind constraint expected by Npgsql
                var slotStartUtc = DateTime.SpecifyKind(targetDay.AddHours(hour), DateTimeKind.Utc);
                var slotEndUtc = DateTime.SpecifyKind(slotStartUtc.AddHours(1), DateTimeKind.Utc);

                foreach (var court in courts)
                {
                    // Check if an event row matches this exact spatial-temporal tracking cell
                    var match = overlappingBookings.FirstOrDefault(b => 
                        b.CourtId == court.Id && b.StartTimeUtc == slotStartUtc);

                    slotsInDay.Add(new
                    {
                        courtId = court.Id.ToString(),
                        courtName = court.Name,
                        startTimeUtc = slotStartUtc,
                        endTimeUtc = slotEndUtc,
                        isAvailable = (match == null), // If no row exists, it is VACANT!
                        bookedPlayerName = match?.BookedPlayerName
                    });
                }
            }

            matrixReport.Add(new
            {
                dateString = targetDay.ToString("yyyy-MM-dd"),
                slots = slotsInDay
            });
        }

        var sortedMatrixReport = matrixReport.Select(day => new
        {
            dateString = ((dynamic)day).dateString,
            slots = ((System.Collections.Generic.List<object>)((dynamic)day).slots)
                .OrderBy(s => ((dynamic)s).courtName)
                .ThenBy(s => ((dynamic)s).startTimeUtc)
                .ToList()
        }).ToList();

        return Ok(sortedMatrixReport);
    }
    // =========================================================================
    // 4. POST: COMMIT AN ON-DEMAND BOOKING RECORD ROW (MODEL B INSERT)
    // =========================================================================
    [HttpPost("claim-dynamic")]
    public async Task<IActionResult> ClaimDynamicSlotAllocation([FromBody] ClaimPayloadDto model)
    {
        var currentAcademyId = _tenantProvider.GetTenantId();

        var currentUserName = HttpContext.User.Claims
            .FirstOrDefault(c => c.Type.Contains("xmlsoap.org"))?.Value;

        if (string.IsNullOrEmpty(currentUserName))
        {
            // Fallback: Check standard default name mapping keys if the array elements shuffle
            currentUserName = HttpContext.User.Identity?.Name;
        }

        if (string.IsNullOrEmpty(currentUserName)) 
        {
            return Unauthorized(new { Message = "Security Obstacle: User identity claim string (username) was not detected inside the active session token." });
        }

        var userIdClaimString = HttpContext.User.Claims
            .FirstOrDefault(c => c.Type.Contains("nameidentifier") || c.Type == "sub" || c.Type == "nameid")?.Value;

        Guid bookedByUserIdGuid = Guid.Empty;
        
        // Safely parse the extracted token string value into a valid structural Guid token type
        if (!string.IsNullOrEmpty(userIdClaimString) && Guid.TryParse(userIdClaimString, out Guid parsedGuid))
        {
            bookedByUserIdGuid = parsedGuid;
        }
        else
        {
            return Unauthorized(new { Message = "Security Obstacle: User identity claim string (id) was not detected inside the active session token." });
        }

        var startUtc = model.StartTimeUtc.ToUniversalTime();
        var endUtc = startUtc.AddHours(1); // Forcing strict 60 minutes intervals

        // CRITICAL DOUBLE-BOOKING SHIELD: Verify zero row overlaps exist before running insertion
        var isConflict = await _dbContext.Bookings.AnyAsync(b => 
            b.AcademyId == currentAcademyId && 
            b.CourtId == model.CourtId && 
            b.StartTimeUtc == startUtc);

        if (isConflict)
        {
            return BadRequest(new { Message = "Collision Alert: This court interval has been secured by another player node." });
        }

        // Fetch parent information to satisfy navigation audit fields
        var courtInfo = await _dbContext.Courts.FirstOrDefaultAsync(c => c.Id == model.CourtId);
        if (courtInfo == null) 
            return BadRequest("Infrastructure Exception: Target court identifier missing.");

        var freshBooking = new Booking
        {
            Id = Guid.NewGuid(),
            AcademyId = currentAcademyId,
            BranchId = courtInfo.BranchId,
            CourtId = courtInfo.Id,
            CourtName = courtInfo.Name,
            StartTimeUtc = startUtc,
            EndTimeUtc = endUtc,
            SlotTime = startUtc, // Legacy column backfill compatibility
            BookedPlayerName = currentUserName,
            BookedByUserId = bookedByUserIdGuid.ToString(),
            IsAvailableSlot = false, // Locked down
            BookingType = "Player App Secured Reservation",
            PricePaid = 0.00m,
            CreatedAtUtc = DateTime.UtcNow
        };

        using (var transaction = await _dbContext.Database.BeginTransactionAsync())
        {
            try
            {
                _dbContext.Bookings.Add(freshBooking);
                await _dbContext.SaveChangesAsync();
                await transaction.CommitAsync(); // Physical data flush straight to disk
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, $"Database collision abort: {ex.Message}");
            }
        }

        return Ok(new { Message = "Match allocation row written cleanly to transaction logs." });
    }

    // =========================================================================
    // 5. DELETE: DESTRUCTIVE TRANSACTIONAL SLOT CANCELLATION RELEASE HANDLER
    // =========================================================================
    [HttpDelete("release/{bookingId}")]
    public async Task<IActionResult> ReleaseReservationSlot(string bookingId)
    {
        if (!Guid.TryParse(bookingId, out Guid bookingGuid)) 
            return BadRequest("Invalid transaction identifier formatting standard.");

        var targetBooking = await _dbContext.Bookings.FirstOrDefaultAsync(b => b.Id == bookingGuid);
        if (targetBooking == null) 
            return NotFound("Target reservation allocation row does not exist.");

        // SECURITY GUARD: Double verify user owns this match slot row before mutating table cells

        var currentUserName = HttpContext.User.Claims
            .FirstOrDefault(c => c.Type.Contains("xmlsoap.org"))?.Value;

        if (string.IsNullOrEmpty(currentUserName))
        {
            // Fallback: Check standard default name mapping keys if the array elements shuffle
            currentUserName = HttpContext.User.Identity?.Name;
        }

        if (string.IsNullOrEmpty(currentUserName)) 
        {
            return Unauthorized(new { Message = "Security Obstacle: User identity claim string (username) was not detected inside the active session token." });
        }

        var userIdClaimString = HttpContext.User.Claims
            .FirstOrDefault(c => c.Type.Contains("nameidentifier") || c.Type == "sub" || c.Type == "nameid")?.Value;

        Guid bookedByUserIdGuid = Guid.Empty;
        
        // Safely parse the extracted token string value into a valid structural Guid token type
        if (!string.IsNullOrEmpty(userIdClaimString) && Guid.TryParse(userIdClaimString, out Guid parsedGuid))
        {
            bookedByUserIdGuid = parsedGuid;
        }
        else
        {
            return Unauthorized(new { Message = "Security Obstacle: User identity claim string (id) was not detected inside the active session token." });
        }

        if (targetBooking.BookedPlayerName != currentUserName && targetBooking.BookedByUserId != bookedByUserIdGuid.ToString()) 
            return Forbid("Security Violation: Cross-identity data dropping transaction rejected.");

        // Model B Action Rules: Simply drop the booking entry row straight from your active event logs database!
        using (var transaction = await _dbContext.Database.BeginTransactionAsync())
        {
            try
            {
                _dbContext.Bookings.Remove(targetBooking);
                await _dbContext.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, $"Deletion execution layer exception: {ex.Message}");
            }
        }

        return Ok(new { Message = "Slot transaction dropped and released successfully." });
    }
}

// Data Transfer Object definition record model
public record ClaimPayloadDto(Guid CourtId, string CourtName, DateTime StartTimeUtc);
