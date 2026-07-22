using Microsoft.SemanticKernel;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel;
using GlobalAcademy.Data;
using GlobalAcademy.Models;
using Microsoft.AspNetCore.Identity;
using System.Security.Claims;

namespace GlobalAcademy.Plugins;

public class DirectorOperationsPlugin
{
    private readonly UserManager<IdentityUser> _userManager;
    private readonly ApplicationDbContext _dbContext;

    public DirectorOperationsPlugin(UserManager<IdentityUser> userManager,
        ApplicationDbContext dbContext)
    {
        _userManager = userManager;
        _dbContext = dbContext;
    }

    [KernelFunction, Description("Creates and provisions a new branch venue location record under the current active academy.")]
    public async Task<string> AdminCreateBranchAsync(
        Kernel kernel,
        [Description("Descriptive name of the new branch venue (e.g., 'London Center Hub')")] string branchName,
        [Description("Details regarding the branch layout or profile description")] string description,
        [Description("Standard IANA timezone identifier string (e.g., 'Europe/London', 'Asia/Dubai')")] string timeZoneId)
    {
        if (!kernel.Data.TryGetValue("academyId", out var academyIdObj) || academyIdObj is not Guid academyId)
        {
            return "Transaction rejected: Missing or invalid security academy perimeter claim scope.";
        }

        var newBranch = new Branch
        {
            Id = Guid.NewGuid(),
            AcademyId = academyId,
            Name = branchName,
            Description = description,
            TimeZoneId = timeZoneId,
            IsDecommissioned = false,
            CreatedAtUtc = DateTime.UtcNow
        };

        _dbContext.Branches.Add(newBranch);
        await _dbContext.SaveChangesAsync();

        string todayStr = DateTime.UtcNow.ToString("yyyy-MM-dd");
        return $"Success! Branch venue '{branchName}' has been successfully provisioned. [FRONTEND_ACTION:SET_DATE:{todayStr}]";
    }

    [KernelFunction, Description("Queries the database to fetch a list of all active non-decommissioned branches inside this academy partition.")]
    public async Task<string> AdminGetBranchesAsync(Kernel kernel)
    {
        if (!kernel.Data.TryGetValue("academyId", out var academyIdObj) || academyIdObj is not Guid academyId)
        {
            return "Transaction rejected: Invalid tenant boundary context configuration parameters.";
        }

        var branches = await _dbContext.Branches
            .Where(b => b.AcademyId == academyId && !b.IsDecommissioned)
            .ToListAsync();

        if (!branches.Any()) return "📋 [ACADEMY VENUE LEDGER]: No active branches exist under this academy configuration blueprint.";

        var summary = "📋 [ACADEMY VENUE LEDGER]:\n";
        foreach (var b in branches)
        {
            summary += $"• {b.Name} (ID: {b.Id}) — Zone: {b.TimeZoneId} | Description: {b.Description}\n";
        }
        return summary;
    }

    [KernelFunction, Description("Modifies baseline descriptive configurations and IANA timezone metadata definitions for an active branch.")]
    public async Task<string> AdminUpdateBranchAsync(
        Kernel kernel,
        [Description("The unique identifier Guid or natural name string of the branch venue to modify")] string branchIdentifier,
        [Description("Updated descriptive name of the branch venue")] string newName,
        [Description("Updated details regarding the branch venue layout")] string description,
        [Description("Updated standard IANA timezone identifier string")] string timeZoneId)
    {
        if (!kernel.Data.TryGetValue("academyId", out var academyIdObj) || academyIdObj is not Guid academyId)
        {
            return "Transaction rejected: Session claims parsing validation failure.";
        }

        Branch? branch = null;
        if (Guid.TryParse(branchIdentifier, out var branchGuid))
        {
            branch = await _dbContext.Branches.FirstOrDefaultAsync(b => b.Id == branchGuid && b.AcademyId == academyId);
        }
        else
        {
            branch = await _dbContext.Branches.FirstOrDefaultAsync(b => b.Name.ToLower() == branchIdentifier.ToLower() && b.AcademyId == academyId);
        }

        if (branch == null) return $"Validation Error: Branch matching identifier '{branchIdentifier}' not found.";
        if (branch.IsDecommissioned) return "Operation Aborted: Cannot modify an already decommissioned branch venue profile.";

        branch.Name = newName;
        branch.Description = description;
        branch.TimeZoneId = timeZoneId;

        await _dbContext.SaveChangesAsync();

        string todayStr = DateTime.UtcNow.ToString("yyyy-MM-dd");
        return $"Success! Branch venue configuration updated cleanly to '{newName}'. [FRONTEND_ACTION:SET_DATE:{todayStr}]";
    }

