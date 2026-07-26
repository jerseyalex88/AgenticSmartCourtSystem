namespace GlobalAcademy.Controllers
{
    using System;
    using System.Threading.Tasks;
    using Microsoft.AspNetCore.Mvc;
    using Microsoft.AspNetCore.Authorization;
    using System.Security.Claims;
    using GlobalAcademy.Payment.Services;

    [ApiController]
    [Route("api/[controller]")]
    [Authorize] // Enforce verified identity context validation rules globally
    public class CheckoutController : ControllerBase
    {
        private readonly CheckoutService _checkoutService;

        public CheckoutController(CheckoutService checkoutService)
        {
            _checkoutService = checkoutService;
        }

        [HttpPost("process")]
        public async Task<IActionResult> ProcessCheckout([FromBody] CheckoutRequestPayload payload)
        {
            // Extract the strict Multi-Tenant firewall identity claim
            var academyIdClaim = User.FindFirst("AcademyId")?.Value;
            if (string.IsNullOrEmpty(academyIdClaim) || !Guid.TryParse(academyIdClaim, out var academyId))
            {
                return BadRequest("Access Denied: Missing or malformed tenant boundary claims profile.");
            }

            var result = await _checkoutService.ExecuteCheckoutAsync(academyId, payload);

            if (!result.IsSuccess)
            {
                return BadRequest(new { success = false, message = result.ErrorMessage });
            }

            return Ok(new { success = true, referenceId = result.ReferenceId });
        }
    }
}
