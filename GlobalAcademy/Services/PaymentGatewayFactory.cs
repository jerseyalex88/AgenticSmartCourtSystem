namespace GlobalAcademy.Payment.Services
{
    using System;
    using GlobalAcademy.Models;
    using Microsoft.Extensions.DependencyInjection;

    // Use this enum inside your controller payload contracts to map incoming web traffic choices
    public enum CheckoutRouteProvider { UseBraintree, UseSquare }

    public class PaymentGatewayFactory
    {
        private readonly IServiceProvider _serviceProvider;

        public PaymentGatewayFactory(IServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
        }

        public IPaymentGatewayService GetGateway(PreferredGateway provider)
        {
            return provider switch
            {
                PreferredGateway.Braintree => _serviceProvider.GetRequiredService<BraintreeGatewayService>(),
                PreferredGateway.Square => _serviceProvider.GetRequiredService<SquareGatewayService>(),
                _ => throw new NotSupportedException($"The gateway provider '{provider}' is not supported.")
            };
        }
    }
}
