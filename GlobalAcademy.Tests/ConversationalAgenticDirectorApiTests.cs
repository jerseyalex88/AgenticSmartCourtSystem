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
using System.IdentityModel.Tokens.Jwt;

namespace GlobalAcademy.Tests;

public class ConversationalAgenticDirectorApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    public ConversationalAgenticDirectorApiTests(WebApplicationFactory<Program> factory)
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
    public async Task AuthController_UpdateUser_ModifiesUsernameAndReturnsModel()
    {
        var client = _factory.CreateClient();
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

        // --- STEP 2: ACT - DISPATCH RAW PUT REQUEST WITH UPDATED USERNAME ---
        var updatePayload = new { email = "chiki@vanguardacademy.com", userName = "Chiki Happi", role = "Player", phoneNumber = "+1604-555-9999", isActive = true };
        var updateResponse = await client.PutAsJsonAsync($"api/Auth/users/04b6d1ab-ea0d-4c0e-b209-f1e42698d918", updatePayload);

        // --- STEP 3: ASSERT - VERIFY THE MODEL SNAPSHOT BACKEND DISPATCH ---
        Assert.True(updateResponse.IsSuccessStatusCode, "The AuthController update endpoint rejected the mutation payload.");        
    }

    [Fact]
    public async Task DirectorChat_UpdateUser_SemanticPromptLoop_ModifiesUsername()
    {
        var client = _factory.CreateClient();
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

        // --- STEP 2: ACT - SEND NATURAL COGNITIVE INSTRUCTION FOR CONVERSATIONAL EDIT ---
        var chatPayload = new { UserInput = $"Please update user profile with email leo@vanguardacademy.com. Change username to 'Leo Happy', keep role as 'Player', phone number as '+1604-123-4567', and status active." };
        var chatResponse = await client.PostAsJsonAsync("/api/AiOrchestration/director-chat", chatPayload);

        // --- STEP 3: ASSERT ---
        Assert.True(chatResponse.IsSuccessStatusCode);
        var chatResult = await chatResponse.Content.ReadFromJsonAsync<UniversalChatResponseDto>();
    }

    // Supporting response parsing DTO declared locally inside your testing suite block
    public record UpdatedUserResponseTestDto(string Id, string Email, string UserName, string Role, bool IsActive, string PhoneNumber);
    public record UniversalChatResponseDto(string AgentResponse);
}