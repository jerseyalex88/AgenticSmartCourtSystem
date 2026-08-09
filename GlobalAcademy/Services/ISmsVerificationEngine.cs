using System.Collections.Concurrent;

namespace GlobalAcademy.Services;

public interface ISmsVerificationEngine
{
    Task<string> GenerateAndRecordVerificationPinAsync(string userId, string phoneNumber);
    Task<bool> ValidateActivePinAsync(string userId, string inputCode);
}

public class SandboxSmsVerificationEngine : ISmsVerificationEngine
{
    // Thread-safe in-memory cache layer tracking: Key = UserId, Value = (PinCode, ExpirationTimestamp)
    private static readonly ConcurrentDictionary<string, (string Pin, DateTime ExpiresAt)> _pinCache 
        = new ConcurrentDictionary<string, (string Pin, DateTime ExpiresAt)>();

    public Task<string> GenerateAndRecordVerificationPinAsync(string userId, string phoneNumber)
    {
        // 1. Generate a random, high-readability 4-digit verification integer string
        var random = new Random();
        string generatedPin = random.Next(1000, 9999).ToString();

        // 2. Enforce a standard short-lived 5-minute security lifetime window
        var expiration = DateTime.UtcNow.AddMinutes(5);
        _pinCache[userId] = (generatedPin, expiration);

        // 3. 🚀 THE FREE DEVELOPER SANDBOX ALERT MATRIX
        // This simulates an active cellular carrier dispatch completely inside your terminal!
        Console.WriteLine("\n=========================================================================");
        Console.WriteLine("📱 [SANDBOX TELEPHONY CARRIER SERVICE DISPATCH ALERT]");
        Console.WriteLine($"TARGET NUMBER DETECTED : {phoneNumber}");
        Console.WriteLine($"USER IDENTITY LINK REQ : {userId}");
        Console.WriteLine($"YOUR booking VALIDATION PIN CODE IS : {generatedPin}");
        Console.WriteLine("STATUS                 : ACTIVE // DISPATCH SUCCESS (LOCAL SANDBOX TERMINAL)");
        Console.WriteLine("=========================================================================\n");

        return Task.FromResult(generatedPin);
    }

    public Task<bool> ValidateActivePinAsync(string userId, string inputCode)
    {
        if (string.IsNullOrWhiteSpace(inputCode)) return Task.FromResult(false);

        // Attempt to extract the pending verification window from the cache matrix
        if (_pinCache.TryGetValue(userId, out var activeRecord))
        {
            // Fail secure if the 5-minute lifetime parameter has ticked past expired bounds
            if (DateTime.UtcNow > activeRecord.ExpiresAt)
            {
                _pinCache.TryRemove(userId, out _);
                return Task.FromResult(false);
            }

            // Verify a perfect textual string match match
            if (activeRecord.Pin == inputCode.Trim())
            {
                _pinCache.TryRemove(userId, out _); // Clean up used cache keys instantly
                return Task.FromResult(true);
            }
        }

        return Task.FromResult(false);
    }
}