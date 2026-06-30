using GlobalAcademy.Data;
using GlobalAcademy.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace GlobalAcademy.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize] 
public class BookingController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public BookingController(ApplicationDbContext context)
    {
        _context = context;
    }

    // --- READ (GET ALL FOR TENANT) ---
    [HttpGet]
    public async Task<IActionResult> GetAllBookings()
    {
        var bookings = await _context.Bookings.ToListAsync();
        return Ok(bookings);
    }

    // --- READ SINGLE ---
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetBookingById(Guid id)
    {
        var booking = await _context.Bookings.FindAsync(id);
        if (booking == null) return NotFound("Target booking configuration record missing or unauthorized access attempt.");
        return Ok(booking);
    }

    // --- CREATE ---
    [HttpPost("create")]
    public async Task<IActionResult> CreateBooking([FromBody] CreateBookingDto model)
    {
        if (model.StartTimeUtc >= model.EndTimeUtc)
        {
            return BadRequest("Invalid schedule sequence: End time must follow start time parameters.");
        }

        var court = await _context.Courts.FindAsync(model.CourtId);
        if (court == null) return NotFound("Target court configuration missing or unauthorized access attempt isolated.");

        TimeSpan bookingDuration = model.EndTimeUtc - model.StartTimeUtc;
        double totalMinutes = bookingDuration.TotalMinutes;

        if (totalMinutes != 60 && totalMinutes != 90)
        {
            return BadRequest("Operational Constraint: The academy time-slot grid only accepts fixed 60-minute or 90-minute intervals.");
        }

        if (model.StartTimeUtc.Minute != 0 && model.StartTimeUtc.Minute != 30)
        {
            return BadRequest("Grid Alignment Error: Bookings must align to the academy time-slot grid (starting at :00 or :30 minutes past the hour).");
        }

        var userId = User.Identity?.Name ?? "Anonymous_User";
        var isDirector = User.IsInRole("AcademyDirector");

        var overlappingBookings = await _context.Bookings
            .Where(b => b.CourtId == model.CourtId && 
                        model.StartTimeUtc < b.EndTimeUtc && 
                        model.EndTimeUtc > b.StartTimeUtc)
            .ToListAsync();

        if (overlappingBookings.Any())
        {
            if (isDirector && model.BookingType == "Clinic")
            {
                var standardMemberConflicts = overlappingBookings
                    .Where(b => b.BookingType == "MemberBooking")
                    .ToList();

                if (standardMemberConflicts.Count == overlappingBookings.Count)
                {
                    foreach (var conflict in standardMemberConflicts)
                    {
                        var queueEntry = new ShadowQueue
                        {
                            Id = Guid.NewGuid(),
                            AcademyId = conflict.AcademyId,
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

                    _context.Bookings.RemoveRange(standardMemberConflicts);
                    Console.WriteLine($"--> Elite Clinic override fired. Preserved {standardMemberConflicts.Count} member booking(s) in Shadow Queue.");
                }
                else
                {
                    return BadRequest("Scheduling Collision: Another Elite Training Clinic is already locked into this court window.");
                }
            }
            else
            {
                if (court.Status == "Rained_Out" || court.Status == "Maintenance_Locked")
                {
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

                return BadRequest("Court Availability Exception: The requested court window is locked or already occupied.");
            }
        }

        var booking = new Booking
        {
            Id = Guid.NewGuid(),
            CourtId = model.CourtId,
            BookedByUserId = userId,
            OpponentUserId = model.OpponentUserId,
            StartTimeUtc = model.StartTimeUtc,
            EndTimeUtc = model.EndTimeUtc,
            BookingType = isDirector ? model.BookingType : "MemberBooking",
            Notes = model.Notes
        };

        int matchMinutes = (int)bookingDuration.TotalMinutes;
        court.AggregateMinutesPlayed += matchMinutes;

        if (court.AggregateMinutesPlayed >= court.MaintenanceThresholdMinutes)
        {
            court.Status = "Maintenance_Locked";
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
            booking.Notes += " [SYSTEM NOTICE: This match triggers an automated facility maintenance lockout loop]";
            Console.WriteLine($"--> Wear Limit Breached on {court.Name}. Maintenance Ticket generated successfully.");
        }

        _context.Bookings.Add(booking);
        await _context.SaveChangesAsync();

        return Ok(new { Message = "Inventory position secured successfully.", Booking = booking });
    }

    // --- UPDATE (PUT) ---
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateBooking(Guid id, [FromBody] UpdateBookingDto model)
    {
        var booking = await _context.Bookings.FindAsync(id);
        if (booking == null) return NotFound("Target booking configuration layout missing.");

        booking.Notes = model.Notes;
        booking.BookingType = User.IsInRole("AcademyDirector") ? model.BookingType : "MemberBooking";
        booking.OpponentUserId = model.OpponentUserId;

        await _context.SaveChangesAsync();
        return Ok(new { Message = "Booking transaction modifications committed.", Booking = booking });
    }

    // --- DELETE ---
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteBooking(Guid id)
    {
        var booking = await _context.Bookings.FindAsync(id);
        if (booking == null) return NotFound("Target booking transaction record missing.");

        _context.Bookings.Remove(booking);
        await _context.SaveChangesAsync();
        return Ok(new { Message = "Booking record unlinked and removed successfully from database storage." });
    }

    [HttpGet("court/{courtId:guid}/schedule")]
    public async Task<IActionResult> GetCourtSchedule(Guid courtId)
    {
        var schedule = await _context.Bookings
            .Where(b => b.CourtId == courtId)
            .OrderBy(b => b.StartTimeUtc)
            .ToListAsync();

        return Ok(schedule);
    }
}

public record CreateBookingDto(Guid CourtId, DateTime StartTimeUtc, DateTime EndTimeUtc, string BookingType, string Notes, string? OpponentUserId);
public record UpdateBookingDto(string Notes, string BookingType, string? OpponentUserId);