    [KernelFunction, Description("Soft-deletes and decommissions a branch location from active operations if no downstream historical court bookings exist.")]
    public async Task<string> AdminDecommissionBranchAsync(
        Kernel kernel,
        [Description("The unique identifier Guid or natural name string of the branch venue to decommission")] string branchIdentifier)
    {
        if (!kernel.Data.TryGetValue("academyId", out var academyIdObj) || academyIdObj is not Guid academyId)
        {
            return "Transaction rejected: Invalid security token profile identity mapping context.";
        }

        Branch? branch = null;
        if (Guid.TryParse(branchIdentifier, out var branchGuid))
        {
            branch = await _dbContext.Branches.FirstOrDefaultAsync(b => b.Id == branchGuid && b.AcademyId == academyId);
        }
        else
        {
            branch = await _dbContext.Branches.FirstOrDefaultAsync(b => b.Name.ToLower() == branchIdentifier.ToLower() && b.AcademyId == academyId);
        }

        if (branch == null) return $"Validation Error: Targeted branch venue profile matching '{branchIdentifier}' not found.";
        if (branch.IsDecommissioned) return $"Notification: Branch venue '{branch.Name}' is already marked as decommissioned.";

        // THE INTEGRITY GUARDRAIL: Verify no active or historical bookings exist on any child court under this branch
        bool hasBookingsBound = await _dbContext.Bookings.AnyAsync(b => b.BranchId == branch.Id && b.AcademyId == academyId);
        if (hasBookingsBound)
        {
            return $"Security Exception Blocked: Branch venue '{branch.Name}' cannot be decommissioned because related player booking history blocks exist in downstream nested tables.";
        }

        // Soft-Decommission Tweak
        branch.IsDecommissioned = true;
        
        // Cascade decommissioning onto underlying court rows safely since no bookings exist
        var underlyingCourts = await _dbContext.Courts.Where(c => c.BranchId == branch.Id && c.AcademyId == academyId).ToListAsync();
        foreach (var court in underlyingCourts)
        {
            court.IsDecommissioned = true;
            court.Status = "Maintenance_Locked";
        }

        await _dbContext.SaveChangesAsync();

        string todayStr = DateTime.UtcNow.ToString("yyyy-MM-dd");
        return $"Success! Branch venue '{branch.Name}' and its empty child court entities have been successfully soft-decommissioned. [FRONTEND_ACTION:SET_DATE:{todayStr}]";
    }

    [KernelFunction, Description("Creates and provisions a new court asset underneath a specified parent branch using its Guid or name string.")]
    public async Task<string> AdminCreateCourtAsync(
        Kernel kernel,
        [Description("The unique identifier Guid or natural name string of the parent branch")] string branchIdentifier,
        [Description("Descriptive name of the court asset (e.g., 'Stadium Center Clay')")] string courtName,
        [Description("The type of surface (e.g., 'Clay', 'Hard', 'Grass')")] string surfaceType,
        [Description("Flag indicating if the court is enclosed indoors")] bool isIndoor,
        [Description("Initial dry traction friction tracking coefficient")] double dryCoefficient,
        [Description("The max wear minutes allowed before triggering a maintenance block")] int maintenanceCeiling)
    {
        if (!kernel.Data.TryGetValue("academyId", out var academyIdObj) || academyIdObj is not Guid academyId)
        {
            return "Transaction rejected: Missing or invalid security academy perimeter claim scope.";
        }

        // Resolve branch via Guid parsing fallback to natural text lookup
        Branch? branch = null;
        if (Guid.TryParse(branchIdentifier, out var branchGuid))
        {
            branch = await _dbContext.Branches.FirstOrDefaultAsync(b => b.Id == branchGuid && b.AcademyId == academyId);
        }
        else
        {
            branch = await _dbContext.Branches.FirstOrDefaultAsync(b => b.Name.ToLower() == branchIdentifier.ToLower() && b.AcademyId == academyId);
        }

        if (branch == null) return $"Validation Error: Parent branch location matching '{branchIdentifier}' does not exist under your tenant profile.";
        if (branch.IsDecommissioned) return "Operation Aborted: Target parent branch is decommissioned.";

        var newCourt = new Court
        {
            Id = Guid.NewGuid(),
            AcademyId = academyId,
            BranchId = branch.Id,
            Name = courtName,
            Description = "Provisioned via administrative agent interface conversation loop.",
            SurfaceType = surfaceType,
            IsIndoor = isIndoor,
            Status = "Open",
            DryCoefficient = dryCoefficient,
            IsDecommissioned = false,
            AggregateMinutesPlayed = 0,
            MaintenanceThresholdMinutes = maintenanceCeiling,
            CreatedAtUtc = DateTime.UtcNow
        };

        _dbContext.Courts.Add(newCourt);
        await _dbContext.SaveChangesAsync();

        string todayStr = DateTime.UtcNow.ToString("yyyy-MM-dd");
        return $"Success! Court '{courtName}' has been successfully provisioned under branch '{branch.Name}'. [FRONTEND_ACTION:SET_DATE:{todayStr}]";
    }

