// File: GlobalAcademy.Services/ICourtDiagnosticsService.cs
using System.Threading.Tasks;
using GlobalAcademy.Models.DTOs;
using System;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using GlobalAcademy.Data;
using GlobalAcademy.Models;
using GlobalAcademy.Security;
using Microsoft.EntityFrameworkCore;
using OpenAI.Chat;

namespace GlobalAcademy.Services;
public interface ICourtDiagnosticsService
{
    Task ProcessTelemetryAsync(CourtDiagnosticsPayloadDto payload);
    Task<CourtDiagnosticsPayloadDto> RequestAgentAnalysisAsync(Guid courtId);
    Task<int> SeedHistoricalTelemetryHistoryAsync(Court court);
}

public class CourtDiagnosticsService : ICourtDiagnosticsService
{
    private readonly ApplicationDbContext _context; // Replace with your exact DbContext name
    private readonly HttpClient _client;

    public CourtDiagnosticsService(ApplicationDbContext context, 
    HttpClient client)
    {
        _context = context;
        _client = client;
    }

    public async Task ProcessTelemetryAsync(CourtDiagnosticsPayloadDto payload)
    {
        if (!Guid.TryParse(payload.CourtId, out Guid verifiedCourtId))
        {
            throw new ArgumentException($"The inbound CourtId '{payload.CourtId}' is not a valid GUID.");
        }

        // 1. Create the base entity map
        var snapshot = new CourtDiagnosticSnapshot
        {
            SessionId = payload.SessionId,
            CourtId = verifiedCourtId,
            AcademyId = payload.AcademyId,
            BranchId = payload.BranchId,
            Timestamp = payload.Timestamp.ToUniversalTime(), // PostgreSQL requires UTC for timestamptz
            SurfaceFrictionIndex = payload.Metrics.SurfaceFrictionIndex,
            BounceUniformityPercentage = payload.Metrics.BounceUniformityPercentage,
            NetTensionNewtons = payload.Metrics.NetTensionNewtons,
            AmbientTemperatureCelsius = payload.Metrics.AmbientTemperatureCelsius,
            HumidityPercentage = payload.Metrics.HumidityPercentage,
            AgentVersion = payload.AgentVersion,
            
            // Map sub-list child items directly
            Anomalies = payload.Anomalies.Select(a => new CourtDiagnosticAnomaly
            {
                AnomalyId = a.AnomalyId,
                SessionId = payload.SessionId,
                AcademyId = payload.AcademyId,
                BranchId = payload.BranchId,
                Severity = a.Severity.ToString(),
                Category = a.Category,
                Description = a.Description,
                ConfidenceScore = a.ConfidenceScore,
                RecommendedAction = a.RecommendedAction
            }).ToList()
        };

        // 2. Queue for database tracking
        await _context.CourtDiagnosticSnapshots.AddAsync(snapshot);

        // 3. Commit transactions directly inside Docker
        await _context.SaveChangesAsync();
    }
    public async Task<CourtDiagnosticsPayloadDto> RequestAgentAnalysisAsync(Guid courtId)
    {
        var court = await _context.Courts.FirstOrDefaultAsync<Court>(c => c.Id == courtId);
        if (court == null)
        {
            throw new ArgumentException($"Court metadata context could not be resolved for ID: {courtId}");
        }

        // 1. Compile physical raw sensors parameters
        var random = new Random();
        var telemetrySignals = new
        {
            court_id = courtId.ToString(),
            surface_friction_index = court.Status == "Rained_Out" ? 0.62 : Math.Round(random.NextDouble() * (0.88 - 0.74) + 0.74, 2),
            humidity_percentage = court.Status == "Rained_Out" ? 94.0 : Math.Round(random.NextDouble() * (70.0 - 45.0) + 45.0, 1),
            ambient_temperature_celsius = 23.4,
            net_tension_newtons = court.Status == "Maintenance_Locked" ? 365.0 : Math.Round(random.NextDouble() * (440.0 - 405.0) + 405.0, 1),
            iteration_index = 0
        };

        // 2. Wrap and bundle the persistent C# class entity metadata values explicitly
        var compiledWrapperPacket = new
        {
            telemetry_signals = telemetrySignals,
            court_metadata = new
            {
                surface_type = court.SurfaceType,
                is_indoor = court.IsIndoor,
                aggregate_minutes_played = court.AggregateMinutesPlayed,
                maintenance_threshold_minutes = court.MaintenanceThresholdMinutes,
                status = court.Status,
                dry_coefficient = court.DryCoefficient
            }
        };

        // 3. Post transaction cleanly over our server-to-server gateway
        CourtDiagnosticsPayloadDto? payload = null;

        try
        {
            string absoluteUrl = "api/ai/diagnostics/analyze-court-telemetry";
            var response = await _client.PostAsJsonAsync(absoluteUrl,compiledWrapperPacket);
            
            if (!response.IsSuccessStatusCode)
            {
                var errorMsg = await response.Content.ReadAsStringAsync();
                throw new HttpRequestException($"Python AI Engine calculation rejection: {response.StatusCode} - {errorMsg}");
            }

            payload = await response.Content.ReadFromJsonAsync<CourtDiagnosticsPayloadDto>();
        }
        catch (HttpRequestException httpEx)
        {
            // Captures connection drops, timeouts, or specific 4xx/5xx responses from port 8000
            Console.WriteLine($"❌ [NETWORK CRASH] Server-to-Server handshake failed on port 8000: {httpEx.Message} {httpEx.InnerException}");
            throw; // Rethrow to let your controller handling metrics bundle it cleanly for React
        }
        catch (Exception ex)
        {
            // Captures unexpected serialization structural shifts or mapping errors
            Console.WriteLine($"❌ [SERIALIZATION ERROR] Failed parsing contract returned from Python: {ex.Message} {ex.InnerException}");
            throw new InvalidOperationException($"The diagnostic payload structure was unparseable or corrupted: {ex.Message}", ex);
        }

        if (payload == null) throw new InvalidOperationException("Python agent engine returned an empty data signature.");
        return payload;            
    }
    public async Task<int> SeedHistoricalTelemetryHistoryAsync(Court court)
    {
        var pythonRequestPayload = new
        {
            court_id = court.Id.ToString(),
            surface_type = court.SurfaceType,
            is_indoor = court.IsIndoor
        };

        var response = await _client.PostAsJsonAsync("api/ai/diagnostics/seed-court-history", pythonRequestPayload);

        if (!response.IsSuccessStatusCode)
        {
            var errorContent = await response.Content.ReadAsStringAsync();
            throw new InvalidOperationException($"Python AI Engine seeder failure: {response.StatusCode} - {errorContent}");
        }

        var seederWrapper = await response.Content.ReadFromJsonAsync<HistorySeederResponseDto>();
        if (seederWrapper == null || seederWrapper.Records == null || !seederWrapper.Records.Any())
        {
            throw new InvalidOperationException("Python agent engine returned an empty or unreadable historical snapshot list.");
        }

        var snapshotsToSave = seederWrapper.Records.Select(payload => new CourtDiagnosticSnapshot
        {
            SessionId = payload.SessionId != Guid.Empty ? payload.SessionId : Guid.NewGuid(),
            CourtId = court.Id,
            AcademyId = court.AcademyId,
            BranchId = court.BranchId,
            Timestamp = payload.Timestamp.ToUniversalTime(), // Crucial: Flag as UTC for Postgres
            SurfaceFrictionIndex = payload.Metrics.SurfaceFrictionIndex,
            BounceUniformityPercentage = payload.Metrics.BounceUniformityPercentage,
            NetTensionNewtons = payload.Metrics.NetTensionNewtons,
            AmbientTemperatureCelsius = payload.Metrics.AmbientTemperatureCelsius,
            HumidityPercentage = payload.Metrics.HumidityPercentage,
            AgentVersion = "v1.7.5-hist",
            
            Anomalies = payload.Anomalies.Select(a => new CourtDiagnosticAnomaly
            {
                AnomalyId = a.AnomalyId != Guid.Empty ? a.AnomalyId : Guid.NewGuid(),
                SessionId = payload.SessionId,
                AcademyId = court.AcademyId,
                BranchId = court.BranchId,
                Severity = a.Severity.ToString(),
                Category = a.Category,
                Description = a.Description,
                ConfidenceScore = a.ConfidenceScore,
                RecommendedAction = a.RecommendedAction
            }).ToList()
        }).ToList();

        await _context.CourtDiagnosticSnapshots.AddRangeAsync(snapshotsToSave);
        await _context.SaveChangesAsync();

        return seederWrapper.TotalRecordsGenerated;
    }
}

