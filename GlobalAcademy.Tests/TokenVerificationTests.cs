using System;
using System.IO;
using System.Net.Http;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using GlobalAcademy.Controllers;
using GlobalAcademy.Security;
using GlobalAcademy.Data;
using Microsoft.AspNetCore.Mvc;
using GlobalAcademy.Models;

namespace GlobalAcademy.Tests;

public class TokenVerificationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public TokenVerificationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Login_And_VerifyTenantId_Extraction_IsNot_EmptyGuid()
    {
        // --- STEP 1: INITIALIZE WEB API CLIENT SANDBOX ---
        var client = _factory.CreateClient();

        // Configure login payload exactly matching your Scalar request parameter metrics
        var loginPayload = new
        {
            email = "director@londonvanguard.com",
            password = "LondonPass123!"
        };

        // --- STEP 2: EXECUTE API REQUEST VIA HTTP CHANNELS ---
        var response = await client.PostAsJsonAsync("api/Auth/login", loginPayload);
        Assert.True(response.IsSuccessStatusCode, "API Login request failed entirely.");

        var loginResult = await response.Content.ReadFromJsonAsync<LoginResponseDto>();
        Assert.NotNull(loginResult?.Token);

        // --- STEP 3: MANUALLY SIMULATE THE TENANT PROVIDER INTERCEPTION FLOW ---
        // We spin up an explicit scope to extract how the running application handles HttpContextAccessor
        using var scope = _factory.Services.CreateScope();
        var httpContextAccessor = scope.ServiceProvider.GetRequiredService<IHttpContextAccessor>();
        
        // Create an artificial HttpContext containing our newly minted cryptographic token string passport
        var httpContext = new DefaultHttpContext();
        httpContext.Request.Headers["Authorization"] = $"Bearer {loginResult.Token}";
        
        // Extract claims via Microsoft's default JwtBearer token processor engine parameters
        var tokenHandler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
        var jwtToken = tokenHandler.ReadJwtToken(loginResult.Token);
        
        var identity = new ClaimsIdentity(jwtToken.Claims, "Bearer");
        httpContext.User = new ClaimsPrincipal(identity);
        
        // Inject our artificial request scope into the accessor tracking node
        httpContextAccessor.HttpContext = httpContext;

        // Instantiate the exact TenantProvider layer running inside your live application engine
        var provider = new TenantProvider(httpContextAccessor);

        // --- STEP 4: EXECUTE THE CRITICAL RESOLUTION TEST ---
        Guid extractedTenantId = provider.GetTenantId();

        // DIAGNOSTIC ASSERTIONS: Ensure the ID matches your physical seeded London database data
        Assert.NotEqual(Guid.Empty, extractedTenantId);
        Console.WriteLine($"[DIAGNOSTIC SUCCESS] Extracted Active Tenant ID: {extractedTenantId}");

        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var timeEngine = scope.ServiceProvider.GetRequiredService<ILocalTimeEngine>();

        // --- STEP 5: INSTANTIATE THE CONTROLLER AND FETCH DATA SLOTS ---
        var facilityController = new FacilityController(dbContext, timeEngine);
        
        // Assign our artificial context directly to the controller pipeline mapping attributes
        facilityController.ControllerContext = new ControllerContext
        {
            HttpContext = httpContext
        };

        // Invoke the target query method directly to inspect the data stream rows
        var actionResult = await facilityController.GetBranches();
        
        // --- STEP 5: DIAGNOSTIC PROPERTY INSPECTION ENGINE ---
        var okResult = Assert.IsType<OkObjectResult>(actionResult);
        Assert.NotNull(okResult.Value);

        // Convert the generic object value into an enumerable list to verify row visibility
        var branchesList = ((System.Collections.IEnumerable)okResult.Value).Cast<object>().ToList();
        
        Console.WriteLine($"[DEBUG] Total Branch Records Visible Past Multi-Tenant Filter: {branchesList.Count}");
        
        // Force evaluation: Fails if the query filter isolates or hides the records to 0 rows
        Assert.NotEmpty(branchesList); 
    }
}

public record LoginResponseDto(string Token, DateTime Expiration);
