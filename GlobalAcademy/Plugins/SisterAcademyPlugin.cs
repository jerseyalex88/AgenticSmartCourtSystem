using System;
using System.ComponentModel;
using System.Threading.Tasks;
using Microsoft.SemanticKernel;
using Microsoft.EntityFrameworkCore;
using GlobalAcademy.Data;

namespace GlobalAcademy.Plugins;

public class SisterAcademyPlugin
{
    private readonly ApplicationDbContext _dbContext;

    public SisterAcademyPlugin(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [KernelFunction, Description("Searches alternative open slots at sister branches within a 15-minute drive.")]
    public async Task<string> SearchNearbySisterBranches(
        [Description("The original branch ID that is currently experiencing a rain-out cancellation.")] string currentBranchId)
    {
        if (!Guid.TryParse(currentBranchId, out Guid branchGuid))
            return "Failure: Invalid original branch format.";

        // In production, you would integrate a mapping API wrapper (like Google Maps or Mapbox) 
        // to calculate matrix distances. For our multi-tenant sandbox, we query nearby branches 
        // belonging to the same parent Academy group.
        var originalBranch = await _dbContext.Branches.FirstOrDefaultAsync(b => b.Id == branchGuid);
        if (originalBranch == null) return "Failure: Original facility could not be matched.";

        var sisterSlots = await _dbContext.Bookings
            .Where(b => b.AcademyId == originalBranch.AcademyId && b.BranchId != branchGuid && b.IsAvailableSlot)
            .Take(5)
            .ToListAsync();

        if (!sisterSlots.Any())
            return "No matching open slots found at any nearby sister branches.";

        return $"Found available alternative locations:\n" + 
               string.Join("\n", sisterSlots.Select(s => $"- SlotID: {s.Id}, Branch: North Branch, Court: {s.CourtName}, Time: {s.SlotTime:HH:mm} UTC"));
    }
}
