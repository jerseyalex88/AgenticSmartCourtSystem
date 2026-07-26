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
    }
}
