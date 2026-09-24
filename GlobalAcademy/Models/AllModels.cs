
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Runtime.Serialization;
using Microsoft.EntityFrameworkCore;
using Pgvector;

namespace GlobalAcademy.Models {
    public class Academy
    {
        public Guid Id { get; set; }
        
        // Core descriptive identity properties
        public string Name { get; set; } = string.Empty; // e.g., "Mouratoglou Global Academy"
        public string Description { get; set; } = string.Empty;
        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow; // Anchored to UTC!

        // Navigation property mapping downward to branches
        public ICollection<Branch> Branches { get; set; } = new List<Branch>();
    }
    public class Branch : Security.IMultiTenant
    {
        public Guid Id { get; set; }
        public Guid AcademyId { get; set; } // Foreign key to top-level Academy

        public string Name { get; set; } = string.Empty; 
        public string Description { get; set; } = string.Empty; 
        
        // THE LOCAL MATRIX: Strict IANA identifier format (e.g., "Europe/London", "Asia/Dubai")
        public string TimeZoneId { get; set; } = "UTC"; 

        // THE GOLDEN RULE: Standard auditing markers locked exclusively to UTC
        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
        // --- PHASE 3 ADMINISTRATIVE METRICS ---
        // Soft-delete marker ensuring audit history persistence while unlinking from live queries
        public bool IsDecommissioned { get; set; } = false; 
        public double Latitude { get; set; } = 51.5074;  // Defaults to London baseline coordinate
        public double Longitude { get; set; } = -0.1278; // Defaults to London baseline coordinate

        // Relational navigation properties
        public Academy? Academy { get; set; }
        public ICollection<Court> Courts { get; set; } = new List<Court>();
    }
    public class Court : Security.IMultiTenant
    {
        public Guid Id { get; set; }
        public Guid AcademyId { get; set; }
        public Guid BranchId { get; set; } 

        public string Name { get; set; } = string.Empty; 
        public string Description { get; set; } = string.Empty; 
        public string SurfaceType { get; set; } = "Hard"; // Clay, Grass, Hard
        public bool IsIndoor { get; set; }
        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

        // --- PHASE 2 WEATHER TELEMETRY ---
        public string Status { get; set; } = "Open"; // "Open", "Rained_Out", "Maintenance_Locked"
        public double DryCoefficient { get; set; } = 1.0; 
        public DateTime? EstimatedReopenTimeUtc { get; set; }
        // --- PHASE 3 ADMINISTRATIVE METRICS ---
        // Soft-delete state protecting downstream relational integrity metrics
        public bool IsDecommissioned { get; set; } = false;

        // =========================================================================
        // SURFACE DEGRADATION & WEAR METRICS
        // =========================================================================
        
        // Aggregated running counter of all completed play minutes since the last service threshold reset
        public int AggregateMinutesPlayed { get; set; } = 0;

        // The hard ceiling threshold triggering maintenance locks. 
        // e.g., Clay triggers every 270 minutes (3 matches); Grass requires mowing/lining every 600 minutes
        public int MaintenanceThresholdMinutes { get; set; } = 270; 

        public Branch? Branch { get; set; }
        // Tracks the real-world state of the physical court hardware: "Off" or "On"
        public string FloodlightState { get; set; } = "Off";
        
        // 🛠️ MERGED PROPERTY: Native PostgreSQL indexable JSONB storage slot
        // Overwrites are committed atomically by your async Python callback webhooks
        [Column(TypeName = "jsonb")]
        public string? SpatialHeatmapJson { get; set; }
        
        [Column(TypeName = "jsonb")]
        public string? CameraCalibrationJson { get; set; }

