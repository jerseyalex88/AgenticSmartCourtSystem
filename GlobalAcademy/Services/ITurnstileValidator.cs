using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace GlobalAcademy.Services;

public interface ITurnstileValidator
{
    Task<bool> IsHumanAsync(string? token);
}

public class TurnstileValidator : ITurnstileValidator
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;

    public TurnstileValidator(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _configuration = configuration;
    }
    public async Task<bool> IsHumanAsync(string? token)
    {
        if (string.IsNullOrWhiteSpace(token))
            return false;

        var secretKey =
            _configuration["TurnstileSettings:SecretKey"];

        if (string.IsNullOrWhiteSpace(secretKey))
            return false;

        try
        {
            var payload = new FormUrlEncodedContent(
                new Dictionary<string, string>
                {
                    ["secret"] = secretKey,
                    ["response"] = token
                });

            var response = await _httpClient.PostAsync(
                _configuration["TurnstileSettings:VerificationUrl"] ?? "https://challenges.cloudflare.com/turnstile/v0/siteverify",
                payload);

            var rawContent =
                await response.Content.ReadAsStringAsync();

            // Console.WriteLine(
            //     $"[DEBUG] Turnstile response: {rawContent}");

            if (!response.IsSuccessStatusCode)
                return false;

            var result =
                JsonSerializer.Deserialize<TurnstileResponse>(
                    rawContent,
                    new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    });

            return result?.Success ?? false;
        }
        catch (Exception ex)
        {
            Console.WriteLine(
                $"[TURNSTILE ERROR] {ex.Message} {ex.StackTrace} {ex.InnerException}");

            return false;
        }
    }
    private class TurnstileResponse
    {
        [JsonPropertyName("success")]
        public bool Success { get; set; }
    }
}