    [KernelFunction, Description("Lists and summarizes active courts and operational telemetry for a branch location.")]
    public async Task<string> AdminGetBranchCourtsAsync(
        Kernel kernel,
        [Description("The unique identifier Guid or natural name string of the branch")] string branchIdentifier)
    {
        if (!kernel.Data.TryGetValue("academyId", out var academyIdObj) || academyIdObj is not Guid academyId)
        {
            return "Transaction rejected: Invalid tenant boundary context configuration parameters.";
        }

        Branch? branch = null;
        if (Guid.TryParse(branchIdentifier, out var branchGuid))
        {
            branch = await _dbContext.Branches.FirstOrDefaultAsync(b => b.Id == branchGuid && b.AcademyId == academyId);
        }
        else
        {
            branch = await _dbContext.Branches.FirstOrDefaultAsync(b => b.Name.ToLower() == branchIdentifier.ToLower() && b.AcademyId == academyId);
        }

        if (branch == null) return $"Validation Error: Mapped branch location context matching '{branchIdentifier}' not found.";

        var courts = await _dbContext.Courts
            .Where(c => c.BranchId == branch.Id && c.AcademyId == academyId && !c.IsDecommissioned)
            .ToListAsync();

        if (!courts.Any()) return $"📋 [{branch.Name.ToUpper()} RESOURCE MATRIX]: No active court structures found.";

        var summary = $"📋 [{branch.Name.ToUpper()} RESOURCE MATRIX]:\n";
        foreach (var c in courts)
        {
            summary += $"• {c.Name} (ID: {c.Id}) — Status: {c.Status} | Surface: {c.SurfaceType} | Wear: {c.AggregateMinutesPlayed}/{c.MaintenanceThresholdMinutes} mins | Lights: {c.FloodlightState}\n";
        }
        return summary;
    }

    [KernelFunction, Description("Modifies operational attributes and telemetry metrics for a specific court asset.")]
    public async Task<string> AdminUpdateCourtAsync(
        Kernel kernel,
        [Description("The unique identifier Guid or natural name string of the court asset to edit")] string courtIdentifier,
        [Description("New name of the court asset")] string newName,
        [Description("Updated type of surface (e.g., 'Clay', 'Hard', 'Grass')")] string surfaceType,
        [Description("Updated weather tracking dry friction coefficient")] double dryCoefficient,
        [Description("Updated hard ceiling threshold for wear maintenance locks")] int maintenanceCeiling)
    {
        if (!kernel.Data.TryGetValue("academyId", out var academyIdObj) || academyIdObj is not Guid academyId)
        {
            return "Transaction rejected: Session claims parsing validation failure.";
        }

        Court? court = null;
        if (Guid.TryParse(courtIdentifier, out var courtGuid))
        {
            court = await _dbContext.Courts.Include(c => c.Branch).FirstOrDefaultAsync(c => c.Id == courtGuid && c.AcademyId == academyId);
        }
        else
        {
            court = await _dbContext.Courts.Include(c => c.Branch).FirstOrDefaultAsync(c => c.Name.ToLower() == courtIdentifier.ToLower() && c.AcademyId == academyId);
        }

        if (court == null) return $"Validation Error: Court asset matching '{courtIdentifier}' does not exist or is unauthorized.";
        if (court.IsDecommissioned) return "Operation Aborted: Cannot modify an already decommissioned court asset.";

        court.Name = newName;
        court.SurfaceType = surfaceType;
        court.DryCoefficient = dryCoefficient;
        court.MaintenanceThresholdMinutes = maintenanceCeiling;

        await _dbContext.SaveChangesAsync();

        string todayStr = DateTime.UtcNow.ToString("yyyy-MM-dd");
        return $"Success! Court structure config updated cleanly to '{newName}'. [FRONTEND_ACTION:SET_DATE:{todayStr}]";
    }

