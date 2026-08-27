// File: GlobalAcademy.Models.DTOs/CourtHealthOverviewDto.cs
using System;
using System.Collections.Generic;

namespace GlobalAcademy.Models.DTOs
{
    public class CourtHealthOverviewDto
    {
        public Guid CourtId { get; set; }
        public string CourtName { get; set; } = string.Empty;
        public string BranchName { get; set; } = string.Empty;
        public Guid BranchId { get; set; }
        public string SurfaceType { get; set; } = "Hard";
        public bool IsIndoor { get; set; }
        public string Status { get; set; } = "Open";
        public int AggregateMinutesPlayed { get; set; }
        public int MaintenanceThresholdMinutes { get; set; }

        // Holds the single, latest diagnostic snapshot data row or null if never calculated
        public LatestSnapshotDataDto? LatestSnapshot { get; set; }
    }

    public class LatestSnapshotDataDto
    {
        public Guid SessionId { get; set; }
        public DateTime Timestamp { get; set; }
        public double SurfaceFrictionIndex { get; set; }
        public double BounceUniformityPercentage { get; set; }
        public double NetTensionNewtons { get; set; }
        public double AmbientTemperatureCelsius { get; set; }
        public double HumidityPercentage { get; set; }
        public string AgentVersion { get; set; } = string.Empty;
        public List<MinimalAnomalyDto> Anomalies { get; set; } = new();
    }

    public class MinimalAnomalyDto
    {
        public Guid AnomalyId { get; set; }
        public string Severity { get; set; } = "Info";
        public string Category { get; set; } = "General";
        public string Description { get; set; } = string.Empty;
        public double ConfidenceScore { get; set; }
        public string RecommendedAction { get; set; } = string.Empty;
    }
}
