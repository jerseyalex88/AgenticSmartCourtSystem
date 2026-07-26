namespace GlobalAcademy.Plugins
{
    using System;
    using System.ComponentModel;
    using System.Threading.Tasks;
    using Microsoft.SemanticKernel;
    using GlobalAcademy.Payment.Services;
    using GlobalAcademy.Models;

    public class PlayerCheckoutPlugin
    {
        private readonly CheckoutService _checkoutService;

        public PlayerCheckoutPlugin(CheckoutService checkoutService)
        {
            _checkoutService = checkoutService;
        }

        [KernelFunction, Description("Executes an atomic invoice balancing payment route from the player chat window using standard tokens.")]
        public async Task<string> ProcessVoicePaymentAsync(
            [Description("The active multi-tenant organization GUID context.")] string academyIdText,
            [Description("The target invoice GUID unique handle key.")] string invoiceIdText,
            [Description("The merchant provider processor choice choice: Braintree or Square.")] string providerText,
            [Description("The client secure network payment nonce token handle.")] string paymentToken)
        {
            // 1. Structural type conversion matching inputs
            if (!Guid.TryParse(academyIdText, out var academyId)) return "Checkout Failed: Malformed target Academy identity structure.";
            if (!Guid.TryParse(invoiceIdText, out var invoiceId)) return "Checkout Failed: Malformed primary Invoice reference format.";

            // 2. Safe parsing extraction mapping for system enums
            if (!Enum.TryParse<PreferredGateway>(providerText, true, out var provider))
            {
                return $"Checkout Failed: The processor gateway identifier '{providerText}' is unrecognized.";
            }

            // 3. Fallback type assumption generation for token inputs
            var methodChoice = provider == PreferredGateway.Square ? PaymentMethod.CreditCard : PaymentMethod.CreditCard;

            var payload = new CheckoutRequestPayload(
                InvoiceId: invoiceId,
                Provider: provider,
                Method: methodChoice,
                PaymentToken: paymentToken,
                CurrencyCode: "CAD"
            );

            // 4. Fire directly through the exact same unified core processing node
            var result = await _checkoutService.ExecuteCheckoutAsync(academyId, payload);

            if (!result.IsSuccess)
            {
                return $"Checkout Rejected by Gateway: {result.ErrorMessage}";
            }

            return $"Transaction Approved Successfully! Settlement confirmation reference tracker token: {result.ReferenceId}";
        }
    }
}