    [KernelFunction, Description("Soft-deletes and decommissions a court asset from live operations if no booking history exists.")]
    public async Task<string> AdminDecommissionCourtAsync(
        Kernel kernel,
        [Description("The unique identifier Guid or natural name string of the court asset to decommission")] string courtIdentifier)
    {
        if (!kernel.Data.TryGetValue("academyId", out var academyIdObj) || academyIdObj is not Guid academyId)
        {
            return "Transaction rejected: Invalid security token profile identity mapping context.";
        }

        Court? court = null;
        if (Guid.TryParse(courtIdentifier, out var courtGuid))
        {
            court = await _dbContext.Courts.FirstOrDefaultAsync(c => c.Id == courtGuid && c.AcademyId == academyId);
        }
        else
        {
            court = await _dbContext.Courts.FirstOrDefaultAsync(c => c.Name.ToLower() == courtIdentifier.ToLower() && c.AcademyId == academyId);
        }

        if (court == null) return $"Validation Error: Targeted court matching '{courtIdentifier}' not found.";
        if (court.IsDecommissioned) return $"Notification: Court '{court.Name}' is already marked as decommissioned.";

        // THE GOLDEN CASCADING INTEGRITY LOCK: Verify no historical or upcoming bookings are linked
        bool hasBookingsBound = await _dbContext.Bookings.AnyAsync(b => b.CourtId == court.Id && b.AcademyId == academyId);
        if (hasBookingsBound)
        {
            return $"Security Exception Blocked: Court '{court.Name}' cannot be decommissioned because relational booking history links exist in the database.";
        }

        // Execute Soft-Decommission Tweak
        court.IsDecommissioned = true;
        court.Status = "Maintenance_Locked";
        await _dbContext.SaveChangesAsync();

        string todayStr = DateTime.UtcNow.ToString("yyyy-MM-dd");
        return $"Success! Court '{court.Name}' has been successfully soft-decommissioned and removed from scheduling windows. [FRONTEND_ACTION:SET_DATE:{todayStr}]";
    }

    [KernelFunction, Description("Provisions and creates a brand new user account inside the director's multi-tenant partition.")]
    public async Task<string> AdminProvisionUserAsync(
        Kernel kernel,
        [Description("The unique account email coordinate string (e.g., 'sam@test.com')")] string email,
        [Description("The preferred username handle or profile nickname (e.g., 'SamSpade')")] string userName,
        [Description("The raw initial access password string")] string password,
        [Description("The targeted authorization security tier role (e.g., 'Groundskeeper')")] string role,
        [Description("Optional phone contact details")] string phoneNumber)
    {
        if (!kernel.Data.TryGetValue("academyId", out var academyIdObj) || academyIdObj is not Guid academyId)
        {
            return "Transaction rejected: Missing or invalid security academy perimeter claim scope.";
        }

        var existingUser = await _userManager.FindByEmailAsync(email);
        if (existingUser != null) return $"Validation Error: Account email '{email}' is already registered to a tenant system.";

        var freshUser = new Microsoft.AspNetCore.Identity.IdentityUser
        {
            UserName = userName.Trim(),
            Email = email,
            PhoneNumber = phoneNumber,
            EmailConfirmed = true 
        };

        var createResult = await _userManager.CreateAsync(freshUser, password);
        if (!createResult.Succeeded) return $"Identity Exception: {createResult.Errors.FirstOrDefault()?.Description ?? "Failed to create identity credentials row."}";

        // Multi-Tenant Isolation Alignment Pass
        await _userManager.AddClaimAsync(freshUser, new Claim("AcademyId", academyId.ToString()));
        await _userManager.AddClaimAsync(freshUser, new Claim(ClaimTypes.Role, role));
        await _userManager.AddToRoleAsync(freshUser, role);

        string todayStr = DateTime.UtcNow.ToString("yyyy-MM-dd");
        return $"Success! User account '{email}' has been successfully provisioned with role tier '{role}'. [FRONTEND_ACTION:SET_DATE:{todayStr}]";
    }

