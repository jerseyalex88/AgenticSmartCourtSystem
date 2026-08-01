using Braintree;
using Square;

namespace GlobalAcademy.Payment.Services
{
    public class GatewayProcessRequest
    {
        public decimal Amount { get; set; }
        public Models.PaymentMethod Method { get; set; }
        public string? PaymentTokenOrDetails { get; set; } // e.g., Card string, Address, or Cash drawer id
    }

    public class GatewayProcessResult
    {
        public bool IsSuccess { get; set; }
        public string? ReferenceId { get; set; }
        public string? ErrorMessage { get; set; }
    }
    public interface IPaymentGatewayService
    {
        Task<GatewayProcessResult> ProcessInvoicePaymentAsync(
            Guid academyId, 
            decimal amount, 
            string paymentToken, 
            string currencyCode = "CAD");
        Task<GatewayProcessResult> RefundPaymentAsync(
            string originalGatewayReferenceId, 
            decimal amount,
            string currencyCode = "CAD");
    }
    public record BraintreeConfig(string MerchantId, string PublicKey, string PrivateKey, string Environment = "Braintree.Environment.SANDBOX");

    public class BraintreeGatewayService : IPaymentGatewayService
    {
        private readonly IBraintreeGateway _gateway;

        public BraintreeGatewayService(BraintreeConfig config)
        {
            _gateway = new BraintreeGateway(
                config.Environment == "Braintree.Environment.PRODUCTION" ? Braintree.Environment.PRODUCTION : Braintree.Environment.SANDBOX,
                config.MerchantId,
                config.PublicKey,
                config.PrivateKey
            );
        }

        /// <summary>
        /// Contacts Braintree Sandbox servers to generate a short-lived authorization token.
        /// </summary>
        public async Task<string> GenerateClientTokenAsync()
        {
            try
            {
                // Generate a fresh, un-vaulted generic gateway client configuration string
                return await _gateway.ClientToken.GenerateAsync();
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException($"Braintree Token Generation Fault: {ex.Message}", ex);
            }
        }
        public async Task<GatewayProcessResult> ProcessInvoicePaymentAsync(Guid academyId, decimal amount, string paymentToken, string currencyCode = "CAD")
        {
            var request = new TransactionRequest
            {
                Amount = amount,
                PaymentMethodNonce = paymentToken, // Passed from React frontend dropdown/input
                Options = new TransactionOptionsRequest { SubmitForSettlement = true }
            };

            request.CustomFields.Add("academy_id", academyId.ToString()); // strict partition tracing

            Result<Braintree.Transaction> result = await _gateway.Transaction.SaleAsync(request);

            if (result.IsSuccess())
            {
                return new GatewayProcessResult { IsSuccess = true, ReferenceId = $"BT-{result.Target.Id}" };
            }
            return new GatewayProcessResult { IsSuccess = false, ErrorMessage = result.Message };
        }
                /// <summary>
        /// Contacts Braintree to safely reverse a payment. If the transaction hasn't settled yet, 
        /// it automatically triggers a direct VOID. Otherwise, it issues an absolute true REFUND.
        /// </summary>
        public async Task<GatewayProcessResult> RefundPaymentAsync(string originalGatewayReferenceId, decimal amount, string currencyCode = "CAD")
        {
            // Extract the raw transactional GUID handle token by stripping out your "BT-" prefix
            string rawBraintreeTxId = originalGatewayReferenceId.Replace("BT-", "").Trim();

            try
            {
                // 1. Fetch current transaction clearance status codes directly from Braintree servers
                Braintree.Transaction tx = await _gateway.Transaction.FindAsync(rawBraintreeTxId);

                // Scenario A: If transaction is still clearing, dispatch an immediate full VOID
                if (tx.Status == TransactionStatus.SUBMITTED_FOR_SETTLEMENT || 
                    tx.Status == TransactionStatus.AUTHORIZED || 
                    tx.Status == TransactionStatus.AUTHORIZING)
                {
                    Result<Braintree.Transaction> voidResult = await _gateway.Transaction.VoidAsync(rawBraintreeTxId);
                    
                    if (voidResult.IsSuccess())
                    {
                        return new GatewayProcessResult { IsSuccess = true, ReferenceId = voidResult.Target.Id };
                    }
                    return new GatewayProcessResult { IsSuccess = false, ErrorMessage = $"Braintree Void Failure: {voidResult.Message}" };
                }


                // Scenario B: Transaction has fully cleared bank processing -> Dispatch an absolute true REFUND
                Result<Braintree.Transaction> refundResult = await _gateway.Transaction.RefundAsync(rawBraintreeTxId, amount);
                
                if (refundResult.IsSuccess())
                {
                    return new GatewayProcessResult { IsSuccess = true, ReferenceId = refundResult.Target.Id };
                }
                return new GatewayProcessResult { IsSuccess = false, ErrorMessage = $"Braintree Refund Failure: {refundResult.Message}" };
            }
            catch (Exception ex)
            {
                return new GatewayProcessResult { IsSuccess = false, ErrorMessage = $"Braintree Infrastructure Fault: {ex.Message}" };
            }
        }

    }
    public record SquareConfig(string ApplicationId, string AccessToken, string Environment = "Square.Environment.SANDBOX");

