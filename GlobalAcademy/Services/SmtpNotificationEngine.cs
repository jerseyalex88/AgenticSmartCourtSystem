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
    private readonly IConfiguration _configuration;

    public SmtpNotificationEngine(IOptions<SmtpSettings> smtpSettings, ApplicationDbContext dbContext, IServiceScopeFactory scopeFactory, IConfiguration configuration)
    {
        _smtpSettings = smtpSettings.Value;
        _dbContext = dbContext;
        _scopeFactory = scopeFactory;
        _configuration = configuration;
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

        // Console.WriteLine($"[DEBUG] _smtpSettings value: fromemail {_smtpSettings.FromEmail} fromname {_smtpSettings.FromName} host {_smtpSettings.Host} port {_smtpSettings.Port} username {_smtpSettings.Username} password {_smtpSettings.Password} enablessl {_smtpSettings.EnableSsl}");

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
    public async Task SendPaymentReceiptAsync(
    string recipientEmail,
    string recipientName,
    Invoice invoice,
    List<InvoiceLineItem> lineItems,
    decimal amountPaid,
    string transactionReference,
    string gatewayName,
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

        // 2. Build the structural table rows detailing item allocations
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

        // 3. Compile the structured, green-accented (Successful Payment) inline CSS HTML layout
        string htmlBody = $@"
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset='utf-8'>
        <meta name='viewport' content='width=device-width, initial-scale=1.0'>
        <title>Payment Receipt</title>
    </head>
    <body style='margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, ""Segoe UI"", Roboto, Helvetica, Arial, sans-serif;'>
        <table width='100%' border='0' cellspacing='0' cellpadding='0' style='background-color: #f8fafc; padding: 24px 12px;'>
            <tr>
                <td align='center'>
                    <table width='100%' max-width='600px' border='0' cellspacing='0' cellpadding='0' style='max-width: 600px; background-color: #ffffff; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); text-align: left;'>
                        <!-- Financial Accent Header Block -->
                        <tr>
                            <td style='background-color: #10b981; padding: 24px; text-align: center;'>
                                <h1 style='margin: 0; font-size: 20px; font-weight: 900; color: #ffffff; text-transform: uppercase; letter-spacing: 0.05em;'>💳 {academyName}</h1>
                                <p style='margin: 4px 0 0 0; font-size: 12px; color: #d1fae5;'>Payment Transaction Receipt</p>
                            </td>
                        </tr>
                        <!-- Narrative Body Section -->
                        <tr>
                            <td style='padding: 24px;'>
                                <h2 style='margin: 0 0 12px 0; font-size: 16px; font-weight: 800; color: #0f172a; text-transform: uppercase;'>Thank you for your payment!</h2>
                                <p style='margin: 0 0 20px 0; font-size: 13px; color: #475569; line-height: 1.6;'>
                                    Hello <strong>{recipientName}</strong>,<br>
                                    Your electronic checkout transaction completed successfully. The associated invoice balance has been credited, and your reservation status is fully confirmed.
                                </p>
                                
                                <!-- Transaction Details Block -->
                                <div style='background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 12px; margin-bottom: 20px; font-size: 12px; color: #14532d;'>
                                    <strong>Invoice Reference:</strong> {invoice.InvoiceId}<br>
                                    <strong>Transaction ID:</strong> <span style='font-family: monospace;'>{transactionReference}</span><br>
                                    <strong>Payment Method:</strong> {gatewayName}<br>
                                    <strong>Date Settled:</strong> {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC<br>
                                    <strong>Status:</strong> <span style='color: #166534; font-weight: bold;'>PAID / SETTLED</span>
                                </div>

                                <!-- Settled Items Table Matrix -->
                                <table width='100%' border='0' cellspacing='0' cellpadding='0' style='margin-bottom: 24px; border-collapse: collapse;'>
                                    <thead>
                                        <tr style='background-color: #f8fafc;'>
                                            <th style='padding: 10px; border-bottom: 2px solid #e2e8f0; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; text-align: left;'>Item Settled</th>
                                            <th style='padding: 10px; border-bottom: 2px solid #e2e8f0; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; text-align: center; width: 60px;'>Qty</th>
                                            <th style='padding: 10px; border-bottom: 2px solid #e2e8f0; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; text-align: right; width: 90px;'>Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {itemsBuilder}
                                        <tr>
                                            <td colspan='2' style='padding: 16px 12px 12px 12px; text-align: right; font-size: 12px; font-weight: 800; color: #64748b; text-transform: uppercase;'>Amount Paid:</td>
                                            <td style='padding: 16px 12px 12px 12px; text-align: right; font-size: 16px; font-weight: 900; color: #10b981;'>${amountPaid:F2}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </td>
                        </tr>
                        <!-- Footer Node Container -->
                        <tr>
                            <td style='background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.4;'>
                                This transaction documentation confirms financial settlement within Smart Court OS.<br>
                                &copy; {DateTime.UtcNow.Year} {academyName}. All entity rights reserved.
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>";

        // 4. Construct and configure the native MailMessage package
        // string cleanFromEmail = string.IsNullOrEmpty(_smtpSettings.FromEmail) ? "billing@smartcourtos.com" : _smtpSettings.FromEmail;
        // string cleanToEmail = string.IsNullOrEmpty(recipientEmail) ? "player-billing-diagnostic@gmail.com" : recipientEmail;

        using var mailMessage = new MailMessage
        {
            From = new MailAddress(_smtpSettings.FromEmail, _smtpSettings.FromName),
            Subject = $"🧾 Payment Receipt: {academyName}",
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
    public async Task SendWelcomeOnboardingEmailAsync(
    string recipientEmail,
    string recipientName,
    Guid academyId)
    {
        // 1. Asynchronously fetch Academy parameters to inject custom multi-tenant branding
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

        // 2. Compile the high-fidelity, cross-client compatible HTML layout
        string htmlBody = $@"
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset='utf-8'>
        <meta name='viewport' content='width=device-width, initial-scale=1.0'>
        <title>Welcome to the Academy</title>
    </head>
    <body style='margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, ""Segoe UI"", Roboto, Helvetica, Arial, sans-serif;'>
        <table width='100%' border='0' cellspacing='0' cellpadding='0' style='background-color: #f8fafc; padding: 24px 12px;'>
            <tr>
                <td align='center'>
                    <table width='100%' max-width='600px' border='0' cellspacing='0' cellpadding='0' style='max-width: 600px; background-color: #ffffff; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); text-align: left;'>
                        <!-- Brand Accent Header Block -->
                        <tr>
                            <td style='background-color: #7c3aed; padding: 32px 24px; text-align: center;'>
                                <h1 style='margin: 0; font-size: 24px; font-weight: 900; color: #ffffff; text-transform: uppercase; letter-spacing: 0.05em;'>✨ Welcome to {academyName}</h1>
                                <p style='margin: 6px 0 0 0; font-size: 13px; color: #ddd6fe;'>Your Player Account Passport is Active</p>
                            </td>
                        </tr>
                        <!-- Core Narrative Body Section -->
                        <tr>
                            <td style='padding: 32px 24px;'>
                                <h2 style='margin: 0 0 12px 0; font-size: 18px; font-weight: 800; color: #0f172a; text-transform: uppercase;'>Your Profile is Provisioned!</h2>
                                <p style='margin: 0 0 24px 0; font-size: 14px; color: #475569; line-height: 1.6;'>
                                    Hello <strong>{recipientName}</strong>,<br><br>
                                    We are thrilled to welcome you to <strong>{academyName}</strong>. Your account has been securely verified and linked to our digital facility gateway interface. 
                                </p>
                                
                                <p style='margin: 0 0 20px 0; font-size: 14px; color: #0f172a; font-weight: bold;'>
                                    Here is what you can unlock right now using Smart Court OS:
                                </p>

                                <!-- Onboarding Feature Grid -->
                                <table width='100%' border='0' cellspacing='0' cellpadding='0' style='margin-bottom: 28px;'>
                                    <tr>
                                        <td style='padding: 0 0 16px 0; vertical-align: top;'>
                                            <span style='font-size: 18px; margin-right: 8px;'>📅</span>
                                        </td>
                                        <td style='padding: 0 0 16px 0;'>
                                            <strong style='font-size: 13px; color: #0f172a;'>Real-Time Court Booking Matrix</strong><br>
                                            <span style='font-size: 12px; color: #64748b;'>Instantly view court slot vacancies and claim dynamic allocations instantly.</span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style='padding: 0 0 16px 0; vertical-align: top;'>
                                            <span style='font-size: 18px; margin-right: 8px;'>🤖</span>
                                        </td>
                                        <td style='padding: 0 0 16px 0;'>
                                            <strong style='font-size: 13px; color: #0f172a;'>Conversational AI Assistant</strong><br>
                                            <span style='font-size: 12px; color: #64748b;'>Chat naturally with our built-in scheduler agent to secure court times using semantic plugins.</span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style='padding: 0 0 16px 0; vertical-align: top;'>
                                            <span style='font-size: 18px; margin-right: 8px;'>💳</span>
                                        </td>
                                        <td style='padding: 0 0 16px 0;'>
                                            <strong style='font-size: 13px; color: #0f172a;'>Unified Financial Ledger</strong><br>
                                            <span style='font-size: 12px; color: #64748b;'>Track statement balances, view open invoices, and settle fees via encrypted Braintree/Square checkouts.</span>
                                        </td>
                                    </tr>
                                </table>

                                <!-- Interactive Button Interface Link -->
                                <table width='100%' border='0' cellspacing='0' cellpadding='0'>
                                    <tr>
                                        <td align='center' style='padding: 12px 0;'>
                                            <a href='http://localhost:5173/player-gateway?academyId={academyId}' style='display: inline-block; background-color: #7c3aed; color: #ffffff; font-weight: bold; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; padding: 14px 28px; text-decoration: none; border-radius: 4px; box-shadow: 0 4px 6px rgba(124,58,237,0.25);'>Access Player Dashboard</a>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <!-- System Footer Node Container -->
                        <tr>
                            <td style='background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.5;'>
                                You received this email because an account was registered with your address under our tenant configuration boundaries.<br>
                                &copy; {DateTime.UtcNow.Year} {academyName}. All entity rights reserved.
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>";

        using var mailMessage = new MailMessage
        {
            From = new MailAddress(_smtpSettings.FromEmail, _smtpSettings.FromName),
            Subject = $"✨ Account Activated: Welcome to {academyName}!",
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
    private string GetBaseUrl()
    {
        // =========================================================================
        // 🚀 PRODUCTION FALLBACK: EXTRACT CLIENT BASE FROM ALLOWED ORIGINS DYNAMICALLY
        // =========================================================================
        string baseUrl = _smtpSettings.ClientBaseUrl;

        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            // Scrape your global Program.cs AllowedOrigins array directly from configuration context
            var origins = _configuration.GetSection("AllowedOrigins").Get<string[]>();
            
            // Fall back safely to the first web-facing host index item if initialized, else loopback ports
            baseUrl = (origins != null && origins.Length > 0) ? origins[0] : "http://localhost:5173";
        }

        baseUrl = baseUrl.TrimEnd('/');
        return baseUrl;
    }
    public async Task SendPasswordResetLinkEmailAsync(
        string recipientEmail,
        string resetToken,
        Guid academyId)
    {
        string academyName = "Smart Court OS Partner Academy";
        using (var scope = _scopeFactory.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var academy = await dbContext.Academies.FirstOrDefaultAsync(a => a.Id == academyId);
            if (academy != null) academyName = academy.Name;
        }

        // Escaping parameters safely to ensure URL query strings do not break across mail servers
        string encodedToken = Uri.EscapeDataString(resetToken);
        string encodedEmail = Uri.EscapeDataString(recipientEmail);
        string dynamicUrl = $"{GetBaseUrl()}/reset-password?token={encodedToken}&email={encodedEmail}&academyId={academyId}";

        string htmlBody = $@"
    <!DOCTYPE html>
    <html>
    <head><meta charset='utf-8'><title>Password Reset Request</title></head>
    <body style='margin:0; padding:0; background-color:#ffffff; font-family:sans-serif; color:#1e293b;'>
        <table width='100%' border='0' cellspacing='0' cellpadding='0' style='padding:20px 0;'>
            <tr>
                <td align='center'>
                    <table width='100%' max-width='550px' border='0' cellspacing='0' cellpadding='0' style='max-width:550px; padding:20px; border:1px solid #e2e8f0; border-radius:8px;'>
                        <tr>
                            <td style='padding-bottom:20px; border-bottom:2px solid #7c3aed;'>
                                <h2 style='margin:0; font-size:18px; color:#7c3aed; text-transform:uppercase;'>🎾 {academyName} Account Protection</h2>
                            </td>
                        </tr>
                        <tr>
                            <td style='padding:20px 0;'>
                                <p style='font-size:14px; line-height:1.5;'>Hello,</p>
                                <p style='font-size:14px; line-height:1.5;'>
                                    We received a request to reset the login security credentials for the profile account linked to this email address. This recovery token link is active for the next 2 hours.
                                </p>
                                <p style='font-size:14px; line-height:1.5;'>
                                    If you did not initiate this security query, you can safely ignore this email notification—your current password string will remain fully encrypted and secure.
                                </p>
                                <div style='margin:24px 0; padding:12px; background-color:#f1f5f9; border:1px dashed #cbd5e1; border-radius:4px; text-align:center; font-family:monospace; font-size:12px; color:#334155;'>
                                    Copy and paste this secure path link into your browser to update your credentials:<br>
                                    <strong>{dynamicUrl}</strong>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td style='border-top:1px solid #e2e8f0; padding-top:16px; text-align:center; font-size:11px; color:#94a3b8;'>
                                This is an automated operational account security update dispatched by Smart Court OS.<br>
                                &copy; {DateTime.UtcNow.Year} {academyName}. All rights reserved.
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>";

        string cleanFromEmail = string.IsNullOrEmpty(_smtpSettings.FromEmail) ? "security@smartcourtos.com" : _smtpSettings.FromEmail;

        using var mailMessage = new MailMessage
        {
            From = new MailAddress(cleanFromEmail, string.IsNullOrEmpty(_smtpSettings.FromName) ? "SmartCourt Vault" : _smtpSettings.FromName),
            Subject = $"🔐 Password Reset Verification: {academyName}",
            Body = htmlBody,
            IsBodyHtml = true,
            BodyEncoding = Encoding.UTF8
        };
        
        mailMessage.To.Add(new MailAddress(recipientEmail, "Valued Player"));

        using var smtpClient = new SmtpClient(_smtpSettings.Host, _smtpSettings.Port)
        {
            Credentials = new NetworkCredential(_smtpSettings.Username, _smtpSettings.Password),
            EnableSsl = _smtpSettings.EnableSsl
        };

        await smtpClient.SendMailAsync(mailMessage);
    }
}
