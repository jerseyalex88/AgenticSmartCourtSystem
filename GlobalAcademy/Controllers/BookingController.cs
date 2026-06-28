using GlobalAcademy.Data;
using GlobalAcademy.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace GlobalAcademy.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize] // Every caller must possess a valid authenticated JWT token profile
public class BookingController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public BookingController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpPost("create")]
    public async Task<IActionResult> CreateBooking([FromBody] CreateBookingDto model)
    {
        // Enforce basic logical baseline: End time must strictly follow start time
        if (model.StartTimeUtc >= model.EndTimeUtc)
        {
            return BadRequest("Invalid schedule sequence: End time must follow start time parameters.");
        }

        // 1. Verify the targeted court asset physically exists under this tenant context boundary
        var court = await _context.Courts.FindAsync(model.CourtId);
        if (court == null)
        {
            return NotFound("Target court configuration missing or unauthorized access attempt isolated.");
        }

        // Extract the user identity contexts out of the validated token claims arrays
        var userId = User.Identity?.Name ?? "Anonymous_User";
        var isDirector = User.IsInRole("AcademyDirector");

        // 2. DETERMINISTIC COLLISION ENGINE
        // Query PostgreSQL for any overlapping bookings on this specific court during the requested window
        var overlappingBookings = await _context.Bookings
            .Where(b => b.CourtId == model.CourtId && 
                        model.StartTimeUtc < b.EndTimeUtc && 
                        model.EndTimeUtc > b.StartTimeUtc)
            .ToListAsync();

        // 3. THE ACADEMY VS. MEMBER SPLIT MATRIX DETERMINATION TREE
        if (overlappingBookings.Any())
        {
            // Scenario A: An Executive Director is reserving a hard schedule block for an Elite Clinic
            if (isDirector && model.BookingType == "Clinic")
            {
                // Isolate and identify standard member bookings that are causing the collision conflict
                var standardMemberConflicts = overlappingBookings
                    .Where(b => b.BookingType == "MemberBooking")
                    .ToList();

                if (standardMemberConflicts.Count == overlappingBookings.Count)
                {
                    // SYSTEM UPGRADE POINT: Instead of throwing a blind scheduling crash error,
                    // we remove the conflicting member slots from the public inventory grid.
                    // This forces them into the Shadow Queue, clearing the baseline path for the Elite clinic.
                    _context.Bookings.RemoveRange(standardMemberConflicts);
                    
                    // Log audit metrics so our Phase 3 AI "Match-Saver" Agent can instantly discover them
                    Console.WriteLine($"--> Elite Clinic override fired. Evicting {standardMemberConflicts.Count} member booking(s) to Shadow Queue.");
                }
                else
                {
                    // If there is another Clinic already sitting in this slot, even a Director cannot overwrite it
                    return BadRequest("Scheduling Collision: Another Elite Training Clinic is already locked into this court window.");
                }
            }
            else
            {
                // Scenario B: A standard Member or Coach is trying to book space over an existing block
                return BadRequest("Court Availability Exception: The requested court window is locked or already occupied.");
            }
        }

        // 4. INVENTORY ASSIGNMENT
        var booking = new Booking
        {
            Id = Guid.NewGuid(),
            CourtId = model.CourtId,
            BookedByUserId = userId,
            StartTimeUtc = model.StartTimeUtc,
            EndTimeUtc = model.EndTimeUtc,
            BookingType = isDirector ? model.BookingType : "MemberBooking", // Standard accounts cannot forge Clinic priorities
            Notes = model.Notes
        };

        _context.Bookings.Add(booking);
        await _context.SaveChangesAsync(); // Stamped cleanly with AcademyId through our database filter layer!

        return Ok(new { Message = "Inventory position secured successfully.", Booking = booking });
    }

    [HttpGet("court/{courtId:guid}/schedule")]
    public async Task<IActionResult> GetCourtSchedule(Guid courtId)
    {
        // Fetch upcoming schedule array listings for the targeted asset
        var schedule = await _context.Bookings
            .Where(b => b.CourtId == courtId)
            .OrderBy(b => b.StartTimeUtc)
            .ToListAsync();

        return Ok(schedule);
    }
}

public record CreateBookingDto(Guid CourtId, DateTime StartTimeUtc, DateTime EndTimeUtc, string BookingType, string Notes);