    [KernelFunction, Description("Queries the database context to list all registered users belonging to the director's multi-tenant partition.")]
    public async Task<string> AdminGetTenantUsersAsync(Kernel kernel)
    {
        if (!kernel.Data.TryGetValue("academyId", out var academyIdObj) || academyIdObj is not Guid academyId)
        {
            return "Transaction rejected: Invalid tenant boundary context configuration parameters.";
        }

        var targetAcademyStr = academyId.ToString();
        var allUsers = await _userManager.Users.ToListAsync();
        var reportSummary = $"📋 [TENANT INITIALIZED USER ROSTER]:\n";
        int identityCounter = 0;

        foreach (var user in allUsers)
        {
            var claims = await _userManager.GetClaimsAsync(user);
            var academyClaim = claims.FirstOrDefault(c => c.Type.Equals("AcademyId", StringComparison.OrdinalIgnoreCase))?.Value;
            
            if (academyClaim == targetAcademyStr)
            {
                identityCounter++;
                var roles = await _userManager.GetRolesAsync(user);
                string activeRole = roles.FirstOrDefault() ?? "Player";
                string accountStatus = user.EmailConfirmed ? "Active" : "Suspended";
                reportSummary += $"• User: {user.Email} (ID: {user.Id}) — Tier: {activeRole} | Status: {accountStatus}\n";
            }
        }

        if (identityCounter == 0) return "📋 [TENANT INITIALIZED USER ROSTER]: No account matrices mapped inside your partition perimeter.";
        return reportSummary;
    }

    [KernelFunction, Description("Modifies the email, contact phone, operational status flag, and role assignments for an existing tenant user account.")]
    public async Task<string> AdminUpdateUserAsync(
        Kernel kernel,
        [Description("The unique string database identifier GUID of the user account to update")] string userId,
        [Description("The new or existing email address coordinate string")] string email,
        [Description("The new or existing unique username handle or nickname")] string userName,
        [Description("The new or existing authorization role tier")] string role,
        [Description("The new or existing phone contact string")] string phoneNumber,
        [Description("Flag status toggle representing active account status access")] bool isActive)
    {
        if (!kernel.Data.TryGetValue("academyId", out var academyIdObj) || academyIdObj is not Guid academyId)
        {
            return "Transaction rejected: Session claims parsing validation failure.";
        }

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return $"Validation Error: Target user account reference matching '{userId}' could not be located.";

        // Tenant Partition Boundary Verification
        var claims = await _userManager.GetClaimsAsync(user);
        var academyClaim = claims.FirstOrDefault(c => c.Type.Equals("AcademyId", StringComparison.OrdinalIgnoreCase))?.Value;
        if (academyClaim != academyId.ToString()) return "Security Blocked: Intercepted unauthorized cross-tenant modification hazard.";

        using var transaction = await _dbContext.Database.BeginTransactionAsync();
        try
        {
            user.Email = email;
            user.UserName = userName;
            user.PhoneNumber = phoneNumber;
            user.EmailConfirmed = isActive; 

            var updateResult = await _userManager.UpdateAsync(user);
            if (!updateResult.Succeeded) return "Identity Exception: Failed to preserve update modifications to the persistence layer.";

            var currentRoles = await _userManager.GetRolesAsync(user);
            if (!currentRoles.Contains(role))
            {
                await _userManager.RemoveFromRolesAsync(user, currentRoles);
                await _userManager.AddToRoleAsync(user, role);

                var oldRoleClaim = claims.FirstOrDefault(c => c.Type == ClaimTypes.Role || c.Type == "role");
                if (oldRoleClaim != null) await _userManager.RemoveClaimAsync(user, oldRoleClaim);
                await _userManager.AddClaimAsync(user, new Claim(ClaimTypes.Role, role));
            }

            string todayStr = DateTime.UtcNow.ToString("yyyy-MM-dd");
            return $"Success! Account profile '{email}' has been cleanly modified past tenant filters. [FRONTEND_ACTION:SET_DATE:{todayStr}]";
        }
        catch (Exception)
        {
            // Safe cascading error rollback safeguard
            await transaction.RollbackAsync();
            return "FAILED Transaction Exception: Identity updates aborted due to an internal system fault.";
        }
    }

