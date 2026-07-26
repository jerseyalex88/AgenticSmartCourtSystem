using Microsoft.Extensions.Configuration;
using GlobalAcademy.Payment.Services;

namespace GlobalAcademy.Tests;

public class PaymentTestConfigurationFixture
{
    public BraintreeConfig BraintreeConfiguration { get; }
    public SquareConfig SquareConfiguration { get; }

    public PaymentTestConfigurationFixture()
    {
        var config = new ConfigurationBuilder()
            .SetBasePath(AppContext.BaseDirectory)
            .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
            .Build();

        BraintreeConfiguration = config.GetSection("PaymentGateways:Braintree").Get<BraintreeConfig>()
            ?? throw new InvalidOperationException("Braintree test credentials missing from appsettings.json.");

        SquareConfiguration = config.GetSection("PaymentGateways:Square").Get<SquareConfig>()
            ?? throw new InvalidOperationException("Square test credentials missing from appsettings.json.");
    }
}

public class BraintreeGatewayTests : IClassFixture<PaymentTestConfigurationFixture>
{
    private readonly BraintreeGatewayService _service;

    public BraintreeGatewayTests(PaymentTestConfigurationFixture fixture)
    {
        _service = new BraintreeGatewayService(fixture.BraintreeConfiguration);
    }

    [Fact]
    public async Task ProcessInvoicePaymentAsync_WithValidSandboxNonce_ReturnsSuccess()
    {
        // Arrange
        var testAcademyId = Guid.NewGuid();
        decimal chargeAmount = 75.00m;
        string standardSuccessNonce = "fake-valid-nonce"; // Official Braintree sandbox test string

        // Act
        var result = await _service.ProcessInvoicePaymentAsync(testAcademyId, chargeAmount, standardSuccessNonce);

        // Assert
        Assert.True(result.IsSuccess, $"Payment failed: {result.ErrorMessage}");
        Assert.StartsWith("BT-", result.ReferenceId);
        Assert.Null(result.ErrorMessage);
    }

    [Fact]
    public async Task ProcessInvoicePaymentAsync_WithDeclinedNonce_ReturnsFailure()
    {
        // Arrange
        var testAcademyId = Guid.NewGuid();
        decimal chargeAmount = 10.00m;
        string consumeDeclinedNonce = "fake-valid-decline-nonce"; // Triggers an intentional bank decline block

        // Act
        var result = await _service.ProcessInvoicePaymentAsync(testAcademyId, chargeAmount, consumeDeclinedNonce);

        // Assert
        Assert.False(result.IsSuccess);
        Assert.Null(result.ReferenceId);
        Assert.NotNull(result.ErrorMessage);
    }
}

public class SquareGatewayTests : IClassFixture<PaymentTestConfigurationFixture>
{
    private readonly SquareGatewayService _service;

    public SquareGatewayTests(PaymentTestConfigurationFixture fixture)
    {
        _service = new SquareGatewayService(fixture.SquareConfiguration);
    }

    [Fact]
    public async Task ProcessInvoicePaymentAsync_WithValidSquareNonce_ReturnsSuccess()
    {
        // Arrange
        var testAcademyId = Guid.NewGuid();
        decimal chargeAmount = 120.50m;
        string standardSuccessNonce = "cnon:card-nonce-ok"; // Official Square sandbox test string

        // Act
        var result = await _service.ProcessInvoicePaymentAsync(testAcademyId, chargeAmount, standardSuccessNonce);

        // Assert
        Assert.True(result.IsSuccess, $"Payment failed: {result.ErrorMessage}");
        Assert.StartsWith("SQ-", result.ReferenceId);
        Assert.Null(result.ErrorMessage);
    }

    [Fact]
    public async Task ProcessInvoicePaymentAsync_WithInvalidNonce_ReturnsFailure()
    {
        // Arrange
        var testAcademyId = Guid.NewGuid();
        decimal chargeAmount = 25.00m;
        string malformedNonce = "cnon:invalid-nonce-signature-format"; 

        // Act
        var result = await _service.ProcessInvoicePaymentAsync(testAcademyId, chargeAmount, malformedNonce);

        // Assert
        Assert.False(result.IsSuccess);
        Assert.Null(result.ReferenceId);
        Assert.NotNull(result.ErrorMessage);
    }
}