using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using GlobalAcademy.Data;
using GlobalAcademy.Models;
using GlobalAcademy.Security;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.IdentityModel.Tokens.Jwt;

namespace GlobalAcademy.Controllers;

/// <summary>
/// 💼 CONTROLLER: Secure Multi-Tenant Overlord Dashboard Panel for GlobalAdmin Roles
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "GlobalAdmin")] // Gates access strictly to the master system guardian role
public class AcademiesController : ControllerBase
{
    private readonly ApplicationDbContext _dbContext;
    private readonly UserManager<IdentityUser> _userManager;
    private readonly IConfiguration _configuration;

    public AcademiesController(
        ApplicationDbContext dbContext, 
        UserManager<IdentityUser> userManager,
        IConfiguration configuration)
    {
        _dbContext = dbContext;
        _userManager = userManager;
        _configuration = configuration;
    }

    /// <summary>
    /// 1. READ ALL: Displays the complete list of available academies from the system table
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetAllAcademies()
    {
        // .IgnoreQueryFilters() is vital here to let the GlobalAdmin view all entries un-partitioned

        var academies = await _dbContext.Academies
            .IgnoreQueryFilters()
            .OrderByDescending(a => a.CreatedAtUtc)
            .Select(a => new {
                a.Id,
                a.Name,
                a.Description,
                a.CreatedAtUtc,
                BranchCount = _dbContext.Branches.IgnoreQueryFilters().Count(b => b.AcademyId == a.Id)
            })
            .ToListAsync();

        return Ok(academies);
    }

    /// <summary>
    /// 2. READ SINGLE: Fetches data for an explicit academy node
    /// </summary>
    [HttpGet("{id}")]

    public async Task<IActionResult> GetAcademyById(Guid id)
    {
        var academy = await _dbContext.Academies
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(a => a.Id == id);

        if (academy == null)
        {
            return NotFound(new { Message = "Target academy record does not exist." });
        }

        return Ok(academy);
    }

    /// <summary>
    /// 3. CREATE: Deploys a brand new academy entity node into the global infrastructure grid
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateAcademy([FromBody] AcademyDto model)

