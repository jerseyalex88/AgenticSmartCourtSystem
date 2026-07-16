using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using GlobalAcademy.Data;
using GlobalAcademy.Security;
using System.Text;
using System.IdentityModel.Tokens.Jwt;

namespace GlobalAcademy.Controllers;

[ApiController]
[Route("api/[controller]")]
[AllowAnonymous] // Open publicly so users can converse to authenticate
public class SemanticAuthController : ControllerBase
{
    private readonly UserManager<IdentityUser> _userManager;
    private readonly SignInManager<IdentityUser> _signInManager;
    private readonly IConfiguration _configuration;
    private readonly Kernel _kernel; // Underneath architecture property tracking anchor

    // FIXED: Request 'Kernel' directly via Dependency Injection! 
    // This cleanly inherits your pre-configured customHttpClient and gpt-5.4-mini models!
    public SemanticAuthController(
        UserManager<IdentityUser> userManager,
        SignInManager<IdentityUser> signInManager,
        IConfiguration configuration,
        Kernel kernel) // <-- INJECT THE PRE-CONFIGURED KERNEL ENGINE RIGHT HERE
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _configuration = configuration;
        _kernel = kernel; // Lock it straight to your central program configurations
    }

    [HttpPost("ai/conversational-auth")]
    [AllowAnonymous] // Open publicly so unauthenticated users can chat to log in!
    public async Task<IActionResult> ProcessConversationalAuth([FromBody] SemanticAuthRequestDto model)
    {
        string userInput = model.UserInput.Trim();
        string chatStage = model.CurrentStage; // "AwaitingEmail", "AwaitingPassword", "Completed"
        string cachedEmail = model.CachedEmail ?? "";

        // SECURE GATE INTERCEPT: If we are collecting a password, immediately process authentication
        if (chatStage == "AwaitingPassword")
        {
            var user = await _userManager.FindByEmailAsync(cachedEmail);
            if (user == null) return BadRequest(new { Message = "Authentication Denied: User coordinates unmatched." });

            var result = await _signInManager.CheckPasswordSignInAsync(user, userInput, false);
            if (!result.Succeeded) return BadRequest(new { Message = "Authentication Denied: Security token check failed." });

            // Generate authentic JWT Token Matrix (Mirroring your tested production claims system)
            var userRoles = await _userManager.GetRolesAsync(user);
            var userClaims = await _userManager.GetClaimsAsync(user);

            var authClaims = new System.Collections.Generic.List<System.Security.Claims.Claim>
            {
                new System.Security.Claims.Claim("http://xmlsoap.org", user.UserName!),
                new System.Security.Claims.Claim("jti", Guid.NewGuid().ToString()),
                new System.Security.Claims.Claim("nameidentifier", user.Id)
            };

            foreach (var role in userRoles) authClaims.Add(new Claim(ClaimTypes.Role, role));
            
            // Add tenant isolation shields
                foreach (var claim in userClaims)
            {
                if (claim.Type != ClaimTypes.Role && claim.Type != "role")
                {
                    authClaims.Add(claim);
                }
            }

            var jwtSettings = _configuration.GetSection("JwtSettings");
            var authSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings["Secret"]!));

            var token = new JwtSecurityToken(
                issuer: jwtSettings["Issuer"],
                audience: jwtSettings["Audience"],
                expires: DateTime.UtcNow.AddMinutes(double.Parse(jwtSettings["ExpiryInMinutes"]!)),
                claims: authClaims,
                signingCredentials: new SigningCredentials(authSigningKey, SecurityAlgorithms.HmacSha256)
            );

            return Ok(new SemanticAuthResponseDto(
                NextStage: "Completed",
                CachedEmail: cachedEmail,
                AgentResponse: "🚀 [AUTHENTICATION GRANTED]: Semantic token mesh established. Launching full system dashboard metrics...",
                Token: new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler().WriteToken(token)
            ));
        }

        // AGENTIC RENDERING: Use Semantic Kernel to parse entities out of loose input text strings
        var chatCompletionService = _kernel.GetRequiredService<IChatCompletionService>();
        var chatHistory = new ChatHistory();

        // System Prompt defining the AI ruleset and output extraction format constraints
        chatHistory.AddSystemMessage(
            "You are an AI authentication assistant routing user entry gates. " +
            "Your explicit goal is to extract a valid user email address from the conversation. " +
            "If the user input contains a valid email address (even inside natural text like 'I want to login as test@test.com'), " +
            "respond EXACTLY with the text 'EXTRACTED_EMAIL: [the email address]'. " +
            "If no email address is present or detectable inside the stream input, output a polite, natural language greeting " +
            "asking them for their account email address to get their login lifecycle started.");

        chatHistory.AddUserMessage(userInput);

        var responseContent = await chatCompletionService.GetChatMessageContentAsync(chatHistory);

        // FIX: Pull the explicit text string straight from the Content property.
        // This matches Semantic Kernel standards perfectly and resolves the compilation crash!
        string agentOutput = responseContent.Content?.Trim() ?? string.Empty;

        if (string.IsNullOrEmpty(agentOutput))
        {
            agentOutput = "❓ I received an empty text packet from the semantic parsing layer. Could you please re-state your login email address?";
        }

        // Evaluate if Semantic Kernel successfully isolated an email token from the stream
        if (agentOutput.StartsWith("EXTRACTED_EMAIL:", StringComparison.OrdinalIgnoreCase))
        {
            string extractedEmail = agentOutput.Split(':')[1].Trim();
            
            return Ok(new SemanticAuthResponseDto(
                NextStage: "AwaitingPassword", // Advance stage to collect sensitive password separately
                CachedEmail: extractedEmail,
                AgentResponse: $"🔒 Email coordinate [{extractedEmail}] captured via Semantic Kernel. Please provide your account password to authorize access:",
                Token: null
            ));
        }

        // Default response: Return the natural language prompt generated by the LLM
        return Ok(new SemanticAuthResponseDto(
            NextStage: "AwaitingEmail",
            CachedEmail: "",
            AgentResponse: agentOutput,
            Token: null
        ));
    }
}

public record SemanticAuthRequestDto(string UserInput, string CurrentStage, string? CachedEmail);
public record SemanticAuthResponseDto(string NextStage, string CachedEmail, string AgentResponse, string? Token);
