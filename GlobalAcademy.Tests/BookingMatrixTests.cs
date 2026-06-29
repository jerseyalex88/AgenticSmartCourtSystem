using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;
using GlobalAcademy.Controllers;
using GlobalAcademy.Data;
using GlobalAcademy.Models;

namespace GlobalAcademy.Tests;

public class BookingMatrixTests
{
    private DbContextOptions<ApplicationDbContext> CreateFreshInMemoryDatabase()
    {
        return new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: $"BookingEngineMatrixDb_{Guid.NewGuid()}")
            .Options;
    }
    private void MockUserSessionContext(BookingController controller, string role, Guid academyId)
    {
        var claims = new[]
        {
            // FIX: Explicitly map the exact system URI identifier string so .NET understands User.Identity.Name
            new Claim("http://xmlsoap.org", "test.user@vanguard.com"),
            new Claim(ClaimTypes.Role, role),
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
    public async Task BookingEngine_Allows_Clean_Sequential_Bookings_Without_Collision()
    {
        // --- ARRANGE ---
        var options = CreateFreshInMemoryDatabase();
        var mockTenant = new MockTenantProvider { ActiveTenantId = Guid.NewGuid() };
        using var context = new ApplicationDbContext(options, mockTenant);

        var courtId = Guid.NewGuid();
        context.Courts.Add(new Court { Id = courtId, Name = "Court A" });
        await context.SaveChangesAsync();

        var controller = new BookingController(context);
        MockUserSessionContext(controller, "Player", mockTenant.ActiveTenantId);

        var baseTime = DateTime.UtcNow.Date.AddHours(10);

        // --- ACT --- Create booking from 10:00 to 11:00 UTC
        var dto1 = new CreateBookingDto(courtId, baseTime, baseTime.AddHours(1), "MemberBooking", "Slot 1", null);
        var result1 = await controller.CreateBooking(dto1);

        // Create subsequent clean booking from 11:00 to 12:00 UTC
        var dto2 = new CreateBookingDto(courtId, baseTime.AddHours(1), baseTime.AddHours(2), "MemberBooking", "Slot 2", null);
        var result2 = await controller.CreateBooking(dto2);

        // --- ASSERT ---
        Assert.IsType<OkObjectResult>(result1);
        Assert.IsType<OkObjectResult>(result2);
        Assert.Equal(2, await context.Bookings.CountAsync());
    }

    [Fact]
    public async Task BookingEngine_Blocks_Standard_Member_Overlapping_Time_Collision()
    {
        // --- ARRANGE ---
        var options = CreateFreshInMemoryDatabase();
        var mockTenant = new MockTenantProvider { ActiveTenantId = Guid.NewGuid() };
        using var context = new ApplicationDbContext(options, mockTenant);

        var courtId = Guid.NewGuid();
        context.Courts.Add(new Court { Id = courtId, Name = "Court B" });
        await context.SaveChangesAsync();

        var controller = new BookingController(context);
        MockUserSessionContext(controller, "Player", mockTenant.ActiveTenantId);

        var baseTime = DateTime.UtcNow.Date.AddHours(14);

        // Commit initial booking: 14:00 - 15:30 UTC
        var initialDto = new CreateBookingDto(courtId, baseTime, baseTime.AddHours(1.5), "MemberBooking", "Original", null);
        await controller.CreateBooking(initialDto);

        // --- ACT --- Attempt malicious overlapping booking: 15:00 - 16:00 UTC
        var collidingDto = new CreateBookingDto(courtId, baseTime.AddHours(1), baseTime.AddHours(2), "MemberBooking", "Collision Attempt", null);
        var result = await controller.CreateBooking(collidingDto);

        // --- ASSERT ---
        Assert.IsType<BadRequestObjectResult>(result);
        var badRequest = result as BadRequestObjectResult;
        Assert.Equal("Court Availability Exception: The requested court window is locked or already occupied.", badRequest?.Value);
    }

    [Fact]
    public async Task AcademyDirector_Fires_Clinic_Override_Evicting_Standard_Members_Successfully()
    {
        // --- ARRANGE ---
        var options = CreateFreshInMemoryDatabase();
        var mockTenant = new MockTenantProvider { ActiveTenantId = Guid.NewGuid() };
        using var context = new ApplicationDbContext(options, mockTenant);

        var courtId = Guid.NewGuid();
        context.Courts.Add(new Court { Id = courtId, Name = "Premium Court" });
        await context.SaveChangesAsync();

        // 1. Establish regular user booking in context: 09:00 - 10:30 UTC
        var controller = new BookingController(context);
        MockUserSessionContext(controller, "Player", mockTenant.ActiveTenantId);
        
        var baseTime = DateTime.UtcNow.Date.AddHours(9);
        var memberDto = new CreateBookingDto(courtId, baseTime, baseTime.AddHours(1.5), "MemberBooking", "Casual Match", null);
        await controller.CreateBooking(memberDto);
        Assert.Equal(1, await context.Bookings.CountAsync());

        // 2. Elevate user privileges to AcademyDirector role layout context
        MockUserSessionContext(controller, "AcademyDirector", mockTenant.ActiveTenantId);

        // --- ACT --- Attempt elite Clinic override across the intersecting window: 08:30 - 10:00 UTC
        var overrideDto = new CreateBookingDto(courtId, baseTime.AddMinutes(-30), baseTime.AddHours(1), "Clinic", "High-Priority Academy Override", null);
        var result = await controller.CreateBooking(overrideDto);

        // --- ASSERT ---
        Assert.IsType<OkObjectResult>(result);
        var activeBookings = await context.Bookings.ToListAsync();
        
        // The deterministic engine must evict the member slot, leaving exactly 1 booking (the Clinic) in the database matrix
        Assert.Single(activeBookings);
        Assert.Equal("Clinic", activeBookings.First().BookingType);
        Assert.Equal("High-Priority Academy Override", activeBookings.First().Notes);
    }
}
