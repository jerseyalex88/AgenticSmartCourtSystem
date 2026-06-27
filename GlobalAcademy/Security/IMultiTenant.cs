namespace GlobalAcademy.Security;

public interface IMultiTenant
{
    // The unique identifier linking this specific record to an academy tenant
    public Guid AcademyId { get; set; }
}
