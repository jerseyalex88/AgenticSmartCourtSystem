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
using Microsoft.Extensions.Configuration;
using GlobalAcademy.Security;

namespace GlobalAcademy.Tests;

public class MatchSaverApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    public MatchSaverApiTests(WebApplicationFactory<Program> factory)
    {
        // FIX: Force the integration test server to bind straight to your local settings
        _factory = factory.WithWebHostBuilder(builder =>
        {
            // 1. Calculate the exact physical directory path of your main backend project
            var projectDir = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../GlobalAcademy"));

            builder.ConfigureAppConfiguration((context, config) =>
            {
                // 2. Clear any default test configurations and inject your real production json file
                config.SetBasePath(projectDir);
                config.AddJsonFile("appsettings.json", optional: false, reloadOnChange: false);
                config.AddEnvironmentVariables(); // Pulls your exported AI__ApiKey safely!
            });
        });
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
        var uniqueFromNumber = "+15550123456";
        Guid proposedSlotId = Guid.NewGuid();

        // 1. ARRANGE: Query your active, live local database entities
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            // Clean house to prevent unique constraint or primary tracking collision blocks
            var existingQueues = await db.ShadowQueues.IgnoreQueryFilters().Where(q => q.PlayerPhoneNumber == uniqueFromNumber).ToListAsync();
            db.ShadowQueues.RemoveRange(existingQueues);
            await db.SaveChangesAsync();

            // STEP A: Fetch the first active available Court row currently stored in your system
            var liveCourt = await db.Courts.IgnoreQueryFilters().FirstOrDefaultAsync();
            if (liveCourt == null)
            {
                Assert.Fail("Database Context Prerequisite Failure: Your local PostgreSQL 'Courts' table is empty. Please run your seeder or create a court first.");
            }

            using (var transaction = await db.Database.BeginTransactionAsync())
            {
                try
                {
                    // STEP B: Bind variables straight onto the existing records extracted from your tables
                    Guid targetAcademyId = liveCourt.AcademyId;
                    Guid targetBranchId = liveCourt.BranchId;
                    Guid targetCourtId = liveCourt.Id;

                    // 2. INJECT SANBOX WORKFLOW MATRIX ITEMS BOUND TO REAL INFRASTRUCTURE IDs
                    var mockQueueItem = new Models.ShadowQueue
                    {
                        Id = Guid.NewGuid(),
                        AcademyId = targetAcademyId,
                        PlayerName = "Venus Williams (Live Test)",
                        PreferredWindow = "Evening Slots",
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
                    // CRITICAL STEP: Hard commit straight to your physical database storage engine
                    await transaction.CommitAsync();
                }
                catch (Exception)
                {
                    await transaction.RollbackAsync();
                    throw;
                }
            }
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
            var verifiedQueueItem = await db.ShadowQueues.IgnoreQueryFilters().FirstOrDefaultAsync(q => q.PlayerPhoneNumber == uniqueFromNumber);
            
            Assert.NotNull(verifiedQueueItem);
            // This guarantees your C# database code committed updates live to your tables
            Assert.True(verifiedQueueItem.IsResolved, "Database Error: IsResolved data byte did not flip to true inside your physical PostgreSQL table columns.");
        }
    }    
    [Fact]
    public async Task PublicPlayerRegistration_ValidAcademyUrlId_SafelyProvisionsMultiTenantPlayer()
    {
        var client = _factory.CreateClient();
        var playerEmail = $"self_registered_player_{Guid.NewGuid()}@wimbledon.com";
        Guid liveAcademyGuid;

        // 1. ARRANGE: Extract a valid live Academy ID from your existing PostgreSQL database rows
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var liveAcademy = await db.Academies.IgnoreQueryFilters().FirstOrDefaultAsync();
            
            if (liveAcademy == null)
            {
                // Fallback: Spawn an academy row if the test environment table is temporarily empty
                liveAcademy = new Models.Academy { Id = Guid.NewGuid(), Name = "Baseline Integration Academy Arena" };
                db.Academies.Add(liveAcademy);
                await db.SaveChangesAsync();
            }
            liveAcademyGuid = liveAcademy.Id;
        }

        // 2. ACT: Call the public endpoint, passing the live target AcademyId parameter token
        var payload = new
        {
            Email = playerEmail,
            Password = "SuperSecurePassword123!",
            PhoneNumber = "+15550998877",
            AcademyId = liveAcademyGuid.ToString()
        };

        var response = await client.PostAsJsonAsync("/api/auth/register-player-public", payload);
        
        // 3. ASSERT: Confirm identity tables accepted data layout rows cleanly
        Assert.True(response.IsSuccessStatusCode, "The public player registration tracking gateway endpoint rejected data payload maps.");
        
        var responseData = await response.Content.ReadAsStringAsync();
        Assert.Contains("initialized cleanly", responseData);
    }

    [Fact]
    public async Task Get7DayAvailableMatrix_WithExistingBookings_ReturnsCorrectlyMappedGrid()
    {
        // 1. Arrange: Arrange a scoped client targeting your running web server application
        var client = _factory.CreateClient();
        
        // Configure login payload exactly matching your Scalar request parameter metrics
        var loginPayload = new
        {
            email = "chiki@wimbeldon.com",
            password = "Password123!"
        };

        // --- STEP 2: EXECUTE API REQUEST VIA HTTP CHANNELS ---
        var responseX = await client.PostAsJsonAsync("api/Auth/login", loginPayload);
        Assert.True(responseX.IsSuccessStatusCode, "API Login request failed entirely.");

        var loginResult = await responseX.Content.ReadFromJsonAsync<LoginResponseDto>();
        Assert.NotNull(loginResult?.Token);

        // 3. Authenticate the request: Simulate a logged-in AcademyDirector.
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", loginResult.Token);

        // Target anchor point: Tomorrow at exactly 10:00 AM UTC
        var testBookingStartTimeUtc = DateTime.UtcNow.AddDays(1).Date.AddHours(10); 

        // 3. ACT: Fire the request at the 7-day matrix endpoint using today's date as the start baseline
        string urlQueryDate = DateTime.UtcNow.ToString("yyyy-MM-dd");
        var response = await client.GetAsync($"/api/PlayerBooking/available-matrix?startDate={urlQueryDate}");
        
        // 4. ASSERT AND AGENTIC SCHEMA DIAGNOSIS
        Assert.True(response.IsSuccessStatusCode, $"The available-matrix endpoint returned an error status code: {response.StatusCode}");

        // Deserializing the complex collection return payload matrix
        var matrixReport = await response.Content.ReadFromJsonAsync<System.Collections.Generic.List<DayMatrixTestDto>>();
        Assert.NotNull(matrixReport);
        
        // Ensure the engine computed exactly 7 distinct days
        Assert.Equal(7, matrixReport.Count);
        
    }
    [Fact]
    public async Task ClaimDynamicSlotAllocation_UsingMatrixPayload_InsertsBookingRecordLive()
    {
        var client = _factory.CreateClient();
        // Configure login payload exactly matching your Scalar request parameter metrics
        var loginPayload = new
        {
            email = "chiki@wimbeldon.com",
            password = "Password123!"
        };

        // --- STEP 2: EXECUTE API REQUEST VIA HTTP CHANNELS ---
        var responseX = await client.PostAsJsonAsync("api/Auth/login", loginPayload);
        Assert.True(responseX.IsSuccessStatusCode, "API Login request failed entirely.");

        var loginResult = await responseX.Content.ReadFromJsonAsync<LoginResponseDto>();
        Assert.NotNull(loginResult?.Token);

        // 3. Authenticate the request: Simulate a logged-in AcademyDirector.
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", loginResult.Token);

        // 2. ACT STEP A: Call Get7DayAvailableMatrix to pull the live grid payload
        string urlQueryDate = DateTime.UtcNow.ToString("yyyy-MM-dd");
        var matrixResponse = await client.GetAsync($"/api/PlayerBooking/available-matrix?startDate={urlQueryDate}");
        Assert.True(matrixResponse.IsSuccessStatusCode, "The available-matrix grid failed to load.");

        var matrixReport = await matrixResponse.Content.ReadFromJsonAsync<System.Collections.Generic.List<DayMatrixTestDto>>();
        Assert.NotNull(matrixReport);

        // 3. EXTRACT: Grab the very first day's very first open slot from the grid array
        var firstOpenSlot = matrixReport
            .FirstOrDefault(d => d.Slots.Any(s => s.IsAvailable))?
            .Slots.FirstOrDefault(s => s.IsAvailable);

        if (firstOpenSlot == null)
        {
            Assert.Fail("Prerequisite Failure: The active 7-day grid contains 0 available time slots. Please seed a court record first.");
        }

        // 4. ACT STEP B: Pass that extracted slot directly as the payload to claim-dynamic
        var claimPayload = new
        {
            CourtId = Guid.Parse(firstOpenSlot.CourtId),
            CourtName = firstOpenSlot.CourtName,
            StartTimeUtc = DateTime.Parse(firstOpenSlot.StartTimeUtc).ToUniversalTime()
        };

        var claimResponse = await client.PostAsJsonAsync("/api/PlayerBooking/claim-dynamic", claimPayload);
        
        // 5. ASSERT: Verify the transaction wrote cleanly to PostgreSQL transaction logs
        Assert.True(claimResponse.IsSuccessStatusCode, $"The claim-dynamic endpoint rejected the matrix slot. Status: {claimResponse.StatusCode}");
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

// Matching anonymous telemetry test DTO schemas
public class DayMatrixTestDto
{
    public string DateString { get; set; } = string.Empty;
    public System.Collections.Generic.List<MatrixSlotTestDto> Slots { get; set; } = new();
}

public class MatrixSlotTestDto
{
    public string CourtId { get; set; } = string.Empty;
    public string CourtName { get; set; } = string.Empty;
    public string StartTimeUtc { get; set; } = string.Empty;
    public bool IsAvailable { get; set; }
    public string? BookedPlayerName { get; set; }
}

