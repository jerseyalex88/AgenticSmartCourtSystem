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
                    // FIX: Instead of dropping players, preserve them in the Shadow Queue for the AI Agent
                    foreach (var conflict in standardMemberConflicts)
                    {
                        var queueEntry = new ShadowQueue
                        {
                            Id = Guid.NewGuid(),
                            AcademyId = conflict.AcademyId, // Match original tenant scope
                            OriginalCourtId = conflict.CourtId,
                            PlayerUserId = conflict.BookedByUserId,
                            OpponentUserId = conflict.OpponentUserId,
                            OriginalStartTimeUtc = conflict.StartTimeUtc,
                            OriginalEndTimeUtc = conflict.EndTimeUtc,
                            QueueStatus = "Pending_Reschedule",
                            DisplacementReason = "Executive Clinic Override"
                        };
                        _context.ShadowQueues.Add(queueEntry);
                    }

                    // Now safely remove them from the active calendar pool grid
                    _context.Bookings.RemoveRange(standardMemberConflicts);
                    Console.WriteLine($"--> Elite Clinic override fired. Preserved {standardMemberConflicts.Count} member booking(s) in Shadow Queue.");

                }
                else
                {
                    // If there is another Clinic already sitting in this slot, even a Director cannot overwrite it
                    return BadRequest("Scheduling Collision: Another Elite Training Clinic is already locked into this court window.");
                }
            }
            else
            {
                // =========================================================================
                // SCENARIO B EXPANSION: STANDARD USER COLLISION MATRIX
                // =========================================================================
                
                // Check if the collision is happening because the physical facility asset is currently offline
                if (court.Status == "Rained_Out" || court.Status == "Maintenance_Locked")
                {
                    // Instead of a blind rejection, funnel the member into the Shadow Queue tracker pool
                    var standbyEntry = new ShadowQueue
                    {
                        Id = Guid.NewGuid(),
                        AcademyId = court.AcademyId,
                        OriginalCourtId = court.Id,
                        PlayerUserId = userId,
                        OpponentUserId = model.OpponentUserId,
                        OriginalStartTimeUtc = model.StartTimeUtc,
                        OriginalEndTimeUtc = model.EndTimeUtc,
                        QueueStatus = "Pending_Reschedule",
                        DisplacementReason = $"Attempted booking during facility asset lockout status ({court.Status})"
                    };

                    _context.ShadowQueues.Add(standbyEntry);
                    await _context.SaveChangesAsync();

                    return BadRequest(new { 
                        Message = $"Court Availability Exception: This court is currently {court.Status}. Your request has been safely queued in our system standby logs.",
                        QueueId = standbyEntry.Id
                    });
                }

                // Standard baseline human-over-human collision block
                return BadRequest("Court Availability Exception: The requested court window is locked or already occupied.");
            }
            // else
            // {
            //     // Scenario B: A standard Member or Coach is trying to book space over an existing block
            //     return BadRequest("Court Availability Exception: The requested court window is locked or already occupied.");
            // }
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

        // =========================================================================
        // AUTOMATED SURFACE DEGRADATION ENGINE
        // =========================================================================
        
        // 1. Calculate how many minutes of physical wear this booking impacts
        TimeSpan calculatedDuration = model.EndTimeUtc - model.StartTimeUtc;
        int matchMinutes = (int)calculatedDuration.TotalMinutes;

        // 2. Accumulate the wear runtime straight onto the physical court entity row
        court.AggregateMinutesPlayed += matchMinutes;

        // 3. THRESHOLD SAFETY INTERCEPTOR
        // If the aggregate minutes exceed the maintenance boundary threshold, lock the court down
        if (court.AggregateMinutesPlayed >= court.MaintenanceThresholdMinutes)
        {
            court.Status = "Maintenance_Locked";

            // FIX: Automatically log a physical work order tracking ticket for the grounds crew
            var maintenanceTicket = new MaintenanceTicket
            {
                Id = Guid.NewGuid(),
                AcademyId = court.AcademyId,
                CourtId = court.Id,
                Title = $"Automated Surface Maintenance Required: {court.Name}",
                Description = $"Court wear limit exceeded. Aggregate runtime hit {court.AggregateMinutesPlayed} minutes. Surface type ({court.SurfaceType}) requires standard refurbishment sweep or mowing routine.",
                TicketStatus = "Open_Queued",
                PriorityLevel = "Routine_Wear"
            };

            _context.MaintenanceTickets.Add(maintenanceTicket);
            Console.WriteLine($"--> Wear Limit Breached on {court.Name}. Maintenance Ticket generated successfully.");

            // System Note: We attach an explanation onto the booking record for display clarity
            booking.Notes += " [SYSTEM NOTICE: This match triggers an automated facility maintenance lockout loop]";
        }

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

// FIX: Appended string? OpponentUserId to the input contract data transfer record
public record CreateBookingDto(Guid CourtId, DateTime StartTimeUtc, DateTime EndTimeUtc, string BookingType, string Notes, string? OpponentUserId);

