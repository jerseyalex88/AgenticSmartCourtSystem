using Microsoft.EntityFrameworkCore;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using GlobalAcademy.Data;
using GlobalAcademy.Models;
using Microsoft.SemanticKernel.Connectors.OpenAI;

namespace GlobalAcademy.Services;

public class MatchSaverService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly Kernel _kernel;

    public MatchSaverService(ApplicationDbContext dbContext, Kernel kernel)
    {
        _dbContext = dbContext;
        _kernel = kernel;
    }
    public async Task<string> AutopilotOptimizeQueueAsync()
    {
        var pendingQueue = await _dbContext.ShadowQueues.Where(sq => !sq.IsResolved).ToListAsync();
        var openSlots = await _dbContext.Bookings.Where(b => b.IsAvailableSlot).Take(10).ToListAsync();

        if (!pendingQueue.Any()) return "No displaced players currently sitting in the shadow queue pipeline.";

        var chatService = _kernel.GetRequiredService<IChatCompletionService>();
        
        // CONFIGURE THE SUBAGENT TOOL EXECUTION MATRIX
        OpenAIPromptExecutionSettings settings = new()
        {
            ToolCallBehavior = ToolCallBehavior.AutoInvokeKernelFunctions, // CRITICAL: Autonomous loops enabled!
            Temperature = 0.1f // Lock down creativity to avoid drift anomalies
        };

        var chatHistory = new ChatHistory($$"""
            You are an enterprise subagent managing an automated Multi-Tenant Smart Court Scheduling system.
            Your job is to reconcile displaced players bumped by weather or facility conflicts.
            
            INSTRUCTIONS:
            1. Evaluate the incoming data models below.
            2. If a preferred time window aligns safely with an available slot, immediately call the 'SchedulingEngine_AssignPlayerToSlot' tool.
            3. Do not ask for human permission. Run the tool loops continuously until no more logical fits exist.

            PENDING SHADOW QUEUE:
            {{string.Join("\n", pendingQueue.Select(p => $"- ID: {p.Id.ToString()}, Name: {p.PlayerName}, Window: {p.PreferredWindow}"))}}

            AVAILABLE SLOTS:
            {{string.Join("\n", openSlots.Select(s => $"- ID: {s.Id.ToString()}, Court: {s.CourtName}, Time: {s.SlotTime:yyyy-MM-dd HH:mm} UTC"))}}
            """);

        // The kernel will call the plugins automatically behind the scenes, mutating database records!
        var response = await chatService.GetChatMessageContentAsync(chatHistory, settings, _kernel);
        return response.ToString();
    }

}
