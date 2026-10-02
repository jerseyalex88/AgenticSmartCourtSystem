// =========================================================================
// FILE 0: INDOOR DELUGE CRISIS ENTITY FRAMEWORK MODELS
// PATH: GlobalAcademy.Core/Models/DelugeCrisisModels.cs
// DESCRIPTION: Strongly typed mapping tables supporting Workers D, E, and F
// =========================================================================

using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GlobalAcademy.Models
{
    // =========================================================================
    // 🛠️ 1. MODELS FOR WORKER D (PROCUREMENT & LOGISTICS)
    // =========================================================================

    [Table("EquipmentInventories")]
    public class EquipmentInventory : Security.IMultiTenant
    {
        [Key]
        [Required]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid AcademyId { get; set; }

        [Required]
        public Guid BranchId { get; set; }

        [Required]
        [StringLength(150)]
        public string ItemName { get; set; } = string.Empty; // e.g., "Industrial Dehumidifier XL"

        [Required]
        [StringLength(50)]
        public string AssetTag { get; set; } = string.Empty; // e.g., "DEHUM-BRANCH1-01"

        [Required]
        [StringLength(50)]
        public string CurrentStatus { get; set; } = "Available"; // e.g., "Available", "In_Use", "Maintenance"

        [Required]
        [StringLength(100)]
        public string LocationRoom { get; set; } = "Storage Locker B";

        [Required]
        public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
    }

    [Table("PurchaseOrders")]
    public class PurchaseOrder : Security.IMultiTenant
    {
        [Key]
        [Required]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid AcademyId { get; set; }

        [Required]
        public Guid BranchId { get; set; }

        [Required]
        [StringLength(150)]
        public string VendorName { get; set; } = string.Empty;

        [Required]
        public string ItemDescription { get; set; } = string.Empty;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalCost { get; set; } = 0.00m;

        [Required]
        [StringLength(50)]
        public string ApprovalStatus { get; set; } = "Draft_Staged"; // e.g., "Draft_Staged", "Approved", "Rejected"

        [Required]
        [StringLength(100)]
        public string CreatedByWorker { get; set; } = "Worker_Procurement_Logistics";

        [Required]
        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    }

    // =========================================================================
    // 🛠️ 2. MODEL FOR WORKER E (PLAYER COMMUNICATIONS)
    // =========================================================================

    [Table("CommunicationLogs")]
    public class CommunicationLog : Security.IMultiTenant
    {
        [Key]
        [Required]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid AcademyId { get; set; }

        [Required]
        public Guid ThreadId { get; set; }

        [Required]
        [StringLength(100)]
        public string PlayerId { get; set; } = string.Empty;

        [Required]
        [StringLength(150)]
        [EmailAddress]
        public string RecipientEmail { get; set; } = string.Empty;

        [Required]
        [StringLength(20)]
        public string MessageChannel { get; set; } = "Email"; // e.g., "Email", "SMS"

        [Required]
        [StringLength(200)]
        public string MessageSubject { get; set; } = string.Empty;

        [Required]
        public string MessageBody { get; set; } = string.Empty;

        [Required]
        [StringLength(50)]
        public string DispatchStatus { get; set; } = "Staged_In_Queue"; // e.g., "Staged_In_Queue", "Dispatched"

        [Required]
        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    }

    // =========================================================================
    // 🛠️ 3. MODEL FOR WORKER F (EXECUTIVE RISK REPORTING)
    // =========================================================================

    [Table("IncidentReports")]
    public class IncidentReport : Security.IMultiTenant
    {
        [Key]
        [Required]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid AcademyId { get; set; }

        [Required]
        public Guid ThreadId { get; set; } // Map one incident thread to one clear regulatory audit trail

        [Required]
        [StringLength(100)]
        public string IncidentType { get; set; } = "Indoor_Deluge_Humidity_Breach";

        [Required]
        public Guid ImpactedCourtId { get; set; }

        [Required]
        [StringLength(100)]
        public string PolicyNumberVerified { get; set; } = string.Empty;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalFinancialLoss { get; set; } = 0.00m; // Ledger cancellations total + policy penalties

        [Required]
        public string ExecutiveSummary { get; set; } = string.Empty; // Full summary report text compiled by Worker F

        [Required]
        [StringLength(50)]
        public string ReportStatus { get; set; } = "Draft_Staged"; // e.g., "Draft_Staged", "Committed"

        [Required]
        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    }
}