        // =========================================================================
        // 🔮 NEW: ADVANCED PREDICTIVE COMPUTER VISION SPECTRUM TELEMETRY SLOT
        // =========================================================================
        // Stores Kalman-filtered cubic spline summary matrix data documents natively
        [Column(TypeName = "jsonb")]
        public string? PredictiveHeatmapJson { get; set; }
        // =========================================================================
    }
    public class UserBranch : Security.IMultiTenant
    {
        public Guid AcademyId { get; set; }

        // Composite Primary Key properties
        public string UserId { get; set; } = null!;
        public Guid BranchId { get; set; }

        public string AssignmentRole { get; set; } = "Staff"; // e.g., "BranchManager", "Groundskeeper"
        public DateTime AssignedAtUtc { get; set; } = DateTime.UtcNow;

        // Navigation property: One user-branch link can map to multiple specific court assignments
        public ICollection<UserCourt> AssignedCourts { get; set; } = new List<UserCourt>();
    }
    public class UserCourt : Security.IMultiTenant
    {
        public Guid AcademyId { get; set; }

        // Composite Primary Key linking directly back to the UserBranch parent assignment
        public string UserId { get; set; } = null!;
        public Guid BranchId { get; set; }
        
        // The specific court identifier being assigned
        public Guid CourtId { get; set; }
        
        public string AccessType { get; set; } = "Maintenance"; // e.g., "PrimaryGroundskeeper", "CoachSlot"
    }
    public class Booking : Security.IMultiTenant
    {
        public Guid Id { get; set; }
        public Guid AcademyId { get; set; } // Enforces our global query filter firewall
        public Guid BranchId { get; set; } 
        public Guid CourtId { get; set; }   // The targeted tennis asset

        // Human Context Tracking parameters
        public string BookedByUserId { get; set; } = string.Empty; // IdentityUser ID of the creator
        public string? OpponentUserId { get; set; } = string.Empty; // Nullable (useful for solo ball-machine training)

        // THE GOLDEN RULE TIMESTAMPS: Always stored as absolute UTC in PostgreSQL
        public DateTime StartTimeUtc { get; set; }
        public DateTime EndTimeUtc { get; set; }

        // THE ACADEMY VS. MEMBER SPLIT MATRIX MATRIX
        // String-based discrimination flag (e.g., "Clinic", "MemberBooking", "TournamentBlock", "Maintenance")
        public string BookingType { get; set; } = "MemberBooking"; 

        // Metadata & Audit trail logging
        public string Notes { get; set; } = string.Empty; // e.g., "Elite Junior Advanced Topspin Class"
        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

        // Navigation property back to the physical court asset
        public Court? Court { get; set; }
        public string CourtName { get; set; } = string.Empty; // Ensure this is exactly "CourtName"
        public DateTime SlotTime { get; set; }  
        public bool IsAvailableSlot { get; set; } = true;
        public string? BookedPlayerName { get; set; }
        public int DurationInMinutes { get; set; } = 60;
        public decimal PricePaid { get; set; } = 0.00m;
        public BookingStatus Status { get; set; } = BookingStatus.Booked;
    }
    public class ShadowQueue : Security.IMultiTenant
    {
        public Guid Id { get; set; }
        public Guid AcademyId { get; set; } // Protected by our multi-tenant firewall
        public Guid OriginalCourtId { get; set; }

        // Human Tracking parameters
        public string PlayerUserId { get; set; } = string.Empty;
        public string? OpponentUserId { get; set; } = string.Empty;

        // The preferred timing window parameters the player originally requested
        public DateTime OriginalStartTimeUtc { get; set; }
        public DateTime OriginalEndTimeUtc { get; set; }

        // Queue Status tracking: "Pending_Reschedule", "Successfully_Relocated", "Cancelled"
        public string QueueStatus { get; set; } = "Pending_Reschedule";
        
