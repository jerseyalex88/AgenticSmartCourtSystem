using System;
using System.ComponentModel;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.SemanticKernel;
using GlobalAcademy.Data;
using GlobalAcademy.Context;

namespace GlobalAcademy.Plugins;

public class PlayerBookingPlugin
{
    private readonly ApplicationDbContext _dbContext;
    private readonly PlayerBookingContext _playerBookingContext;

    public PlayerBookingPlugin(ApplicationDbContext dbContext, PlayerBookingContext playerBookingContext)
    {
        _dbContext = dbContext;
        _playerBookingContext = playerBookingContext;
    }

    // =========================================================================
    // 1. KERNEL FUNCTION: FETCH CONFIRMED MATCH LEDGER FOR CURRENT USER
    // =========================================================================
    [KernelFunction, Description("Queries the database to fetch a list of all upcoming confirmed court bookings and match schedules for the currently logged-in player.")]
    public async Task<string> GetPlayerLedgerAsync(KernelArguments arguments)
    {
        // Extract the secure token attributes injected by your UniversalChatController
        if (!arguments.TryGetValue("currentUserName", out var userObj) || userObj is not string currentUserName ||
            !arguments.TryGetValue("academyId", out var academyObj) || academyObj is not Guid academyGuid)
        {
            return "❌ [SECURITY ERROR]: Unable to verify your multi-tenant session parameters inside the execution context.";
        }

        try
        {
            // Execute the relational database query to fetch active rows
            var upcomingBookings = await _dbContext.Bookings
                .Include(b => b.Court)
                .ThenInclude(c => c!.Branch) // Eager-load physical location models
                .Where(b => b.AcademyId == academyGuid 
                         && b.BookedPlayerName == currentUserName 
                         && b.StartTimeUtc >= DateTime.UtcNow // Future schedules only
                         && !b.IsAvailableSlot)
                .OrderBy(b => b.StartTimeUtc)
                .ToListAsync();

            if (!upcomingBookings.Any())
            {
                return $"📅 Hello {currentUserName}, you currently have no upcoming court bookings scheduled across this academy partition.";
            }

            // Build a clean, human-readable text matrix dashboard layout response
            var reportSummary = $"📋 [UPCOMING COURT RESERVATIONS FOR {currentUserName.ToUpper()}]:\n";
            
            foreach (var booking in upcomingBookings)
            {
                // Dynamic timezone resolution matching your established, tested frontend guidelines
                string targetTimeZoneId = booking.Court?.Branch?.TimeZoneId ?? "UTC";
                TimeZoneInfo branchTimeZone;
                try
                {
                    branchTimeZone = TimeZoneInfo.FindSystemTimeZoneById(targetTimeZoneId);
                }
                catch
                {
                    branchTimeZone = TimeZoneInfo.Utc;
                }

                DateTime localizedTime = TimeZoneInfo.ConvertTimeFromUtc(booking.StartTimeUtc, branchTimeZone);
                string branchName = booking.Court?.Branch?.Name ?? "Main Arena Complex";

                reportSummary += $"• {booking.CourtName} ({branchName}) — 🕒 {localizedTime:MMM dd, yyyy 'at' hh:mm tt} ({booking.DurationInMinutes} mins)\n";
            }

            return reportSummary;
        }
        catch (Exception ex)
        {
            return $"❌ [DATABASE EXCEPTION]: An error occurred while retrieving your schedule matrix: {ex.Message}";
        }
    }
    // =========================================================================
    // 2. KERNEL FUNCTION: CHECK OPEN COURT INTERVAL MATRIX TRACKS
    // =========================================================================
    [KernelFunction, Description("Queries the availability matrix for a given target calendar date. Extracts a specific Date string from user inputs.")]
    public async Task<string> CheckCourtAvailabilityAsync(
        [Description("The targeted date string formatted as YYYY-MM-DD. For example, if user says 'tomorrow', pass tomorrow's date string standard.")] string targetDateString,
        KernelArguments arguments)
    {
        var academyGuid = _playerBookingContext.AcademyId;
        var userId = _playerBookingContext.UserId;
        var userName = _playerBookingContext.UserName;
        var userRole = _playerBookingContext.UserRole;

        if (academyGuid == Guid.Empty || string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(userName))
        {
            return "❌ [SECURITY ERROR]: Multi-tenant session parameters missing from context.";
        }

        // if (!arguments.TryGetValue("academyId", out var academyObj) || academyObj is not Guid academyGuid)
        // {
        //     return "❌ [SECURITY ERROR]: Multi-tenant session parameter missing from context.";
        // }

        if (!DateTime.TryParse(targetDateString, out DateTime parsedStart))
            return "⚠️ Exception: Unable to parse the specified date formatting standard. Please provide a clear calendar date.";

        var rangeStartUtc = DateTime.SpecifyKind(parsedStart.Date, DateTimeKind.Utc);
        var rangeEndUtc = DateTime.SpecifyKind(rangeStartUtc.AddDays(1), DateTimeKind.Utc); // 24-hour lookahead frame

        try
        {
            var courts = await _dbContext.Courts
                .Include(c => c.Branch)
                .Where(c => c.AcademyId == academyGuid)
                .OrderBy(c => c.Name)
                .ToListAsync();

            var bookings = await _dbContext.Bookings
                .Where(b => b.AcademyId == academyGuid && b.StartTimeUtc >= rangeStartUtc && b.StartTimeUtc < rangeEndUtc)
                .ToListAsync();

            if (!courts.Any()) return "🏟️ No active court infrastructure rows configured for this academy partition.";

            int startHour = 8;
            int endHour = 20;
            var summary = $"🎾 [AVAILABILITY MATRIX FOR {rangeStartUtc:MMM dd, yyyy} (Branch Local Hours)]:\n";
            int vacantCount = 0;

            foreach (var court in courts)
            {
                summary += $"\n🔹 {court.Name}:\n";
                string timeZoneId = court.Branch?.TimeZoneId ?? "UTC";
                var tz = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);

                for (int hour = startHour; hour < endHour; hour++)
                {
                    var slotStartUtc = DateTime.SpecifyKind(rangeStartUtc.AddHours(hour), DateTimeKind.Utc);
                    var isBooked = bookings.Any(b => b.CourtId == court.Id && b.StartTimeUtc == slotStartUtc);

                    if (!isBooked)
                    {
                        DateTime localTime = TimeZoneInfo.ConvertTimeFromUtc(slotStartUtc, tz);
                        summary += $"  • ⚡ Open Hour: {localTime:hh:mm tt}\n";
                        vacantCount++;
                    }
                }
            }

            if (vacantCount == 0) return $"🔒 All intervals are completely booked out across all courts for {rangeStartUtc:yyyy-MM-dd}.";

            // SPECIAL INSTRUCTION: Inject a hidden frontend data command envelope token 
            // so our React Layout can parse it and sync dashboard tab views with no reloads!
            summary += $"\n[FRONTEND_ACTION:SET_DATE:{rangeStartUtc:yyyy-MM-dd}]";
            return summary;
        }
        catch (Exception ex)
        {
            return $"❌ [DATABASE ERROR]: Failed to analyze availability tracks: {ex.Message}";
        }
    }

}
