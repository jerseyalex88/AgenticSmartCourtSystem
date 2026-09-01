// File: GlobalAcademy.Models.DTOs/CourtHealthOverviewDto.cs
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace GlobalAcademy.Models.DTOs
{
    public enum AiProcessingModel
    {
        Standard,
        Predictive
    }
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
        
        // 🛠️ ADVANCED COMPUTER VISION SPATIAL HEATMAP ATTACHMENT CORE
        public SpatialHeatmapDto? Heatmap { get; set; }

        // 🔮 NEW: Parallel data transfer layer for the Kalman Predictive framework stream
        public SpatialHeatmapDto? PredictiveHeatmap { get; set; }

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
    public class SpatialHeatmapDto
    {
        [JsonPropertyName("court_id")]
        public Guid CourtId { get; set; }

        [JsonPropertyName("total_processed_bounces")]
        public int TotalProcessedBounces { get; set; }

        [JsonPropertyName("analyzed_video_filename")]
        public string AnalyzedVideoFilename { get; set; } = string.Empty;
    
        [JsonPropertyName("last_updated_utc")]
        public DateTime LastUpdatedUtc { get; set; }

        [JsonPropertyName("last_analyzed_clip_utc")]
        public DateTime LastAnalyzedClipUtc { get; set; }

        [JsonPropertyName("sectors")]
        public List<SectorImpactDto> Sectors { get; set; } = new();
        [JsonPropertyName("bounce_points")]
        public List<BouncePointDto> BouncePoints { get; set; } = new();
    }

    public class SectorImpactDto
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("bounce_count")]
        public int BounceCount { get; set; }

        [JsonPropertyName("wear_intensity_index")]
        public double WearIntensityIndex { get; set; }
    }
    public class BouncePointDto
    {
        [JsonPropertyName("x")]
        public double X { get; set; } // Percentage width coordinate from left edge (0 to 100)

        [JsonPropertyName("y")]
        public double Y { get; set; } // Percentage height coordinate from top edge (0 to 100)

        [JsonPropertyName("intensity")]
        public string Intensity { get; set; } = "High"; // High (Red), Moderate (Amber), Low (Blue)
    }
    public class SaveCourtCalibrationDto
    {
        [Required]
        public int VideoWidth { get; set; }

        [Required]
        public int VideoHeight { get; set; }
        [Required]
        public string CalibrationPhotoFilename { get; set; } = string.Empty;

        [Required]
        public double TopLeftX { get; set; }
        [Required]
        public double TopLeftY { get; set; }

        [Required]
        public double TopRightX { get; set; }
        [Required]
        public double TopRightY { get; set; }

        [Required]
        public double BottomLeftX { get; set; }
        [Required]
        public double BottomLeftY { get; set; }

        [Required]
        public double BottomRightX { get; set; }
        [Required]
        public double BottomRightY { get; set; }
    }
}