    [KernelFunction, Description("Permanently purges and deletes a user account registration from the active multi-tenant system registries.")]
    public async Task<string> AdminDeleteUserAsync(
        Kernel kernel,
        [Description("The unique database identifier string key matching the target account")] string userId)
    {
        if (!kernel.Data.TryGetValue("academyId", out var academyIdObj) || academyIdObj is not Guid academyId)
        {
            return "Transaction rejected: Invalid security token profile identity mapping context.";
        }

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return "Validation Error: Target account profile tracking record does not exist.";

        var claims = await _userManager.GetClaimsAsync(user);
        var academyClaim = claims.FirstOrDefault(c => c.Type.Equals("AcademyId", StringComparison.OrdinalIgnoreCase))?.Value;
        if (academyClaim != academyId.ToString()) return "Security Exception: Cross-tenant account deletion attempt blocked.";

        var deleteResult = await _userManager.DeleteAsync(user);
        if (!deleteResult.Succeeded) return "Identity Exception: Unable to purge user entry from system registers.";

        string todayStr = DateTime.UtcNow.ToString("yyyy-MM-dd");
        return $"Success! Account record '{user.Email}' has been permanently wiped from identity storage tables. [FRONTEND_ACTION:SET_DATE:{todayStr}]";
    }

    [KernelFunction, Description("Assigns and maps an existing user profile onto a branch roster matrix line with a specific operational tier role.")]
    public async Task<string> AdminAssignUserToBranchAsync(
        Kernel kernel,
        [Description("The unique identifier database Guid or handle username of the employee profile to route")] string userIdentifier,
        [Description("The unique identifier database Guid or natural name string of the target facility branch")] string branchIdentifier,
        [Description("The operational task assignment role tier (e.g., 'Groundskeeper', 'BranchManager', 'Staff')")] string assignmentRole)
    {
        if (!kernel.Data.TryGetValue("academyId", out var academyIdObj) || academyIdObj is not Guid academyId)
        {
            return "Transaction rejected: Missing or invalid security academy perimeter claim scope.";
        }

        Microsoft.AspNetCore.Identity.IdentityUser? user = null;
        if (Guid.TryParse(userIdentifier, out var userGuid))
        {
            user = await _userManager.FindByIdAsync(userIdentifier);
        }
        else
        {
            user = await _userManager.FindByNameAsync(userIdentifier) ?? await _userManager.FindByEmailAsync(userIdentifier);
        }
        if (user == null) return $"Validation Error: Target account profile matching '{userIdentifier}' not found.";

        Branch? branch = null;
        if (Guid.TryParse(branchIdentifier, out var branchGuid))
        {
            branch = await _dbContext.Branches.FirstOrDefaultAsync(b => b.Id == branchGuid && b.AcademyId == academyId);
        }
        else
        {
            branch = await _dbContext.Branches.FirstOrDefaultAsync(b => b.Name.ToLower() == branchIdentifier.ToLower() && b.AcademyId == academyId);
        }
        if (branch == null) return $"Validation Error: Target facility branch venue matching '{branchIdentifier}' not found.";
        if (branch.IsDecommissioned) return "Operation Aborted: Target destination branch venue is marked decommissioned.";

        var alreadyAssigned = await _dbContext.UserBranches
            .AnyAsync(ub => ub.UserId == user.Id && ub.BranchId == branch.Id && ub.AcademyId == academyId);
        if (alreadyAssigned) return $"Notification: User @{user.UserName} already carries an active assignment row on branch '{branch.Name}'.";

        var userBranch = new UserBranch
        {
            AcademyId = academyId,
            UserId = user.Id,
            BranchId = branch.Id,
            AssignmentRole = assignmentRole,
            AssignedAtUtc = DateTime.UtcNow
        };

        _dbContext.UserBranches.Add(userBranch);
        await _dbContext.SaveChangesAsync();

        string todayStr = DateTime.UtcNow.ToString("yyyy-MM-dd");
        return $"Success! User @{user.UserName} successfully assigned to branch '{branch.Name}' as a '{assignmentRole}'. [FRONTEND_ACTION:SET_DATE:{todayStr}]";
    }

