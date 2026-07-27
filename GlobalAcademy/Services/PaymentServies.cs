using Braintree;
using Square;

namespace GlobalAcademy.Payment.Services
{
    public class GatewayProcessRequest
    {
        public decimal Amount { get; set; }
        public Models.PaymentMethod Method { get; set; }
        public string PaymentTokenOrDetails { get; set; } // e.g., Card string, Address, or Cash drawer id
    }

    public class GatewayProcessResult
    {
        public bool IsSuccess { get; set; }
        public string ReferenceId { get; set; }
        public string ErrorMessage { get; set; }
    }
    public interface IPaymentGatewayService
    {
        Task<GatewayProcessResult> ProcessInvoicePaymentAsync(
            Guid academyId, 
            decimal amount, 
            string paymentToken, 
            string currencyCode = "USD");
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
        public async Task<GatewayProcessResult> ProcessInvoicePaymentAsync(Guid academyId, decimal amount, string paymentToken, string currencyCode = "USD")
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
                
                return new GatewayProcessResult 
                { 
                    IsSuccess = true, 
                    ReferenceId = $"SQ-{response.Payment.Id}" 
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
    }
}
