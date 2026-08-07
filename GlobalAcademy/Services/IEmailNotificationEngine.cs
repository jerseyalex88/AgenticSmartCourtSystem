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
}
