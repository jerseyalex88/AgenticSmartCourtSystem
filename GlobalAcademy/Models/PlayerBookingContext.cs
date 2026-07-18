namespace GlobalAcademy.Context
{
    public class PlayerBookingContext
    {
        public string UserId { get; set; } = "";
        public string UserName { get; set; } = "";
        public Guid AcademyId { get; set; } = Guid.Empty;
        public string UserRole { get; set; } = "";
    }
}
