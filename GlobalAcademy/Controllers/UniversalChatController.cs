using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using GlobalAcademy.Data;
using GlobalAcademy.Plugins;
using GlobalAcademy.Context;

namespace GlobalAcademy.Controllers;

[ApiController]
[Route("api/AiOrchestration")]
[Authorize] // Enforces secure multi-tenant identity verification automatically
public class UniversalChatController : ControllerBase
{
    private readonly Kernel _kernel;
    private readonly ApplicationDbContext _dbContext;

    public UniversalChatController(Kernel kernel, ApplicationDbContext dbContext)
    {
        _kernel = kernel;
        _dbContext = dbContext;
        //_kernel.Plugins.AddFromObject(new Plugins.PlayerBookingPlugin(_dbContext), "PlayerBookingPlugin");
        // tomorrow we will register our custom CourtBookingPlugin directly to this kernel instance!
    }

    [HttpPost("universal-chat")]
    public async Task<IActionResult> DispatchUniversalQuery([FromBody] UniversalChatRequestDto model,
    [FromServices] PlayerBookingContext playerBookingContext) // <-- Inject the PlayerBookingContext here
    {
        try
        {
            string userInput = model.UserInput.Trim();
            if (string.IsNullOrEmpty(userInput)) return BadRequest("Input text vector empty.");

            // 1. EXTRACTION: Pull the authenticated user's name and multi-tenant firewall parameters
            var currentUserName = HttpContext.User.Claims.FirstOrDefault(c => c.Type.Contains("xmlsoap.org"))?.Value ?? HttpContext.User.Identity?.Name;
            var tenantIdClaim = HttpContext.User.FindFirst("AcademyId")?.Value;
            var userRole = HttpContext.User.FindFirst(ClaimTypes.Role)?.Value ?? "Player";
            var userId = HttpContext.User.Claims.FirstOrDefault(c => c.Type.Contains("nameidentifier"))?.Value ?? HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (string.IsNullOrEmpty(currentUserName) || !Guid.TryParse(tenantIdClaim, out Guid academyGuid))
            {
                return Unauthorized("Security Exception: Security perimeter claims unreadable.");
            }

            // playerBookingContext.UserId = userId ?? "";
            // playerBookingContext.UserName = currentUserName ?? "";
            // playerBookingContext.AcademyId = academyGuid;
            // playerBookingContext.UserRole = userRole ?? "Player";

            // 3. EXECUTE INTEGRATION LOOP
            var chatCompletionService = _kernel.GetRequiredService<IChatCompletionService>();
            var chatHistory = new ChatHistory();

            // Establish strict role-based guardrails so the LLM acts as an assistant within boundaries
            chatHistory.AddSystemMessage(
                $"You are the Smart Court OS Ambient Assistant. You are currently talking to {currentUserName}, user Id is {userId} who is a {userRole}. " +
                $"Your tenant partition boundary is hardlocked to AcademyId: {academyGuid}. " +
                "\n\nINTENT CLASSIFICATION RULES:" +
                "\n1. EXPLORATORY (Checking Availability): If the user asks to see open slots, check availability, or scan what is free (e.g., 'find me slots on july 21...'), you MUST use 'CheckCourtAvailabilityAsync'. This function does NOT require a court name or court ID. Call it immediately with the extracted target date." +
                "\n2. TRANSACTIONAL (Booking/Reserving): Only enforce mandatory parameter slot-filling rules (courtId, courtName, targetDate, startHour) if the user explicitly states they want to book, secure, reserve, or claim a specific slot." +
                "\n\nCRITICAL RULES FOR FRONTEND SYNCHRONIZATION:" +
                "\nWhenever a plugin returns a response containing a structural action token like '[FRONTEND_ACTION:SET_DATE:YYYY-MM-DD]', you MUST preserve and append that exact token string at the absolute end of your final markdown text response to the user."
            );

            chatHistory.AddSystemMessage(
                $"You are the Smart Court OS Ambient Assistant. You are currently talking to {currentUserName}, user Id is {userId} who is a {userRole}. " +
                $"Your tenant partition boundary is hardlocked to AcademyId: {academyGuid}. " +
                "You have access to native booking and cancellation plugins. If a user asks to reserve or clear a court, " +
                "use your functions tool belt to fulfill the transaction. Keep responses succinct, universal, and scannable." +
                "\n\nCRITICAL SLOT-FILLING LAWS:" +
                "\nBefore executing 'ClaimCourtReservationAsync', you MUST explicitly gather all three mandatory parameters:" +
                "\n1. courtName (The descriptive string name of the court asset, e.g., 'Indoor Clay Court 2')" +
                "\n2. targetDate (ISO format string 'YYYY-MM-DD')" +
                "\n3. startHour (Military hour text, e.g., '14:00')" +
                "\nIf the player leaves any parameter out (e.g., 'Book a court for tomorrow' without specifying a time or a court), DO NOT call the function. Respond politely asking for the missing variables." +
                "\n\n3. CANCELLATION ACTIONS:" +
                "\nIf the user wants to cancel, remove, drop, or clear a booking, you MUST gather three mandatory parameters:" +
                "\n- courtName (The string name of the court asset, e.g., 'Cancellation Court 1')" +
                "\n- targetDate (ISO format string 'YYYY-MM-DD')" +
                "\n- startHour (Military hour text, e.g., '10:00')" +
                "\nDo not look for a GUID reference. Pass these natural parameters directly into 'CancelActiveBookingAsync'." +
                "\n\nCRITICAL RULES FOR FRONTEND SYNCHRONIZATION:" +
                "\nWhenever a plugin returns a response containing a structural action token like '[FRONTEND_ACTION:SET_DATE:YYYY-MM-DD]', you MUST preserve and append that exact token string at the absolute end of your final markdown text response to the user. Do not omit, truncate, or rewrite the bracketed token."
            );

            chatHistory.AddSystemMessage(
                $"You are the Smart Court OS Ambient Assistant. You are currently talking to {currentUserName}, user Id is {userId} who is a {userRole}. " +
                $"Your tenant partition boundary is hardlocked to AcademyId: {academyGuid}. " +
                "You have access to native booking, availability, and cancellation plugins." +                
                "\n\nMULTIPLE SLOTS CAPABILITY RULES:" +
                "\n- If a user requests multiple times (e.g., 'Book court 1 from 9am to 11am' or 'Book 9:00 and 10:00'), extract the hours into an array format and invoke 'ClaimCourtReservationAsync' for each hour." +                
                "\n\nINTELLIGENT MULTI-CANCELLATION CHAINING RULES:" +
                "\n- If a user inquires about multiple slots using relative terms (e.g., 'all my bookings' or 'all my matches next week'), you MUST invoke 'GetPlayerLedgerAsync' first to retrieve their active verified allocation history." +
                "\n- If a user asks to cancel, remove, or drop multiple slots using relative terms (e.g., 'Cancel all my bookings tomorrow' or 'Clear my matches on Tuesday'), you MUST invoke 'GetPlayerLedgerAsync' first to retrieve their active verified allocation history." +
                "\n- Read the output summary from 'GetPlayerLedgerAsync' to cross-reference dates and isolate the target court names, dates, and start hours that match the user's request." +
                "\n- Loop through and invoke 'CancelActiveBookingAsync' for each matched slot individually using those natural parameters." +
                "\n- Keep responses succinct, universal, and scannable." +                
                "\n\nCRITICAL RULES FOR FRONTEND SYNCHRONIZATION:" +
                "\nWhenever a cancellation or booking completes successfully, ensure the exact '[FRONTEND_ACTION:SET_DATE:YYYY-MM-DD]' token returned by the final tool execution is appended to your response text stream."
            );

            chatHistory.AddUserMessage(userInput);

            // Execute the model completion loop using automatic function invocation call routing configurations
            var openAiPromptExecutionSettings = new Microsoft.SemanticKernel.Connectors.OpenAI.OpenAIPromptExecutionSettings
            {
                ToolCallBehavior = Microsoft.SemanticKernel.Connectors.OpenAI.ToolCallBehavior.AutoInvokeKernelFunctions
            };

            // =========================================================================
            // INJECT VARIABLES INTO THE KERNEL'S STATE DATA DICTIONARY
            // This makes properties universally available to all background plugins!
            // =========================================================================
            _kernel.Data["currentUserName"] = currentUserName;
            _kernel.Data["academyId"] = academyGuid;
            _kernel.Data["userRole"] = userRole;
            _kernel.Data["userId"] = userId;

            var agentResponseContent = await chatCompletionService.GetChatMessageContentAsync(
                chatHistory: chatHistory,
                executionSettings: openAiPromptExecutionSettings,
                kernel: _kernel);

            return Ok(new UniversalChatResponseDto(
                AgentResponse: agentResponseContent.Content ?? "Operation processed cleanly with no text feedback output lines."
            ));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { Message = $"Universal Assistant Pipeline Exception: {ex.Message}" });
        }
    }

    // =========================================================================
    // ACADEMY DIRECTOR ADMIN ORCHESTRATION PIPELINE
    // =========================================================================
    [HttpPost("director-chat")]
    [Authorize(Roles = "AcademyDirector,GlobalAdmin")]
    public async Task<IActionResult> DispatchDirectorQuery([FromBody] UniversalChatRequestDto model)
    {
        try
        {
            string userInput = model.UserInput.Trim();
            if (string.IsNullOrEmpty(userInput)) return BadRequest("Input text vector empty.");

            // 1. EXTRACTION: Pull the authenticated user's name and multi-tenant firewall parameters
            var currentUserName = HttpContext.User.Claims.FirstOrDefault(c => c.Type.Contains("xmlsoap.org"))?.Value ?? HttpContext.User.Identity?.Name;
            var tenantIdClaim = HttpContext.User.FindFirst("AcademyId")?.Value;
            var userRole = HttpContext.User.FindFirst(ClaimTypes.Role)?.Value ?? "Unknown";
            var userId = HttpContext.User.Claims.FirstOrDefault(c => c.Type.Contains("nameidentifier"))?.Value ?? HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (string.IsNullOrEmpty(currentUserName) || !Guid.TryParse(tenantIdClaim, out Guid academyGuid))
            {
                return Unauthorized("Security Exception: Security perimeter claims unreadable.");
            }

            // 3. Inject multi-tenant partition parameters into the stateless ambient dictionary
            _kernel.Data["currentUserName"] = currentUserName;
            _kernel.Data["academyId"] = academyGuid;
            _kernel.Data["userRole"] = userRole;
            _kernel.Data["userId"] = userId;

            // 4. Construct high-clearance executive instruction templates
            var chatCompletionService = _kernel.GetRequiredService<IChatCompletionService>();
            var chatHistory = new ChatHistory();

            chatHistory.AddSystemMessage(
                $"You are the Smart Court OS Executive Director Agent. You are talking to {currentUserName}. " +
                $"Your administrative partition boundary is locked to AcademyId: {academyGuid}. " +
                "\n\nEXECUTIVE COMPLIANCE MANDATES:" +
                "\n- You possess high-clearance access to manage facility assets (Branches and Courts) and employee rosters via complete CRUD matrices." +
                "\n- Lookups must accept natural string matching names or explicit Guid keys." +
                "\n- Keep engineering message summaries clear, universal, and scannable." +
                "\n\nBRANCH CRUD Lifecycles Tool Belt Instructions:" +
                "\n1. To provision or add a venue, use 'AdminCreateBranchAsync'." +
                "\n2. To list active branches, run 'AdminGetBranchesAsync'. If the director asks for courts generally without specifying a location context (e.g., 'list all active courts'), you MUST query 'AdminGetBranchesAsync' first to discover what branches exist before attempting court lookups. Do not assume or fabricate branch names." +
                "\n3. To edit details, use 'AdminUpdateBranchAsync'." +
                "\n4. To soft-delete a venue, use 'AdminDecommissionBranchAsync'. This blocks if any related bookings exist." +
                "\n\nCOURT CRUD Lifecycles Tool Belt Instructions:" +
                "\n1. Create: 'AdminCreateCourtAsync' (collect branchIdentifier, courtName, surfaceType, isIndoor, dryCoefficient, maintenanceCeiling)." +
                "\n2. Retrieve: 'AdminGetBranchCourtsAsync' (requires explicit branchIdentifier context)." +
                "\n3. Update: 'AdminUpdateCourtAsync'." +
                "\n4. Delete: 'AdminDecommissionCourtAsync' (soft-deletes after blocking if historical bookings exist)." +

                "\n\nMULTIPLE ADMINISTRATIVE ACTIONS BATCH LAWS:" +
                "\n- If a director requests multiple identical operations at once (e.g., 'Create 3 new courts named Court A, Court B, Court C for Branch London' or 'Delete Court 1 and Court 2'), you MUST extract the unique individual parameters into separate entities." +
                "\n- Loop through and invoke the corresponding CRUD tool (e.g., 'AdminCreateCourtAsync' or 'AdminDecommissionCourtAsync') sequentially, once for each targeted item." +
                "\n- Combine the text results from all looped executions into a single, succinct final response summary for the director." +
                "\n- Do not skip items mid-loop if one fails; report both successes and failures clearly." +

                "\n\nCRITICAL RULES FOR FRONTEND SYNCHRONIZATION:" +
                "\nWhenever an operation settles successfully, you MUST preserve and append the trailing grid layout token " +
                "'[FRONTEND_ACTION:SET_DATE:YYYY-MM-DD]' replacing YYYY-MM-DD with today's target tracking date to force immediate client rendering refreshes."
            );

            chatHistory.AddSystemMessage(
                $"You are the Smart Court OS Executive Director Agent. You are talking to {currentUserName}. " +
                $"Your administrative partition boundary is locked to AcademyId: {academyGuid}. " +
                "\n\nEXECUTIVE COMPLIANCE MANDATES:" +
                "\n- You possess high-clearance access to manage facility assets (Branches and Courts) and employee identity accounts via complete CRUD matrices." +
                "\n- Lookups must accept natural string matching names or explicit Guid keys." +
                "\n- Keep engineering message summaries clear, universal, and scannable." +
                "\n\nMULTIPLE ADMINISTRATIVE ACTIONS BATCH LAWS:" +
                "\n- If a director requests multiple identical operations at once (e.g., 'Provision 3 new staff entries' or 'Delete these 2 accounts'), extract the unique individual parameters into separate entities." +
                "\n- Loop through and invoke the corresponding CRUD tool sequentially, once for each targeted item, and combine results into a single final scannable response summary." +
                "\n\nIDENTITY ACCOUNT MANAGEMENT CRUD Tool Belt Instructions:" +
                "\n1. Create Account: 'AdminProvisionUserAsync' (collect email, user name, password, role, phoneNumber)." +
                "\n1b. Create Account: 'AdminProvisionUserAsync' (Always extract a distinct email coordinate string and a separate user specified name handle or profile nickname parameter)." +
                "\n2. Retrieve Roster: 'AdminGetTenantUsersAsync' (takes zero arguments, lists all accounts inside your academy)." +
                "\n3. Update Profile: 'AdminUpdateUserAsync' (requires explicit userId database string identifier along with email, userName handle, role, phoneNumber, and isActive flag)." +
                "\n4. Delete Account: 'AdminDeleteUserAsync' (wipes account credentials permanently using its string userId)." +
                "\n\nUSER FACILITY ROSTER MANAGEMENT CRUD Tool Belt Instructions:" +
                "\n1. Assign to Branch: 'AdminAssignUserToBranchAsync' (collect userIdentifier, branchIdentifier, and assignmentRole)." +
                "\n2. Remove from Branch: 'AdminRemoveUserFromBranchAsync' (collect userIdentifier and branchIdentifier. Note that this cascades out downstream court assignments via an atomic transaction block)." +
                "\n3. Assign task to Court: 'AdminAssignUserToCourtAsync' (collect userIdentifier, branchIdentifier, courtIdentifier, and accessType. This will automatically block if the user is not found on the active branch roster blueprint first)." +
                "\n4. Unlink from Court task: 'AdminRemoveUserFromCourtAsync' (collect userIdentifier, branchIdentifier, and courtIdentifier)." +   
                "\n\nBRANCH/COURT RECOVERY ENGINES:" +
                "\n- [Include previous operational branch and court instructions here...]" +
                "\n\nCRITICAL RULES FOR FRONTEND SYNCHRONIZATION:" +
                "\nWhenever an operation settles successfully, you MUST preserve and append the trailing grid layout token " +
                "'[FRONTEND_ACTION:SET_DATE:YYYY-MM-DD]' replacing YYYY-MM-DD with today's target tracking date to force immediate client rendering refreshes."
            );

            // Feed full user statement into history tracking
            chatHistory.AddUserMessage(model.UserInput);

            // 5. Invoke conversational completion loop with Auto-Invocation tool belt parameters active
            // Execute the model completion loop using automatic function invocation call routing configurations
            var openAiPromptExecutionSettings = new Microsoft.SemanticKernel.Connectors.OpenAI.OpenAIPromptExecutionSettings
            {
                ToolCallBehavior = Microsoft.SemanticKernel.Connectors.OpenAI.ToolCallBehavior.AutoInvokeKernelFunctions
            };

            var agentResponseContent = await chatCompletionService.GetChatMessageContentAsync(
                chatHistory: chatHistory,
                executionSettings: openAiPromptExecutionSettings,
                kernel: _kernel);

            return Ok(new UniversalChatResponseDto(
                AgentResponse: agentResponseContent.Content ?? "Operation processed cleanly with no text feedback output lines."
            ));
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"🚨 [DIRECTOR ENGINE ERROR]: Orchestration pipeline interception fault: {ex.Message}");
        }
    }

}

public record UniversalChatRequestDto(string UserInput);
public record UniversalChatResponseDto(string AgentResponse);
