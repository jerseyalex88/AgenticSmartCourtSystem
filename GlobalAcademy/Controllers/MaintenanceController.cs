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
[Authorize(Roles = "AcademyDirector,Groundskeeper")] // Protect operations under executive and staff roles
public class MaintenanceController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public MaintenanceController(ApplicationDbContext context)
    {
        _context = context;
    }

    // --- SHADOW QUEUE ENDPOINTS ---

    [HttpGet("shadow-queue")]
    public async Task<IActionResult> GetShadowQueue()
    {
        // Our EF Core Global Query Filter restricts this list to only the user's active tenant
        var queue = await _context.ShadowQueues
            .Where(q => q.QueueStatus == "Pending_Reschedule")
            .OrderBy(q => q.DisplacedAtUtc)
            .ToListAsync();

        return Ok(queue);
    }

    // --- MAINTENANCE TICKET ENDPOINTS ---

    [HttpGet("tickets")]
    public async Task<IActionResult> GetActiveTickets()
    {
        var tickets = await _context.MaintenanceTickets
            .Where(t => t.TicketStatus != "Resolved_Completed")
            .OrderByDescending(t => t.CreatedAtUtc)
            .ToListAsync();

        return Ok(tickets);
    }

    [HttpPost("tickets/{id:guid}/resolve")]
    public async Task<IActionResult> ResolveTicket(Guid id, [FromBody] ResolveTicketDto model)
    {
        // 1. Locate the physical maintenance work order ticket
        var ticket = await _context.MaintenanceTickets.FindAsync(id);
        if (ticket == null) return NotFound("Target maintenance ticket missing or unauthorized access attempt.");

        // 2. Locate the linked physical court asset needing service restoration
        var court = await _context.Courts.FindAsync(ticket.CourtId);
        if (court == null) return NotFound("Linked court asset infrastructure configuration missing.");

        // 3. THE RESET ENGINE: Restore the physical facility asset back to pristine operating parameters
        ticket.TicketStatus = "Resolved_Completed";
        ticket.ResolvedAtUtc = DateTime.UtcNow;
        ticket.ResolutionNotes = model.Notes;

        // Reset the aggregate minute counter completely back to zero
        court.AggregateMinutesPlayed = 0;

        // If the court was locked out due to wear, bring it back online to the public booking pool
        if (court.Status == "Maintenance_Locked")
        {
            court.Status = "Open";
            Console.WriteLine($"--> Facility Reset Triggered: {court.Name} has been refurbished. Status returned to Open.");
        }

        // Commit all operational parameter shifts live to PostgreSQL
        await _context.SaveChangesAsync();

        return Ok(new { 
            Message = "Surface maintenance completed successfully. Court asset aggregate usage trackers cleared and reopened.", 
            UpdatedCourtStatus = court.Status 
        });
    }
}

public record ResolveTicketDto(string Notes);