        public string DisplacementReason { get; set; } = "Executive Clinic Override";
        public DateTime DisplacedAtUtc { get; set; } = DateTime.UtcNow;
        public string PlayerName { get; set; } = string.Empty;     // Ensure this is exactly "PlayerName"
        public string PreferredWindow { get; set; } = string.Empty; // Ensure this is exactly "PreferredWindow"
        public bool IsResolved { get; set; } = false;
        public string PlayerPhoneNumber { get; set; } = string.Empty;
        public Guid? ProposedSlotId { get; set; }
        public string DispatchStatus { get; set; } = "AwaitingReply";
        public Guid? AssociatedBookingId { get; set; }
                
        [ForeignKey(nameof(AssociatedBookingId))]
        public Booking? AssociatedBooking { get; set; }
    }
    public class MaintenanceTicket : Security.IMultiTenant
    {
        public Guid Id { get; set; }
        public Guid AcademyId { get; set; }
        public Guid CourtId { get; set; }

        // Target Assignment Parameters
        public string Title { get; set; } = string.Empty; // e.g., "Clay Surface Sweep & Line Reset"
        public string Description { get; set; } = string.Empty;
        
        // Status tracking: "Open_Queued", "In_Progress", "Resolved_Completed"
        public string TicketStatus { get; set; } = "Open_Queued";
        
        // Severity tracking: "Routine_Wear", "Microclimatic_Storm_Damage", "Emergency"
        public string PriorityLevel { get; set; } = "Routine_Wear";

        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
        public DateTime? ResolvedAtUtc { get; set; }
        public string? ResolutionNotes { get; set; } = string.Empty;
    }
    public class CourtDiagnosticSnapshot : Security.IMultiTenant
    {
        [Key]
        public Guid SessionId { get; set; }

        // --- MULTI-TENANT BOUNDARIES ---
        [Required]
        public Guid AcademyId { get; set; }

        [Required]
        public Guid BranchId { get; set; }

        // --- RELATIONAL LINK TO THE COURT ---
        [Required]
        public Guid CourtId { get; set; } // Matches the Guid type from Court class

        [Required]
        public DateTime Timestamp { get; set; }

        [Required]
        public double SurfaceFrictionIndex { get; set; }

        [Required]
        public double BounceUniformityPercentage { get; set; }

        [Required]
        public double NetTensionNewtons { get; set; }

        [Required]
        public double AmbientTemperatureCelsius { get; set; }

        [Required]
        public double HumidityPercentage { get; set; }

        [Required]
        [Column("AgentVersion", TypeName = "varchar(20)")]
        public string AgentVersion { get; set; } = string.Empty;

        // Navigation properties
        [ForeignKey(nameof(CourtId))]
        public Court? Court { get; set; }

        public List<CourtDiagnosticAnomaly> Anomalies { get; set; } = new();
    }
    public class CourtDiagnosticAnomaly : Security.IMultiTenant
    {
        [Key]
        public Guid AnomalyId { get; set; }

        [Required]
        public Guid SessionId { get; set; }

        // --- MULTI-TENANT BOUNDARIES ---
        [Required]
        public Guid AcademyId { get; set; }

        [Required]
        public Guid BranchId { get; set; }

        [Required]
        [Column("Severity", TypeName = "varchar(20)")]
        public string Severity { get; set; } = string.Empty;

        [Required]
        [Column("Category", TypeName = "varchar(100)")]
        public string Category { get; set; } = string.Empty;

        [Required]
        [Column("Description", TypeName = "text")]
        public string Description { get; set; } = string.Empty;

        [Required]
        public double ConfidenceScore { get; set; }

        [Required]
        [Column("RecommendedAction", TypeName = "text")]
        public string RecommendedAction { get; set; } = string.Empty;

        // Foreign Key Navigation
        [ForeignKey(nameof(SessionId))]
        public CourtDiagnosticSnapshot? Snapshot { get; set; }
    }
    [Table("CourtMaintenanceKnowledge")]
    public class CourtMaintenanceKnowledge : Security.IMultiTenant
    {
        [Key]
        public Guid Id { get; set; }

