using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using GlobalAcademy.Models;

namespace GlobalAcademy.Data;

public static class DbInitializer
{
    public static async Task SeedAsync(
        ApplicationDbContext context, 
        UserManager<IdentityUser> userManager, 
        RoleManager<IdentityRole> roleManager,
        bool resetDatabase = false)
    {
        // =========================================================================
        // PART 1: OPTIONAL ENVIRONMENT DESTRUCTION (NUKE ENGINE)
        // =========================================================================
        if (resetDatabase)
        {
            Console.WriteLine("--> WARNING: Executing database truncation reset rule...");
            
            // Execute raw TRUNCATE commands to bypass foreign key constraint restrictions
            await context.Database.ExecuteSqlRawAsync(@"
                TRUNCATE TABLE ""ShadowQueues"", ""MaintenanceTickets"", ""Bookings"", ""UserCourts"", ""UserBranches"", ""Courts"", ""Branches"", ""Academies"", 
                               ""AspNetUserClaims"", ""AspNetUserRoles"", ""AspNetUsers"", ""AspNetRoles"" CASCADE;");
            
            Console.WriteLine("--> Database wiped clean successfully.");
        }

        // =========================================================================
        // PART 2: SYSTEM MANAGEMENT IDENTITY ROLES SETUP
        // =========================================================================
        string[] roles = { "GlobalAdmin", "AcademyDirector", "Groundskeeper", "Player" };
        foreach (var role in roles)
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                await roleManager.CreateAsync(new IdentityRole(role));
            }
        }

        // Halt further execution if records are already present in the database
        if (await context.Academies.AnyAsync())
        {
            Console.WriteLine("--> Database already contains operational data profiles. Skipping seed process.");
            return;
        }

        Console.WriteLine("--> Seeding global multi-tenant tennis infrastructure configurations...");

        // =========================================================================
        // TENANT 1: THE ELITE EUROPEAN BLUEPRINT (LONDON CLAY ACADEMY)
        // =========================================================================
        var londonAcademyId = Guid.NewGuid();
        var londonAcademy = new Academy
        {
            Id = londonAcademyId,
            Name = "Vanguard Tennis International (London HQ)",
            Description = "Premium high-performance junior athletic blueprint.",
            CreatedAtUtc = DateTime.UtcNow
        };
        context.Academies.Add(londonAcademy);

        var londonBranchId = Guid.NewGuid();
        var londonBranch = new Branch
        {
            Id = londonBranchId,
            AcademyId = londonAcademyId,
            Name = "London Clay Club",
            Description = "Traditional indoor/outdoor red clay optimization venue.",
            TimeZoneId = "Europe/London", // Local Matrix Target IANA
            CreatedAtUtc = DateTime.UtcNow
        };
        context.Branches.Add(londonBranch);

        var londonCourt1 = new Court
        {
            Id = Guid.NewGuid(),
            AcademyId = londonAcademyId,
            BranchId = londonBranchId,
            Name = "Stadium Center Clay",
            Description = "Premium Italian surface utilizing active microclimatic sensors.",
            SurfaceType = "Clay",
            IsIndoor = false,
            DryCoefficient = 1.5, // Dries in exactly 90 minutes post heavy storm metrics
            CreatedAtUtc = DateTime.UtcNow
        };
        var londonCourt2 = new Court
        {
            Id = Guid.NewGuid(),
            AcademyId = londonAcademyId,
            BranchId = londonBranchId,
            Name = "Indoor Clay Court 2",
            Description = "Enclosed training hall insulated from regional precipitation anomalies.",
            SurfaceType = "Clay",
            IsIndoor = true,
            DryCoefficient = 0.0, // Weather independent
            CreatedAtUtc = DateTime.UtcNow
        };
        context.Courts.Add(londonCourt1);
        context.Courts.Add(londonCourt2);

        // CREATE HUMAN LOGIN ROSTERS FOR LONDON
        var londonDirectorEmail = "director@londonvanguard.com";
        var londonDirector = new IdentityUser { UserName = londonDirectorEmail, Email = londonDirectorEmail, EmailConfirmed = true };
        var resultDirector = await userManager.CreateAsync(londonDirector, "LondonPass123!");
        
        if (resultDirector.Succeeded)
        {
            await userManager.AddToRoleAsync(londonDirector, "AcademyDirector");
            await userManager.AddClaimAsync(londonDirector, new Claim("AcademyId", londonAcademyId.ToString()));
            
            // Associate User to their Physical Branch
            var userBranchMapping = new UserBranch { AcademyId = londonAcademyId, UserId = londonDirector.Id, BranchId = londonBranchId, AssignmentRole = "Director" };
            context.UserBranches.Add(userBranchMapping);
        }

        var londonKeeperEmail = "keeper.tom@londonvanguard.com";
        var londonKeeper = new IdentityUser { UserName = londonKeeperEmail, Email = londonKeeperEmail, EmailConfirmed = true };
        if ((await userManager.CreateAsync(londonKeeper, "KeeperPass123!")).Succeeded)
        {
            await userManager.AddToRoleAsync(londonKeeper, "Groundskeeper");
            await userManager.AddClaimAsync(londonKeeper, new Claim("AcademyId", londonAcademyId.ToString()));

            context.UserBranches.Add(new UserBranch { AcademyId = londonAcademyId, UserId = londonKeeper.Id, BranchId = londonBranchId, AssignmentRole = "Grounds Crew" });
            
            // Granular Court Mapping Assignment Rule Check: Link Groundskeeper explicitly to Court 1
            context.UserCourts.Add(new UserCourt { AcademyId = londonAcademyId, UserId = londonKeeper.Id, BranchId = londonBranchId, CourtId = londonCourt1.Id, AccessType = "Maintenance" });
        }


