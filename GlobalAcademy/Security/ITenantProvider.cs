using System.Security.Claims;
using Microsoft.AspNetCore.Http;

namespace GlobalAcademy.Security;

public interface ITenantProvider
{
    Guid GetTenantId();
}

public class TenantProvider : ITenantProvider
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public TenantProvider(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public Guid GetTenantId()
    {
        var user = _httpContextAccessor.HttpContext?.User;
        if (user == null) return Guid.Empty;

        // FIX: Explicitly scan for the exact raw "AcademyId" string key parameter inside the token claims array
        var academyClaim = user.Claims.FirstOrDefault(c => c.Type.Equals("AcademyId", StringComparison.OrdinalIgnoreCase))?.Value;

        if (Guid.TryParse(academyClaim, out var tenantGuid))
        {
            return tenantGuid; // Returns your real physical database tenant GUID key!
        }

        return Guid.Empty;
    }
}
