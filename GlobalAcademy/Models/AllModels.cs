
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
}
