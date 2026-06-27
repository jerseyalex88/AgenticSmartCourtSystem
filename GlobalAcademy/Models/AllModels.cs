
namespace GlobalAcademy.Models {
    public class Booking : Security.IMultiTenant { public Guid Id { get; set; } public Guid AcademyId { get; set; } }
    public class Branch : Security.IMultiTenant
    {
        public Guid Id { get; set; }
        public Guid AcademyId { get; set; }
        
        // Core descriptive identity properties
        public string Name { get; set; } = string.Empty; // e.g., "Dubai Desert Hardcourts"
        public string Description { get; set; } = string.Empty; // e.g., "Main tournament hub featuring 6 outdoor plexicushion courts."
        
        public string TimeZoneId { get; set; } = "UTC"; // Used for our Phase 1 Local Time Engine
    }
    public class Court : Security.IMultiTenant
    {
        public Guid Id { get; set; }
        public Guid AcademyId { get; set; }
        public Guid BranchId { get; set; } // Links back to its physical branch parent

        // Descriptive identity parameters
        public string Name { get; set; } = string.Empty; // e.g., "Stadium Clay Court 1"
        public string Description { get; set; } = string.Empty; // e.g., "Premium Italian red clay equipped with smart drainage sensors."
        
        public string SurfaceType { get; set; } = "Hard"; // e.g., "Clay", "Grass", "Hard"
        public bool IsIndoor { get; set; }
        public double DryCoefficient { get; set; } = 1.0; // Used for Phase 2 dynamic weather adjustments
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
