using System.Net;
using System.Net.Mail;
using System.Text;
using GlobalAcademy.Data;
using GlobalAcademy.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.DependencyInjection;

namespace GlobalAcademy.Services;

public class SmtpNotificationEngine : IEmailNotificationEngine
{
    private readonly SmtpSettings _smtpSettings;
    private readonly ApplicationDbContext _dbContext;
    private readonly IServiceScopeFactory _scopeFactory; 

    public SmtpNotificationEngine(IOptions<SmtpSettings> smtpSettings, ApplicationDbContext dbContext, IServiceScopeFactory scopeFactory)
    {
        _smtpSettings = smtpSettings.Value;
        _dbContext = dbContext;
        _scopeFactory = scopeFactory;
    }

    public async Task SendCourtReservationConfirmationAsync(
        string recipientEmail, 
        string recipientName, 
        Invoice invoice, 
        List<InvoiceLineItem> lineItems, 
        Guid academyId)
    {
        // 1. Asynchronously fetch Academy isolation parameters to safely inject branding data
        string academyName = "Smart Court OS Partner Academy";

        using (var scope = _scopeFactory.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var academy = await dbContext.Academies.FirstOrDefaultAsync(a => a.Id == academyId);
            if (academy != null)
            {
                academyName = academy.Name;
            }
        }

        // 2. Build the structural dynamic line item rows for the HTML template
        var itemsBuilder = new StringBuilder();
        foreach (var item in lineItems)
        {
            itemsBuilder.Append($@"
                <tr>
                    <td style='padding: 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-size: 13px; color: #334155;'>{item.ItemDescription}</td>
                    <td style='padding: 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-size: 13px; color: #334155; text-align: center;'>{item.Quantity}</td>
                    <td style='padding: 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-size: 13px; color: #1e293b; text-align: right; font-weight: bold;'>${item.UnitPrice:F2}</td>
                </tr>");
        }

        // 3. Compile the structured, cross-client responsive inline CSS HTML design layout
        string htmlBody = $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>Reservation Confirmed</title>
</head>
<body style='margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, ""Segoe UI"", Roboto, Helvetica, Arial, sans-serif;'>
    <table width='100%' border='0' cellspacing='0' cellpadding='0' style='background-color: #f8fafc; padding: 24px 12px;'>
        <tr>
            <td align='center'>
                <table width='100%' max-width='600px' border='0' cellspacing='0' cellpadding='0' style='max-width: 600px; background-color: #ffffff; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); text-align: left;'>
                    <!-- Brand Accent Header Block -->
                    <tr>
                        <td style='background-color: #7c3aed; padding: 24px; text-align: center;'>
                            <h1 style='margin: 0; font-size: 20px; font-weight: 900; color: #ffffff; text-transform: uppercase; tracking-wider: 0.05em;'>🎾 {academyName}</h1>
                            <p style='margin: 4px 0 0 0; font-size: 12px; color: #ddd6fe;'>Smart Court OS Confirmation Receipt</p>
                        </td>
                    </tr>
                    <!-- Core Narrative Body Section -->
                    <tr>
                        <td style='padding: 24px;'>
                            <h2 style='margin: 0 0 12px 0; font-size: 16px; font-weight: 800; color: #0f172a; text-transform: uppercase;'>Reservation Confirmed!</h2>
                            <p style='margin: 0 0 20px 0; font-size: 13px; color: #475569; line-height: 1.6;'>
                                Hello <strong>{recipientName}</strong>,<br>
                                Your digital player profile passport has successfully secured court times. Your booking allocations have been permanently committed to the schedule database.
                            </p>
                            
                            <!-- Invoice Identifier Badge -->
                            <div style='background-color: #f1f5f9; border-left: 4px solid #7c3aed; padding: 12px; margin-bottom: 20px; font-size: 12px; color: #334155;'>
                                <strong>Invoice ID:</strong> {invoice.InvoiceId}<br>
                                <strong>Issued Date:</strong> {invoice.CreatedAtUtc:yyyy-MM-dd HH:mm} UTC<br>
                                <strong>Status:</strong> <span style='color: #b45309; font-weight: bold;'>UNPAID</span>
                            </div>

                            <!-- Structured Table Matrix -->
                            <table width='100%' border='0' cellspacing='0' cellpadding='0' style='margin-bottom: 24px; border-collapse: collapse;'>
                                <thead>
                                    <tr style='background-color: #f8fafc;'>
                                        <th style='padding: 10px; border-bottom: 2px solid #e2e8f0; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; text-align: left;'>Allocation Description</th>
                                        <th style='padding: 10px; border-bottom: 2px solid #e2e8f0; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; text-align: center; width: 60px;'>Qty</th>
                                        <th style='padding: 10px; border-bottom: 2px solid #e2e8f0; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; text-align: right; width: 90px;'>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {itemsBuilder}
                                    <tr>
                                        <td colspan='2' style='padding: 16px 12px 12px 12px; text-align: right; font-size: 12px; font-weight: 800; color: #64748b; text-transform: uppercase;'>Total Due:</td>
                                        <td style='padding: 16px 12px 12px 12px; text-align: right; font-size: 16px; font-weight: 900; color: #7c3aed;'>${invoice.TotalAmount:F2}</td>
                                    </tr>
                                </tbody>
                            </table>

                            <!-- Interactive Call To Action Interface Link -->
                            <table width='100%' border='0' cellspacing='0' cellpadding='0'>
                                <tr>
                                    <td align='center' style='padding-top: 12px;'>
                                        <a href='http://localhost:5173/' style='display: inline-block; background-color: #7c3aed; color: #ffffff; font-weight: bold; font-size: 12px; text-transform: uppercase; tracking-wider: 0.05em; padding: 12px 24px; text-decoration: none; border-radius: 4px; box-shadow: 0 2px 4px rgba(124,58,237,0.3);'>Open Gateway & Complete Checkout</a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <!-- System Footer Node Container -->
                    <tr>
                        <td style='background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.4;'>
                            This is an automated operational system notification dispatched securely by Smart Court OS.<br>
                            &copy; {DateTime.UtcNow.Year} {academyName}. All entity rights reserved.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>";

        // 4. Construct the standard native cross-platform MailMessage package
        using var mailMessage = new MailMessage
        {
            From = new MailAddress(_smtpSettings.FromEmail, _smtpSettings.FromName),
            Subject = $"🎾 Booking Confirmation: {academyName}",
            Body = htmlBody,
            IsBodyHtml = true,
            BodyEncoding = Encoding.UTF8
        };
        
        mailMessage.To.Add(new MailAddress(recipientEmail, recipientName));

        // 5. Initialize the atomic SMTP client configuration bridge rules
        using var smtpClient = new SmtpClient(_smtpSettings.Host, _smtpSettings.Port)
        {
            Credentials = new NetworkCredential(_smtpSettings.Username, _smtpSettings.Password),
            EnableSsl = _smtpSettings.EnableSsl
        };

        // 6. Asynchronously execute the network mail delivery pass thread
        await smtpClient.SendMailAsync(mailMessage);
    }
}