    [KernelFunction, Description("Purges a user assignment entry from a branch roster and cascades clearances out of downstream court configurations.")]
    public async Task<string> AdminRemoveUserFromBranchAsync(
        Kernel kernel,
        [Description("The unique identifier Guid or handle username of the employee profile to remove")] string userIdentifier,
        [Description("The unique identifier Guid or natural name string of the branch venue profile")] string branchIdentifier)
    {
        if (!kernel.Data.TryGetValue("academyId", out var academyIdObj) || academyIdObj is not Guid academyId)
        {
            return "Transaction rejected: Session claims parsing validation failure.";
        }

        Microsoft.AspNetCore.Identity.IdentityUser? user = null;
        if (Guid.TryParse(userIdentifier, out var userGuid))
        {
            user = await _userManager.FindByIdAsync(userIdentifier);
        }
        else
        {
            user = await _userManager.FindByNameAsync(userIdentifier) ?? await _userManager.FindByEmailAsync(userIdentifier);
        }
        if (user == null) return $"Validation Error: Target identity account reference matching '{userIdentifier}' missing.";

        Branch? branch = null;
        if (Guid.TryParse(branchIdentifier, out var branchGuid))
        {
            branch = await _dbContext.Branches.FirstOrDefaultAsync(b => b.Id == branchGuid && b.AcademyId == academyId);
        }
        else
        {
            branch = await _dbContext.Branches.FirstOrDefaultAsync(b => b.Name.ToLower() == branchIdentifier.ToLower() && b.AcademyId == academyId);
        }
        if (branch == null) return $"Validation Error: Facility branch matching '{branchIdentifier}' not found.";

        var assignment = await _dbContext.UserBranches
            .FirstOrDefaultAsync(ub => ub.BranchId == branch.Id && ub.UserId == user.Id && ub.AcademyId == academyId);
            
        if (assignment == null) return $"Validation Error: No active roster assignment maps exist linking @{user.UserName} to branch '{branch.Name}'.";

        using var transaction = await _dbContext.Database.BeginTransactionAsync();
        try
        {
            var nestedCourts = await _dbContext.UserCourts
                .Where(uc => uc.BranchId == branch.Id && uc.UserId == user.Id && uc.AcademyId == academyId)
                .ToListAsync();
            _dbContext.UserCourts.RemoveRange(nestedCourts);

            _dbContext.UserBranches.Remove(assignment);
            await _dbContext.SaveChangesAsync();
            await transaction.CommitAsync();

            string todayStr = DateTime.UtcNow.ToString("yyyy-MM-dd");
            return $"Success! User @{user.UserName} dropped cleanly from branch '{branch.Name}' roster. Child court clearances purged. [FRONTEND_ACTION:SET_DATE:{todayStr}]";
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            return $"Transaction Failure: Unable to complete roster purge: {ex.Message}";
        }
    }
    [KernelFunction, Description("Assigns a specific court maintenance or operational access task routing mapping to a branch-rostered user.")]
    public async Task<string> AdminAssignUserToCourtAsync(
        Kernel kernel,
        [Description("The unique identifier Guid or handle username of the employee profile")] string userIdentifier,
        [Description("The unique identifier Guid or natural name string of the branch venue profile")] string branchIdentifier,
        [Description("The unique identifier Guid or natural name string of the specific court asset")] string courtIdentifier,
        [Description("The duty task tracking clearance type (e.g., 'PrimaryGroundskeeper', 'CoachSlot')")] string accessType)
    {
        if (!kernel.Data.TryGetValue("academyId", out var academyIdObj) || academyIdObj is not Guid academyId)
        {
            return "Transaction rejected: Invalid security token profile context parameters.";
        }

        Microsoft.AspNetCore.Identity.IdentityUser? user = null;
        if (Guid.TryParse(userIdentifier, out var userGuid))
        {
            user = await _userManager.FindByIdAsync(userIdentifier);
        }
        else
        {
            user = await _userManager.FindByNameAsync(userIdentifier) ?? await _userManager.FindByEmailAsync(userIdentifier);
        }
        if (user == null) return "Validation Error: Selected target user does not exist.";

        Branch? branch = null;
        if (Guid.TryParse(branchIdentifier, out var branchGuid))
        {
            branch = await _dbContext.Branches.FirstOrDefaultAsync(b => b.Id == branchGuid && b.AcademyId == academyId);
        }
        else
        {
            branch = await _dbContext.Branches.FirstOrDefaultAsync(b => b.Name.ToLower() == branchIdentifier.ToLower() && b.AcademyId == academyId);
        }
        if (branch == null) return "Validation Error: Target branchvenue configuration location missing.";

        var hasBranchAccess = await _dbContext.UserBranches
            .AnyAsync(ub => ub.UserId == user.Id && ub.BranchId == branch.Id && ub.AcademyId == academyId);
        if (!hasBranchAccess) 
        {
            return $"Security Exception Blocked: User @{user.UserName} must be explicitly added to the Branch Roster for '{branch.Name}' before receiving specific court tasks.";
        }

        Court? court = null;
        if (Guid.TryParse(courtIdentifier, out var courtGuid))
        {
            court = await _dbContext.Courts.FirstOrDefaultAsync(c => c.Id == courtGuid && c.BranchId == branch.Id && c.AcademyId == academyId);
        }
        else
        {
            court = await _dbContext.Courts.FirstOrDefaultAsync(c => c.Name.ToLower() == courtIdentifier.ToLower() && c.BranchId == branch.Id && c.AcademyId == academyId);
        }
        if (court == null) return $"Validation Error: Target court asset matching name '{courtIdentifier}' does not exist inside branch venue '{branch.Name}'.";

        var alreadyAssigned = await _dbContext.UserCourts
            .AnyAsync(uc => uc.UserId == user.Id && uc.BranchId == branch.Id && uc.CourtId == court.Id && uc.AcademyId == academyId);
        if (alreadyAssigned) return $"Notification: User @{user.UserName} already carries an active operational layout assignment task on court '{court.Name}'.";

        var userCourt = new UserCourt
        {
            AcademyId = academyId,
            UserId = user.Id,
            BranchId = branch.Id,
            CourtId = court.Id,
            AccessType = accessType
        };

        _dbContext.UserCourts.Add(userCourt);
        await _dbContext.SaveChangesAsync();

        string todayStr = DateTime.UtcNow.ToString("yyyy-MM-dd");
        return $"Success! User @{user.UserName} mapped task routing access '{accessType}' onto court '{court.Name}'. [FRONTEND_ACTION:SET_DATE:{todayStr}]";
    }

