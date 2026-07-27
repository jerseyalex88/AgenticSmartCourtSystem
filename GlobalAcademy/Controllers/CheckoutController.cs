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

    public CheckoutController(CheckoutService checkoutService,
        ApplicationDbContext dbContext,
        ITenantProvider tenantProvider)
    {
        _checkoutService = checkoutService;
        _dbContext = dbContext;
        _tenantProvider = tenantProvider;
    }

    [HttpPost("process")]
    public async Task<IActionResult> ProcessCheckout([FromBody] CheckoutRequestPayload payload)
    {
        // Extract the strict Multi-Tenant firewall identity claim
        var academyIdClaim = User.FindFirst("AcademyId")?.Value;
        if (string.IsNullOrEmpty(academyIdClaim) || !Guid.TryParse(academyIdClaim, out var academyId))
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
    [HttpGet("my-statements")]
    public async Task<IActionResult> GetMyBillingStatements()
    {
        // 1. Extract and enforce strict Multi-Tenant + Identity Firewall constraints
        var currentAcademyId = _tenantProvider.GetTenantId();

        var currentUserName = HttpContext.User.Claims
            .FirstOrDefault(c => c.Type.Contains("xmlsoap.org"))?.Value;

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
        Guid issuedToUserIdGuid = Guid.Empty;
        
        // Safely parse the extracted token string value into a valid structural Guid token type
        if (!string.IsNullOrEmpty(userIdClaimString) && Guid.TryParse(userIdClaimString, out Guid parsedGuid))
        {
            issuedToUserIdGuid = parsedGuid;
        }
        else
        {
            return Unauthorized(new { Message = "Security Obstacle: User identity claim string (id) was not detected inside the active session token." });
        }
        
        var isDirector = User.IsInRole("AcademyDirector");

        var query = _dbContext.Invoices.Where(i => i.AcademyId == currentAcademyId);

        // 3. Conditional Rule: If NOT a director, strictly isolate query results to the logged-in player's ID
        if (!isDirector)
        {
            query = query.Where(i => i.IssuedToUserId == issuedToUserIdGuid.ToString());
        }

        // 2. Execute optimal projected query mapping directly from physical PostgreSQL tables
        var statements = await query
            .Include(i => i.LineItems)
            .Include(i => i.Transactions)
            .OrderByDescending(i => i.CreatedAtUtc)
            .Select(i => new BillingStatementDto(
                i.CustomerName,
                i.InvoiceId,
                i.CreatedAtUtc,
                i.Status.ToString(), // Converts enum to clean display text string
                i.TotalAmount,
                i.LineItems.Select(li => new InvoiceLineItemDto(
                    li.ItemDescription,
                    li.Quantity,
                    li.UnitPrice,
                    li.LineTotal
                )).ToList(),
                i.Transactions.Select(t => new TransactionReceiptDto(
                    t.ProcessedByGateway,
                    t.GatewayReferenceId,
                    t.Amount,
                    t.TimestampUtc,
                    t.IsSuccess
                )).ToList()
            ))
            .ToListAsync();

        return Ok(statements);
    }    
}

public record InvoiceLineItemDto(
        string ItemDescription,
        int Quantity,
        decimal UnitPrice,
        decimal LineTotal
    );

public record TransactionReceiptDto(
    PreferredGateway ProcessedByGateway,
    string GatewayReferenceId,
    decimal Amount,
    DateTime TimestampUtc,
    bool IsSuccess
);

public record BillingStatementDto(
    string CustomerName,
    Guid InvoiceId,
    DateTime CreatedAtUtc,
    string Status,
    decimal TotalAmount,
    List<InvoiceLineItemDto> LineItems,
    List<TransactionReceiptDto> Receipts
);