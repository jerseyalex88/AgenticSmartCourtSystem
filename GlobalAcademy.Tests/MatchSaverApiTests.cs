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

        //var payload = GetTestJwtTokenAsync(client).Result;

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

    [Fact]
    public async Task PlayerSmsWebhook_NaturalLanguageConfirm_UpdatesDatabaseStates()
    {
        var client = _factory.CreateClient();
        var uniqueFromNumber = "+15550199234";
        Guid proposedSlotId = Guid.NewGuid();

        // 1. ARRANGE: Query your active, live local database entities
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            // Clean house to prevent unique constraint or primary tracking collision blocks
            var existingQueues = await db.ShadowQueues.Where(q => q.PlayerPhoneNumber == uniqueFromNumber).ToListAsync();
            db.ShadowQueues.RemoveRange(existingQueues);
            await db.SaveChangesAsync();

            // STEP A: Fetch the first active available Court row currently stored in your system
            var liveCourt = await db.Courts.FirstOrDefaultAsync();
            if (liveCourt == null)
            {
                Assert.Fail("Database Context Prerequisite Failure: Your local PostgreSQL 'Courts' table is empty. Please run your seeder or create a court first.");
            }

            // STEP B: Bind variables straight onto the existing records extracted from your tables
            Guid targetAcademyId = liveCourt.AcademyId;
            Guid targetBranchId = liveCourt.BranchId;
            Guid targetCourtId = liveCourt.Id;

            // 2. INJECT SANBOX WORKFLOW MATRIX ITEMS BOUND TO REAL INFRASTRUCTURE IDs
            var mockQueueItem = new Models.ShadowQueue
            {
                Id = Guid.NewGuid(),
                AcademyId = targetAcademyId,
                PlayerName = "Serena Williams (Live Test)",
                PreferredWindow = "Morning Slots",
                IsResolved = false,
                PlayerPhoneNumber = uniqueFromNumber, // Target webhook connector
                ProposedSlotId = proposedSlotId,      // Target solution destination
                DispatchStatus = "AwaitingReply"
            };

            var mockBookingSlot = new Models.Booking
            {
                Id = proposedSlotId,
                AcademyId = targetAcademyId,
                BranchId = targetBranchId,   // FIXED: Pointing straight to your existing branch row
                CourtId = targetCourtId,     // FIXED: Pointing straight to your existing court row
                CourtName = liveCourt.Name,  // Inheriting actual layout naming
                SlotTime = DateTime.UtcNow.AddDays(1).Date.AddHours(9),
                IsAvailableSlot = true,
                BookingType = "Live Integration Test Row",
                DurationInMinutes = 60,
                PricePaid = 0.00m
            };

            db.ShadowQueues.Add(mockQueueItem);
            db.Bookings.Add(mockBookingSlot);
            
            await db.SaveChangesAsync();
        }

        // 3. ACT: Shoot the simulated incoming SMS payload text message packet into your controller
        var smsResponsePayload = new
        {
            FromNumber = uniqueFromNumber,
            Body = "YES" // Simulated confirmation response
        };

        var response = await client.PostAsJsonAsync("/api/aiorchestration/ai/match-saver/sms-webhook", smsResponsePayload);
        
        // 4. ASSERT: Confirm endpoints report clean operational validation
        Assert.True(response.IsSuccessStatusCode, "The live database SMS webhook gateway tracking endpoint returned an error code.");
        
        var responseBody = await response.Content.ReadAsStringAsync();
        Assert.Contains("CONFIRMED", responseBody); // Verifies string response pattern matching logic

        // 5. VERIFY LIVE POSTGRES STATE: Extract mutated rows to ensure updates committed perfectly
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var verifiedQueueItem = await db.ShadowQueues.FirstOrDefaultAsync(q => q.PlayerPhoneNumber == uniqueFromNumber);
            
            Assert.NotNull(verifiedQueueItem);
            // This guarantees your C# database code committed updates live to your tables
            Assert.True(verifiedQueueItem.IsResolved, "Database Error: IsResolved data byte did not flip to true inside your physical PostgreSQL table columns.");
        }
    }    

    private async Task<string> GetTestJwtTokenAsync(HttpClient client)
    {
        // First, register a new academy to obtain a fresh multi-tenant payload context
        var regModel = new { Email = $"director@londonvanguard.com", Password = "LondonPass123!", AcademyName = "Test Diagnostic Academy" };
        //var regRes = await client.PostAsJsonAsync("/api/auth/register-academy", regModel);
        
        // Now login to get the fresh token
        var loginModel = new { Email = regModel.Email, Password = regModel.Password };
        var loginRes = await client.PostAsJsonAsync("/api/auth/login", loginModel);
        
        var loginData = await loginRes.Content.ReadFromJsonAsync<LoginResponseDto>();
        return loginData!.Token;
    }

    private class LoginResponseDto { public string Token { get; set; } = string.Empty; }
}
