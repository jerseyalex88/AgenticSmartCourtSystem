
namespace GlobalAcademy.Models {
    public class Booking : Security.IMultiTenant { public Guid Id { get; set; } public Guid AcademyId { get; set; } }
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
        
        public string SurfaceType { get; set; } = "Hard"; 
        public bool IsIndoor { get; set; }
        public double DryCoefficient { get; set; } = 1.0; 

        // THE GOLDEN RULE: Audit marker locked to UTC
        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

        // Relational navigation property back to branch parent
        public Branch? Branch { get; set; }
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

}
