using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Xunit;
using GlobalAcademy.Data;
using GlobalAcademy.Models;
using GlobalAcademy.Security;

namespace GlobalAcademy.Tests;

// A Mock implementation to manipulate active claims context parameters programmatically during automated test sequences
public class MockTenantProvider : ITenantProvider
{
    public Guid ActiveTenantId { get; set; } = Guid.Empty;
    public Guid GetTenantId() => ActiveTenantId;
}

public class MultiTenantSecurityTests
{
    [Fact]
    public async Task DatabaseEngine_Enforces_Strict_Isolation_Between_Different_Academies()
    {
        // --- ARRANGE --- Setup an isolated database sandbox container inside local system memory
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: $"TenantSecurityTestDb_{Guid.NewGuid()}")
            .Options;

        var mockTenantService = new MockTenantProvider();

        // Target Context Node A: London Clay Club
        var londonTenantId = Guid.NewGuid();
        mockTenantService.ActiveTenantId = londonTenantId;
        
        using (var arrangeContext = new ApplicationDbContext(options, mockTenantService))
        {
            var londonBranch = new Branch { Id = Guid.NewGuid(), Name = "London Clay Club Hub", TimeZoneId = "Europe/London" };
            arrangeContext.Branches.Add(londonBranch);
            await arrangeContext.SaveChangesAsync(); // Auto-stamped with London tenant ID via SaveChanges context rule!
        }

        // Target Context Node B: Dubai Desert Hardcourts
        var dubaiTenantId = Guid.NewGuid();
        mockTenantService.ActiveTenantId = dubaiTenantId;

        using (var arrangeContext = new ApplicationDbContext(options, mockTenantService))
        {
            var dubaiBranch = new Branch { Id = Guid.NewGuid(), Name = "Dubai Desert Stadium", TimeZoneId = "Asia/Dubai" };
            arrangeContext.Branches.Add(dubaiBranch);
            await arrangeContext.SaveChangesAsync(); // Auto-stamped with Dubai tenant ID
        }

        // --- ACT & ASSERT --- Simulate the London User trying to query data lines
        mockTenantService.ActiveTenantId = londonTenantId;
        using (var assertContext = new ApplicationDbContext(options, mockTenantService))
        {
            var visibleBranches = await assertContext.Branches.ToListAsync();

            // Verification Check A: The reader must only pull up their personal context data row
            Assert.Single(visibleBranches);
            Assert.Equal("London Clay Club Hub", visibleBranches.First().Name);

            // Verification Check B: The firewall must completely block tracking parameters pointing to Dubai rows
            Assert.DoesNotContain(visibleBranches, b => b.Name == "Dubai Desert Stadium");
        }
    }
}