        // 🛡️ Multi-Tenant Query Filter Firewall Anchors
        [Required]
        public Guid AcademyId { get; set; }
        
        [Required]
        public Guid BranchId { get; set; }
        
        // 🎯 OPTIONAL ASSET ANCHOR: Nullable Guid linking chunks directly to an individual court asset row
        public Guid? CourtId { get; set; }

        // Core Knowledge Content Tracking Columns
        [Required]
        public string DocumentName { get; set; } = string.Empty; // e.g., "Club_Maintenance_SOP.pdf"
        
        [Required]
        public string TextChunkContent { get; set; } = string.Empty; // The actual textual paragraph slice
        
        public int PageNumber { get; set; }

        // 🚀 THE VECTOR EMBEDDING CORE COLUMN
        // Maps natively to a PostgreSQL 'vector(1536)' data slot matching OpenAI embedding scales
        [Required]
        [Column(TypeName = "vector(1536)")]
        public Vector Embedding { get; set; }

        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    }
    [Table("SavedAgentQueries")]
    public class SavedAgentQuery : Security.IMultiTenant
    {
        [Key]
        public Guid Id { get; set; }

        // 🛡️ THE MULTI-TENANT FIREWALL ANCHOR
        // Automatically isolated via your global DbContext Query Filters
        [Required]
        public Guid AcademyId { get; set; }

        [Required]
        [StringLength(100)]
        public string Title { get; set; } = string.Empty; // e.g., "90-Day Prophet Warranty Audit"

        [Required]
        public string QueryText { get; set; } = string.Empty; // Holds the full multi-line prompt

        [Required]
        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    }

    [Table("GraphStateCheckpoints")]
    public class GraphStateCheckpoint : Security.IMultiTenant
    {
        // =========================================================================
        // COMPOSITE PRIMARY KEY STRUCTURE
        // =========================================================================
        
        /// <summary>
        /// Unique tracking identifier matching the active agentic conversation conversation layout thread.
        /// </summary>
        [Required]
        public Guid ThreadId { get; set; }

        /// <summary>
        /// State snapshot hash iteration token generated systematically by LangGraph compilation transitions.
        /// </summary>
        [Required]
        [StringLength(255)]
        public string CheckpointId { get; set; } = string.Empty;

        // =========================================================================
        // MULTI-TENANT ISOLATION BOUNDARIES & AUDITING FOOTPRINTS
        // =========================================================================
        
        /// <summary>
        /// Cryptographic global query filter partition firewall key.
        /// </summary>
        [Required]
        public Guid AcademyId { get; set; }

        /// <summary>
        /// IdentityUser token mapping the active physical employee or standard player executing the task.
        /// </summary>
        [Required]
        [StringLength(100)]
        public string UserId { get; set; } = string.Empty;

        /// <summary>
        /// The explicit worker graph location snapshot processing the token payload array (e.g. Worker_Financial_Ledger).
        /// </summary>
        [Required]
        [StringLength(100)]
        public string ActiveNode { get; set; } = string.Empty;

        // =========================================================================
        // COMPRESSED BINARY/TEXT METRIC SLOTS
        // =========================================================================

        /// <summary>
        /// Native JSON database document block containing full state channel dictionaries, memories, and variables.
        /// </summary>
        [Required]
        [Column(TypeName = "jsonb")]
        public string SerializedState { get; set; } = string.Empty;

        /// <summary>
        /// Harness Engineering Monitor Counter: Validates active total tokens consumed inside context array window.
        /// </summary>
        [Required]
        public int ContextTokenCount { get; set; } = 0;

        /// <summary>
        /// Sequential circuit breaker execution metric to prevent cascading recursion loop leakage.
        /// </summary>
        [Required]
        public int LoopIterationCount { get; set; } = 0;

        /// <summary>
        /// Auditing timestamp strictly anchored to universal coordinated timeline framework.
        /// </summary>
        [Required]
        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    }
}
