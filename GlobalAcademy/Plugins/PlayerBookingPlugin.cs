using System;
using System.ComponentModel;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.SemanticKernel;
using GlobalAcademy.Data;
using GlobalAcademy.Context;
using GlobalAcademy.Models;
using GlobalAcademy.Services;

namespace GlobalAcademy.Plugins;

public class PlayerBookingPlugin
{
    private readonly ApplicationDbContext _dbContext;
    private readonly PlayerBookingContext _playerBookingContext;
    private readonly IEmailNotificationEngine _emailEngine;

    public PlayerBookingPlugin(ApplicationDbContext dbContext, PlayerBookingContext playerBookingContext, IEmailNotificationEngine emailEngine)
    {
        _dbContext = dbContext;
        _playerBookingContext = playerBookingContext;
        _emailEngine = emailEngine;
    }

    // =========================================================================
    // 1. KERNEL FUNCTION: FETCH CONFIRMED MATCH LEDGER FOR CURRENT USER
    // =========================================================================
    [KernelFunction, Description("Queries the database to fetch a list of all past and upcoming confirmed court bookings and match schedules for the currently logged-in player.")]
    public async Task<string> GetPlayerLedgerAsync(Kernel kernel)
    {
        // 1. Unpack security claims mapped dynamically via universal controller context data dictionary
        if (!kernel.Data.TryGetValue("academyId", out var academyIdObj) || academyIdObj is not Guid academyGuid)
        {
            return "Transaction rejected: Missing or invalid security academy perimeter claim scope.";
        }

        if (!kernel.Data.TryGetValue("currentUserName", out var playerObj) || playerObj is not string userName)
        {
            return "Transaction rejected: User context mapping verification fault (playerName).";
        }

        if (!kernel.Data.TryGetValue("userId", out var userIdObj) || userIdObj is not string userId)
        {
            return "Transaction rejected: User context mapping verification fault (userId).";
        }

        if (!kernel.Data.TryGetValue("userRole", out var userRoleObj) || userRoleObj is not string userRole)
        {
            return "Transaction rejected: User context mapping verification fault (userRole).";
        }

        try
        {
            // Execute the relational database query to fetch active rows
            var upcomingBookings = await _dbContext.Bookings
                .Include(b => b.Court)
                .ThenInclude(c => c!.Branch) // Eager-load physical location models
                .Where(b => b.AcademyId == academyGuid 
                         && b.BookedByUserId == userId 
                         //&& b.StartTimeUtc >= DateTime.UtcNow // Future schedules only
                         && !b.IsAvailableSlot)
                .OrderBy(b => b.StartTimeUtc)
                .ToListAsync();

            if (!upcomingBookings.Any())
            {
                return $"📅 Hello {userName}, you currently have no past and upcoming court bookings scheduled across this academy partition.";
            }

            // Build a clean, human-readable text matrix dashboard layout response
            var reportSummary = $"📋 [PAST AND UPCOMING COURT RESERVATIONS FOR {userName.ToUpper()}]:\n";
            
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
        Kernel kernel,
        [Description("The targeted date string formatted as YYYY-MM-DD. For example, if user says 'tomorrow', pass tomorrow's date string standard.")] string targetDateString)
    {
        // 1. Unpack security claims mapped dynamically via universal controller context data dictionary
        if (!kernel.Data.TryGetValue("academyId", out var academyIdObj) || academyIdObj is not Guid academyGuid)
        {
            return "Transaction rejected: Missing or invalid security academy perimeter claim scope.";
        }

        if (!kernel.Data.TryGetValue("currentUserName", out var playerObj) || playerObj is not string userName)
        {
            return "Transaction rejected: User context mapping verification fault (playerName).";
        }

        if (!kernel.Data.TryGetValue("userId", out var userIdObj) || userIdObj is not string userId)
        {
            return "Transaction rejected: User context mapping verification fault (userId).";
        }

        if (!kernel.Data.TryGetValue("userRole", out var userRoleObj) || userRoleObj is not string userRole)
        {
            return "Transaction rejected: User context mapping verification fault (userRole).";
        }

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

        // 9. Instantiation mapping for a linked Unified Ledger Invoice
        var invoiceId = Guid.NewGuid();
        var invoicePrice = 50.00m; // Default uniform court slot rate rule

        var newInvoice = new Invoice
        {
            InvoiceId = invoiceId,
            AcademyId = academyId,
            IssuedToUserId = userId,
            CustomerName = playerName,
            CreatedAtUtc = DateTime.UtcNow,
            Status = InvoiceStatus.Unpaid,
            TotalAmount = invoicePrice
        };

        var lineItem = new InvoiceLineItem
        {
            LineItemId = Guid.NewGuid(),
            InvoiceId = invoiceId,
            ItemDescription = $"Court Rental Fee: {courtName} on {targetDate} @ {startHour}",
            Quantity = 1,
            UnitPrice = invoicePrice,
            AssociatedBookingId = newBooking.Id
        };

        using (var transaction = await _dbContext.Database.BeginTransactionAsync())
        {
            try
            {
                _dbContext.Bookings.Add(newBooking);
                _dbContext.Invoices.Add(newInvoice);
                _dbContext.InvoiceLineItems.Add(lineItem);
                await _dbContext.SaveChangesAsync();
                await transaction.CommitAsync();

                await _emailEngine.SendCourtReservationConfirmationAsync(
                    recipientEmail: playerName,
                    recipientName: playerName,
                    invoice: newInvoice,
                    lineItems: new List<InvoiceLineItem> { lineItem },
                    academyId: academyId);
                
                return $"Success: Confirmed booking for {courtName} on {targetDate} at {startHour}. " +
               $"An outstanding balance invoice has been issued. [FRONTEND_ACTION:LAUNCH_CHECKOUT:{invoiceId}:${invoicePrice.ToString("F2")}]";
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return $"Failed: Database collision abort: {ex.InnerException?.ToString() ?? ex.Message}";
            }
        }

        // 9. Dispatch success string along with the unified token boundary to trigger frontend grid synchronization
        //return $"Success! I have successfully secured your reservation for {court.Name} on {targetDate} starting at {startHour}. [FRONTEND_ACTION:SET_DATE:{targetDate}]";
    }

    [KernelFunction, Description("Queries the database for any active open unpaid invoices belonging strictly to the currently logged in user context.")]
    public async Task<string> GetUnpaidInvoicesAsync(Kernel kernel)
    {
        if (!kernel.Data.TryGetValue("academyId", out var academyIdObj) || academyIdObj is not Guid academyId)
        {
            return "Transaction rejected: Missing or invalid security academy perimeter claim scope.";
        }

        if (!kernel.Data.TryGetValue("userId", out var userIdObj) || userIdObj is not string userId)
        {
            return "Transaction rejected: User context mapping verification fault (userId).";
        }

        // Retrieve outstanding entries inside a strict multi-tenant partition firewall loop
        var unpaidInvoices = await _dbContext.Invoices
            .Where(i => i.IssuedToUserId == userId && i.AcademyId == academyId && i.Status == InvoiceStatus.Unpaid)
            .OrderByDescending(i => i.CreatedAtUtc)
            .ToListAsync();

        if (unpaidInvoices.Count == 0)
        {
            return "System Scan Result: You currently have no outstanding or unpaid invoices on your account ledger profile.";
        }

        var summary = "Outstanding Open Balance Items Located:\n";
        var invoiceTotalAmount = 0.00m; 
        foreach (var inv in unpaidInvoices)
        {
            summary += $"- Invoice ID: {inv.InvoiceId} | Issued: {inv.CreatedAtUtc:yyyy-MM-dd} | Total Due: ${inv.TotalAmount:F2}\n";
            invoiceTotalAmount += inv.TotalAmount;
        }

        summary += $"  [FRONTEND_ACTION:LAUNCH_CHECKOUT:Total Invoices Amount:{invoiceTotalAmount:F2}]";

        return summary;
    }

    [KernelFunction, Description("Safely cancels and releases an active court reservation slot using natural parameters like court name, date, and start hour.")]
    public async Task<string> CancelActiveBookingAsync(
        Kernel kernel,
        [Description("The exact matching string name of the tennis or padel court")] string courtName,
        [Description("Target booking date in ISO string sequence format (YYYY-MM-DD)")] string targetDate,
        [Description("The localized military start hour format string (e.g., '10:00', '14:30')")] string startHour)
    {
        // 1. Unpack security claims mapped dynamically via universal controller context data dictionary
        if (!kernel.Data.TryGetValue("academyId", out var academyIdObj) || academyIdObj is not Guid academyId)
        {
            return "Transaction rejected: Missing or invalid security academy perimeter claim scope.";
        }

        if (!kernel.Data.TryGetValue("currentUserName", out var playerObj) || playerObj is not string playerName)
        {
            return "Transaction rejected: User context mapping verification fault.";
        }

        if (!kernel.Data.TryGetValue("userId", out var userIdObj) || userIdObj is not string userId)
        {
            return "Transaction rejected: User context mapping verification fault (userId).";
        }

        // 2. Parse target timestamps relative to the specific branch configuration timezone requirements
        if (!DateOnly.TryParse(targetDate, out var date) || !TimeOnly.TryParse(startHour, out var startTime))
        {
            return "Conversational mapping fault: Could not extract explicit date or start hour from input variables.";
        }

        // 3. Query court schema mapping to figure out timezone contexts and branch connections
        var court = await _dbContext.Courts
            .Include(c => c.Branch)
            .FirstOrDefaultAsync(c => c.AcademyId == academyId && c.Name.ToLower() == courtName.ToLower());

        if (court == null)
        {
            return $"Validation error: Court matching the name '{courtName}' does not exist inside your academy ecosystem.";
        }

        // 4. Timezone Evaluation: Reconstruct the exact localized booking slot time into its original absolute UTC equivalent
        string timeZoneString = court.Branch?.TimeZoneId ?? "UTC";
        var branchTimeZone = TimeZoneInfo.FindSystemTimeZoneById(timeZoneString);
        var targetDateTimeLocal = date.ToDateTime(startTime);
        var calculatedUtc = TimeZoneInfo.ConvertTimeToUtc(targetDateTimeLocal, branchTimeZone);
        var targetDateTimeUtc = DateTime.SpecifyKind(calculatedUtc, DateTimeKind.Utc);

        // 5. Query booking row via key natural property parameters AND multi-tenant user perimeters
        var booking = await _dbContext.Bookings
            .FirstOrDefaultAsync(b => b.CourtId == court.Id 
                                && b.AcademyId == academyId 
                                && b.StartTimeUtc == targetDateTimeUtc
                                && (b.BookedByUserId == userId));

        if (booking == null)
        {
            return $"Validation error: No active reservation found for {courtName} on {targetDate} at {startHour} belonging to your profile.";
        }

        // 6. Enforce the 24-Hour Business Lock Rule
        // Parse target date and slot hour time allocations back into absolute UTC equivalents
        if (!DateTime.TryParse($"{targetDate} {startHour}", out var matchStartTime))
        {
            return "Cancellation Refused: Malformed date or slot hour format parameter submitted.";
        }

        var timeUntilMatch = matchStartTime - DateTime.UtcNow;

        // Block execution if match starts in under 24 hours AND the user is NOT an Academy Director
        if (timeUntilMatch.TotalHours < 24) // && !_isDirector)
        {
            return "Cancellation Locked: Reservations starting in less than 24 hours cannot be dropped by players. Please contact an Academy Director for an override.";
        }

        // 7. Locate the associated invoice using our historical booking tracking ID reference key
        var associatedLineItem = await _dbContext.InvoiceLineItems
            .FirstOrDefaultAsync(li => li.AssociatedBookingId == booking.Id);

        string financialStatusUpdateMessage = "No linked financial invoices were altered.";

        if (associatedLineItem != null)
        {
            var invoice = await _dbContext.Invoices
                .FirstOrDefaultAsync(i => i.InvoiceId == associatedLineItem.InvoiceId && i.AcademyId == academyId);

            if (invoice != null)
            {
                if (invoice.Status == InvoiceStatus.Unpaid)
                {
                    // Scenario A: User hasn't paid yet -> Simply void the outstanding balance sheet row
                    invoice.Status = InvoiceStatus.Voided;
                    financialStatusUpdateMessage = $"Linked outstanding Invoice #{invoice.InvoiceId} has been successfully VOIDED.";
                }
                else if (invoice.Status == InvoiceStatus.Paid)
                {
                    // Scenario B: User already settled -> Mark as Refunded
                    // In production, this flag triggers an async webhook listener dispatching credit back through Braintree/Square
                    invoice.Status = InvoiceStatus.Refunded;
                    financialStatusUpdateMessage = $"Linked paid Invoice #{invoice.InvoiceId} has been marked as REFUNDED. Funds will return to the original gateway account.";
                }
            }
        }

        // 8. Credit back play minutes to the court surface wear metrics tracking system before removing row
        court.AggregateMinutesPlayed = Math.Max(0, court.AggregateMinutesPlayed - booking.DurationInMinutes);

        // 9. Delete record from PostgreSQL database state tables
        using (var transaction = await _dbContext.Database.BeginTransactionAsync())
        {
            try
            {
                _dbContext.Bookings.Remove(booking);
                await _dbContext.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return $"FAILED: Deletion execution layer exception: {ex.InnerException?.ToString() ?? ex.Message}";
            }
        }

        // 8. Return success response with frontend layout token to refresh the grid instantly
        return $"Success! I have cancelled your reservation for {court.Name} on {targetDate} at {startHour}. [FRONTEND_ACTION:SET_DATE:{targetDate}]";
    }

}
