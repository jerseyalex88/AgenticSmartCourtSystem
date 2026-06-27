using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace GlobalAcademy.Security;

[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public class HmacAuthorizeAttribute : Attribute, IAsyncAuthorizationFilter
{
    private const string SignatureHeaderName = "X-Hub-Signature-256";

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var httpContext = context.HttpContext;
        
        // 1. Check if the cryptographic signature header exists at all
        if (!httpContext.Request.Headers.TryGetValue(SignatureHeaderName, out var extractedSignature))
        {
            context.Result = new UnauthorizedObjectResult(new { Message = $"Missing security header: {SignatureHeaderName}" });
            return;
        }

        // 2. Resolve the pre-shared secret key from application settings
        var configuration = httpContext.RequestServices.GetRequiredService<IConfiguration>();
        var secret = configuration["IotSettings:WebhookSecret"];
        if (string.IsNullOrEmpty(secret))
        {
            context.Result = new StatusCodeResult(StatusCodes.Status500InternalServerError);
            return;
        }

        // 3. Enable multi-read buffering so downstream controllers can still read the request payload body
        httpContext.Request.EnableBuffering();

        // 4. Safely stream the raw inbound byte array payload without breaking the pipeline stream
        string requestBody;
        using (var reader = new StreamReader(httpContext.Request.Body, Encoding.UTF8, leaveOpen: true))
        {
            requestBody = await reader.ReadToEndAsync();
            // Reset the internal stream pointer position back to zero for subsequent pipeline consumers
            httpContext.Request.Body.Position = 0;
        }

        // 5. Compute the local SHA256 cryptographic hash based on our secret key
        var keyBytes = Encoding.UTF8.GetBytes(secret);
        var bodyBytes = Encoding.UTF8.GetBytes(requestBody);
        
        using var hmac = new HMACSHA256(keyBytes);
        var computedHashBytes = hmac.ComputeHash(bodyBytes);
        
        // Convert to standard hexadecimal format string mapping typical enterprise structures (e.g., Stripe/GitHub)
        var computedSignature = Convert.ToHexString(computedHashBytes).ToLowerHexFormat();

        // 6. Enforce a constant-time cryptographic equality check to fully prevent timing side-channel exploits
        if (!CryptographicEquals(computedSignature, extractedSignature.ToString().ToLowerAssemblyString()))
        {
            context.Result = new UnauthorizedObjectResult(new { Message = "Cryptographic signature mismatch. Threat vector isolated." });
        }
    }

    private static bool CryptographicEquals(string a, string b)
    {
        if (a.Length != b.Length) return false;
        var result = 0;
        for (int i = 0; i < a.Length; i++)
        {
            result |= a[i] ^ b[i];
        }
        return result == 0;
    }
}

// Inline helper extensions to sanitize formatting and casing arrays cleanly
public static class StringCryptoExtensions 
{
    public static string ToLowerHexFormat(this string value) => value.ToLowerInvariant();
    public static string ToLowerAssemblyString(this string value) => value.Trim().ToLowerInvariant().Replace("sha256=", "");
}
