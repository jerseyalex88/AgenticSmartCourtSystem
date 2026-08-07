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
using GlobalAcademy.Services;

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
    private readonly Data.ApplicationDbContext _dbContext;
    private readonly IEmailNotificationEngine _emailEngine;

    // FIXED: Request 'Kernel' directly via Dependency Injection! 
    // This cleanly inherits your pre-configured customHttpClient and gpt-5.4-mini models!
    public SemanticAuthController(
        UserManager<IdentityUser> userManager,
        SignInManager<IdentityUser> signInManager,
        IConfiguration configuration,
        Kernel kernel,
        Data.ApplicationDbContext dbContext,
        IEmailNotificationEngine emailEngine)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _configuration = configuration;
        _kernel = kernel; // Lock it straight to your central program configurations
        _dbContext = dbContext; // Inject the database context for multi-tenant isolation
        _emailEngine = emailEngine; // Inject the email notification engine
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
                new System.Security.Claims.Claim("nameidentifier", user.Id),
                new System.Security.Claims.Claim("email", user.Email!),
                new System.Security.Claims.Claim("username", user.UserName!)
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
    // =========================================================================
    // POST: CONVERSATIONAL SEMANTIC KERNEL REGISTRATION GATEWAY
    // =========================================================================
    [HttpPost("ai/conversational-register")]
    [AllowAnonymous] // Open publicly so new players can execute onboarding queries
    public async Task<IActionResult> ProcessConversationalRegister([FromBody] SemanticRegisterRequestDto model)
    {
        try
        {
            string userInput = model.userInput.Trim();
            string chatStage = model.currentStage; // "ExtractingDetails", "AwaitingPassword", "Completed"
            string cachedEmail = model.cachedEmail ?? "";
            string cachedPhone = model.cachedPhone ?? "";
            string cachedAcademyId = model.cachedAcademyId ?? "";

            // 1. SECURE DESTRUCTIVE IDENTITY GATE INTERCEPT: Process password and commit to PostgreSQL
            if (chatStage == "AwaitingPassword")
            {
                if (!Guid.TryParse(cachedAcademyId, out Guid academyGuid))
                    return BadRequest(new { message = "Registration Exception: Academy identification token is invalid." });

                var academyExists = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
                    .AnyAsync(_dbContext.Academies, a => a.Id == academyGuid);
                if (!academyExists)
                    return NotFound(new { message = "Registration Exception: Target academy partition does not exist." });

                var userExists = await _userManager.FindByEmailAsync(cachedEmail);
                if (userExists != null)
                    return BadRequest(new { message = "Registration Exception: Email is already tied to a tenant passport." });

                var freshUser = new IdentityUser
                {
                    UserName = cachedEmail,
                    Email = cachedEmail,
                    PhoneNumber = cachedPhone,
                    EmailConfirmed = true
                };

                var createResult = await _userManager.CreateAsync(freshUser, userInput); // userInput here is the plain text password string
                if (!createResult.Succeeded)
                    return BadRequest(new { message = createResult.Errors.FirstOrDefault()?.Description ?? "Password constraints failed." });

                // Multi-tenant isolation claims assignment
                await _userManager.AddToRoleAsync(freshUser, "Player");
                await _userManager.AddClaimAsync(freshUser, new Claim("AcademyId", academyGuid.ToString()));
                await _userManager.AddClaimAsync(freshUser, new Claim(ClaimTypes.Role, "Player"));

                // =========================================================================
                // 🚀 WELCOME ONBOARDING TOUCHPOINT: CONVERSATIONAL SEMANTIC REGISTRATION
                // =========================================================================
                try
                {
                    await _emailEngine.SendWelcomeOnboardingEmailAsync(
                        recipientEmail: freshUser.Email!,
                        recipientName: freshUser.UserName ?? freshUser.Email!,
                        academyId: academyGuid);
                }
                catch { /* Safeguards your semantic kernel chat dialogue interface against connection exceptions */ }

                return Ok(new SemanticRegisterResponseDto(
                    nextStage: "Completed",
                    cachedEmail: cachedEmail,
                    cachedPhone: cachedPhone,
                    cachedAcademyId: cachedAcademyId,
                    agentResponse: "🚀 [IDENTITY PROVISIONED]: Your secure player passport has been stamped cleanly into this academy partition database. You can now log into the platform!"
                ));
            }

            // 2. CORE MICROSOFT SEMANTIC KERNEL ENTITY CAPTURE
            var chatCompletionService = _kernel.GetRequiredService<Microsoft.SemanticKernel.ChatCompletion.IChatCompletionService>();
            var chatHistory = new Microsoft.SemanticKernel.ChatCompletion.ChatHistory();

            chatHistory.AddSystemMessage(
                "You are an AI registration onboarding assistant. Your job is to extract 3 structural variables from user input: " +
                "an Email address, a Phone number, and an AcademyId GUID string. " +
                "If the user input contains any of these variables, respond EXACTLY with this format, skipping fields you don't find: \n" +
                "EMAIL:[value]\nPHONE:[value]\nACADEMY:[guid]\n" +
                "If any fields are missing, respond with a polite conversational prompt asking for the remaining pieces. " +
                "Do not include quotes, ticks, or markdown code block formatting symbols.");

            chatHistory.AddUserMessage(userInput);

            var responseContent = await chatCompletionService.GetChatMessageContentAsync(chatHistory);
            string agentOutput = responseContent.Content?.Trim() ?? string.Empty;

            // Analyze if Semantic Kernel isolated profile variables out of the user text stream
            string email = cachedEmail;
            string phone = cachedPhone;
            string academyId = cachedAcademyId;

            if (agentOutput.Contains("EMAIL:", StringComparison.OrdinalIgnoreCase) || 
                agentOutput.Contains("PHONE:", StringComparison.OrdinalIgnoreCase) || 
                agentOutput.Contains("ACADEMY:", StringComparison.OrdinalIgnoreCase))
            {
                var lines = agentOutput.Split('\n');
                foreach (var line in lines)
                {
                    if (line.StartsWith("EMAIL:", StringComparison.OrdinalIgnoreCase)) email = line.Split(':')[1].Trim();
                    if (line.StartsWith("PHONE:", StringComparison.OrdinalIgnoreCase)) phone = line.Split(':')[1].Trim();
                    if (line.StartsWith("ACADEMY:", StringComparison.OrdinalIgnoreCase)) academyId = line.Split(':')[1].Trim();
                }

                // Evaluate slot-filling completion parameter bounds
                if (!string.IsNullOrEmpty(email) && !string.IsNullOrEmpty(phone) && !string.IsNullOrEmpty(academyId))
                {
                    return Ok(new SemanticRegisterResponseDto(
                        nextStage: "AwaitingPassword", // Move securely to masked password collection step
                        cachedEmail: email,
                        cachedPhone: phone,
                        cachedAcademyId: academyId,
                        agentResponse: $"🔒 Profile details captured via Semantic Kernel!\n• Email: {email}\n• Phone: {phone}\n• Academy ID: {academyId.Substring(0,8)}...\n\nPlease provide a secure account password to finalize your profile setup:"
                    ));
                }
            }

            // Slot-Filling fallback loop: return the natural prompt requesting remaining fields
            return Ok(new SemanticRegisterResponseDto(
                nextStage: "ExtractingDetails",
                cachedEmail: email,
                cachedPhone: phone,
                cachedAcademyId: academyId,
                agentResponse: agentOutput
            ));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Internal Semantic Registration Error: {ex.Message}" });
        }
    }

}

public record SemanticAuthRequestDto(string UserInput, string CurrentStage, string? CachedEmail);
public record SemanticAuthResponseDto(string NextStage, string CachedEmail, string AgentResponse, string? Token);
// Data Transfer Records enforcing camelCase property serialization natively
public record SemanticRegisterRequestDto(string userInput, string currentStage, string? cachedEmail, string? cachedPhone, string? cachedAcademyId);
public record SemanticRegisterResponseDto(string nextStage, string cachedEmail, string cachedPhone, string cachedAcademyId, string agentResponse);
