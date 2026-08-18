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
using GlobalAcademy.Payment.Services;
using GlobalAcademy.Services;
using Microsoft.Extensions.Options;

namespace GlobalAcademy.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Player,AcademyDirector,GlobalAdmin")] // Secure multi-role permission locks
public class PlayerBookingController : ControllerBase
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ITenantProvider _tenantProvider;
    private readonly IEmailNotificationEngine _emailEngine;
    private readonly IOptions<BookingSecuritySettings> _securitySettings;
    private readonly ISmsVerificationEngine _smsEngine;
    private readonly UserManager<IdentityUser> _userManager;

    public PlayerBookingController(
        ApplicationDbContext dbContext,
        ITenantProvider tenantProvider,
        IEmailNotificationEngine emailEngine,
        IOptions<BookingSecuritySettings> securitySettings,
        ISmsVerificationEngine smsEngine,
        UserManager<IdentityUser> userManager)
    {
        _dbContext = dbContext;
        _tenantProvider = tenantProvider;
        _emailEngine = emailEngine;
        _securitySettings = securitySettings;
        _smsEngine = smsEngine;
        _userManager = userManager;
    }

    // =========================================================================
    // 1. GET: FETCH ACTIVE RESERVATIONS LINKED TO THIS LOGGED-IN PLAYER
    // =========================================================================
    [HttpGet("my-reservations")]
    public async Task<IActionResult> GetMyReservations()
    {
        var currentAcademyId = _tenantProvider.GetTenantId();

        var currentUserName = HttpContext.User.Claims
            .FirstOrDefault(c => c.Type.Contains("username"))?.Value;

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
        
        // Pull active bookings alongside their physical parent court and branch relationship tracking paths
        // 1. Initialize the base query attached to your multi-tenant boundary wall
        var bookingsQuery = _dbContext.Bookings
            .Include(b => b.Court!)
            .ThenInclude(c => c.Branch!) 
            .Where(b => b.AcademyId == currentAcademyId && !b.IsAvailableSlot);

        // Isolate clearance flags using the ambient User role claims context
        var isDirector = User.IsInRole("AcademyDirector") || User.IsInRole("GlobalAdmin");

        // 2. POLYMORPHIC CONSTRAINT: Append user isolation filters ONLY if the caller is a standard player
        if (!isDirector)
        {
            bookingsQuery = bookingsQuery.Where(b => b.BookedByUserId == userIdClaimString);
        }

        // 3. Finalize execution with secondary ordering matrices atomically
        var userBookings = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .ToListAsync(bookingsQuery
                .OrderByDescending(b => b.StartTimeUtc) 
                .ThenBy(b => b.CourtName));

        var invoiceFilterQuery = _dbContext.Invoices
            .Where(i => i.AcademyId == currentAcademyId && i.Status == InvoiceStatus.Paid);

        // 2. POLYMORPHIC CONSTRAINT: Restrict to a single player's scope ONLY if the caller is not a director
        if (!isDirector)
        {
            invoiceFilterQuery = invoiceFilterQuery.Where(i => i.IssuedToUserId == userIdClaimString);
        }

        // 3. Finalize the main query, checking against our dynamically modified invoice registry loop
        var paidBookingIds = await _dbContext.InvoiceLineItems
            .Where(li => invoiceFilterQuery.Any(i => i.InvoiceId == li.InvoiceId)
                      && li.AssociatedBookingId != null)
            .Select(li => li.AssociatedBookingId ?? Guid.Empty)
            .Where(id => id != Guid.Empty) // Clear out empty fallbacks safely
            .ToListAsync();

        var payload = userBookings.Select(b => {
            // Dynamically resolve timezone parameters by traversing the booking entity relation links
            string targetTimeZoneId = b.Court?.Branch?.TimeZoneId ?? "UTC";
            
            TimeZoneInfo branchTimeZone;
            try {
                branchTimeZone = TimeZoneInfo.FindSystemTimeZoneById(targetTimeZoneId);
            } catch {
                branchTimeZone = TimeZoneInfo.Utc;
            }

            DateTime localTime = TimeZoneInfo.ConvertTimeFromUtc(b.StartTimeUtc, branchTimeZone);
            
            // NEW VERIFICATION FLAG CHECK: Determine if this booking ID resides within our paid registry list
            bool isSettled = paidBookingIds.Contains(b.Id);
            // NEW TIMING CHECK: Compare the booking's structural UTC timestamp directly against the current moment.
            // If the start time is strictly earlier than now, the slot is marked as expired.
            bool hasPassed = b.StartTimeUtc < DateTime.UtcNow;

            return new
            {
                id = b.Id.ToString(),
                courtName = b.CourtName,
                branchName = b.Court?.Branch?.Name ?? "Main Campus Area Hub", 
                slotTimeDisplay = localTime.ToString("MMM dd, yyyy 'at' hh:mm tt"), 
                durationMinutes = b.DurationInMinutes,
                isPaid = isSettled,
                isExpired = hasPassed,
                bookedPlayerName = b.BookedPlayerName,
            };
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

        var rangeStartUtc = DateTime.SpecifyKind(parsedStart.Date, DateTimeKind.Utc);
        var rangeEndUtc = DateTime.SpecifyKind(rangeStartUtc.AddDays(7), DateTimeKind.Utc);

        var courts = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .ToListAsync(_dbContext.Courts
                .Include(c => c.Branch) 
                .Where(c => c.AcademyId == currentAcademyId)
                .OrderBy(c => c.Name));

        var overlappingBookings = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .ToListAsync(_dbContext.Bookings.Where(b => 
                b.AcademyId == currentAcademyId && 
                b.StartTimeUtc >= rangeStartUtc && 
                b.StartTimeUtc < rangeEndUtc));

        int startHour = 8;
        int endHour = 20;

        // 🚀 UPGRADE: Using a clean, strongly-typed dictionary layer instead of loose dynamic lists
        var matrixReport = new System.Collections.Generic.Dictionary<string, System.Collections.Generic.List<MatrixSlotResponse>>();

        for (int dayOffset = 0; dayOffset < 7; dayOffset++)
        {
            var targetDay = rangeStartUtc.AddDays(dayOffset);
            var slotsInDay = new System.Collections.Generic.List<MatrixSlotResponse>();
            
            string localHeaderDayString = targetDay.ToString("yyyy-MM-dd");
            bool headerSet = false;

            for (int hour = startHour; hour < endHour; hour++)
            {
                var slotStartUtc = DateTime.SpecifyKind(targetDay.AddHours(hour), DateTimeKind.Utc);
                var slotEndUtc = slotStartUtc.AddHours(1);

                foreach (var court in courts)
                {
                    string courtTimeZoneId = court.Branch?.TimeZoneId ?? "UTC";
                    
                    TimeZoneInfo branchTimeZone;
                    try
                    {
                        branchTimeZone = TimeZoneInfo.FindSystemTimeZoneById(courtTimeZoneId);
                    }
                    catch
                    {
                        branchTimeZone = TimeZoneInfo.Utc; 
                    }

                    DateTime branchLocalStart = TimeZoneInfo.ConvertTimeFromUtc(slotStartUtc, branchTimeZone);

                    if (!headerSet)
                    {
                        localHeaderDayString = branchLocalStart.ToString("yyyy-MM-dd");
                        headerSet = true;
                    }

                    var match = overlappingBookings.FirstOrDefault(b => 
                        b.CourtId == court.Id && b.StartTimeUtc == slotStartUtc);

                    // Calculate localized time zones right now at this physical court branch
                    DateTime branchCurrentTimeNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, branchTimeZone);

                    bool slotIsAvailable = (match == null);

                    // 🚀 ANTI-RETROSPECTIVE GATE: Block past hours natively on the active timeline day
                    if (slotIsAvailable && branchLocalStart <= branchCurrentTimeNow)
                    {
                        slotIsAvailable = false;
                    }

                    slotsInDay.Add(new MatrixSlotResponse(
                        CourtId: court.Id.ToString(),
                        CourtName: court.Name,
                        StartTimeUtc: slotStartUtc,
                        EndTimeUtc: slotEndUtc,
                        BranchLocalTimeDisplay: branchLocalStart.ToString("hh:mm tt"),
                        BranchLocalDateDisplay: branchLocalStart.ToString("MMM dd"),
                        IsAvailable: slotIsAvailable,
                        BookedPlayerName: match?.BookedPlayerName
                    ));
                }
            }

            // Append to our safe dictionary ledger using the resolved localized day string as key
            if (!matrixReport.ContainsKey(localHeaderDayString))
            {
                matrixReport[localHeaderDayString] = slotsInDay;
            }
            else
            {
                matrixReport[localHeaderDayString].AddRange(slotsInDay);
            }
        }

        // 🚀 UPGRADE: Clean sorting projection completely free from dangerous dynamic casting layers
        var sortedMatrixReport = matrixReport.Select(kvp => new
        {
            dateString = kvp.Key,
            slots = kvp.Value
                .OrderBy(s => s.CourtName)
                .ThenBy(s => s.StartTimeUtc)
                .ToList()
        })
        .OrderBy(d => d.dateString)
        .ToList();

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
            .FirstOrDefault(c => c.Type.Contains("username"))?.Value;

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

        // =========================================================================
        // 🚀 TIER 3 INTERCEPT GATE: EVALUATE SMS VERIFICATION FEATURE SWITCH FLAGS
        // =========================================================================
        if (_securitySettings.Value.EnableSmsVerification && string.IsNullOrEmpty(model.SmsCode))
        {
            // Fetch the user out of disk memory to cleanly locate their verified phone context numbers
            var userProfile = await _userManager.FindByIdAsync(userIdClaimString);
            string playerPhone = userProfile?.PhoneNumber ?? "+15550123456"; // Fallback to prototype placeholder if empty

            // Fire up our modular singleton abstraction layer engine (Prints seed out to your VS Code logs console!)
            await _smsEngine.GenerateAndRecordVerificationPinAsync(userIdClaimString, playerPhone);

            // Halt transaction processing execution immediately and return a specialized step intercept token response
            return Ok(new { status = "SMS_VERIFICATION_REQUIRED", targetPhone = playerPhone, message = "Two-step SMS verification required to claim court slots." });
        }

        // =========================================================================
        // LAYER B VALIDATION: IF A CODE IS PROVIDED, ENFORCE CRYPTOGRAPHIC PIN MATCHES
        // =========================================================================
        if (_securitySettings.Value.EnableSmsVerification && !string.IsNullOrEmpty(model.SmsCode))
        {
            bool isCodeValid = await _smsEngine.ValidateActivePinAsync(userIdClaimString, model.SmsCode);
            if (!isCodeValid)
            {
                return BadRequest(new { Message = "Security Intercept: The provided booking verification PIN is invalid or has expired." });
            }
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

        int durationMinutes = 60;

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
            OpponentUserId = string.Empty, // Nullable / Empty fallback initialization
            IsAvailableSlot = false, // Locked down
            BookingType = "Player App Secured Reservation",
            Notes = "Booked manually by player via Smart Court OS.",
            DurationInMinutes = durationMinutes,
            PricePaid = 0.00m,
            CreatedAtUtc = DateTime.UtcNow
        };

        // 8. Accumulate wear minutes onto the court asset matrix tracking
        courtInfo.AggregateMinutesPlayed += durationMinutes;

        // 9. Instantiation mapping for a linked Unified Ledger Invoice
        var invoiceId = Guid.NewGuid();
        var invoicePrice = 50.00m; // Default uniform court slot rate rule

        var newInvoice = new Invoice
        {
            InvoiceId = invoiceId,
            AcademyId = currentAcademyId,
            IssuedToUserId = bookedByUserIdGuid.ToString(),
            CustomerName = currentUserName,
            CreatedAtUtc = DateTime.UtcNow,
            Status = InvoiceStatus.Unpaid,
            TotalAmount = invoicePrice
        };

        var lineItem = new InvoiceLineItem
        {
            LineItemId = Guid.NewGuid(),
            InvoiceId = invoiceId,
            ItemDescription = $"Court Rental Fee: {courtInfo.Name} on {startUtc.Date} @ {startUtc.Hour}",
            Quantity = 1,
            UnitPrice = invoicePrice,
            AssociatedBookingId = freshBooking.Id
        };

        bool transactionSuccess = false;

        using (var transaction = await _dbContext.Database.BeginTransactionAsync())
        {
            try
            {
                _dbContext.Bookings.Add(freshBooking);
                _dbContext.Invoices.Add(newInvoice);
                _dbContext.InvoiceLineItems.Add(lineItem);
                await _dbContext.SaveChangesAsync();
                await transaction.CommitAsync(); // Physical data flush straight to disk

                transactionSuccess = true;

            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, $"Database collision abort: {ex.Message}");
            }
        }

        if (transactionSuccess)
        {
            try
            {
                var userEmailClaimString = HttpContext.User.Claims
                    .FirstOrDefault(c => c.Type.Contains("email"))?.Value;

                if (!string.IsNullOrEmpty(userEmailClaimString)) 
                {
                    // =========================================================================
                    // TARGETED DISPATCH ADDITION: FIRE ASYNC CONFIRMATION TRANSACTIONAL MAIL
                    // =========================================================================
                    await _emailEngine.SendCourtReservationConfirmationAsync(
                        recipientEmail: userEmailClaimString,
                        recipientName: currentUserName,
                        invoice: newInvoice,
                        lineItems: new System.Collections.Generic.List<InvoiceLineItem> { lineItem },
                        academyId: currentAcademyId);
                }
            }
            catch (Exception emailEx)
            {
                // Log the email sending failure but do not block the booking confirmation
                Console.WriteLine($"Email dispatch failure: {emailEx.Message} {emailEx.StackTrace} {emailEx.InnerException}");
            }
        }

        return Ok(new { Message = "Match allocation row written cleanly to transaction logs." });
    }

    // =========================================================================
    // 5. DELETE: DESTRUCTIVE TRANSACTIONAL SLOT CANCELLATION RELEASE HANDLER
    // =========================================================================
    [HttpDelete("release/{bookingId}")]
    public async Task<IActionResult> ReleaseReservationSlot(string bookingId, [FromServices] CheckoutService checkoutService)
    {
        if (!Guid.TryParse(bookingId, out Guid bookingGuid)) 
            return BadRequest("Invalid transaction identifier formatting standard.");

        // =========================================================================
        // STEP 1: IDENTITY GUARD HOOKS SHIFTED TO TOP FOR SECURITY FASTRACKING
        // =========================================================================
        var currentUserName = HttpContext.User.Claims
            .FirstOrDefault(c => c.Type.Contains("username"))?.Value;

        if (string.IsNullOrEmpty(currentUserName))
        {
            currentUserName = HttpContext.User.Identity?.Name;
        }

        if (string.IsNullOrEmpty(currentUserName)) 
        {
            return Unauthorized(new { Message = "Security Obstacle: User identity claim string (username) was not detected inside the active session token." });
        }

        var userIdClaimString = HttpContext.User.Claims
            .FirstOrDefault(c => c.Type.Contains("nameidentifier") || c.Type == "sub" || c.Type == "nameid")?.Value;

        Guid bookedByUserIdGuid = Guid.Empty;
        if (!string.IsNullOrEmpty(userIdClaimString) && Guid.TryParse(userIdClaimString, out Guid parsedGuid))
        {
            bookedByUserIdGuid = parsedGuid;
        }
        else
        {
            return Unauthorized(new { Message = "Security Obstacle: User identity claim string (id) was not detected inside the active session token." });
        }

        // Isolate authority clearance tags natively from the active token session claims context
        var isDirector = User.IsInRole("AcademyDirector") || User.IsInRole("GlobalAdmin");

        // 2. Fetch the target booking slot row from the database
        var targetBooking = await _dbContext.Bookings.FirstOrDefaultAsync(b => b.Id == bookingGuid);
        if (targetBooking == null) 
            return NotFound("Target reservation allocation row does not exist.");

        // =========================================================================
        // STEP 2: MULTI-USER IDENTITY MATCH VALIDATION RUNS IMMEDIATELY
        // =========================================================================
        if (!isDirector && targetBooking.BookedPlayerName != currentUserName && targetBooking.BookedByUserId != bookedByUserIdGuid.ToString()) 
        {
            return Forbid("Security Violation: Cross-identity data dropping transaction rejected.");
        }

        // =========================================================================
        // STEP 3: DYNAMIC 24-HOUR CANCELLATION TIMING POLICY EVALUATION
        // =========================================================================
        var timeUntilMatch = targetBooking.StartTimeUtc - DateTime.UtcNow;

        // Condition: Block execution if match starts in under 24 hours AND the user is NOT an Academy Director
        if (timeUntilMatch.TotalHours < 24 && !isDirector)
        {
            return BadRequest("Cancellation Locked: Reservations starting in less than 24 hours cannot be dropped by players. Please contact an Academy Director for an override.");
        }

        var court = await _dbContext.Courts
            .Include(c => c.Branch)
            .FirstOrDefaultAsync(c => c.AcademyId == targetBooking.AcademyId && c.Name.ToLower() == targetBooking.CourtName.ToLower());

        if (court == null)
        {
            return BadRequest($"Validation error: Court matching the name '{targetBooking.CourtName}' does not exist inside your academy ecosystem.");
        }

        // 4. Locate the associated invoice using our historical booking tracking ID reference key
        var associatedLineItem = await _dbContext.InvoiceLineItems
            .FirstOrDefaultAsync(li => li.AssociatedBookingId == targetBooking.Id);

        string financialStatusUpdateMessage = "No linked financial invoices were altered.";

        if (associatedLineItem != null)
        {
            // =========================================================================
            // STEP 4: INTEGRATE THE REVERSAL CORE (VOIDS UNPAID OR REFUNDS GATEWAY FUNDS)
            // =========================================================================
            // Calls your centralized service to process live refunds or atomic database voids
            var reversalResult = await checkoutService.ProcessInvoiceReversalAsync(targetBooking.AcademyId, associatedLineItem.InvoiceId);
            
            if (!reversalResult.IsSuccess)
            {
                return BadRequest($"Financial Ledger Rejection: {reversalResult.ErrorMessage}");
            }

            financialStatusUpdateMessage = reversalResult.ReferenceId == "VOIDED-SUCCESSFULLY"
                ? $"Linked outstanding Invoice #{associatedLineItem.InvoiceId} has been successfully VOIDED."
                : $"Linked paid Invoice #{associatedLineItem.InvoiceId} has been marked as REFUNDED. Gateway Ref Handle: {reversalResult.ReferenceId}";
        }

        // 5. Credit back play minutes to the court surface wear metrics tracking system
        court.AggregateMinutesPlayed = Math.Max(0, court.AggregateMinutesPlayed - targetBooking.DurationInMinutes);

        // 6. Execute atomic database record extraction transaction loop
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

        return Ok(new { Message = $"Slot transaction dropped and released successfully. {financialStatusUpdateMessage}" });
    }

}

// Data Transfer Object definition record model
public record ClaimPayloadDto(Guid CourtId, string CourtName, DateTime StartTimeUtc, string SmsCode = "");

// 🚀 NEW STRUCTURAL RECORD DATA CONTRACT BACKING THE MATRIX RESPONSE LOOP
public record MatrixSlotResponse(
    string CourtId,
    string CourtName,
    DateTime StartTimeUtc,
    DateTime EndTimeUtc,
    string BranchLocalTimeDisplay,
    string BranchLocalDateDisplay,
    bool IsAvailable,
    string? BookedPlayerName
);

