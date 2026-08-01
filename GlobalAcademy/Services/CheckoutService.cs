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

    public record CheckoutResult(bool IsSuccess, string? ReferenceId, string? ErrorMessage);

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
        public async Task<CheckoutResult> ProcessInvoiceReversalAsync(Guid academyId, Guid invoiceId)
        {
            // Fetch target invoice within strict tenant boundary partitions
            var invoice = await _context.Invoices
                .Include(i => i.Transactions)
                .FirstOrDefaultAsync(i => i.InvoiceId == invoiceId && i.AcademyId == academyId);

            if (invoice == null)
            {
                return new CheckoutResult(false, null, "Reversal Denied: Target invoice record not found.");
            }

            // Scenario A: Invoice is unpaid -> Perform an instant absolute database VOID
            if (invoice.Status == InvoiceStatus.Unpaid)
            {
                invoice.Status = InvoiceStatus.Voided;
                await _context.SaveChangesAsync();
                return new CheckoutResult(true, "VOIDED-SUCCESSFULLY", null);
            }

            // Scenario B: Already settled -> Initiate third-party refund API calls
            if (invoice.Status == InvoiceStatus.Paid)
            {
                // Isolate the successful ledger transaction receipt string block
                var successfulTx = invoice.Transactions.FirstOrDefault(t => t.IsSuccess);
                if (successfulTx == null)
                {
                    return new CheckoutResult(false, null, "Refund Denied: Could not locate matching transaction receipt.");
                }

                if (string.IsNullOrWhiteSpace(successfulTx.GatewayReferenceId))
                {
                    return new CheckoutResult(false, null, "Refund Denied: The original payment reference key is missing or corrupted on this ledger item row.");
                }

                // =========================================================================
                // LIVE GATEWAY INTEGRATION CORE: FETCH ADAPTER AND EXECUTE REVERSAL
                // =========================================================================
                // 1. Resolve the concrete adapter (Square or Braintree) dynamically via the factory container
                var gateway = _gatewayFactory.GetGateway(successfulTx.ProcessedByGateway);

                // 2. DISPATCH THE LIVE GATEWAY REFUND handshakes out over the web network!
                var gatewayRefundResult = await gateway.RefundPaymentAsync(
                    successfulTx.GatewayReferenceId, 
                    invoice.TotalAmount,
                    "CAD" // Aligns with your baseline Currency settings
                );

                if (!gatewayRefundResult.IsSuccess)
                {
                    return new CheckoutResult(false, null, $"Gateway Refund Failure: {gatewayRefundResult.ErrorMessage}");
                }

                // 3. Queue up the historical adjustment transaction record layout row
                var refundLog = new LedgerTransaction
                {
                    TransactionId = Guid.NewGuid(),
                    AcademyId = academyId,
                    InvoiceId = invoice.InvoiceId,
                    Method = successfulTx.Method,
                    ProcessedByGateway = successfulTx.ProcessedByGateway,
                    GatewayReferenceId = $"REF-{gatewayRefundResult.ReferenceId}", // Stores live API tracking token
                    Amount = invoice.TotalAmount,
                    TimestampUtc = DateTime.UtcNow,
                    IsSuccess = true
                };

                _context.LedgerTransactions.Add(refundLog);
                invoice.Status = InvoiceStatus.Refunded;
                
                await _context.SaveChangesAsync();
                return new CheckoutResult(true, refundLog.GatewayReferenceId, null);
            }

            return new CheckoutResult(false, null, $"Reversal Denied: Invoices with state '{invoice.Status}' cannot be altered.");
        }
    }
}