        // =========================================================================
        // TENANT 2: MIDDLE EAST INFRASTRUCTURE BLUEPRINT (DUBAI DESERT VENUE)
        // =========================================================================
        var dubaiAcademyId = Guid.NewGuid();
        var dubaiAcademy = new Academy
        {
            Id = dubaiAcademyId,
            Name = "Apex Desert Tennis Consortium",
            Description = "Luxury ultra-high tier sports infrastructure installation.",
            CreatedAtUtc = DateTime.UtcNow
        };
        context.Academies.Add(dubaiAcademy);

        var dubaiBranchId = Guid.NewGuid();
        var dubaiBranch = new Branch
        {
            Id = dubaiBranchId,
            AcademyId = dubaiAcademyId,
            Name = "Dubai Desert Hardcourts",
            Description = "State of the art tournament oasis utilizing automated light control matrices.",
            TimeZoneId = "Asia/Dubai", // Local Matrix Target IANA
            CreatedAtUtc = DateTime.UtcNow
        };
        context.Branches.Add(dubaiBranch);

        var dubaiCourt1 = new Court
        {
            Id = Guid.NewGuid(),
            AcademyId = dubaiAcademyId,
            BranchId = dubaiBranchId,
            Name = "Grand Oasis Stadium",
            Description = "Plexicushion hardcourt featuring solar geometry floodlight triggers.",
            SurfaceType = "Hard",
            IsIndoor = false,
            DryCoefficient = 0.5, // Dries exceptionally quickly in high heat indicators
            CreatedAtUtc = DateTime.UtcNow
        };
        context.Courts.Add(dubaiCourt1);

        // CREATE HUMAN LOGIN ROSTERS FOR DUBAI
        var dubaiDirectorEmail = "director@dubaiapex.com";
        var dubaiDirector = new IdentityUser { UserName = dubaiDirectorEmail, Email = dubaiDirectorEmail, EmailConfirmed = true };
        if ((await userManager.CreateAsync(dubaiDirector, "DubaiPass123!")).Succeeded)
        {
            await userManager.AddToRoleAsync(dubaiDirector, "AcademyDirector");
            await userManager.AddClaimAsync(dubaiDirector, new Claim("AcademyId", dubaiAcademyId.ToString()));

            context.UserBranches.Add(new UserBranch { AcademyId = dubaiAcademyId, UserId = dubaiDirector.Id, BranchId = dubaiBranchId, AssignmentRole = "Director" });
        }

        // =========================================================================
        // PART 3: SCHEDULING INFRASTRUCTURE SEED DATA (THE CALENDAR MATRIX)
        // =========================================================================
        Console.WriteLine("--> Seeding deterministic booking matrix constraints into PostgreSQL...");

        // Establish relative date parameters anchored cleanly to UTC
        var baseDate = DateTime.UtcNow.Date;

        // --- LONDON SCHEDULE LINEUP ---
        // Booking 1: Standard Member Singles Match on Stadium Center Clay
        var memberBooking1 = new Booking
        {
            Id = Guid.NewGuid(),
            AcademyId = londonAcademyId,
            CourtId = londonCourt1.Id,
            BookedByUserId = "player.alex@vanguard.com",
            OpponentUserId = "player.ben@vanguard.com",
            StartTimeUtc = baseDate.AddHours(9), // 09:00 UTC
            EndTimeUtc = baseDate.AddHours(10).AddMinutes(30), // 10:30 UTC
            BookingType = "MemberBooking",
            Notes = "Friendly ladder ranking match.",
            CreatedAtUtc = DateTime.UtcNow
        };

        // Booking 2: High-Priority Executive Training Clinic on Indoor Clay Court 2
        var clinicBooking1 = new Booking
        {
            Id = Guid.NewGuid(),
            AcademyId = londonAcademyId,
            CourtId = londonCourt2.Id,
            BookedByUserId = londonDirectorEmail,
            StartTimeUtc = baseDate.AddHours(14), // 14:00 UTC
            EndTimeUtc = baseDate.AddHours(16), // 16:00 UTC
            BookingType = "Clinic",
            Notes = "Elite Under-18 National Topspin Clinic block.",
            CreatedAtUtc = DateTime.UtcNow
        };

        context.Bookings.Add(memberBooking1);
        context.Bookings.Add(clinicBooking1);

        // --- DUBAI SCHEDULE LINEUP ---
        // Booking 3: International Tournament Block on Grand Oasis Stadium
        var tournamentBooking1 = new Booking
        {
            Id = Guid.NewGuid(),
            AcademyId = dubaiAcademyId,
            CourtId = dubaiCourt1.Id,
            BookedByUserId = dubaiDirectorEmail,
            StartTimeUtc = baseDate.AddHours(18), // 18:00 UTC
            EndTimeUtc = baseDate.AddHours(21), // 21:00 UTC
            BookingType = "Clinic", // Handled under executive scheduling rule templates
            Notes = "Middle East Junior Desert Championship Opening Rounds.",
            CreatedAtUtc = DateTime.UtcNow
        };

        context.Bookings.Add(tournamentBooking1);

        // Commit all generated records cleanly into PostgreSQL storage
        await context.SaveChangesAsync();
        Console.WriteLine("--> Database seeding operations finalized successfully.");
    }
}