    [KernelFunction, Description("Unlinks a specific user court clearance task or operation assignment node.")]
    public async Task<string> AdminRemoveUserFromCourtAsync(
        Kernel kernel,
        [Description("The unique identifier Guid or handle username of the employee profile")] string userIdentifier,
        [Description("The unique identifier Guid or natural name string of the branch venue")] string branchIdentifier,
        [Description("The unique identifier Guid or natural name string of the specific court structure asset")] string courtIdentifier)
    {
        if (!kernel.Data.TryGetValue("academyId", out var academyIdObj) || academyIdObj is not Guid academyId)
        {
            return "Transaction rejected: Invalid security token identity mapping context parameters.";
        }

        Microsoft.AspNetCore.Identity.IdentityUser? user = null;
        if (Guid.TryParse(userIdentifier, out var userGuid))
        {
            user = await _userManager.FindByIdAsync(userIdentifier);
        }
        else
        {
            user = await _userManager.FindByNameAsync(userIdentifier) ?? await _userManager.FindByEmailAsync(userIdentifier);
        }
        if (user == null) return "Validation Error: Profile reference unreadable.";

        Branch? branch = null;
        if (Guid.TryParse(branchIdentifier, out var branchGuid))
        {
            branch = await _dbContext.Branches.FirstOrDefaultAsync(b => b.Id == branchGuid && b.AcademyId == academyId);
        }
        else
        {
            branch = await _dbContext.Branches.FirstOrDefaultAsync(b => b.Name.ToLower() == branchIdentifier.ToLower() && b.AcademyId == academyId);
        }
        if (branch == null) return "Validation Error: Branch reference unreadable.";

        Court? court = null;
        if (Guid.TryParse(courtIdentifier, out var courtGuid))
        {
            court = await _dbContext.Courts.FirstOrDefaultAsync(c => c.Id == courtGuid && c.BranchId == branch.Id && c.AcademyId == academyId);
        }
        else
        {
            court = await _dbContext.Courts.FirstOrDefaultAsync(c => c.Name.ToLower() == courtIdentifier.ToLower() && c.BranchId == branch.Id && c.AcademyId == academyId);
        }
        if (court == null) return "Validation Error: Court structural link reference unreadable.";

        var courtAssignment = await _dbContext.UserCourts
            .FirstOrDefaultAsync(uc => uc.BranchId == branch.Id && uc.CourtId == court.Id && uc.UserId == user.Id && uc.AcademyId == academyId);
            
        if (courtAssignment == null) return $"Validation Error: Specific user-court task route mapping linking @{user.UserName} to court '{court.Name}' does not exist.";

        _dbContext.UserCourts.Remove(courtAssignment);
        await _dbContext.SaveChangesAsync();

        string todayStr = DateTime.UtcNow.ToString("yyyy-MM-dd");
        return $"Success! User @{user.UserName} unlinked cleanly from court task on '{court.Name}'. [FRONTEND_ACTION:SET_DATE:{todayStr}]";
    }

}
