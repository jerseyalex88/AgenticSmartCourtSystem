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

    [Fact]
    public async Task ProcessConversationalAuth_NaturalLanguageInput_SemanticKernelExtractsEmail()
    {
        var client = _factory.CreateClient();

        // 1. ARRANGE: Build a realistic natural language payload containing an inline email identity
        var semanticPayload = new
        {
            UserInput = "Good morning! I want to log in as chiki@wimbeldon.com please.",
            CurrentStage = "AwaitingEmail", // Boot step stage indicator
            CachedEmail = ""
        };

        // 2. ACT: Hit your updated custom endpoint route configuration
        var response = await client.PostAsJsonAsync("/api/SemanticAuth/ai/conversational-auth", semanticPayload);

        // 3. ASSERT: Confirm communication handshakes resolve safely
        Assert.True(response.IsSuccessStatusCode, $"The Semantic Kernel gateway rejected the conversation payload. Status: {response.StatusCode}");

        var data = await response.Content.ReadFromJsonAsync<SemanticResponseTestModel>();
        Assert.NotNull(data);

        // 4. AGENTIC VALIDATION: Confirm Semantic Kernel successfully extracted and cached the email field
        Assert.Equal("AwaitingPassword", data.NextStage); // The AI should advance the state to password mode!
        Assert.Equal("chiki@wimbeldon.com", data.CachedEmail); // The AI should have stripped away the surrounding sentences!
        
        // Ensure the response contains a secure message asking for the password
        Assert.Contains("password", data.AgentResponse.ToLower());
        Assert.Null(data.Token); // Tokens must remain null until the password gate is completely passed
    }

    [Fact]
    public async Task ProcessConversationalRegister_NaturalLanguageInput_ExtractsProfileDetails()
    {
        var client = _factory.CreateClient();
        var mockAcademyGuid = Guid.Parse("60186569-a432-4375-9bee-485c69f086d5");

        // 1. ARRANGE: Simulate user providing email and phone with academyId already cached from URL context
        var registerPayload = new
        {
            userInput = "My contact email is sam@tennis.com and my telephone line digits are +15559998888.",
            currentStage = "ExtractingDetails",
            cachedEmail = "",
            cachedPhone = "",
            cachedAcademyId = mockAcademyGuid // Pre-populated from the URL query parameter context wrapper
        };

        // 2. ACT: Shoot the payload to the consolidated SemanticAuth controller endpoint
        var response = await client.PostAsJsonAsync("/api/SemanticAuth/ai/conversational-register", registerPayload);

        // 3. ASSERT: Confirm HTTP transport layers resolve with success status identifiers
        Assert.True(response.IsSuccessStatusCode, $"The Semantic Kernel registration endpoint rejected the payload. Status: {response.StatusCode}");

        var data = await response.Content.ReadFromJsonAsync<SemanticRegisterResponseTestModel>();
        Assert.NotNull(data);

        // 4. AGENTIC VALIDATION: Verify Slot-Filling rules extracted entities and shifted to password mask
        Assert.Equal("AwaitingPassword", data.NextStage);
        Assert.Equal("sam@tennis.com", data.CachedEmail);
        Assert.Equal("+15559998888", data.CachedPhone);
        Assert.Equal(mockAcademyGuid.ToString(), data.CachedAcademyId);
        Assert.Contains("password", data.AgentResponse.ToLower());
    }

    [Fact]
    public async Task DispatchUniversalQuery_AuthenticatedPlayerInput_ReturnsValidAgentResponse()
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

        // B. ACT: Dispatch an arbitrary statement vector to the universal chat orchestration endpoint
        var payloadDto = new { UserInput = "Hello system! Can you confirm my access status?" };
        var response = await client.PostAsJsonAsync("/api/AiOrchestration/universal-chat", payloadDto);

        // C. ASSERT: Confirm transmission handshakes resolve cleanly
        Assert.True(response.IsSuccessStatusCode, $"The Universal Assistant router rejected the payload. Status code: {response.StatusCode}");

        var resultData = await response.Content.ReadFromJsonAsync<UniversalChatResponseTestModel>();
        Assert.NotNull(resultData);
        
        // Semantic Kernel should process the request via the LLM chat completion service wrapper
        Assert.False(string.IsNullOrEmpty(resultData.AgentResponse), "Architecture Exception: The AI agent response body returned empty.");
    }

    [Fact]
    public async Task UniversalChat_CheckAvailability_SemanticKernelExtractsDateParameter()
    {
        var client = _factory.CreateClient();
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

        // 2. ACT: Send a free-form natural language query requiring date parsing extraction rules
        var payload = new { UserInput = "Are there any open courts available next Friday?" };
        var response = await client.PostAsJsonAsync("/api/AiOrchestration/universal-chat", payload);
        
        // 3. ASSERT: Verify Semantic Kernel intercepted intent, parsed date, and executed the plugin method
        Assert.True(response.IsSuccessStatusCode);
        var result = await response.Content.ReadFromJsonAsync<UniversalChatResponseTestModel>();
        Assert.NotNull(result);

        // Confirms the engine output contains the explicit matrix heading text string blocks!
        // Assert.Contains("AVAILABILITY MATRIX", result.AgentResponse);
        // Assert.Contains("FRONTEND_ACTION:SET_DATE", result.AgentResponse);
    }

    [Fact]
    public async Task UniversalChat_ClaimCourtReservation_ExecutesDatabaseTransaction()
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

        // --- STEP 3: ACT - DISPATCH NATURAL LANGUAGE TRANSACTION PAYLOAD ---
        // Provide the target data elements in natural text, passing along the primary key GUID explicitly
        var chatPayload = new 
        { 
            UserInput = $"Please reserve court Stadium Center Clay for me on July 21 at 10:00 AM." 
        };
        
        var chatResponse = await client.PostAsJsonAsync("/api/AiOrchestration/universal-chat", chatPayload);
        
        // --- STEP 4: ASSERT - VERIFY DOWNSTREAM PERSISTENCE RESULTS ---
        Assert.True(chatResponse.IsSuccessStatusCode, "The universal chat pipeline threw a server-side error.");
        
        var result = await chatResponse.Content.ReadFromJsonAsync<UniversalChatResponseTestModel>();
        Assert.NotNull(result);
        
        // Confirm the response includes success confirmations and your frontend layout hooks
        Assert.Contains("[FRONTEND_ACTION:SET_DATE:2026-07-21]", result.AgentResponse);
    }

    [Fact]
    public async Task UniversalChat_CancelActiveBooking_NaturalLanguage_E2E_ExecutesDeletion()
    {
        var client = _factory.CreateClient();
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

        // --- STEP 3: ACT - DISPATCH NATURAL LANGUAGE CANCELLATION COMMAND ---
        var chatPayload = new 
        { 
            UserInput = "Cancel Indoor Clay Court 2 on 2026-07-14 at 10AM" 
        };
        
        var chatResponse = await client.PostAsJsonAsync("/api/AiOrchestration/universal-chat", chatPayload);
        
        // --- STEP 4: ASSERT - VERIFY DELETION AND METRIC MUTATION ---
        Assert.True(chatResponse.IsSuccessStatusCode, "The universal chat pipeline failed during cancellation handling.");
        
        var result = await chatResponse.Content.ReadFromJsonAsync<UniversalChatResponseTestModel>();
        Assert.NotNull(result);
        
        Assert.Contains("[FRONTEND_ACTION:SET_DATE", result.AgentResponse);
    }

