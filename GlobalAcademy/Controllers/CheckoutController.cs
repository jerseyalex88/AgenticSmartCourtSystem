using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using GlobalAcademy.Payment.Services;
using GlobalAcademy.Models;
using GlobalAcademy.Data;
using Microsoft.EntityFrameworkCore;
using GlobalAcademy.Security;

namespace GlobalAcademy.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize] // Enforce verified identity context validation rules globally
public class CheckoutController : ControllerBase
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ITenantProvider _tenantProvider;
    private readonly CheckoutService _checkoutService;
    private readonly BraintreeGatewayService _braintreeGateway;

    public CheckoutController(CheckoutService checkoutService,
        BraintreeGatewayService braintreeGateway,
        ApplicationDbContext dbContext,
        ITenantProvider tenantProvider)
    {
        _checkoutService = checkoutService;
        _braintreeGateway = braintreeGateway;
        _dbContext = dbContext;
        _tenantProvider = tenantProvider;
    }

    [HttpPost("process")]
    public async Task<IActionResult> ProcessCheckout([FromBody] CheckoutRequestPayload payload)
    {
        // Extract the strict Multi-Tenant firewall identity claim
        var currentAcademyId = _tenantProvider.GetTenantId();
        if (!Guid.TryParse(currentAcademyId.ToString(), out var academyId))
        {
            return BadRequest("Access Denied: Missing or malformed tenant boundary claims profile.");
        }

        var result = await _checkoutService.ExecuteCheckoutAsync(academyId, payload);

        if (!result.IsSuccess)
        {
            return BadRequest(new { success = false, message = result.ErrorMessage });
        }

        return Ok(new { success = true, referenceId = result.ReferenceId });
    }
    
    /// <summary>
    /// POST api/Checkout/process-consolidated
    /// Charges a single unified total sum balance and clears multiple unpaid invoices atomically.
    /// </summary>
    [HttpPost("process-consolidated")]
    public async Task<IActionResult> ProcessConsolidatedCheckout([FromBody] ConsolidatedCheckoutRequest payload)
    {
        var academyIdClaim = User.FindFirst("AcademyId")?.Value;
        if (string.IsNullOrEmpty(academyIdClaim) || !Guid.TryParse(academyIdClaim, out var academyId))
        {
            return BadRequest(new { success = false, message = "Access Denied: Missing multi-tenant partition context parameters." });
        }

        // Invoke our single-charge multi-clear transactional execution node service
        var result = await _checkoutService.ExecuteConsolidatedCheckoutAsync(academyId, payload);

        if (!result.IsSuccess)
        {
            return BadRequest(new { success = false, message = result.ErrorMessage });
        }

        return Ok(new { success = true, referenceId = result.ReferenceId });
    }

    [HttpGet("my-statements")]
    public async Task<IActionResult> GetMyBillingStatements()
    {
        // 1. Extract and enforce strict Multi-Tenant + Identity Firewall constraints
        var currentAcademyId = _tenantProvider.GetTenantId();

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
        Guid issuedToUserIdGuid = Guid.Empty;
        
        if (!string.IsNullOrEmpty(userIdClaimString) && Guid.TryParse(userIdClaimString, out Guid parsedGuid))
        {
            issuedToUserIdGuid = parsedGuid;
        }
        else
        {
            return Unauthorized(new { Message = "Security Obstacle: User identity claim string (id) was not detected inside the active session token." });
        }
        
        var isDirector = User.IsInRole("AcademyDirector") || User.IsInRole("GlobalAdmin");

        var query = _dbContext.Invoices.Where(i => i.AcademyId == currentAcademyId);

        // 3. Conditional Rule: If NOT a director, strictly isolate query results to the logged-in player's ID
        if (!isDirector)
        {
            query = query.Where(i => i.IssuedToUserId == issuedToUserIdGuid.ToString());
        }

                // 2. Execute optimal projected query mapping directly from physical PostgreSQL tables
        var statements = await query
            .Include(i => i.LineItems)
            .Include(i => i.AssociatedTransaction)
            .OrderByDescending(i => i.CreatedAtUtc)
            .Select(i => new BillingStatementDto(
                i.CustomerName,
                i.InvoiceId,
                i.CreatedAtUtc,
                i.Status.ToString(), 
                i.TotalAmount,
                i.LineItems.Select(li => new InvoiceLineItemDto(
                    li.ItemDescription,
                    li.Quantity,
                    li.UnitPrice,
                    li.LineTotal
                )).ToList(),
                
                // =========================================================================
                // FIXED TRANSACTION RECEIPT ARRAY PROJECTION
                // =========================================================================
                // Generates a type-safe single-item list or an empty list if the invoice is unpaid
                i.AssociatedTransaction != null && i.AssociatedTransaction.IsSuccess
                    ? new List<TransactionReceiptDto>
                      {
                          new TransactionReceiptDto(
                              i.AssociatedTransaction.ProcessedByGateway,
                              i.AssociatedTransaction.GatewayReferenceId,
                              i.AssociatedTransaction.Amount,
                              i.AssociatedTransaction.TimestampUtc,
                              i.AssociatedTransaction.IsSuccess
                          )
                      }
                    : new List<TransactionReceiptDto>(),

                // Subquery Reversal Telemetry Extractions remain completely untouched
                _dbContext.Bookings
                    .Where(b => _dbContext.InvoiceLineItems.Any(li => li.InvoiceId == i.InvoiceId && li.AssociatedBookingId == b.Id))
                    .Select(b => (DateTime?)b.StartTimeUtc)
                    .FirstOrDefault(),

                _dbContext.Bookings
                    .Any(b => _dbContext.InvoiceLineItems.Any(li => li.InvoiceId == i.InvoiceId && li.AssociatedBookingId == b.Id) 
                           && b.StartTimeUtc < DateTime.UtcNow)
            ))
            .ToListAsync();

        return Ok(statements);

    }
    
    /// <summary>
    /// GET api/Checkout/braintree-token
    /// Generates a real-time secure tokenization authorization wrapper for the frontend PayPal iframe container.
    /// </summary>
    [HttpGet("braintree-token")]
    public async Task<IActionResult> GetBraintreeToken()
    {
        // Verify tenant claim structure boundaries exist before dispatching network calls
        var academyIdClaim = User.FindFirst("AcademyId")?.Value;
        if (string.IsNullOrEmpty(academyIdClaim))
        {
            return BadRequest("Access Denied: Missing multi-tenant partition key credentials.");
        }

        try
        {
            // Invoke the live server-to-server authorization handshake with Braintree Sandbox
            string clientTokenString = await _braintreeGateway.GenerateClientTokenAsync();
            
            return Ok(new { clientToken = clientTokenString });
        }
        catch (Exception ex)
        {
            // Catch any account or credential mapping issues without spilling raw traces to client logs
            return StatusCode(500, new { success = false, message = $"Failed to synchronize handshake context with gateway server. {ex.Message}" });
        }
    }
        /// <summary>
    /// POST api/Checkout/director-refund/{invoiceId}
    /// Secure Director-Only terminal pipeline to issue gateway reverse charges.
    /// </summary>
    [HttpPost("director-refund/{invoiceId}")]
    [Authorize(Roles = "AcademyDirector,GlobalAdmin")] // ◄--- HIGH SECURITY ENDPOINT FIREWALL
    public async Task<IActionResult> IssueDirectorRefund(Guid invoiceId)
    {
        // 1. Isolate the strict multi-tenant claim token parameters
        var academyIdClaim = User.FindFirst("AcademyId")?.Value;
        if (string.IsNullOrEmpty(academyIdClaim) || !Guid.TryParse(academyIdClaim, out var academyId))
        {
            return BadRequest(new { success = false, message = "Access Denied: Missing multi-tenant partition context keys." });
        }

        // 2. Dispatch down into your newly designed chronological guard service node loop
        var result = await _checkoutService.ExecuteDirectorRefundAsync(academyId, invoiceId);

        if (!result.IsSuccess)
        {
            return BadRequest(new { success = false, message = result.ErrorMessage });
        }

        return Ok(new { 
            success = true, 
            message = $"Success! Invoice balance sheet updated and gateway reversal completed.",
            referenceId = result.ReferenceId 
        });
    }
    /// <summary>
    /// GET api/Checkout/statement-manifest/{invoiceId}
    /// Harvests all invoices matching a shared transaction group to print a unified statement.
    /// </summary>
    [HttpGet("statement-manifest/{invoiceId}")]
    [Authorize]
    public async Task<IActionResult> GetStatementManifest(Guid invoiceId)
    {
        var currentAcademyId = _tenantProvider.GetTenantId();

        // 1. Locate the anchor invoice under multi-tenant constraints
        var anchorInvoice = await _dbContext.Invoices
            .Include(i => i.AssociatedTransaction)
            .FirstOrDefaultAsync(i => i.InvoiceId == invoiceId && i.AcademyId == currentAcademyId);

        if (anchorInvoice == null) return NotFound("Target statement data could not be located.");

        List<Invoice> targetInvoices;

        // 2. POLYMORPHIC TRACK: If paid & grouped, gather all sister invoices sharing the Transaction ID
        if (anchorInvoice.AssociatedTransactionId != null)
        {
            targetInvoices = await _dbContext.Invoices
                .Include(i => i.LineItems)
                .Where(i => i.AssociatedTransactionId == anchorInvoice.AssociatedTransactionId && i.AcademyId == currentAcademyId)
                .ToListAsync();
        }
        else
        {
            // If Unpaid, it stands alone as a single isolated document layout list
            await _dbContext.Entry(anchorInvoice).Collection(i => i.LineItems).LoadAsync();
            targetInvoices = new List<Invoice> { anchorInvoice };
        }

        // 3. Assemble unified ledger payment details strings
        string referenceId = anchorInvoice.AssociatedTransaction?.GatewayReferenceId ?? "PENDING-DUE";
        string methodDisplay = anchorInvoice.AssociatedTransaction?.Method.ToString() ?? "None / Unsettled";
        DateTime processedDate = anchorInvoice.AssociatedTransaction?.TimestampUtc ?? anchorInvoice.CreatedAtUtc;
        decimal grandTotal = targetInvoices.Sum(i => i.TotalAmount);

        var payload = new ConsolidatedStatementDto(
            CustomerName: anchorInvoice.CustomerName,
            GatewayReferenceId: referenceId,
            PaymentMethodDisplay: methodDisplay,
            DateProcessedUtc: processedDate,
            GrandTotalAmount: grandTotal,
            Invoices: targetInvoices.Select(inv => new StatementInvoiceDetailsDto(
                InvoiceId: inv.InvoiceId,
                CreatedAtUtc: inv.CreatedAtUtc,
                Status: inv.Status.ToString(),
                TotalAmount: inv.TotalAmount,
                LineItems: inv.LineItems.Select(li => new InvoiceLineItemDto(
                    li.ItemDescription,
                    li.Quantity,
                    li.UnitPrice,
                    li.LineTotal
                )).ToList()
            )).ToList()
        );

        return Ok(payload);
    }

}

public record InvoiceLineItemDto(
        string? ItemDescription,
        int Quantity,
        decimal UnitPrice,
        decimal LineTotal
    );

public record TransactionReceiptDto(
    PreferredGateway ProcessedByGateway,
    string? GatewayReferenceId,
    decimal Amount,
    DateTime TimestampUtc,
    bool IsSuccess
);
public record BillingStatementDto(
    string? CustomerName,
    Guid InvoiceId,
    DateTime CreatedAtUtc,
    string Status,
    decimal TotalAmount,
    List<InvoiceLineItemDto> LineItems,
    List<TransactionReceiptDto> Transactions,
    DateTime? BookingStartTimeUtc,
    bool IsExpired
);
public record ConsolidatedStatementDto(
    string? CustomerName,
    string GatewayReferenceId,
    string PaymentMethodDisplay,
    DateTime DateProcessedUtc,
    decimal GrandTotalAmount,
    List<StatementInvoiceDetailsDto> Invoices
);

public record StatementInvoiceDetailsDto(
    Guid InvoiceId,
    DateTime CreatedAtUtc,
    string Status,
    decimal TotalAmount,
    List<InvoiceLineItemDto> LineItems
);
