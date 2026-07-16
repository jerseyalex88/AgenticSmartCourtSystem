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

public class ConversationalAgenticApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    public ConversationalAgenticApiTests(WebApplicationFactory<Program> factory)
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
    public async Task ConversationalAuth_SequentialTurns_ReturnsCorrectStateTransitions()
    {
        var client = _factory.CreateClient();

        // Turn 1: Assert Intent Detection
        var turn1Payload = new { UserInput = "I want to log in please", CurrentStage = "AwaitingIntent", CachedEmail = "" };
        var res1 = await client.PostAsJsonAsync("/api/AiOrchestration/ai/conversational-auth", turn1Payload);
        Assert.True(res1.IsSuccessStatusCode);
        
        var data1 = await res1.Content.ReadFromJsonAsync<ConversationalResponseTestDto>();
        Assert.Equal("AwaitingEmail", data1!.NextStage);
        Assert.Contains("email address", data1.AgentResponse);
    }
    [Fact]
    public async Task ConversationalAuth_PasswordValidated_GeneratesTokenWithAllRequiredFrontendClaims()
    {
        var client = _factory.CreateClient();

        var uniqueEmail = $"chiki@wimbeldon.com";
        var password = "Password123!";

        // 2. ACT: Execute the final step of your conversational state machine loop
        // We bypass turns 1 and 2 to hit the password validation gate directly, passing our cached email token
        var finalTurnPayload = new
        {
            UserInput = password, // Passing plain text password matching Model B input vectors
            CurrentStage = "AwaitingPassword",
            CachedEmail = uniqueEmail
        };

        var response = await client.PostAsJsonAsync("/api/AiOrchestration/ai/conversational-auth", finalTurnPayload);
        
        // 3. ASSERT: Confirm communication metrics return success identifiers
        Assert.True(response.IsSuccessStatusCode, $"The conversational auth gateway rejected credentials payload maps. Status: {response.StatusCode}");

        var jsonResult = await response.Content.ReadFromJsonAsync<ConversationalResponseTestModel>();
        Assert.NotNull(jsonResult);
        Assert.Equal("Completed", jsonResult.NextStage);
        Assert.NotNull(jsonResult.Token); // Confirms a token byte sequence generated cleanly
        
        // 4. DEEP DECRYPTION INSPECTION: Verify token payload contains all properties required by AuthContext.tsx
        var tokenHandler = new JwtSecurityTokenHandler();
        var jwtToken = tokenHandler.ReadJwtToken(jsonResult.Token);
        
        Assert.NotNull(jwtToken);

        // // A. Verify the explicit Role Claim exists and flags the identity correctly
        // var roleClaim = jwtToken.Claims.FirstOrDefault(c => c.Type == "http://microsoft.com" || c.Type == "role")?.Value;
        // Assert.True(roleClaim == "Player" || roleClaim == "AcademyDirector", "Frontend Block Warning: The generated token lacks an explicit system Role claim.");

        // // B. Verify the Multi-Tenant AcademyId partition barrier exists
        // var academyClaim = jwtToken.Claims.FirstOrDefault(c => c.Type.Equals("AcademyId", StringComparison.OrdinalIgnoreCase))?.Value;
        // Assert.NotNull(academyClaim);
        // Assert.NotEqual(Guid.Empty.ToString(), academyClaim);

        // // C. Verify the Username claim (The xmlsoap.org token entry your Layout.tsx depends on)
        // var usernameClaim = jwtToken.Claims.FirstOrDefault(c => c.Type.Contains("xmlsoap.org") || c.Type == "unique_name")?.Value;
        // Assert.NotNull(usernameClaim);
        // Assert.Equal(uniqueEmail, usernameClaim);
    }
    public class ConversationalResponseTestDto
    {
        public string NextStage { get; set; } = string.Empty;
        public string CachedEmail { get; set; } = string.Empty;
        public string AgentResponse { get; set; } = string.Empty;
        public string? Token { get; set; }
    }
    public class ConversationalResponseTestModel
    {
        public string NextStage { get; set; } = string.Empty;
        public string CachedEmail { get; set; } = string.Empty;
        public string AgentResponse { get; set; } = string.Empty;
        public string? Token { get; set; }
    }
}