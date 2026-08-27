using GlobalAcademy.Data;
using GlobalAcademy.Models;
using GlobalAcademy.Models.DTOs;
using GlobalAcademy.Security;
using GlobalAcademy.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace GlobalAcademy.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "AcademyDirector,Groundskeeper,GlobalAdmin")]
public class MaintenanceController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ICourtDiagnosticsService _diagnosticsService;
    private readonly ITenantProvider _tenantProvider;

    public MaintenanceController(ApplicationDbContext context,
        ICourtDiagnosticsService diagnosticsService,
        ITenantProvider tenantProvider)
    {
        _context = context;
        _diagnosticsService = diagnosticsService;
        _tenantProvider = tenantProvider;
    }

    // =========================================================================
    // SHADOW QUEUE CRUDS MANAGEMENT
    // =========================================================================

    [HttpGet("shadow-queue")]
    public async Task<IActionResult> GetShadowQueue()
    {
        var queue = await _context.ShadowQueues.ToListAsync();
        return Ok(queue);
    }

    [HttpGet("shadow-queue/{id:guid}")]
    public async Task<IActionResult> GetShadowQueueById(Guid id)
    {
        var entry = await _context.ShadowQueues.FindAsync(id);
        if (entry == null) return NotFound("Shadow queue entry missing.");
        return Ok(entry);
    }

    // --- MANUALLY INSERT AN ENTRY TO STANDBY POOL (CREATE) ---
    [HttpPost("shadow-queue")]
    public async Task<IActionResult> CreateShadowQueueEntry([FromBody] CreateShadowQueueDto model)
    {
        var entry = new ShadowQueue
        {
            Id = Guid.NewGuid(),
            OriginalCourtId = model.OriginalCourtId,
            PlayerUserId = model.PlayerUserId,
            OpponentUserId = model.OpponentUserId,
            OriginalStartTimeUtc = model.OriginalStartTimeUtc,
            OriginalEndTimeUtc = model.OriginalEndTimeUtc,
            QueueStatus = model.QueueStatus,
            DisplacementReason = model.DisplacementReason
        };

        _context.ShadowQueues.Add(entry);
        await _context.SaveChangesAsync();
        return Ok(entry);
    }

    // --- MODIFY QUEUE META (UPDATE) ---
    [HttpPut("shadow-queue/{id:guid}")]
    public async Task<IActionResult> UpdateShadowQueueEntry(Guid id, [FromBody] UpdateShadowQueueDto model)
    {
        var entry = await _context.ShadowQueues.FindAsync(id);
        if (entry == null) return NotFound("Shadow queue log context missing.");

        entry.QueueStatus = model.QueueStatus;
        entry.DisplacementReason = model.DisplacementReason;

        await _context.SaveChangesAsync();
        return Ok(new { Message = "Standby record matrix metadata updated smoothly.", Entry = entry });
    }

    // --- PURGE FROM STANDBY (DELETE) ---
    [HttpDelete("shadow-queue/{id:guid}")]
    public async Task<IActionResult> DeleteShadowQueueEntry(Guid id)
    {
        var entry = await _context.ShadowQueues.FindAsync(id);
        if (entry == null) return NotFound("Target shadow queue record missing.");

        _context.ShadowQueues.Remove(entry);
        await _context.SaveChangesAsync();
        return Ok(new { Message = "Standby player queue profile unlinked and removed successfully." });
    }

    // =========================================================================
    // MAINTENANCE TICKETS CRUDS MANAGEMENT
    // =========================================================================

    [HttpGet("tickets")]
    public async Task<IActionResult> GetActiveTickets()
    {
        var tickets = await _context.MaintenanceTickets.ToListAsync();
        return Ok(tickets);
    }

    [HttpGet("tickets/{id:guid}")]
    public async Task<IActionResult> GetTicketById(Guid id)
    {
        var ticket = await _context.MaintenanceTickets.FindAsync(id);
        if (ticket == null) return NotFound("Target maintenance ticket missing.");
        return Ok(ticket);
    }

    // --- MANUALLY DESPATCH WORK ORDER (CREATE) ---
    [HttpPost("tickets")]
    public async Task<IActionResult> CreateMaintenanceTicket([FromBody] CreateTicketDto model)
    {
        var ticket = new MaintenanceTicket
        {
            Id = Guid.NewGuid(),
            CourtId = model.CourtId,
            Title = model.Title,
            Description = model.Description,
            TicketStatus = "Open_Queued",
            PriorityLevel = model.PriorityLevel
        };

        _context.MaintenanceTickets.Add(ticket);
        await _context.SaveChangesAsync();
        return Ok(ticket);
    }

    // --- MODIFY PROGRESS DETAILS (UPDATE) ---
    [HttpPut("tickets/{id:guid}")]
    public async Task<IActionResult> UpdateMaintenanceTicket(Guid id, [FromBody] UpdateTicketDto model)
    {
        var ticket = await _context.MaintenanceTickets.FindAsync(id);
        if (ticket == null) return NotFound("Target maintenance work order tracking missing.");

        ticket.Title = model.Title;
        ticket.Description = model.Description;
        ticket.TicketStatus = model.TicketStatus;
        ticket.PriorityLevel = model.PriorityLevel;

        await _context.SaveChangesAsync();
        return Ok(new { Message = "Work order log metadata updated safely.", Ticket = ticket });
    }

    // --- PURGE WORK ORDER SCRIPTS (DELETE) ---
    [HttpDelete("tickets/{id:guid}")]
    public async Task<IActionResult> DeleteMaintenanceTicket(Guid id)
    {
        var ticket = await _context.MaintenanceTickets.FindAsync(id);
        if (ticket == null) return NotFound("Target maintenance work order tracker record missing.");

        _context.MaintenanceTickets.Remove(ticket);
        await _context.SaveChangesAsync();
        return Ok(new { Message = "Work order ticket permanently removed from system database storage structures." });
    }

    [HttpPost("tickets/{id:guid}/resolve")]
    public async Task<IActionResult> ResolveTicket(Guid id, [FromBody] ResolveTicketDto model)
    {
        var ticket = await _context.MaintenanceTickets.FindAsync(id);
        if (ticket == null) return NotFound("Target maintenance ticket missing or unauthorized access attempt.");

        var court = await _context.Courts.FindAsync(ticket.CourtId);
        if (court == null) return NotFound("Linked court asset infrastructure configuration missing.");

        ticket.TicketStatus = "Resolved_Completed";
        ticket.ResolvedAtUtc = DateTime.UtcNow;
        ticket.ResolutionNotes = model.Notes;

        court.AggregateMinutesPlayed = 0;

        if (court.Status == "Maintenance_Locked")
        {
            court.Status = "Open";
            Console.WriteLine($"--> Facility Reset Triggered: {court.Name} has been refurbished. Status returned to Open.");
        }

        await _context.SaveChangesAsync();
        return Ok(new { 
            Message = "Surface maintenance completed successfully. Court asset aggregate usage trackers cleared and reopened.", 
            UpdatedCourtStatus = court.Status 
        });
    }

    [HttpPost("court-diagnostics")]
    public async Task<IActionResult> SubmitTelemetry([FromBody] CourtDiagnosticsPayloadDto payload)
    {
        // 1. Guard check for empty payloads
        if (payload == null)
        {
            return BadRequest("Inbound telemetry payload cannot be null.");
        }

        // 2. Validate C# model states/annotations
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        if (!Guid.TryParse(payload.CourtId, out Guid verifiedCourtId))
        {
            return BadRequest($"The inbound CourtId '{payload.CourtId}' is not a valid GUID.");
        }

        var court = await _context.Courts.FindAsync(verifiedCourtId);
        if (court == null) return NotFound("Target court entity configuration layout missing.");

        var currentAcademyId = _tenantProvider.GetTenantId();

        if (court.AcademyId != currentAcademyId)
        {
            return BadRequest("Inbound court telemetry payload is not valid for current tenant academy.");
        }

        // 3. Pass data to the brain (Service Layer)
        payload.AcademyId = court.AcademyId;
        payload.BranchId = court.BranchId;

        await _diagnosticsService.ProcessTelemetryAsync(payload);

        // 4. Return success state to the calling Python Engine
        return Ok(new { 
            status = "Success", 
            message = "Court telemetry processed successfully." 
        });
    }

    // --- READ ALL: GET api/maintenance/court-diagnostics ---
    [HttpGet("court-diagnostics-view")]
    public async Task<IActionResult> GetTenantDiagnostics(
        [FromQuery] int pageNumber = 1, 
        [FromQuery] int pageSize = 10,
        [FromQuery] string? courtId = null,
        [FromQuery] string? branchId = null,
        [FromQuery] string? search = null)
    {
        // 1. Build the base query execution expression bound to this multi-tenant claim
        var query = _context.CourtDiagnosticSnapshots
            .Include(s => s.Court)
                .ThenInclude(c => c!.Branch)
            .Where(s => s.AcademyId == _tenantProvider.GetTenantId());

        // 2. Cascade server-side physical database boundaries instantly if filters are passed
        if (Guid.TryParse(courtId, out Guid parsedCourtId))
        {
            query = query.Where(s => s.CourtId == parsedCourtId);
        }
        else if (Guid.TryParse(branchId, out Guid parsedBranchId))
        {
            query = query.Where(s => s.BranchId == parsedBranchId);
        }

        // 3. Optional: Basic server-side text string keyword pre-filtering if provided
        if (!string.IsNullOrWhiteSpace(search))
        {
            var cleanSearch = search.ToLower().Trim();
            query = query.Where(s => 
                (s.Court != null && s.Court.Name.ToLower().Contains(cleanSearch)) ||
                s.AgentVersion.ToLower().Contains(cleanSearch)
            );
        }

        // 4. Calculate total matched count BEFORE cutting records into page slices
        int totalRecords = await query.CountAsync();

        // 5. Slice database rows directly inside PostgreSQL memory via Skip and Take
        var snapshotsData = await query
        .OrderByDescending(s => s.Timestamp)
        .Skip((pageNumber - 1) * pageSize)
        .Take(pageSize)
        .Select(s => new
        {
            sessionId = s.SessionId,
            academyId = s.AcademyId,
            courtId = s.CourtId,
            courtName = s.Court != null ? s.Court.Name : "Unknown Court",
            branchId = s.BranchId,
            branchName = (s.Court != null && s.Court.Branch != null) ? s.Court.Branch.Name : "Unknown Branch",
            timestamp = s.Timestamp,
            surfaceFrictionIndex = s.SurfaceFrictionIndex,
            bounceUniformityPercentage = s.BounceUniformityPercentage,
            netTensionNewtons = s.NetTensionNewtons,
            ambientTemperatureCelsius = s.AmbientTemperatureCelsius,
            humidityPercentage = s.HumidityPercentage,
            agentVersion = s.AgentVersion,
            anomalies = s.Anomalies.Select(a => new
            {
                anomalyId = a.AnomalyId,
                sessionId = a.SessionId,
                academyId = a.AcademyId,
                branchId = a.BranchId,
                severity = a.Severity,
                category = a.Category,
                description = a.Description,
                confidenceScore = a.ConfidenceScore,
                recommendedAction = a.RecommendedAction
            }).ToList()
        })
        .ToListAsync();

        // 6. Wrap structural database outputs inside our new clean metadata envelope response DTO
        int totalPages = (int)Math.Ceiling((double)totalRecords / pageSize);

        var paginatedEnvelope = new PagedResponseDto<object>
        {
            Items = snapshotsData.Cast<object>().ToList(),
            TotalRecords = totalRecords,
            PageNumber = pageNumber,
            PageSize = pageSize,
            TotalPages = totalPages == 0 ? 1 : totalPages
        };

        return Ok(paginatedEnvelope);
    }
    // --- ORCHESTRATE & CALCULATE: POST api/maintenance/court-diagnostics/calculate/{courtId} ---
    [HttpPost("court-diagnostics/calculate/{courtId}")]
    public async Task<IActionResult> CalculateActiveDiagnostics(Guid courtId)
    {
        // 1. Verify target court exists inside this tenant boundary first
        Guid academyId = _tenantProvider.GetTenantId();

        var court = await _context.Courts.FindAsync(courtId);
        if (court == null) return NotFound($"Court ID '{courtId}' was not found within this academy branch.");

        try
        {
            // 2. Fire cross-port server-to-server call to Python Engine on port 8000
            CourtDiagnosticsPayloadDto computedPayload = await _diagnosticsService.RequestAgentAnalysisAsync(courtId);

            // 3. Enrich payload with tenant boundaries resolved from identity context
            computedPayload.AcademyId = academyId;
            computedPayload.BranchId = court.BranchId;

            // 4. Pass down to service layer to map and commit changes to SmartCourtDb
            await _diagnosticsService.ProcessTelemetryAsync(computedPayload);

            return Ok(new { message = $"Active structural analysis logged successfully for Court {courtId.ToString().Substring(0,8)}." });
        }
        catch (HttpRequestException httpEx)
        {
            // Traps cross-port HTTP handshake communication crashes (e.g. 404, 422 Unprocessable entity from Python)
            // Console.WriteLine($"--- 🚨 [DEBUG] CROSS-PORT HANDSHAKE CRASH ON PORT 8000 🚨 ---");
            // Console.WriteLine($"Message: {httpEx.Message}");
            
            return StatusCode(500, new { 
                message = "Cross-Port Connection Error", 
                detail = httpEx.Message 
            });
        }
        catch (DbUpdateException dbEx)
        {
            // Traps unique constraints, constraint deletions or structural PostgreSQL data truncations inside Docker
            // Console.WriteLine($"--- 🚨 [DEBUG] POSTGRESQL TRANSACTION CRASH 🚨 ---");
            // Console.WriteLine($"Inner Exception: {dbEx.InnerException?.Message ?? dbEx.Message}");
            
            return StatusCode(500, new { 
                message = "SmartCourtDb Storage Constraint Failure", 
                detail = dbEx.InnerException?.Message ?? dbEx.Message 
            });
        }
        catch (Exception generalEx)
        {
            // Traps runtime null references, object instance mapping failures, or property exceptions
            // Console.WriteLine($"--- 🚨 [DEBUG] GENERC BACKEND PIPELINE CRASH 🚨 ---");
            // Console.WriteLine($"Type: {generalEx.GetType().Name}");
            // Console.WriteLine($"Message: {generalEx.Message}");
            // Console.WriteLine($"Stack: {generalEx.StackTrace}");

            return StatusCode(500, new { 
                message = $"Internal Server Exception [{generalEx.GetType().Name}]", 
                detail = generalEx.Message 
            });
        }
    }
    // --- FORECAST DECAY DEADLINES: GET api/maintenance/court-diagnostics/forecast/{courtId} ---
    [HttpGet("court-diagnostics/forecast/{courtId}")]
    public async Task<IActionResult> GetCourtSurfaceWearForecast(Guid courtId)
    {
        Guid academyId = _tenantProvider.GetTenantId();
        
        // Safety check: Verify asset authorization boundaries
        var courtExists = await _context.Courts.AnyAsync(c => c.Id == courtId && c.AcademyId == academyId);
        if (!courtExists) return NotFound($"Target Court sector not found inside active academy branch context.");

        try
        {
            // Invoke the analytical pipeline method
            PredictiveAnalysisOutputDto forecastData = await _diagnosticsService.ExecuteSurfaceDecayForecastAsync(courtId);
            
            return Ok(forecastData);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Analytics pipeline execution failure: {ex.Message}");
        }
    }
    // --- ADVANCED PROPHET/SCIPY ENDPOINT: GET api/maintenance/court-diagnostics/forecast-advanced/{courtId} ---
    [HttpGet("court-diagnostics/forecast-advanced/{courtId}")]
    public async Task<IActionResult> GetAdvancedLifespanForecast(Guid courtId)
    {
        Guid academyId = _tenantProvider.GetTenantId();
        var courtExists = await _context.Courts.AnyAsync(c => c.Id == courtId && c.AcademyId == academyId);
        if (!courtExists) return NotFound($"Target Court asset context could not be validated.");

        try
        {
            // Routes execution cleanly into your newly engineered advanced method layout
            PredictiveAnalysisOutputDto forecastData = await _diagnosticsService.ExecuteAdvancedLifespanForecastAsync(courtId);
            return Ok(forecastData);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Advanced analytics execution crash: {ex.Message}");
        }
    }
    // --- DELETE: DELETE api/maintenance/court-diagnostics/{sessionId} ---
    [HttpDelete("court-diagnostics/{sessionId}")]
    public async Task<IActionResult> DeleteSnapshot(Guid sessionId)
    {
        Guid academyId = _tenantProvider.GetTenantId();

        // Guard check by unique ID and Tenant matching
        var snapshot = await _context.CourtDiagnosticSnapshots
            .FirstOrDefaultAsync(s => s.SessionId == sessionId && s.AcademyId == academyId);

        if (snapshot == null) return NotFound($"Diagnostic session snapshot '{sessionId}' not found.");

        // Remove snapshot. EF Core cascade rules automatically drop the associated anomalies table rows.
        _context.CourtDiagnosticSnapshots.Remove(snapshot);
        await _context.SaveChangesAsync();

        return Ok(new { message = $"Successfully purged diagnostic session snapshot {sessionId}." });
    }

    // --- READ TOPOLOGY TREE: GET api/maintenance/branches/topology ---
    [HttpGet("branches/topology")]
    public async Task<IActionResult> GetAcademyBranchTopology()
    {
        // 1. Resolve active multi-tenant boundary parameters
        Guid academyId = _tenantProvider.GetTenantId();

        // 2. Query structural relations directly out of PostgreSQL container memory
        var topologyData = await _context.Branches
            .Include(b => b.Courts)
            .Where(b => b.AcademyId == academyId && !b.IsDecommissioned)
            .OrderBy(b => b.Name)
            .Select(b => new BranchTopologyMetaDto
            {
                Id = b.Id,
                Name = b.Name,
                Description = b.Description,
                IsDecommissioned = b.IsDecommissioned,
                
                // Map child court rows that are actively maintained
                Courts = b.Courts
                    .Where(c => !c.IsDecommissioned)
                    .OrderBy(c => c.Name)
                    .Select(c => new MinimalCourtMetaDto
                    {
                        Id = c.Id,
                        Name = c.Name,
                        SurfaceType = c.SurfaceType,
                        IsIndoor = c.IsIndoor,
                        Status = c.Status
                    }).ToList()
            })
            .ToListAsync();

        return Ok(topologyData);
    }
    // --- BATCH SEED DATA: POST api/maintenance/court-diagnostics/seed/{courtId} ---
    [HttpPost("court-diagnostics/seed/{courtId}")]
    public async Task<IActionResult> SeedHistoricalTelemetryHistory(Guid courtId)
    {
        // 1. Resolve multi-tenant boundary parameters
        Guid academyId = _tenantProvider.GetTenantId();
        var court = await _context.Courts.FirstOrDefaultAsync(c => c.Id == courtId && c.AcademyId == academyId);
        if (court == null) return NotFound($"Court ID '{courtId}' was not found within this academy branch.");

        try
        {
            int count = await _diagnosticsService.SeedHistoricalTelemetryHistoryAsync(court);

            return Ok(new { 
                message = $"Successfully generated and injected {count} historical time-series entries for {court.Name}." 
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Historical injection pathway failure: {ex.Message}");
        }
    }
    // --- CURRENT ASSET HEALTH MATRIX: GET api/maintenance/court-health-summary ---
    [HttpGet("court-health-summary")]
    public async Task<IActionResult> GetAcademyCourtHealthSummary([FromQuery] string? branchId = null, [FromQuery] string? courtId = null)
    {
        Guid academyId = _tenantProvider.GetTenantId();

        // 1. Base query matching active multi-tenant court slots
        var courtsQuery = _context.Courts
            .Include(c => c.Branch)
            .Where(c => c.AcademyId == academyId && !c.IsDecommissioned);

        // 2. Apply filtering options passed from the collapsible ledger panel state
        if (Guid.TryParse(courtId, out Guid parsedCourtId))
        {
            courtsQuery = courtsQuery.Where(c => c.Id == parsedCourtId);
        }
        else if (Guid.TryParse(branchId, out Guid parsedBranchId))
        {
            courtsQuery = courtsQuery.Where(c => c.BranchId == parsedBranchId);
        }

        var courtsList = await courtsQuery.OrderBy(c => c.Name).ToListAsync();

        // 3. Retrieve the single latest snapshot row for each court via fast Partition matching
        var courtIds = courtsList.Select(c => c.Id).ToList();
        
        var latestSnapshots = await _context.CourtDiagnosticSnapshots
            .Include(s => s.Anomalies)
            .Where(s => courtIds.Contains(s.CourtId))
            .GroupBy(s => s.CourtId)
            .Select(g => g.OrderByDescending(s => s.Timestamp).FirstOrDefault())
            .ToDictionaryAsync(s => s!.CourtId, s => s);

        // 4. Map into our clean dashboard presentation DTO wrapper array
        var healthSummaryList = courtsList.Select(c =>
        {
            latestSnapshots.TryGetValue(c.Id, out var snapshot);

            return new CourtHealthOverviewDto
            {
                CourtId = c.Id,
                CourtName = c.Name,
                BranchId = c.BranchId,
                BranchName = c.Branch != null ? c.Branch.Name : "Main Facility",
                SurfaceType = c.SurfaceType,
                IsIndoor = c.IsIndoor,
                Status = c.Status,
                AggregateMinutesPlayed = c.AggregateMinutesPlayed,
                MaintenanceThresholdMinutes = c.MaintenanceThresholdMinutes,
                
                LatestSnapshot = snapshot == null ? null : new LatestSnapshotDataDto
                {
                    SessionId = snapshot.SessionId,
                    Timestamp = snapshot.Timestamp,
                    SurfaceFrictionIndex = snapshot.SurfaceFrictionIndex,
                    BounceUniformityPercentage = snapshot.BounceUniformityPercentage,
                    NetTensionNewtons = snapshot.NetTensionNewtons,
                    AmbientTemperatureCelsius = snapshot.AmbientTemperatureCelsius,
                    HumidityPercentage = snapshot.HumidityPercentage,
                    AgentVersion = snapshot.AgentVersion,
                    Anomalies = snapshot.Anomalies.Select(a => new MinimalAnomalyDto
                    {
                        AnomalyId = a.AnomalyId,
                        Severity = a.Severity,
                        Category = a.Category,
                        Description = a.Description,
                        ConfidenceScore = a.ConfidenceScore,
                        RecommendedAction = a.RecommendedAction
                    }).ToList()
                }
            };
        }).ToList();

        return Ok(healthSummaryList);
    }

}

public record ResolveTicketDto(string Notes);
public record CreateShadowQueueDto(Guid OriginalCourtId, string PlayerUserId, string? OpponentUserId, DateTime OriginalStartTimeUtc, DateTime OriginalEndTimeUtc, string QueueStatus, string DisplacementReason);
public record UpdateShadowQueueDto(string QueueStatus, string DisplacementReason);
public record CreateTicketDto(Guid CourtId, string Title, string Description, string PriorityLevel);
public record UpdateTicketDto(string Title, string Description, string TicketStatus, string PriorityLevel);
public class PagedResponseDto<T>
    {
        public List<T> Items { get; set; } = new();
        public int TotalRecords { get; set; }
        public int PageNumber { get; set; }
        public int PageSize { get; set; }
        public int TotalPages { get; set; }
    }