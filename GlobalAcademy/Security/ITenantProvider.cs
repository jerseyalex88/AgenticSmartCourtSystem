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

    // public Guid GetTenantId()
    // {
    //     // 1. Pull the user principal out of the current HTTP Context
    //     var user = _httpContextAccessor.HttpContext?.User;

    //     // 2. Extract the specific Academy ID claim injected by our JWT validator
    //     var claim = user?.FindFirst("AcademyId")?.Value;

    //     // 3. Return the Guid if it exists; otherwise return empty (useful for anonymous registration flows)
    //     return Guid.TryParse(claim, out var tenantId) ? tenantId : Guid.Empty;
    // }

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
