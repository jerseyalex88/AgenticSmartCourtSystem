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
    public const string AcademyOverrideClaimType = "smartcourt:academy_override";

    public TenantProvider(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    // public Guid GetTenantId()
    // {
    //     var user = _httpContextAccessor.HttpContext?.User;
    //     if (user == null) return Guid.Empty;

    //     // FIX: Explicitly scan for the exact raw "AcademyId" string key parameter inside the token claims array
    //     var academyClaim = user.Claims.FirstOrDefault(c => c.Type.Equals("AcademyId", StringComparison.OrdinalIgnoreCase))?.Value;

    //     if (Guid.TryParse(academyClaim, out var tenantGuid))
    //     {
    //         return tenantGuid; // Returns your real physical database tenant GUID key!
    //     }

    //     return Guid.Empty;
    // }
    public Guid GetTenantId()
    {
        // 1. Extract the active security user principal from the HttpContext tracking session
        var user = _httpContextAccessor.HttpContext?.User;
        if (user == null || user.Identity?.IsAuthenticated != true) 
            return Guid.Empty;

        // 2. GLOBALADMIN OVERRIDE MATRIX: If the user belongs to the master guardian role, evaluate overrides first
        if (user.IsInRole("GlobalAdmin"))
        {
            var overrideClaim = user.Claims
                .FirstOrDefault(c => c.Type.Equals(AcademyOverrideClaimType, StringComparison.OrdinalIgnoreCase))?.Value;

            if (Guid.TryParse(overrideClaim, out var overrideGuid))
            {
                return overrideGuid; // Instantly channels EF Core query filters to the selected academy tenant scope
            }

            // Fallback for GlobalAdmin when no active academy node has been targeted yet
            return Guid.Empty;
        }

        // 3. STANDARD USER TENANT FALLBACK FLOW
        // Explicitly scan for the exact raw "AcademyId" string key parameter inside the token claims array
        var academyClaim = user.Claims
            .FirstOrDefault(c => c.Type.Equals("AcademyId", StringComparison.OrdinalIgnoreCase))?.Value;

        if (Guid.TryParse(academyClaim, out var tenantGuid))
        {
            return tenantGuid; // Returns your real physical database tenant GUID key!
        }

        return Guid.Empty;
    }
}
