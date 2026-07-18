using System;
using System.ComponentModel;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.SemanticKernel;
using GlobalAcademy.Data;
using GlobalAcademy.Context;
using GlobalAcademy.Models;

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

    [KernelFunction, Description("Executes a real-time reservation entry for a targeted court asset after verifying open slot vacancy.")]
    public async Task<string> ClaimCourtReservationAsync(
        Kernel kernel,
        //[Description("The unique identifier Guid of the targeted court asset")] string courtId,
        [Description("The exact matching string name of the tennis or padel court")] string courtName,
        [Description("Target booking date in ISO string sequence format (YYYY-MM-DD)")] string targetDate,
        [Description("The localized military start hour format string (e.g., '09:00', '14:30')")] string startHour)
    {
        // 1. Unpack security claims mapped dynamically via universal controller context data dictionary
        if (!kernel.Data.TryGetValue("academyId", out var academyIdObj) || academyIdObj is not Guid academyId)
        {
            return "Transaction rejected: Missing or invalid security academy perimeter claim scope.";
        }

        if (!kernel.Data.TryGetValue("currentUserName", out var playerObj) || playerObj is not string playerName)
        {
            return "Transaction rejected: User context mapping verification fault (playerName).";
        }

        if (!kernel.Data.TryGetValue("userId", out var userIdObj) || userIdObj is not string userId)
        {
            return "Transaction rejected: User context mapping verification fault (userId).";
        }

        // 2. Parse target timestamps relative to the specific branch configuration timezone requirements
        if (!DateOnly.TryParse(targetDate, out var date) || 
            !TimeOnly.TryParse(startHour, out var startTime))
        {
            return "Conversational mapping fault: Could not extract valid unique identifiers, dates, or start hours.";
        }

        // 3. Query court schema mapping via its Primary Key Guid with multi-tenant firewall enforcement
        var court = await _dbContext.Courts
            .Include(c => c.Branch)
            .FirstOrDefaultAsync(c => c.Name.ToLower() == courtName.ToLower() && c.AcademyId == academyId);

        if (court == null)
        {
            return $"Validation error: Court matching the name '{courtName}' does not exist inside your academy ecosystem.";
        }

        // 4. Verify Phase 2 weather telemetry and surface degradation wear metrics
        if (court.Status == "Rained_Out" || court.Status == "Maintenance_Locked")
        {
            return $"Booking suspended: {court.Name} is currently flagged as '{court.Status}'.";
        }

        if (court.AggregateMinutesPlayed >= court.MaintenanceThresholdMinutes)
        {
            return $"Booking suspended: {court.Name} has reached its wear limit ({court.AggregateMinutesPlayed}/{court.MaintenanceThresholdMinutes} mins) and requires resurfacing.";
        }


        // --- FIX STEP 5: TIMEZONE EVALUATION ---
        string timeZoneString = court.Branch?.TimeZoneId ?? "UTC";
        var branchTimeZone = TimeZoneInfo.FindSystemTimeZoneById(timeZoneString);

        // 1. Combine Date and Time components (instantiates as Unspecified Kind)
        var rawDateTimeLocal = date.ToDateTime(startTime);

        // 2. Perform localized zone conversion calculation to find absolute UTC
        var calculatedUtc = TimeZoneInfo.ConvertTimeToUtc(rawDateTimeLocal, branchTimeZone);

        // 3. CRITICAL POSTGRESQL FIX: Force .NET to stamp the structure metadata as absolute UTC
        var targetDateTimeUtc = DateTime.SpecifyKind(calculatedUtc, DateTimeKind.Utc);

        int durationMinutes = 60;
        var endDateTimeUtc = targetDateTimeUtc.AddMinutes(durationMinutes);

        // 6. Query PostgreSQL for overlapping Bookings rows to guard against double-booking race hazards
        bool isSlotOccupied = await _dbContext.Bookings
            .AnyAsync(b => b.CourtId == court.Id 
                           && b.StartTimeUtc < endDateTimeUtc 
                           && b.EndTimeUtc > targetDateTimeUtc);

        if (isSlotOccupied)
        {
            return $"Conflict detected: The requested slot on {court.Name} at {startHour} is already reserved by another player.";
        }

        // 7. Persist clean model layer transaction row utilizing exact model classes configuration
        var newBooking = new Booking
        {
            Id = Guid.NewGuid(),
            AcademyId = academyId,
            BranchId = court.BranchId,
            CourtId = court.Id,
            BookedByUserId = userId,
            OpponentUserId = string.Empty, // Nullable / Empty fallback initialization
            StartTimeUtc = targetDateTimeUtc,
            EndTimeUtc = endDateTimeUtc,
            BookingType = "MemberBooking",
            Notes = "Booked natively via Smart Court OS conversational assistant interface.",
            CreatedAtUtc = DateTime.UtcNow,
            CourtName = court.Name,
            SlotTime = DateTime.SpecifyKind(rawDateTimeLocal, DateTimeKind.Utc),
            IsAvailableSlot = false, // Set to false since it is now explicitly occupied
            BookedPlayerName = playerName,
            DurationInMinutes = durationMinutes,
            PricePaid = 0.00m // Default free pass mapping parameter
        };

        // 8. Accumulate wear minutes onto the court asset matrix tracking
        court.AggregateMinutesPlayed += durationMinutes;

        using (var transaction = await _dbContext.Database.BeginTransactionAsync())
        {
            try
            {
                _dbContext.Bookings.Add(newBooking);
                await _dbContext.SaveChangesAsync();
                await transaction.CommitAsync(); // Physical data flush straight to disk
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return $"Failed: Database collision abort: {ex.Message}";
            }
        }

        // 9. Dispatch success string along with the unified token boundary to trigger frontend grid synchronization
        return $"Success! I have successfully secured your reservation for {court.Name} on {targetDate} starting at {startHour}. [FRONTEND_ACTION:SET_DATE:{targetDate}]";
    }
}
