using GlobalAcademy.Data;
using GlobalAcademy.Models;
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
public class MaintenanceController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public MaintenanceController(ApplicationDbContext context)
    {
        _context = context;
    }

    // =========================================================================
    // SHADOW QUEUE CRUDS MANAGEMENT
    // =========================================================================

    [HttpGet("shadow-queue")]
    public async Task<IActionResult> GetShadowQueue()
    {
        var queue = await _context.ShadowQueues.ToListAsync();
        return Ok(queue);
    }

    [HttpGet("shadow-queue/{id:guid}")]
    public async Task<IActionResult> GetShadowQueueById(Guid id)
    {
        var entry = await _context.ShadowQueues.FindAsync(id);
        if (entry == null) return NotFound("Shadow queue entry missing.");
        return Ok(entry);
    }

    // --- MANUALLY INSERT AN ENTRY TO STANDBY POOL (CREATE) ---
    [HttpPost("shadow-queue")]
    public async Task<IActionResult> CreateShadowQueueEntry([FromBody] CreateShadowQueueDto model)
    {
        var entry = new ShadowQueue
        {
            Id = Guid.NewGuid(),
            OriginalCourtId = model.OriginalCourtId,
            PlayerUserId = model.PlayerUserId,
            OpponentUserId = model.OpponentUserId,
            OriginalStartTimeUtc = model.OriginalStartTimeUtc,
            OriginalEndTimeUtc = model.OriginalEndTimeUtc,
            QueueStatus = model.QueueStatus,
            DisplacementReason = model.DisplacementReason
        };

        _context.ShadowQueues.Add(entry);
        await _context.SaveChangesAsync();
        return Ok(entry);
    }

    // --- MODIFY QUEUE META (UPDATE) ---
    [HttpPut("shadow-queue/{id:guid}")]
    public async Task<IActionResult> UpdateShadowQueueEntry(Guid id, [FromBody] UpdateShadowQueueDto model)
    {
        var entry = await _context.ShadowQueues.FindAsync(id);
        if (entry == null) return NotFound("Shadow queue log context missing.");

        entry.QueueStatus = model.QueueStatus;
        entry.DisplacementReason = model.DisplacementReason;

        await _context.SaveChangesAsync();
        return Ok(new { Message = "Standby record matrix metadata updated smoothly.", Entry = entry });
    }

    // --- PURGE FROM STANDBY (DELETE) ---
    [HttpDelete("shadow-queue/{id:guid}")]
    public async Task<IActionResult> DeleteShadowQueueEntry(Guid id)
    {
        var entry = await _context.ShadowQueues.FindAsync(id);
        if (entry == null) return NotFound("Target shadow queue record missing.");

        _context.ShadowQueues.Remove(entry);
        await _context.SaveChangesAsync();
        return Ok(new { Message = "Standby player queue profile unlinked and removed successfully." });
    }

    // =========================================================================
    // MAINTENANCE TICKETS CRUDS MANAGEMENT
    // =========================================================================

    [HttpGet("tickets")]
    public async Task<IActionResult> GetActiveTickets()
    {
        var tickets = await _context.MaintenanceTickets.ToListAsync();
        return Ok(tickets);
    }

    [HttpGet("tickets/{id:guid}")]
    public async Task<IActionResult> GetTicketById(Guid id)
    {
        var ticket = await _context.MaintenanceTickets.FindAsync(id);
        if (ticket == null) return NotFound("Target maintenance ticket missing.");
        return Ok(ticket);
    }

    // --- MANUALLY DESPATCH WORK ORDER (CREATE) ---
    [HttpPost("tickets")]
    public async Task<IActionResult> CreateMaintenanceTicket([FromBody] CreateTicketDto model)
    {
        var ticket = new MaintenanceTicket
        {
            Id = Guid.NewGuid(),
            CourtId = model.CourtId,
            Title = model.Title,
            Description = model.Description,
            TicketStatus = "Open_Queued",
            PriorityLevel = model.PriorityLevel
        };

        _context.MaintenanceTickets.Add(ticket);
        await _context.SaveChangesAsync();
        return Ok(ticket);
    }

    // --- MODIFY PROGRESS DETAILS (UPDATE) ---
    [HttpPut("tickets/{id:guid}")]
    public async Task<IActionResult> UpdateMaintenanceTicket(Guid id, [FromBody] UpdateTicketDto model)
    {
        var ticket = await _context.MaintenanceTickets.FindAsync(id);
        if (ticket == null) return NotFound("Target maintenance work order tracking missing.");

        ticket.Title = model.Title;
        ticket.Description = model.Description;
        ticket.TicketStatus = model.TicketStatus;
        ticket.PriorityLevel = model.PriorityLevel;

        await _context.SaveChangesAsync();
        return Ok(new { Message = "Work order log metadata updated safely.", Ticket = ticket });
    }

    // --- PURGE WORK ORDER SCRIPTS (DELETE) ---
    [HttpDelete("tickets/{id:guid}")]
    public async Task<IActionResult> DeleteMaintenanceTicket(Guid id)
    {
        var ticket = await _context.MaintenanceTickets.FindAsync(id);
        if (ticket == null) return NotFound("Target maintenance work order tracker record missing.");

        _context.MaintenanceTickets.Remove(ticket);
        await _context.SaveChangesAsync();
        return Ok(new { Message = "Work order ticket permanently removed from system database storage structures." });
    }

    [HttpPost("tickets/{id:guid}/resolve")]
    public async Task<IActionResult> ResolveTicket(Guid id, [FromBody] ResolveTicketDto model)
    {
        var ticket = await _context.MaintenanceTickets.FindAsync(id);
        if (ticket == null) return NotFound("Target maintenance ticket missing or unauthorized access attempt.");

        var court = await _context.Courts.FindAsync(ticket.CourtId);
        if (court == null) return NotFound("Linked court asset infrastructure configuration missing.");

        ticket.TicketStatus = "Resolved_Completed";
        ticket.ResolvedAtUtc = DateTime.UtcNow;
        ticket.ResolutionNotes = model.Notes;

        court.AggregateMinutesPlayed = 0;

        if (court.Status == "Maintenance_Locked")
        {
            court.Status = "Open";
            Console.WriteLine($"--> Facility Reset Triggered: {court.Name} has been refurbished. Status returned to Open.");
        }

        await _context.SaveChangesAsync();
        return Ok(new { 
            Message = "Surface maintenance completed successfully. Court asset aggregate usage trackers cleared and reopened.", 
            UpdatedCourtStatus = court.Status 
        });
    }
}

public record ResolveTicketDto(string Notes);
public record CreateShadowQueueDto(Guid OriginalCourtId, string PlayerUserId, string? OpponentUserId, DateTime OriginalStartTimeUtc, DateTime OriginalEndTimeUtc, string QueueStatus, string DisplacementReason);
public record UpdateShadowQueueDto(string QueueStatus, string DisplacementReason);
public record CreateTicketDto(Guid CourtId, string Title, string Description, string PriorityLevel);
public record UpdateTicketDto(string Title, string Description, string TicketStatus, string PriorityLevel);
