using System;
using System.ComponentModel;
using System.Threading.Tasks;
using Microsoft.SemanticKernel;
using Microsoft.EntityFrameworkCore;
using GlobalAcademy.Data;

namespace GlobalAcademy.Plugins;

public class CourtSchedulingPlugin
{
    private readonly ApplicationDbContext _dbContext;

    public CourtSchedulingPlugin(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [KernelFunction, Description("Reassigns an available open court booking slot to a displaced shadow queue player record.")]
    public async Task<string> AssignPlayerToSlot(
        [Description("The unique Guid string ID of the player record sitting in the Shadow Queue table.")] string queueId,
        [Description("The unique Guid string ID of the Booking slot matrix row.")] string slotId)
    {
        // 1. Parse incoming strings safely into strong Guid types
        if (!Guid.TryParse(queueId, out Guid queueGuid))
            return $"Failure: Provided queueId '{queueId}' is not a valid cryptographic Guid format.";

        if (!Guid.TryParse(slotId, out Guid slotGuid))
            return $"Failure: Provided slotId '{slotId}' is not a valid cryptographic Guid format.";

        // 2. Execute query utilizing matching Guid-to-Guid types
        var queueItem = await _dbContext.ShadowQueues.FirstOrDefaultAsync(q => q.Id == queueGuid && !q.IsResolved);
        var openSlot = await _dbContext.Bookings.FirstOrDefaultAsync(b => b.Id == slotGuid && b.IsAvailableSlot);

        if (queueItem == null) return $"Failure: ShadowQueue target identity {queueGuid} was not found or is already resolved.";
        if (openSlot == null) return $"Failure: Booking slot row {slotGuid} is no longer available or was deleted.";

        // 3. Commit state changes
        openSlot.IsAvailableSlot = false;
        openSlot.BookedPlayerName = queueItem.PlayerName; 
        queueItem.IsResolved = true; 

        await _dbContext.SaveChangesAsync();

        return $"Success! Player '{queueItem.PlayerName}' has been assigned to Court '{openSlot.CourtName}' at UTC {openSlot.SlotTime:yyyy-MM-dd HH:mm}. ShadowQueue {queueGuid} resolved successfully.";
    }
}
