using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace GlobalAcademy.Hubs
{
    /// <summary>
    /// Real-time gateway hub proxying asynchronous Harness Engineering alert updates 
    /// and Human-In-The-Loop validation gates cleanly to authenticated director panels.
    /// </summary>
    [Authorize(Roles = "AcademyDirector,GlobalAdmin")]
    public class HarnessApprovalHub : Hub
    {
        // =========================================================================
        // TENANT-BOUNDED CONNECTIVITY RAILS
        // =========================================================================

        /// <summary>
        /// Contextual hook executing automatically upon websocket handshake completion.
        /// Binds the client connection to an isolated group mapped to their unique Academy ID.
        /// </summary>
        public override async Task OnConnectedAsync()
        {
            var httpContext = Context.GetHttpContext();
            var academyIdClaim = httpContext?.User?.FindFirst("AcademyId")?.Value;

            if (!string.IsNullOrEmpty(academyIdClaim))
            {
                // Isolate connection stream boundaries inside a specific multi-tenant group name footprint
                string tenantGroupName = $"Tenant_Group_{academyIdClaim}";
                await Groups.AddToGroupAsync(Context.ConnectionId, tenantGroupName);
                
                Console.WriteLine($"📡 [SIGNALR HUB] Connection {Context.ConnectionId} successfully locked to tenant isolation group: {tenantGroupName}");
            }
            else
            {
                Console.WriteLine($"⚠️ [SIGNALR HUB WARNING] Connection {Context.ConnectionId} attempted entry without standard cryptographic tenant metadata. Rejecting connection socket channel.");
                Context.Abort();
            }

            await base.OnConnectedAsync();
        }

        /// <summary>
        /// Cleans up localized tenant group arrays when an employee logs out or disconnects.
        /// </summary>
        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var httpContext = Context.GetHttpContext();
            var academyIdClaim = httpContext?.User?.FindFirst("AcademyId")?.Value;

            if (!string.IsNullOrEmpty(academyIdClaim))
            {
                string tenantGroupName = $"Tenant_Group_{academyIdClaim}";
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, tenantGroupName);
            }

            await base.OnDisconnectedAsync(exception);
        }

        // =========================================================================
        // OUTBOUND BROADCAST PROXIES
        // =========================================================================

        /// <summary>
        /// Broadcasts an active pending validation payload notification exclusively to the tenant academy group 
        /// to render the high-density director form card overlay on screen.
        /// </summary>
        public async Task BroadcastPendingApprovalGate(string academyId, string threadId, string payloadJson, string rationaleText)
        {
            string tenantGroupName = $"Tenant_Group_{academyId}";
            
            // Invoke the client event handler registered on the React panel layout tier
            await Clients.Group(tenantGroupName).SendAsync("ReceiveHarnessApprovalGate", new {
                ThreadId = threadId,
                Payload = payloadJson,
                Rationale = rationaleText,
                TimestampUtc = DateTime.UtcNow
            });
            
            Console.WriteLine($"🟢 [SIGNALR BROADCAST] Successfully pushed human approval break alert for thread: {threadId} down tenant group wire: {tenantGroupName}");
        }
    }
}