    public class SquareGatewayService : IPaymentGatewayService
    {
        private readonly ISquareClient _client;

        public SquareGatewayService(SquareConfig config)
        {
            // Set the correct baseline environment enum mapper
            var baseEnvironment = config.Environment.ToLower() == "Square.Environment.PRODUCTION" 
                ? SquareEnvironment.Production 
                : SquareEnvironment.Sandbox;

            // Instantiate the client directly using the standard constructor
            _client = new SquareClient(
                config.AccessToken,
                new ClientOptions { BaseUrl = baseEnvironment }
            );
        }

        public async Task<GatewayProcessResult> ProcessInvoicePaymentAsync(Guid academyId, decimal amount, string paymentToken, string currencyCode = "CAD")
        {
            long amountInCents = (long)(amount * 100);
            
            var amountMoney = new Money
            {
                Amount = amountInCents,
                Currency = new Currency(currencyCode)
            };

            string idempotencyKey = Guid.NewGuid().ToString();

            var request = new CreatePaymentRequest
            {
                SourceId = paymentToken,
                IdempotencyKey = idempotencyKey,
                AmountMoney = amountMoney,
                Note = $"Academy Tenant Isolation Partition ID: {academyId}"
            };

            try
            {
                // The client exposes the endpoint layer directly through the PaymentsApi property
                var response = await _client.Payments.CreateAsync(request);

                string secureReferenceId = response?.Payment?.Id ?? Guid.NewGuid().ToString("N");
                
                return new GatewayProcessResult 
                { 
                    IsSuccess = true, 
                    ReferenceId = $"SQ-{secureReferenceId}" 
                };
            }
            // catch (Square.Exceptions.ApiException ex)
            // {
            //     string structuralErrors = ex.Errors != null && ex.Errors.Count > 0
            //         ? string.Join(" | ", ex.Errors.Select(e => $"{e.Category}: {e.Detail}"))
            //         : ex.Message;

            //     return new GatewayProcessResult 
            //     { 
            //         IsSuccess = false, 
            //         ErrorMessage = $"Square API Exception: {structuralErrors}" 
            //     };
            // }
            catch (Exception ex)
            {
                return new GatewayProcessResult 
                { 
                    IsSuccess = false, 
                    ErrorMessage = $"General Connection Error: {ex.Message}" 
                };
            }
        }
                /// <summary>
        /// Contacts Square APIs to issue a safe reverse-charge refund back to the player's card profile.
        /// </summary>
        public async Task<GatewayProcessResult> RefundPaymentAsync(string originalGatewayReferenceId, decimal amount, string currencyCode = "CAD")
        {
            // Extract raw transaction identifier handles by stripping out your "SQ-" prefix
            string rawSquarePaymentId = originalGatewayReferenceId.Replace("SQ-", "").Trim();
            long amountInCents = (long)(amount * 100);

            var amountMoney = new Money
            {
                Amount = amountInCents,
                Currency = new Currency(currencyCode)
            };

            // Instantiate square-specific structural refund request payload contracts
            var request = new RefundPaymentRequest() {IdempotencyKey= Guid.NewGuid().ToString(), PaymentId=rawSquarePaymentId, AmountMoney= amountMoney, Reason="Transactional cancellation loop trigger via PlayerBooking release command."};

            try
            {
                // Execute network reversal directly through Square's standard client RefundsApi mapping
                var response = await _client.Refunds.RefundPaymentAsync(request);

                string secureReferenceId = response?.Refund?.Id ?? Guid.NewGuid().ToString("N");

                return new GatewayProcessResult
                {
                    IsSuccess = true,
                    ReferenceId = $"SQ-{secureReferenceId}"
                };
            }
            catch (Exception ex)
            {
                return new GatewayProcessResult
                {
                    IsSuccess = false,
                    ErrorMessage = $"Square Refund Connection Error: {ex.Message}"
                };
            }
        }

    }
}
