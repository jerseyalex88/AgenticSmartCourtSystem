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
    Task<PredictiveAnalysisOutputDto> ExecuteSurfaceDecayForecastAsync(Guid courtId);
    Task<PredictiveAnalysisOutputDto> ExecuteAdvancedLifespanForecastAsync(Guid courtId);
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
    public async Task<PredictiveAnalysisOutputDto> ExecuteSurfaceDecayForecastAsync(Guid courtId)
    {
        // 1. Gather the entire chronological footprint of snapshots recorded for this asset
        var localSnapshotsList = await _context.CourtDiagnosticSnapshots
            .Where(s => s.CourtId == courtId)
            .OrderBy(s => s.Timestamp)
            .Select(s => new
            {
                courtId = s.CourtId.ToString(),
                timestamp = s.Timestamp.ToString("o"), // ISO 8601 formatting alignment
                surfaceFrictionIndex = s.SurfaceFrictionIndex,
                bounceUniformityPercentage = s.BounceUniformityPercentage,
                netTensionNewtons = s.NetTensionNewtons,
                ambientTemperatureCelsius = s.AmbientTemperatureCelsius,
                humidityPercentage = s.HumidityPercentage
            })
            .ToListAsync();

        if (!localSnapshotsList.Any())
        {
            throw new InvalidOperationException("Cannot forecast decay profile on an asset with zero historical database entries.");
        }

        // var verboseJsonOptions = new System.Text.Json.JsonSerializerOptions { WriteIndented = true };
        // string rawPayloadDumpString = System.Text.Json.JsonSerializer.Serialize(localSnapshotsList, verboseJsonOptions);
        // Console.WriteLine(rawPayloadDumpString);

        PredictiveAnalysisOutputDto? forecastResults = null;

        try
        {
            // 2. Fire the server-to-server POST over the Docker network bridge to port 8000
            // Targets the exact folder route prefix matched on the Python side
            var response = await _client.PostAsJsonAsync("api/ai/diagnostics/forecast-surface-decay", localSnapshotsList);

            if (!response.IsSuccessStatusCode)
            {
                var errorDetails = await response.Content.ReadAsStringAsync();
                throw new HttpRequestException($"Python Analytics Engine rejected the trend query: {response.StatusCode} - {errorDetails}");
            }

            var jsonParsingOptions = new System.Text.Json.JsonSerializerOptions
            {
                // Tells .NET to map incoming 'estimated_days_until_breach' straight into 'EstimatedDaysUntilBreach'
                PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.SnakeCaseLower,
                PropertyNameCaseInsensitive = true
            };
            forecastResults = await response.Content.ReadFromJsonAsync<PredictiveAnalysisOutputDto>(jsonParsingOptions);

            //forecastResults = await response.Content.ReadFromJsonAsync<PredictiveAnalysisOutputDto>();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ [FORECASTING HANDSHAKE FAILURE]: {ex.Message}");
            throw;
        }

        if (forecastResults == null)
        {
            throw new InvalidOperationException("Python analytical services returned an empty forecasting payload.");
        }

        // var verboseJsonOptions = new System.Text.Json.JsonSerializerOptions { WriteIndented = true };
        // var rawPayloadDumpString = System.Text.Json.JsonSerializer.Serialize(forecastResults, verboseJsonOptions);
        // Console.WriteLine(rawPayloadDumpString);

        return forecastResults;
    }
    public async Task<PredictiveAnalysisOutputDto> ExecuteAdvancedLifespanForecastAsync(Guid courtId)
    {
        var court = await _context.Courts.FirstOrDefaultAsync(c => c.Id == courtId);
        if (court == null) throw new ArgumentException($"Court missing tracking target: {courtId}");

        var localSnapshotsList = await _context.CourtDiagnosticSnapshots
            .Where(s => s.CourtId == courtId)
            .OrderBy(s => s.Timestamp)
            .Select(s => new
            {
                courtId = s.CourtId.ToString(),
                timestamp = s.Timestamp.ToString("o"),
                surfaceFrictionIndex = s.SurfaceFrictionIndex,
                bounceUniformityPercentage = s.BounceUniformityPercentage,
                netTensionNewtons = s.NetTensionNewtons,
                ambientTemperatureCelsius = s.AmbientTemperatureCelsius,
                humidityPercentage = s.HumidityPercentage
            })
            .ToListAsync();

        if (!localSnapshotsList.Any()) throw new InvalidOperationException("No history found to process.");

        var payloadWrapperPacket = new
        {
            historical_snapshots = localSnapshotsList,
            court_metadata = new
            {
                status = court.Status,
                surface_type = court.SurfaceType,
                is_indoor = court.IsIndoor,
                dry_coefficient = court.DryCoefficient
            }
        };

        PredictiveAnalysisOutputDto? forecastResults = null;

        try
        {
            // Hits your brand-new distinct advanced python router address url string
            string advancedUrl = "api/ai/diagnostics/forecast-advanced-lifespan";
            var response = await _client.PostAsJsonAsync(advancedUrl, payloadWrapperPacket);

            if (!response.IsSuccessStatusCode)
            {
                var errorDetails = await response.Content.ReadAsStringAsync();
                throw new HttpRequestException($"Advanced Engine computation rejection: {errorDetails}");
            }

            forecastResults = await response.Content.ReadFromJsonAsync<PredictiveAnalysisOutputDto>();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ [ADVANCED HANDSHAKE FAILURE]: {ex.Message}");
            throw;
        }

        if (forecastResults == null) throw new InvalidOperationException("Empty results object mapped.");

        // Update persistent weather tracking structures if calculated by SciPy
        if (!string.IsNullOrWhiteSpace(forecastResults.EstimatedReopenTimeUtc) && 
            DateTime.TryParse(forecastResults.EstimatedReopenTimeUtc, out DateTime parsedReopenTime))
        {
            court.EstimatedReopenTimeUtc = parsedReopenTime.ToUniversalTime();
            court.DryCoefficient = forecastResults.CalculatedDryCoefficient;
            await _context.SaveChangesAsync();
        }

        return forecastResults;
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