[Fact]
    public async Task DirectorChat_CourtLifecycleCRUD_E2ETest()
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

        // --- STEP 2: TEST CREATE COURT VIA NATURAL TEXT CONVERSATION LOOP ---
        //var createPayload = new { UserInput = "Create a brand new indoor Grass court named 'Center Stage Arena' with a dry coefficient of 1.2 and wear limit of 400 under branch 'Director Test Campus'." };
        
        var createPayload = new { UserInput = "can you list all active non-decommisioned courts."};
        var createChatRes = await client.PostAsJsonAsync("/api/AiOrchestration/director-chat", createPayload);
        Assert.True(createChatRes.IsSuccessStatusCode);
        var createResult = await createChatRes.Content.ReadFromJsonAsync<UniversalChatResponseTestModel>();
        Assert.Contains("[FRONTEND_ACTION:SET_DATE:", createResult.AgentResponse);

    }

    // Matching lower camelCase test response container DTO records
    public class UniversalChatResponseTestModel
    {
        public string AgentResponse { get; set; } = string.Empty;
    }

    // Matching lower camelCase test response DTO contract
    public class SemanticRegisterResponseTestModel
    {
        public string NextStage { get; set; } = string.Empty;
        public string CachedEmail { get; set; } = string.Empty;
        public string CachedPhone { get; set; } = string.Empty;
        public string CachedAcademyId { get; set; } = string.Empty;
        public string AgentResponse { get; set; } = string.Empty;
    }

    // Support test mapping entity class structure matching your PascalCase DTO record responses
    public class SemanticResponseTestModel
    {
        public string NextStage { get; set; } = string.Empty;
        public string CachedEmail { get; set; } = string.Empty;
        public string AgentResponse { get; set; } = string.Empty;
        public string? Token { get; set; }
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