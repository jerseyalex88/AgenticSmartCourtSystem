using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using GlobalAcademy.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace GlobalAcademy.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly UserManager<IdentityUser> _userManager;
    private readonly RoleManager<IdentityRole> _roleManager;
    private readonly IConfiguration _configuration;
    private readonly ITenantProvider _tenantProvider;

    public AuthController(
        UserManager<IdentityUser> userManager, 
        RoleManager<IdentityRole> roleManager, 
        IConfiguration configuration,
        ITenantProvider tenantProvider)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _configuration = configuration;
        _tenantProvider = tenantProvider;
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

    // [HttpPost("login")]
    // public async Task<IActionResult> Login([FromBody] LoginDto model)
    // {
    //     var user = await _userManager.FindByEmailAsync(model.Email);
    //     if (user == null || !await _userManager.CheckPasswordAsync(user, model.Password))
    //     {
    //         return Unauthorized(new { Message = "Invalid credentials." });
    //     }

    //     var userClaims = await _userManager.GetClaimsAsync(user);
    //     var academyClaim = userClaims.FirstOrDefault(c => c.Type == "AcademyId")?.Value ?? Guid.Empty.ToString();
    //     var userRoles = await _userManager.GetRolesAsync(user);

    //     var authClaims = new List<Claim>
    //     {
    //         new(ClaimTypes.Name, user.UserName!),
    //         new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
    //         new("AcademyId", academyClaim) 
    //     };

    //     foreach (var role in userRoles)
    //     {
    //         authClaims.Add(new Claim(ClaimTypes.Role, role));
    //     }

    //     var jwtSettings = _configuration.GetSection("JwtSettings");
    //     var authSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings["Secret"]!));

    //     var token = new JwtSecurityToken(
    //         issuer: jwtSettings["Issuer"],
    //         audience: jwtSettings["Audience"],
    //         expires: DateTime.UtcNow.AddMinutes(double.Parse(jwtSettings["ExpiryInMinutes"]!)),
    //         claims: authClaims,
    //         signingCredentials: new SigningCredentials(authSigningKey, SecurityAlgorithms.HmacSha256)
    //     );

    //     return Ok(new
    //     {
    //         Token = new JwtSecurityTokenHandler().WriteToken(token),
    //         Expiration = token.ValidTo
    //     });
    // }
    
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto model)
    {
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
                new Claim("jti", Guid.NewGuid().ToString())
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
            UserName = model.Email,
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
    [Authorize(Roles = "AcademyDirector,GlobalAdmin")]
    public async Task<IActionResult> UpdateUser(string userId, [FromBody] UpdateUserPayloadDto model)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound("Target identity user account could not be found.");

        // Enforce Tenant Partition Isolation Boundary
        var currentAcademyId = _tenantProvider.GetTenantId().ToString();
        var claims = await _userManager.GetClaimsAsync(user);
        var academyClaim = claims.FirstOrDefault(c => c.Type.Equals("AcademyId", StringComparison.OrdinalIgnoreCase))?.Value;
        if (academyClaim != currentAcademyId) return Forbid("Security Violation: Unauthorized cross-tenant modification attempt intercepted.");

        // Update core mutable properties
        user.Email = model.Email;
        user.UserName = model.Email; // Standard identity sync behavior
        user.PhoneNumber = model.PhoneNumber;
        user.EmailConfirmed = model.IsActive; // Mapping IsActive state onto EmailConfirmed for testing flag visibility

        var updateResult = await _userManager.UpdateAsync(user);
        if (!updateResult.Succeeded) return BadRequest("Failed to update identity registration rows.");

        // Synchronize Security Role Assignments
        var currentRoles = await _userManager.GetRolesAsync(user);
        if (!currentRoles.Contains(model.Role))
        {
            await _userManager.RemoveFromRolesAsync(user, currentRoles);
            await _userManager.AddToRoleAsync(user, model.Role);

            // Update the token generation role claim row
            var oldRoleClaim = claims.FirstOrDefault(c => c.Type == ClaimTypes.Role || c.Type == "role");
            if (oldRoleClaim != null) await _userManager.RemoveClaimAsync(user, oldRoleClaim);
            await _userManager.AddClaimAsync(user, new Claim(ClaimTypes.Role, model.Role));
        }

        return Ok(new { Message = "User profile row modified successfully." });
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
}

public record RegisterAcademyDto(string Email, string Password, string AcademyName);
public record LoginDto(string Email, string Password);
public record UpdateUserRoleDto(string Email, string NewRole);
public record ProvisionUserDto(string Email, string Password, string Role, string PhoneNumber);
public record UpdateUserPayloadDto(string Email, string Role, string PhoneNumber, bool IsActive);
