using System;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using GlobalAcademy.Data;
using GlobalAcademy.Models;
using Microsoft.EntityFrameworkCore;

namespace GlobalAcademy.Tests;

public class MatchSaverApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public MatchSaverApiTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task SeedTestData_DetailedDiagnostic_ReturnsSuccessOrExposesExactDbSchema()
    {
        // 1. Arrange: Arrange a scoped client targeting your running web server application
        var client = _factory.CreateClient();
        
        // Configure login payload exactly matching your Scalar request parameter metrics
        var loginPayload = new
        {
            email = "director@londonvanguard.com",
            password = "LondonPass123!"
        };

        // --- STEP 2: EXECUTE API REQUEST VIA HTTP CHANNELS ---
        var responseX = await client.PostAsJsonAsync("api/Auth/login", loginPayload);
        Assert.True(responseX.IsSuccessStatusCode, "API Login request failed entirely.");

        var loginResult = await responseX.Content.ReadFromJsonAsync<LoginResponseDto>();
        Assert.NotNull(loginResult?.Token);

        // 3. Authenticate the request: Simulate a logged-in AcademyDirector.
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", loginResult.Token);

        // 4. Act: Hit the specific endpoint throwing the 23503 error
        try
        {
            var response = await client.PostAsync("/api/aiorchestration/ai/match-saver/seed-test-data", null);
            
            // 5. Assert & Diagnose
            if (response.StatusCode != HttpStatusCode.OK)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                Console.WriteLine($"🚨 API Failed with status {response.StatusCode}. Content: {errorContent}");
            }

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"💥 Exception Caught During API Call: {ex}");
            throw;
        }
    }

    [Fact]
    public async Task MatchSaverRun_DetailedDiagnostic_ReturnsSuccessOrExposesExactDbSchema()
    {
        // 1. Arrange: Arrange a scoped client targeting your running web server application
        var client = _factory.CreateClient();
        
        // Configure login payload exactly matching your Scalar request parameter metrics
        var loginPayload = new
        {
            email = "director@londonvanguard.com",
            password = "LondonPass123!"
        };

        // --- STEP 2: EXECUTE API REQUEST VIA HTTP CHANNELS ---
        var responseX = await client.PostAsJsonAsync("api/Auth/login", loginPayload);
        Assert.True(responseX.IsSuccessStatusCode, "API Login request failed entirely.");

        var loginResult = await responseX.Content.ReadFromJsonAsync<LoginResponseDto>();
        Assert.NotNull(loginResult?.Token);

        // 3. Authenticate the request: Simulate a logged-in AcademyDirector.
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", loginResult.Token);

        // 4. Act: Hit the specific endpoint throwing the 23503 error
        try
        {
            var response = await client.PostAsync("/api/aiorchestration/ai/match-saver/run", null);
            
            // 5. Assert & Diagnose
            if (response.StatusCode != HttpStatusCode.OK)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                Console.WriteLine($"🚨 API Failed with status {response.StatusCode}. Content: {errorContent}");
            }

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"💥 Exception Caught During API Call: {ex}");
            throw;
        }
    }

    private async Task<string> GetTestJwtTokenAsync(HttpClient client)
    {
        // First, register a new academy to obtain a fresh multi-tenant payload context
        var regModel = new { Email = $"test_director_{Guid.NewGuid()}@academy.com", Password = "SecurePassword123!", AcademyName = "Test Diagnostic Academy" };
        var regRes = await client.PostAsJsonAsync("/api/auth/register-academy", regModel);
        
        // Now login to get the fresh token
        var loginModel = new { Email = regModel.Email, Password = regModel.Password };
        var loginRes = await client.PostAsJsonAsync("/api/auth/login", loginModel);
        
        var loginData = await loginRes.Content.ReadFromJsonAsync<LoginResponseDto>();
        return loginData!.Token;
    }

    private class LoginResponseDto { public string Token { get; set; } = string.Empty; }
}
