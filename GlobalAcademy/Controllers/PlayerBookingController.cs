using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using GlobalAcademy.Data;
using GlobalAcademy.Security;

namespace GlobalAcademy.Controllers;

[ApiController]
[Route("api/player/bookings")]
[Authorize(Roles = "Player,AcademyDirector,GlobalAdmin")] // Open to core authenticated users
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
    // 1. GET: FETCH ACTIVE CONFIRMED RESERVATIONS LINKED TO THIS LOGGED-IN PLAYER
    // =========================================================================
    [HttpGet("my-reservations")]
    public async Task<IActionResult> GetMyReservations()
    {
        var currentAcademyId = _tenantProvider.GetTenantId();
        
        // Extract the explicit human username string out of the HTTP Context token passport
        var currentUserName = HttpContext.User.Identity?.Name;
        if (string.IsNullOrEmpty(currentUserName)) return Unauthorized("Identity token unreadable.");

        // Query standard bookings where the BookedPlayerName string matches this active login context
        // Global multi-tenant filters automatically protect cross-academy isolation partitions!
        var userBookings = await _dbContext.Bookings
            .Where(b => b.AcademyId == currentAcademyId && b.BookedPlayerName == currentUserName && !b.IsAvailableSlot)
            .OrderBy(b => b.SlotTime)
            .ToListAsync();

        var payload = userBookings.Select(b => new
        {
            id = b.Id.ToString(),
            courtName = b.CourtName,
            branchName = "Main Central Arena Complex", // Expandable based on your structural model mappings
            slotTime = b.SlotTime,
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

        var standbyRows = await _dbContext.ShadowQueues
            .Where(sq => sq.AcademyId == currentAcademyId && sq.PlayerName == currentUserName && !sq.IsResolved)
            .ToListAsync();

        var payload = standbyRows.Select(sq => new
        {
            id = sq.Id.ToString(),
            preferredWindow = sq.PreferredWindow,
            isResolved = sq.IsResolved
        });

        return Ok(payload);
    }

    // =========================================================================
    // 3. DELETE: DESTRUCTIVE SLOT RELEASE HANDLER
    // =========================================================================
    [HttpDelete("release/{bookingId}")]
    public async Task<IActionResult> ReleaseReservationSlot(string bookingId)
    {
        if (!Guid.TryParse(bookingId, out Guid bookingGuid)) 
            return BadRequest("Invalid identity format.");

        var targetBooking = await _dbContext.Bookings.FirstOrDefaultAsync(b => b.Id == bookingGuid);
        if (targetBooking == null) return NotFound("Target reservation allocation row does not exist.");

        // SECURITY GUARD: Double verify user owns this match slot row before mutating table cells
        var currentUserName = HttpContext.User.Identity?.Name;
        if (targetBooking.BookedPlayerName != currentUserName) 
            return Forbid("Security Block: Cross-identity data dropping rejected.");

        // RESET STATE: Clear the slot and mark it open for the public pool or AI agent recovery
        targetBooking.IsAvailableSlot = true;
        targetBooking.BookedPlayerName = null;
        targetBooking.BookingType = "Available Marketplace Slot";

        await _dbContext.SaveChangesAsync();
        return Ok(new { Message = "Slot released successfully." });
    }
}