    {
        if (string.IsNullOrWhiteSpace(model.Name))
        {
            return BadRequest(new { Message = "Validation Error: Academy designation title cannot be empty." });
        }

        var newAcademy = new Academy
        {
            Id = Guid.NewGuid(),
            Name = model.Name.Trim(),
            Description = model.Description?.Trim() ?? string.Empty,
            CreatedAtUtc = DateTime.UtcNow
        };

        _dbContext.Academies.Add(newAcademy);
        await _dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetAcademyById), new { id = newAcademy.Id }, newAcademy);
    }


    /// <summary>
    /// 4. UPDATE: Modifies structural configurations for a specific academy location row
    /// </summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateAcademy(Guid id, [FromBody] AcademyDto model)
    {
        var academy = await _dbContext.Academies
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(a => a.Id == id);

        if (academy == null)
        {
            return NotFound(new { Message = "Target academy profile row not found." });
        }

        if (string.IsNullOrWhiteSpace(model.Name))
        {
            return BadRequest(new { Message = "Validation Error: Academy designation title cannot be empty." });
        }


        academy.Name = model.Name.Trim();
        academy.Description = model.Description?.Trim() ?? string.Empty;

        await _dbContext.SaveChangesAsync();
        return Ok(new { Message = "Academy parameters updated successfully.", Academy = academy });
    }

    /// <summary>
    /// 5. DELETE: Purges an academy and cascading branch architectures safely
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteAcademy(Guid id)
    {
        var academy = await _dbContext.Academies
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(a => a.Id == id);

        if (academy == null)
        {

            return NotFound(new { Message = "Target academy structure not flagged for removal." });
        }

        // Cascade cleanup protections are executed cleanly based on your PostgreSQL constraint structures
        _dbContext.Academies.Remove(academy);
        await _dbContext.SaveChangesAsync();

        return Ok(new { Message = $"Academy '{academy.Name}' has been permanently decommissioned from the system." });
    }

    /// <summary>
    /// 🌟 6. TENANT OVERRIDE SELECTOR: Assigns a target academy as the active management workspace for the admin session
    /// </summary>
    [HttpPost("{id}/set-active")]
    public async Task<IActionResult> SetActiveAcademyOverride(Guid id)
    {
        // 1. Verify target academy identity exists before establishing session overrides
        var academyExists = await _dbContext.Academies.IgnoreQueryFilters().AnyAsync(a => a.Id == id);
        if (!academyExists)
        {
            Console.WriteLine("Impersonation Denied: The target academy node does not exist.");
            return BadRequest(new { Message = "Impersonation Denied: The target academy node does not exist." });
        }

        var userIdClaimString = HttpContext.User.Claims
            .FirstOrDefault(c => c.Type.Contains("nameidentifier") || c.Type == "sub" || c.Type == "nameid")?.Value;

        Guid userId = Guid.Empty;
        
        // Safely parse the extracted token string value into a valid structural Guid token type
        if (!string.IsNullOrEmpty(userIdClaimString) && Guid.TryParse(userIdClaimString, out Guid parsedGuid))
        {
            userId = parsedGuid;
        }
        else
        {
            Console.WriteLine("Security Gate Failure: Active security principal session context is missing.");
            return Unauthorized(new { Message = "Security Gate Failure: Active security principal session context is missing." });
        }

        // 2. Direct EF Core Table Target: Find the single exact row targeting this specific user and claim type
        var activeClaimRow = await _dbContext.UserClaims
            .FirstOrDefaultAsync(uc => uc.UserId == userIdClaimString && uc.ClaimType == "AcademyId");

        if (activeClaimRow != null)
        {
            Console.WriteLine($"Update Active Claim Row: {activeClaimRow.ToString()}");
            // 🚀 ONE-SHOT ATOMIC SWAP: Mutate the value directly on the monitored row object
            activeClaimRow.ClaimValue = id.ToString();
        }
        else
        {
            // Fallback: If for some reason the admin row is missing, handle safe insertion tracking
            var newClaim = new Microsoft.AspNetCore.Identity.IdentityUserClaim<string>
            {
                UserId = userIdClaimString,
                ClaimType = "AcademyId",
                ClaimValue = id.ToString()
            };
                        
            Console.WriteLine($"Insert New Claim Row: {newClaim.ToString()}");
            _dbContext.UserClaims.Add(newClaim);
        }

        // 3. Persist modifications atomically to PostgreSQL via a single transaction pipeline call
        await _dbContext.SaveChangesAsync();

        // 🚀 NEW SECURITY INJECTION STRATEGY: Re-compile a fresh production security token 
        // carrying the brand-new, updated database claim values instantly!
        var user = await _userManager.FindByIdAsync(userIdClaimString);
        if (user == null)
        {
            return Unauthorized(new { Message = "Security Gate Failure: Active security principal session context is missing." });
        }

        var (tokenString, expirationTime) = await GenerateJwtTokenAsync(user); 

        // Return the fresh security credentials back out to the client payload
        return Ok(new { 
            message = "Master tenant tracking updated successfully.", 
            activeAcademyId = id,
            token = tokenString, // ◄--- Crucial token attachment payload!
            expiration = expirationTime
        });
    }
    private async Task<(string Token, DateTime Expiration)> GenerateJwtTokenAsync(IdentityUser user)
    {
        var userRoles = await _userManager.GetRolesAsync(user);
        var userClaims = await _userManager.GetClaimsAsync(user);

        var authClaims = new List<Claim>
        {
            new Claim("http://xmlsoap.org", user.UserName!),
            new Claim("jti", Guid.NewGuid().ToString()),
            new Claim("nameidentifier", user.Id),
            new Claim("email", user.Email!),
            new Claim("username", user.UserName!)
        };

        foreach (var claim in userClaims)
        {
            if (claim.Type != ClaimTypes.Role && claim.Type != "role") authClaims.Add(claim);
        }

        foreach (var userRole in userRoles)
        {
            authClaims.Add(new Claim(ClaimTypes.Role, userRole));
        }

        var academyClaimValue = userClaims.FirstOrDefault(c => c.Type.Equals("AcademyId", StringComparison.OrdinalIgnoreCase))?.Value;
        if (!string.IsNullOrEmpty(academyClaimValue) && Guid.TryParse(academyClaimValue, out Guid academyClaim))
        {
            var academy = _dbContext.Academies.FirstOrDefault(a => a.Id == academyClaim);
            if (academy != null) authClaims.Add(new Claim("academyName", academy.Name));
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

        // 🚀 FIXED: Returns both parameters simultaneously back to the execution caller loops
        string encodedToken = new JwtSecurityTokenHandler().WriteToken(token);
        return (encodedToken, token.ValidTo);
    }
}

/// <summary>
/// Data Transfer Object parsing inbound data parameters securely.

/// </summary>
public class AcademyDto
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}

