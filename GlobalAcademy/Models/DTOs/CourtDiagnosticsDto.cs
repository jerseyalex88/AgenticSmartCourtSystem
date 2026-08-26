// File: GlobalAcademy.Models.DTOs/CourtDiagnosticsDTOs.cs
using System;
using System.Text.Json.Serialization;

namespace GlobalAcademy.Models.DTOs
{
    /// <summary>
    /// Represents the complete inbound analysis payload from the Python Agent Engine.
    /// </summary>
    public record CourtDiagnosticsPayloadDto(
        [property: JsonPropertyName("session_id")] Guid SessionId,
        [property: JsonPropertyName("court_id")] string CourtId,
        [property: JsonPropertyName("timestamp")] DateTime Timestamp,
        [property: JsonPropertyName("metrics")] DiagnosticsMetricsDto Metrics,
        [property: JsonPropertyName("anomalies")] DiagnosticsAnomalyDto[] Anomalies,
        [property: JsonPropertyName("agent_version")] string AgentVersion
    )
    {
        // Added properties resolved at the API Gateway layer
        public Guid AcademyId { get; set; }
        public Guid BranchId { get; set; }
    };

    /// <summary>
    /// Captures the sub-millimetre physical telemetry and environmental metrics from the court sensors.
    /// </summary>
    public record DiagnosticsMetricsDto(
        [property: JsonPropertyName("surface_friction_index")] double SurfaceFrictionIndex,
        [property: JsonPropertyName("bounce_uniformity_percentage")] double BounceUniformityPercentage,
        [property: JsonPropertyName("net_tension_newtons")] double NetTensionNewtons,
        [property: JsonPropertyName("ambient_temperature_celsius")] double AmbientTemperatureCelsius,
        [property: JsonPropertyName("humidity_percentage")] double HumidityPercentage
    );

    /// <summary>
    /// Pinpoints exact structural or environmental structural anomalies detected during analysis.
    /// </summary>
    public record DiagnosticsAnomalyDto(
        [property: JsonPropertyName("anomaly_id")] Guid AnomalyId,
        [property: JsonPropertyName("severity")] AnomalySeverity Severity,
        [property: JsonPropertyName("category")] string Category,
        [property: JsonPropertyName("description")] string Description,
        [property: JsonPropertyName("confidence_score")] double ConfidenceScore,
        [property: JsonPropertyName("recommended_action")] string RecommendedAction
    );

    /// <summary>
    /// Defines severity operational baselines for triaging court maintenance.
    /// </summary>
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum AnomalySeverity
    {
        Info,
        Low,
        Medium,
        High,
        Critical
    }

    public class HistorySeederResponseDto
    {
        public string CourtId { get; set; } = string.Empty;
        public int TotalRecordsGenerated { get; set; }
        public List<CourtDiagnosticsPayloadDto> Records { get; set; } = new();
    }
    public class PredictiveAnalysisOutputDto
    {
        public string CourtId { get; set; } = string.Empty;
        public double VelocityFrictionLossPerDay { get; set; }
        public int EstimatedDaysUntilBreach { get; set; }
        public string? PredictedBreachDate { get; set; }
        public bool IsResurfaceRecommended { get; set; }
        public double ConfidenceScore { get; set; }
    }
}
