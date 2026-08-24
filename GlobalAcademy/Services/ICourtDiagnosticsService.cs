// File: GlobalAcademy.Services/ICourtDiagnosticsService.cs
using System.Threading.Tasks;
using GlobalAcademy.Models.DTOs;
using System;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using GlobalAcademy.Data;
using GlobalAcademy.Models;
using GlobalAcademy.Security;

namespace GlobalAcademy.Services;
public interface ICourtDiagnosticsService
{
    Task ProcessTelemetryAsync(CourtDiagnosticsPayloadDto payload);
}

public class CourtDiagnosticsService : ICourtDiagnosticsService
{
    private readonly ApplicationDbContext _context; // Replace with your exact DbContext name
    private readonly ITenantProvider _tenantProvider;

    public CourtDiagnosticsService(ApplicationDbContext context, ILogger<CourtDiagnosticsService> logger, ITenantProvider tenantProvider)
    {
        _context = context;
        _tenantProvider = tenantProvider;
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
}

