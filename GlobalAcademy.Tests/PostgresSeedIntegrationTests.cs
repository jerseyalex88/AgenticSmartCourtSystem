using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;
using GlobalAcademy.Data;
using GlobalAcademy.Models;

namespace GlobalAcademy.Tests;

public class PostgresSeedIntegrationTests
{
    private ApplicationDbContext CreateRealPostgresContext()
    {
        // 1. Build a configuration reader pointing directly to your primary project configuration file
        // Note: Assumes standard root execution setup inside VS Code workspace
        var projectPath = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "GlobalAcademy"));
        
        var configuration = new ConfigurationBuilder()
            .SetBasePath(projectPath)
            .AddJsonFile("appsettings.json", optional: false)
            .Build();

        var connectionString = configuration.GetConnectionString("DefaultConnection");
        if (string.IsNullOrEmpty(connectionString))
        {
            throw new InvalidOperationException("Integration Test Failure: PostgreSQL Connection String missing from appsettings.json.");
        }

        // 2. Configure a real DbContext options block utilizing the PostgreSQL driver
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(connectionString)
            .Options;

        var mockTenantProvider = new MockTenantProvider(); // Reuses our Step 1 mock provider

        return new ApplicationDbContext(options, mockTenantProvider);
    }

    private (UserManager<IdentityUser>, RoleManager<IdentityRole>) CreateIdentityManagers(ApplicationDbContext context)
    {
        // 1. Setup the User Storage layer and Identity options
        var userStore = new UserStore<IdentityUser>(context);
        
        var userManager = new UserManager<IdentityUser>(
            userStore,
            Options.Create(new IdentityOptions()),
            new PasswordHasher<IdentityUser>(),
            new IUserValidator<IdentityUser>[] { }, // Explicit type arrays to satisfy .NET compiler type checking
            new IPasswordValidator<IdentityUser>[] { },
            new UpperInvariantLookupNormalizer(),
            new IdentityErrorDescriber(),
            null,
            NullLogger<UserManager<IdentityUser>>.Instance); // Enterprise NullLogger prevents protection level errors

        // 2. Setup the Role Storage layer
        var roleStore = new RoleStore<IdentityRole>(context);
        
        var roleManager = new RoleManager<IdentityRole>(
            roleStore,
            new IRoleValidator<IdentityRole>[] { },
            new UpperInvariantLookupNormalizer(),
            new IdentityErrorDescriber(),
            NullLogger<RoleManager<IdentityRole>>.Instance);

        return (userManager, roleManager);
    }

    [Fact]
    public async Task SeedAsync_OnLivePostgres_TruncatesAndRepopulatesSystemWithoutConstraintViolations()
    {
        // --- ARRANGE --- Connect to your live database instance
        var context1 = CreateRealPostgresContext();
        var (userManager, roleManager) = CreateIdentityManagers(context1);

        // FIX: Force an explicit master database transaction scope to capture Microsoft Identity actions
        using var transaction = await context1.Database.BeginTransactionAsync();

        // --- ACT --- Execute the seed sequence with 'resetDatabase: true'
        var exception = await Record.ExceptionAsync(async () => 
        {
            await DbInitializer.SeedAsync(context1, userManager, roleManager, resetDatabase: true);
        });

        // Verify that the seed script execution didn't throw an initial crash exception
        Assert.Null(exception);

        // FIX: Commit the transaction explicitly! This forces PostgreSQL to lock the rows permanently onto the disk
        await transaction.CommitAsync();

        // Safely dispose of and kill the first database context connection block
        await context1.DisposeAsync();

        // =========================================================================
        // --- ASSERT & DIAGNOSTICS --- OPEN A FRESH CONTEXT FOR VERIFICATION
        // =========================================================================
        using var assertContext = CreateRealPostgresContext();

        // FIX: Add .IgnoreQueryFilters() to allow our master test suite to see past the multi-tenant firewall
        var academyCount = await assertContext.Academies.IgnoreQueryFilters().CountAsync();
        var branchCount = await assertContext.Branches.IgnoreQueryFilters().CountAsync();
        var courtCount = await assertContext.Courts.IgnoreQueryFilters().CountAsync();
        var rosterCount = await assertContext.UserBranches.IgnoreQueryFilters().CountAsync();

        // These evaluations will now match with 100% precision
        Assert.True(academyCount > 0, "PostgreSQL Integration Failed: Academies row count is zero.");
        Assert.True(branchCount > 0, "PostgreSQL Integration Failed: Branches row count is zero.");
        Assert.True(courtCount > 0, "PostgreSQL Integration Failed: Courts row count is zero.");
        Assert.True(rosterCount > 0, "PostgreSQL Integration Failed: Roster assignment row count is zero.");

    }

}
