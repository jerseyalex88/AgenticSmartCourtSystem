using GlobalAcademy.Data;
using GlobalAcademy.Models;

namespace GlobalAcademy.Services;

public interface IEmailNotificationEngine
{
    Task SendCourtReservationConfirmationAsync(
        string recipientEmail, 
        string recipientName, 
        Invoice invoice, 
        List<InvoiceLineItem> lineItems, 
        Guid academyId);
    Task SendPaymentReceiptAsync(
        string recipientEmail,
        string recipientName,
        Invoice invoice,
        List<InvoiceLineItem> lineItems,
        decimal amountPaid,
        string transactionReference,
        string gatewayName,
        Guid academyId);
    Task SendWelcomeOnboardingEmailAsync(
        string recipientEmail,
        string recipientName,
        Guid academyId);
}
