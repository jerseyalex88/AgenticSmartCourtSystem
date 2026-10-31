using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Runtime.Serialization;
using Microsoft.EntityFrameworkCore;
using Pgvector;

namespace GlobalAcademy.Models {
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
        [Required]
        public string StorageObjectKey { get; set; } = "pending_extraction";
        [Required]
        public long FileSizeBytes { get; set; } = 0;
        [Required]
        [StringLength(100)]
        public string MimeType { get; set; } = "application/pdf";
        [Required]
        public bool IsProcessing { get; set; } = true;
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
        [Required]
        [StringLength(100)]
        public string Category { get; set; } = "General";
        [Required]
        public string Keyword { get; set; } = string.Empty;
    }
}
