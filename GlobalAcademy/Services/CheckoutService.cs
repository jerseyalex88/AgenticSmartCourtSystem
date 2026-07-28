namespace GlobalAcademy.Payment.Services
{
    using System;
    using System.Threading.Tasks;
    using Microsoft.EntityFrameworkCore;
    using GlobalAcademy.Data;
    using GlobalAcademy.Models;

    public record CheckoutRequestPayload(
        Guid InvoiceId, 
        PreferredGateway Provider, 
        PaymentMethod Method, 
        string PaymentToken, 
        string CurrencyCode = "CAD"
    );

    public record ConsolidatedCheckoutRequest(
        List<Guid> InvoiceIds,
        PreferredGateway Provider,
        PaymentMethod Method,
        string PaymentToken,
        string CurrencyCode = "CAD"
    );

    public record CheckoutResult(bool IsSuccess, string ReferenceId, string ErrorMessage);

    public class CheckoutService
    {
        private readonly ApplicationDbContext _context;
        private readonly PaymentGatewayFactory _gatewayFactory;

        public CheckoutService(ApplicationDbContext context, PaymentGatewayFactory gatewayFactory)
        {
            _context = context;
            _gatewayFactory = gatewayFactory;
        }

        public async Task<CheckoutResult> ExecuteCheckoutAsync(Guid academyId, CheckoutRequestPayload payload)
        {
            // 1. Fetch the target invoice within strict Multi-Tenant firewall bounds
            var invoice = await _context.Invoices
                .FirstOrDefaultAsync(i => i.InvoiceId == payload.InvoiceId && i.AcademyId == academyId);

            if (invoice == null)
                return new CheckoutResult(false, null, "Error: Target invoice not found or access denied by security partition.");

            if (invoice.Status == InvoiceStatus.Paid)
                return new CheckoutResult(false, null, "Error: This balancing ledger invoice has already been fully settled.");

            // 2. Resolve the matching third-party provider wrapper dynamically using the factory
            var gateway = _gatewayFactory.GetGateway(payload.Provider);

            // 3. Dispatch the transaction over the active network context to the live sandbox
            var gatewayResult = await gateway.ProcessInvoicePaymentAsync(
                academyId, 
                invoice.TotalAmount, 
                payload.PaymentToken, 
                payload.CurrencyCode
            );

            // 4. Instantiation mapping for the historical ledger transaction record
            var transactionLog = new LedgerTransaction
            {
                TransactionId = Guid.NewGuid(),
                AcademyId = academyId,
                InvoiceId = invoice.InvoiceId,
                Method = payload.Method,
                ProcessedByGateway = payload.Provider,
                GatewayReferenceId = gatewayResult.ReferenceId ?? "FAILED-ATTEMPT",
                Amount = invoice.TotalAmount,
                TimestampUtc = DateTime.UtcNow,
                IsSuccess = gatewayResult.IsSuccess
            };

            _context.LedgerTransactions.Add(transactionLog);

            if (!gatewayResult.IsSuccess)
            {
                await _context.SaveChangesAsync(); // Log the failure trail for admin diagnostics
                return new CheckoutResult(false, null, gatewayResult.ErrorMessage);
            }

            // 5. Update invoice state parameters on clear gateway authorization confirmation
            invoice.Status = InvoiceStatus.Paid;
            await _context.SaveChangesAsync();

            return new CheckoutResult(true, gatewayResult.ReferenceId, null);
        }
        public async Task<CheckoutResult> ExecuteConsolidatedCheckoutAsync(Guid academyId, ConsolidatedCheckoutRequest payload)
        {
            // 1. Fetch all requested invoices under strict multi-tenant firewall bounds
            var invoices = await _context.Invoices
                .Where(i => payload.InvoiceIds.Contains(i.InvoiceId) && i.AcademyId == academyId && i.Status == InvoiceStatus.Unpaid)
                .ToListAsync();

            if (!invoices.Any())
                return new CheckoutResult(false, null, "Error: No outstanding unpaid invoices found matching selection criteria.");

            // 2. Sum the absolute cumulative balance to issue exactly ONE charge payload
            decimal totalConsolidatedAmount = invoices.Sum(i => i.TotalAmount);

            // 3. Resolve the third-party gateway dynamically using the factory container
            var gateway = _gatewayFactory.GetGateway(payload.Provider);

            // Create a descriptive text handle tracing what this transaction represents
            string aggregatedNote = $"Consolidated Payment for Invoice IDs: {string.Join(", ", invoices.Select(i => i.InvoiceId.ToString().Substring(0, 8)))}";

            // 4. Dispatch the single cumulative balance charge out to the gateway sandbox
            var gatewayResult = await gateway.ProcessInvoicePaymentAsync(
                academyId, 
                totalConsolidatedAmount, 
                payload.PaymentToken, 
                payload.CurrencyCode
            );

            // 5. Instantiation mapping for a single historical tracking log line item
            var transactionLog = new LedgerTransaction
            {
                TransactionId = Guid.NewGuid(),
                AcademyId = academyId,
                // Associate with the first invoice item as the primary target pointer anchor
                InvoiceId = invoices.First().InvoiceId, 
                Method = payload.Method,
                ProcessedByGateway = payload.Provider,
                GatewayReferenceId = gatewayResult.ReferenceId ?? "FAILED-CONSOLIDATED",
                Amount = totalConsolidatedAmount,
                TimestampUtc = DateTime.UtcNow,
                IsSuccess = gatewayResult.IsSuccess
            };

            _context.LedgerTransactions.Add(transactionLog);

            if (!gatewayResult.IsSuccess)
            {
                await _context.SaveChangesAsync(); // Log the audit fail trace for dashboard diagnostics
                return new CheckoutResult(false, null, gatewayResult.ErrorMessage);
            }

            // 6. Loop through and flip all invoice status states to Paid in memory safely
            foreach (var inv in invoices)
            {
                inv.Status = InvoiceStatus.Paid;
            }

            // 7. Save both the single log line and multiple status changes atomically to PostgreSQL
            await _context.SaveChangesAsync();

            return new CheckoutResult(true, gatewayResult.ReferenceId, null);
        }
    }
}
