using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;
using GlobalAcademy.Data;
using GlobalAcademy.Models;

namespace GlobalAcademy.Tests;

public class SeedDataTests
{
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
    public async Task SeedAsync_Executes_And_Populates_All_Hierarchical_Tables_Without_Crashing()
    {
        // --- ARRANGE --- Setup a clean, isolated database container in-memory
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: $"SeedEngineDiagnosticDb_{Guid.NewGuid()}")
            .Options;

        var mockTenantProvider = new MockTenantProvider();
        
        using var context = new ApplicationDbContext(options, mockTenantProvider);
        var (userManager, roleManager) = CreateIdentityManagers(context);

        // --- ACT --- Execute the seed pipeline sequence (with resetDatabase: false to prevent raw SQL truncation crashes in-memory)
        var exception = await Record.ExceptionAsync(async () => 
        {
            await DbInitializer.SeedAsync(context, userManager, roleManager, resetDatabase: false);
        });

        // --- ASSERT DIAGNOSTICS ---
        // 1. Verify that no unhandled exceptions were thrown during class parsing
        Assert.Null(exception);

        // 2. Verify physical data rows are mapped correctly down the operational pipeline
        Assert.True(await context.Academies.AnyAsync(), "Seeding failed: Academies table is empty.");
        Assert.True(await context.Branches.AnyAsync(), "Seeding failed: Branches table is empty.");
        Assert.True(await context.Courts.AnyAsync(), "Seeding failed: Courts table is empty.");
        Assert.True(await context.UserBranches.AnyAsync(), "Seeding failed: User-Branch assignments are empty.");

        // 3. Verify that the child elements carry correct relational parent links
        var sampleCourt = await context.Courts.FirstOrDefaultAsync(c => c.Name == "Stadium Center Clay");
        Assert.NotNull(sampleCourt);
        Assert.NotEqual(Guid.Empty, sampleCourt.BranchId);
    }
}
