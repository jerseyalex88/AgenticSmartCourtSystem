using System;
using System.IO;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Xunit;
using GlobalAcademy.Controllers;
using GlobalAcademy.Data;
using GlobalAcademy.Models;
using GlobalAcademy.Security;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Identity;

namespace GlobalAcademy.Tests;

public class CourtCreationIntegrationTests
{
    private readonly WebApplicationFactory<Program> _factory;
    private ApplicationDbContext CreateRealPostgresContext(MockTenantProvider tenantProvider)
    {
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

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(connectionString)
            .Options;

        return new ApplicationDbContext(options, tenantProvider);
    }

    private void MockUserSessionContext(FacilityController controller, Guid academyId)
    {
        var claims = new[]
        {
            // Simulating your live 'director@londonvanguard.com' session parameters
            new Claim("http://xmlsoap.org", "director@londonvanguard.com"),
            new Claim(ClaimTypes.Role, "AcademyDirector"),
            new Claim("AcademyId", academyId.ToString())
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        var claimsPrincipal = new ClaimsPrincipal(identity);

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = claimsPrincipal }
        };
    }

    [Fact]
    public async Task CreateCourt_UsingFirstExistingBranch_SavesRowToPostgresFlawlessly()
    {
        // --- ARRANGE --- Connect to your live database instance
        var mockTenantProvider = new MockTenantProvider();
        
        // 1. First, create a temporary context without a filter to look up your real seeded data
        using (var initialLookupContext = CreateRealPostgresContext(new MockTenantProvider()))
        {
            // Pull the first branch created by your database seed script
            var existingBranch = await initialLookupContext.Branches.IgnoreQueryFilters().FirstOrDefaultAsync();
            Assert.NotNull(existingBranch); // Fails if your seed data is completely empty

            // Lock our active security context tenant ID to match this existing branch's owner academy
            mockTenantProvider.ActiveTenantId = existingBranch.AcademyId;
        }

        // 2. Re-open a fresh context bounded securely by our discovered AcademyId tenant filter firewall
        using var context = CreateRealPostgresContext(mockTenantProvider);

        // Fetch the first branch again, this time flowing *through* the active tenant query filter
        var targetBranch = await context.Branches.FirstOrDefaultAsync();
        Assert.NotNull(targetBranch); // Fails if the global query filter blocks visibility

        // Instantiate the Facility Controller under our real time matrix engine dependency
        var timeEngine = new LocalTimeEngine();

        using var scope = _factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<IdentityUser>>();

        var controller = new FacilityController(context, timeEngine, userManager);
        MockUserSessionContext(controller, mockTenantProvider.ActiveTenantId);

        // Configure the DTO payload using the physical existing branch GUID
        var courtDto = new CreateCourtDto(
            targetBranch.Id, 
            "Test Diagnostic Stadium 1", 
            "Verifying existing branch relationship parsing directly via database layers.", 
            "Clay", 
            false, 
            1.1
        );

        // --- ACT --- Invoke the CreateCourt controller action endpoint directly
        var result = await controller.CreateCourt(courtDto);

        // --- ASSERT & DIAGNOSTICS ---
        if (result is BadRequestObjectResult badRequest)
        {
            // If the validation check throws your exact error string, fail the test and print the context trace
            Assert.Fail($"Court Creation Failed via Controller: {badRequest.Value}");
        }

        Assert.IsType<OkObjectResult>(result);
        
        // Open a separate verification check to ensure the row was physically saved to the disk
        var count = await context.Courts.CountAsync(c => c.BranchId == targetBranch.Id && c.Name == "Test Diagnostic Stadium 1");
        Assert.Equal(1, count);
    }
}
