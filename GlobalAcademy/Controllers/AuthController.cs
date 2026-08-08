using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using GlobalAcademy.Models;
using GlobalAcademy.Security;
using GlobalAcademy.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.Authentication;

namespace GlobalAcademy.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly UserManager<IdentityUser> _userManager;
    private readonly RoleManager<IdentityRole> _roleManager;
    private readonly IConfiguration _configuration;
    private readonly ITenantProvider _tenantProvider;
    private readonly Data.ApplicationDbContext _dbContext;
    private readonly IEmailNotificationEngine _emailEngine;
    private readonly ITurnstileValidator _turnstileValidator;

    // 2. UPDATE THE CONSTRUCTOR TO ACCEPT APPLICATIONDBCONTEXT
    public AuthController(
        UserManager<IdentityUser> userManager, 
        RoleManager<IdentityRole> roleManager, 
        IConfiguration configuration,
        ITenantProvider tenantProvider,
        Data.ApplicationDbContext dbContext,
        IEmailNotificationEngine emailEngine,
        ITurnstileValidator turnstileValidator)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _configuration = configuration;
        _tenantProvider = tenantProvider;
        _dbContext = dbContext;
        _emailEngine = emailEngine;
        _turnstileValidator = turnstileValidator;
    }    

    // =========================================================================
    // TARGETED ADDITION: INITIATE GOOGLE CHALLENGE MATRIX
    // =========================================================================
    [HttpGet("external-login")]
    [AllowAnonymous]
    public IActionResult ExternalLogin([FromQuery] string provider, [FromQuery] string academyId)
    {
        if (string.IsNullOrEmpty(academyId))
        {
            return BadRequest("Multi-tenant organization boundary context parameter is required.");
        }

         var redirectUrl = Url.Action("ExternalLoginCallback", "Auth");
        //var redirectUrl = "https://localhost:7290/api/Auth/external-login-callback";
        var properties = new AuthenticationProperties { RedirectUri = redirectUrl };
        
        // Safely package multi-tenant key in Google's secure round-trip state payload
        properties.Items["state"] = academyId;
        properties.Items["LoginProvider"] = provider;

        return Challenge(properties, provider);
    }

    // =========================================================================
    // TARGETED ADDITION: OAUTH CALLBACK PROCESSING AND AUTO-PROVISIONING
    // =========================================================================
    [HttpGet("external-login-callback")]
    [AllowAnonymous]
    public async Task<IActionResult> ExternalLoginCallback()
    {
        var frontendUrl = _configuration["AllowedOrigins:0"] ?? "http://localhost:5173";

        // Read transient security payload flags from incoming scheme cookies
        var authResult = await HttpContext.AuthenticateAsync(IdentityConstants.ExternalScheme);
        if (!authResult.Succeeded)
        {
            return Redirect($"{frontendUrl}/player-gateway?error=Google authentication handshake aborted or failed.");
        }

        var email = authResult.Principal.FindFirstValue(ClaimTypes.Email);
        var academyId = authResult.Properties.Items.ContainsKey("state") ? authResult.Properties.Items["state"] : null;

        if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(academyId) || !Guid.TryParse(academyId, out Guid academyGuid))
        {
            return Redirect($"{frontendUrl}/player-gateway?error=Multi-tenant identity boundaries or tracking configurations are corrupted.");
        }

        // Verify the targeted academy isolation partition block exists in the database
        var academyExists = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.AnyAsync(_dbContext.Academies, a => a.Id == academyGuid);
        if (!academyExists)
        {
            return Redirect($"{frontendUrl}/player-gateway?error=Referenced tenant academy system branch does not exist.");
        }

        var user = await _userManager.FindByEmailAsync(email);
        if (user == null)
        {
            // PROVISION EXPLICIT NEW PLAYER ROW
            user = new IdentityUser
            {
                UserName = email,
                Email = email,
                EmailConfirmed = true
            };

            var createResult = await _userManager.CreateAsync(user);
            if (!createResult.Succeeded)
            {
                return Redirect($"{frontendUrl}/player-gateway?error=Identity failure: Failed to construct baseline user framework.");
            }

            await _userManager.AddToRoleAsync(user, "Player");
            await _userManager.AddClaimAsync(user, new Claim("AcademyId", academyGuid.ToString()));
            await _userManager.AddClaimAsync(user, new Claim(ClaimTypes.Role, "Player"));

            // =========================================================================
            // 🚀 WELCOME ONBOARDING TOUCHPOINT: GOOGLE FEDERATED REGISTRATION
            // =========================================================================
            try
            {
                await _emailEngine.SendWelcomeOnboardingEmailAsync(
                    recipientEmail: user.Email!,
                    recipientName: user.UserName ?? user.Email!,
                    academyId: academyGuid);
            }
            catch { /* Fault-tolerant catch block handles mail delivery failures gracefully */ }
        }
        else
        {
            // SECURITY GUARD: Verify returning player matches current URL isolation context
            var claimsList = await _userManager.GetClaimsAsync(user);
            var userAcademyClaim = claimsList.FirstOrDefault(c => c.Type.Equals("AcademyId", StringComparison.OrdinalIgnoreCase))?.Value;

            if (userAcademyClaim != academyId)
            {
                return Redirect($"{frontendUrl}/player-gateway?error=Security Violation: Identity registration collision found outside target tenant parameters.");
            }
        }

        // COMPILE SYSTEM CRYPTOGRAPHIC TOKEN PASSPORT
        var userRoles = await _userManager.GetRolesAsync(user);
        var liveClaims = await _userManager.GetClaimsAsync(user);

        var authClaims = new List<Claim>
        {
            new Claim("http://xmlsoap.org", user.UserName!),
            new Claim("jti", Guid.NewGuid().ToString()),
            new Claim("nameidentifier", user.Id),
            new Claim("email", user.Email!),
            new Claim("username", user.UserName!)
        };

        foreach (var claim in liveClaims)
        {
            if (claim.Type != ClaimTypes.Role && claim.Type != "role") authClaims.Add(claim);
        }

        foreach (var userRole in userRoles)
        {
            authClaims.Add(new Claim(ClaimTypes.Role, userRole));
        }

        var academy = _dbContext.Academies.FirstOrDefault(a => a.Id == academyGuid);
        authClaims.Add(new Claim("academyName", academy?.Name ?? "Unknown Academy"));

        var jwtSettings = _configuration.GetSection("JwtSettings");
        var authSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings["Secret"]!));

        var token = new JwtSecurityToken(
            issuer: jwtSettings["Issuer"],
            audience: jwtSettings["Audience"],
            expires: DateTime.UtcNow.AddMinutes(double.Parse(jwtSettings["ExpiryInMinutes"]!)),
            claims: authClaims,
            signingCredentials: new SigningCredentials(authSigningKey, SecurityAlgorithms.HmacSha256)
        );

        var tokenString = new JwtSecurityTokenHandler().WriteToken(token);

        // Terminate transient login tracking cookies cleanly
        await HttpContext.SignOutAsync(IdentityConstants.ExternalScheme);

        // Pass authenticated token passport back down to React SPA context safely
        return Redirect($"{frontendUrl}/player-gateway?token={tokenString}");
    }

    [HttpPost("register-academy")]
    public async Task<IActionResult> RegisterAcademy([FromBody] RegisterAcademyDto model)
    {
        string[] roles = ["GlobalAdmin", "AcademyDirector", "Groundskeeper", "Player"];
        foreach (var role in roles)
        {
            if (!await _roleManager.RoleExistsAsync(role))
            {
                await _roleManager.CreateAsync(new IdentityRole(role));
            }
        }

        var newAcademyId = Guid.NewGuid();
        var user = new IdentityUser { UserName = model.Email, Email = model.Email };
        var result = await _userManager.CreateAsync(user, model.Password);

        if (!result.Succeeded)
        {
            return BadRequest(result.Errors);
        }

        await _userManager.AddToRoleAsync(user, "AcademyDirector");
        await _userManager.AddClaimAsync(user, new Claim("AcademyId", newAcademyId.ToString()));

        return Ok(new { Message = "Academy registered successfully!", AcademyId = newAcademyId });
    }
    
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto model)
    {
        if (!await _turnstileValidator.IsHumanAsync(model.TurnstileToken))
        {
            Console.WriteLine($"Turnstile validation failed: Bot signature detected or challenge token expired. {model.TurnstileToken}");
            return BadRequest(new { message = "Security Intercept: Automated bot signature detected or challenge token expired." });
        }

        var user = await _userManager.FindByEmailAsync(model.Email);
        if (user != null && await _userManager.CheckPasswordAsync(user, model.Password))
        {
            // 1. Fetch your actual, live roles from AspNetUserRoles table
            var userRoles = await _userManager.GetRolesAsync(user);
            
            // 2. Fetch your custom claims (like AcademyId) from disk
            var userClaims = await _userManager.GetClaimsAsync(user);

            var authClaims = new List<Claim>
            {
                new Claim("http://xmlsoap.org", user.UserName!),
                new Claim("jti", Guid.NewGuid().ToString()),
                new Claim("nameidentifier", user.Id),
                new Claim("email", user.Email!),
                new Claim("username", user.UserName!)
            };

            // =========================================================================
            // FIX: FORCE LIVE ROLES TO OVERRIDE STALE CLAIM ENTRIES
            // =========================================================================
            // We filter out any old, stale "role" claims sitting in the claims table 
            // to prevent them from colliding with your upgraded role state.
            
            foreach (var claim in userClaims)
            {
                if (claim.Type != ClaimTypes.Role && claim.Type != "role")
                {
                    authClaims.Add(claim);
                }
            }

            // Inject your real, freshly elevated live database roles into the token!
            foreach (var userRole in userRoles)
            {
                authClaims.Add(new Claim(ClaimTypes.Role, userRole));
            }

            var academyClaimValue = userClaims
            .FirstOrDefault(c => c.Type.Equals("AcademyId", StringComparison.OrdinalIgnoreCase))?.Value;

            if (string.IsNullOrEmpty(academyClaimValue) || !Guid.TryParse(academyClaimValue, out Guid academyClaim))
            {

                // Security Guard: Halt processing immediately to prevent cross-tenant parameter bleeding
                return BadRequest("Access Denied: Missing or malformed multi-tenant organization context parameters.");
            }

            var academy = _dbContext.Academies.FirstOrDefault(a=> a.Id == academyClaim);
            string academyName = academy?.Name ?? "Unknown Academy";
            authClaims.Add(new Claim("academyName", academyName));

            // --- Generate Token Signing Configurations ---
            var jwtSettings = _configuration.GetSection("JwtSettings");
            var authSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings["Secret"]!));

            var token = new JwtSecurityToken(
                issuer: jwtSettings["Issuer"],
                audience: jwtSettings["Audience"],
                expires: DateTime.UtcNow.AddMinutes(double.Parse(jwtSettings["ExpiryInMinutes"]!)),
                claims: authClaims,
                signingCredentials: new SigningCredentials(authSigningKey, SecurityAlgorithms.HmacSha256)
            );


            return Ok(new
            {
                token = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler().WriteToken(token),
                expiration = token.ValidTo
            });
        }

        return Unauthorized("Cryptographic handshake failed: Invalid email or password credentials.");
    }
    [HttpPost("update-user-role")]
    [Authorize(Roles = "AcademyDirector,GlobalAdmin")] // Lock down strictly to executives
    public async Task<IActionResult> UpdateUserRole([FromBody] UpdateUserRoleDto model)
    {
        var user = await _userManager.FindByEmailAsync(model.Email);
        if (user == null) return NotFound("Target identity user account could not be located in database registries.");

        // Extract current roles to perform a clean swap transformation
        var currentRoles = await _userManager.GetRolesAsync(user);
        
        // Clear legacy role assignments to prevent identity collision anomalies
        await _userManager.RemoveFromRolesAsync(user, currentRoles);

        // Commit the fresh structural system role assignment
        var result = await _userManager.AddToRoleAsync(user, model.NewRole);
        if (!result.Succeeded) return BadRequest("Identity Exception: Failed to modify system role security claims.");

        // CRITICAL: Refresh the user's explicit Role claim inside AspNetUserClaims table 
        // so the JWT token generator and frontend layout logic sync perfectly on the next login!
        var claims = await _userManager.GetClaimsAsync(user);
        var oldRoleClaim = claims.FirstOrDefault(c => c.Type == System.Security.Claims.ClaimTypes.Role);
        if (oldRoleClaim != null)
        {
            await _userManager.RemoveClaimAsync(user, oldRoleClaim);
        }
        await _userManager.AddClaimAsync(user, new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Role, model.NewRole));

        return Ok(new { Message = $"Account authorization elevated successfully. {model.Email} is now assigned as {model.NewRole}." });
    }
    // =========================================================================
    // FETCH ALL USERS BELONGING TO THE ACTIVE MULTI-TENANT PARTITION
    // =========================================================================
    [HttpGet("tenant-users")]
    [Authorize(Roles = "AcademyDirector,GlobalAdmin")]
    public async Task<IActionResult> GetTenantUsers()
    {
        // Fetch users. Since they share an AcademyId claim context, we filter by that claim natively.
        var currentAcademyId = _tenantProvider.GetTenantId().ToString();
        var allUsers = _userManager.Users.ToList();
        var tenantFilteredUsers = new List<object>();

        foreach (var user in allUsers)
        {
            var claims = await _userManager.GetClaimsAsync(user);
            var academyClaim = claims.FirstOrDefault(c => c.Type.Equals("AcademyId", StringComparison.OrdinalIgnoreCase))?.Value;
            
            // If the user belongs to the active director's academy partition, extract their profile data matrix
            if (academyClaim == currentAcademyId)
            {
                var roles = await _userManager.GetRolesAsync(user);
                tenantFilteredUsers.Add(new
                {
                    id = user.Id,
                    email = user.Email,
                    userName = user.UserName,
                    role = roles.FirstOrDefault() ?? "Player",
                    phoneNumber = user.PhoneNumber,
                    isActive = user.EmailConfirmed // Using Identity flags or a custom property to track operational state
                });
            }
        }

        return Ok(tenantFilteredUsers);
    }
    // =========================================================================
    // PROVISION A FRESH MULTI-TENANT CONSCIOUS USER ACCOUNT LIFE-CYCLE
    // =========================================================================
    [HttpPost("provision-user")]
    [Authorize(Roles = "AcademyDirector,GlobalAdmin")]
    public async Task<IActionResult> ProvisionUser([FromBody] ProvisionUserDto model)
    {
        var existingUser = await _userManager.FindByEmailAsync(model.Email);
        if (existingUser != null) return BadRequest("Identity Exception: Account email is already registered to a tenant branch system.");

        var freshUser = new Microsoft.AspNetCore.Identity.IdentityUser
        {
            UserName = model.UserName.Trim(),
            Email = model.Email,
            PhoneNumber = model.PhoneNumber,
            EmailConfirmed = true // Instantly unlock authentication flags
        };

        var createResult = await _userManager.CreateAsync(freshUser, model.Password);
        if (!createResult.Succeeded) return BadRequest(createResult.Errors.FirstOrDefault()?.Description ?? "Failed to create identity credentials row.");

        // Dynamic Multi-Tenant Alignment: Stamp the active Director's AcademyId onto the new account passport entries
        var activeTenantGuid = _tenantProvider.GetTenantId();
        await _userManager.AddClaimAsync(freshUser, new Claim("AcademyId", activeTenantGuid.ToString()));
        await _userManager.AddClaimAsync(freshUser, new Claim(ClaimTypes.Role, model.Role));
        await _userManager.AddToRoleAsync(freshUser, model.Role);

        // =========================================================================
        // 🚀 WELCOME ONBOARDING TOUCHPOINT: MANUAL DIRECTOR CREATION
        // =========================================================================
        try
        {
            await _emailEngine.SendWelcomeOnboardingEmailAsync(
                recipientEmail: freshUser.Email!,
                recipientName: freshUser.UserName ?? freshUser.Email!,
                academyId: activeTenantGuid);
        }
        catch { /* Maintain dashboard stability if the email channel slips */ }

        return Ok(new
        {
            id = freshUser.Id,
            email = freshUser.Email,
            userName = freshUser.UserName,
            role = model.Role,
            isActive = true,
            phoneNumber = model.PhoneNumber
        });
    }
    // =========================================================================
    // UPDATE EXISTING IDENTITY USER PROFILE METADATA & ROLES (PUT)
    // =========================================================================
    [HttpPut("users/{userId}")]
    [Authorize]
    public async Task<IActionResult> UpdateUser(string userId, [FromBody] UpdateUserPayloadDto model)
    {
        // Extract the calling user's Identity Id from the JWT claims context
        var userIdClaimString = HttpContext.User.Claims
            .FirstOrDefault(c => c.Type.Contains("nameidentifier") || c.Type == "sub" || c.Type == "nameid")?.Value;

        // Isolate clearance flags using the ambient User role claims context
        var isDirector = User.IsInRole("AcademyDirector") || User.IsInRole("GlobalAdmin");

        // =========================================================================
        // SECURITY IN-METHOD FIREWALL BLOCK: PROTECTS AGAINST CROSS-USER SCRIPTING
        // =========================================================================
        if (!isDirector && userIdClaimString != userId)
        {
            return Forbid("Security Violation: Players are strictly locked to modifying their own profile nodes.");
        }

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound("Target identity user account could not be found.");

        // Enforce Tenant Partition Isolation Boundary
        var currentAcademyId = _tenantProvider.GetTenantId().ToString();
        var claims = await _userManager.GetClaimsAsync(user);
        var academyClaim = claims.FirstOrDefault(c => c.Type.Equals("AcademyId", StringComparison.OrdinalIgnoreCase))?.Value;
        if (academyClaim != currentAcademyId) return Forbid("Security Violation: Unauthorized cross-tenant modification attempt.");

        // 1. OPEN TRANSACTION BOUNDARY FILTER
        using var transaction = await _dbContext.Database.BeginTransactionAsync();
        try
        {
            // Update core mutable properties
            user.Email = model.Email.Trim();
            user.UserName = model.UserName.Trim(); 
            user.PhoneNumber = model.PhoneNumber;

            // =========================================================================
            // PRIVILEGE LOCKS: Players cannot activate/deactivate accounts or change roles
            // =========================================================================
            if (isDirector)
            {
                user.EmailConfirmed = model.IsActive; 
            }

            var updateResult = await _userManager.UpdateAsync(user);
            if (!updateResult.Succeeded)
            {
                await transaction.RollbackAsync();
                return BadRequest("Failed to update identity registration rows.");
            }

            // Only run the complex role assignment tracking loop if a Director initiates it
            var currentRoles = await _userManager.GetRolesAsync(user);
            string activeTargetRole = isDirector ? model.Role : currentRoles.FirstOrDefault() ?? "Player";

            if (isDirector && !currentRoles.Contains(activeTargetRole))
            {
                var removeRoleResult = await _userManager.RemoveFromRolesAsync(user, currentRoles);
                var addRoleResult = await _userManager.AddToRoleAsync(user, activeTargetRole);

                if (!removeRoleResult.Succeeded || !addRoleResult.Succeeded)
                {
                    await transaction.RollbackAsync();
                    return BadRequest("Failed to update security role mappings.");
                }

                // Update the token generation role claim row
                var oldRoleClaim = claims.FirstOrDefault(c => c.Type == ClaimTypes.Role || c.Type == "role");
                if (oldRoleClaim != null) await _userManager.RemoveClaimAsync(user, oldRoleClaim);
                await _userManager.AddClaimAsync(user, new Claim(ClaimTypes.Role, activeTargetRole));
            }

            // 2. COMMIT TRANSACTION LIVE TO POSTGRESQL REGISTRIES
            await transaction.CommitAsync();

            return Ok(new
            {
                id = user.Id,
                email = user.Email,
                userName = user.UserName,
                role = activeTargetRole, // Echoes the safe validated role
                isActive = user.EmailConfirmed,
                phoneNumber = user.PhoneNumber
            });
        }
        catch (Exception)
        {
            // Safe cascading error rollback safeguard
            await transaction.RollbackAsync();
            return StatusCode(500, "Transaction Exception: Identity updates aborted due to an internal system fault.");
        }
    }

    // =========================================================================
    // PERMANENTLY PURGE USER IDENTITY FROM THE TENANT DATABASE MIGRATION (DELETE)
    // =========================================================================
    [HttpDelete("users/{userId}")]
    [Authorize(Roles = "AcademyDirector,GlobalAdmin")]
    public async Task<IActionResult> DeleteUser(string userId)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound("Target identity user record does not exist.");

        // Enforce Tenant Partition Isolation Boundary
        var currentAcademyId = _tenantProvider.GetTenantId().ToString();
        var claims = await _userManager.GetClaimsAsync(user);
        var academyClaim = claims.FirstOrDefault(c => c.Type.Equals("AcademyId", StringComparison.OrdinalIgnoreCase))?.Value;
        if (academyClaim != currentAcademyId) return Forbid("Security Block: Cross-tenant entity drop rejected.");

        // Delete user (PostgreSQL cascade cascades down to clear UserBranches and UserCourts mappings automatically)
        var deleteResult = await _userManager.DeleteAsync(user);
        if (!deleteResult.Succeeded) return BadRequest("Identity Exception: Unable to purge user entry.");

        return Ok(new { Message = "Account record wiped cleanly." });
    }
    [HttpPost("register-player-public")]
    [AllowAnonymous] // Open publicly to the open internet so new players can reach it!
    public async Task<IActionResult> RegisterPlayerPublicly([FromBody] PublicPlayerRegisterDto model)
    {
        if (!await _turnstileValidator.IsHumanAsync(model.TurnstileToken))
        {
            return BadRequest(new { message = "Security Intercept: Automated bot signature detected or challenge token expired." });
        }

        if (!Guid.TryParse(model.AcademyId, out Guid academyGuid))
        {
            return BadRequest(new { Message = "Identity Exception: The targeted Academy invitation link format is invalid." });
        }

        // 1. SECURITY CHECKS: Ensure this target Academy actually exists in our system
        var academyExists = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
        .AnyAsync(_dbContext.Academies, a => a.Id == academyGuid);

        if (!academyExists)
        {
            return NotFound(new { Message = "Security Obstacle: The referenced tenant academy system branch does not exist." });
        }

        // 2. CHECK FOR EMAIL COLLISION
        var existingUser = await _userManager.FindByEmailAsync(model.Email);
        if (existingUser != null)
        {
            return BadRequest(new { Message = "Identity Exception: Account email is already registered to a network tenant." });
        }

        // 3. PROVISION IDENTITY USER SCHEMAS
        var freshUser = new IdentityUser
        {
            UserName = model.Email,
            Email = model.Email,
            PhoneNumber = model.PhoneNumber,
            EmailConfirmed = true // Automatically clear authorization flags for rapid prototyping entry
        };

        var createResult = await _userManager.CreateAsync(freshUser, model.Password);
        if (!createResult.Succeeded)
        {
            return BadRequest(new { Message = createResult.Errors.FirstOrDefault()?.Description ?? "Failed to compile password security constraints." });
        }

        // 4. MULTI-TENANT LOCKDOWN EXTRACTION
        // We bind the incoming URL AcademyId directly to this player profile passport.
        // This locks them completely inside that tenant boundary!
        await _userManager.AddToRoleAsync(freshUser, "Player");
        await _userManager.AddClaimAsync(freshUser, new Claim("AcademyId", academyGuid.ToString()));
        await _userManager.AddClaimAsync(freshUser, new Claim(ClaimTypes.Role, "Player"));

        try
        {
            await _emailEngine.SendWelcomeOnboardingEmailAsync(
                recipientEmail: freshUser.Email!,
                recipientName: freshUser.UserName ?? freshUser.Email!,
                academyId: academyGuid);
        }
        catch (Exception emailEx)
        {
            // Log the email sending failure but do not block the booking confirmation
            Console.WriteLine($"Email dispatch failure: {emailEx.Message} {emailEx.StackTrace} {emailEx.InnerException}");
        }

        return Ok(new { Message = "Player account initialized cleanly." });
    }
}

public record LoginDto(string Email, string Password, string TurnstileToken = "");
public record PublicPlayerRegisterDto(string Email, string Password, string PhoneNumber, string AcademyId, string TurnstileToken = "");
public record RegisterAcademyDto(string Email, string Password, string AcademyName);
public record UpdateUserRoleDto(string Email, string NewRole);
public record ProvisionUserDto(string Email, string UserName, string Password, string Role, string PhoneNumber);
public record UpdateUserPayloadDto(string Email, string UserName, string Role, string PhoneNumber, bool IsActive);
// Data Transfer Object definition model record
