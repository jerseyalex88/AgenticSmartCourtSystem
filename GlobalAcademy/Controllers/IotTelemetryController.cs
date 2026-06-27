using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using GlobalAcademy.Security;

namespace GlobalAcademy.Security;

[ApiController]
[Route("api/[controller]")]
public class IotTelemetryController : ControllerBase
{
    [HttpPost("weather-alert")]
    [HmacAuthorize] // ◄— The firewall is instantly locked down right here!
    public IActionResult HandleWeatherAlert([FromBody] WeatherPayload data)
    {
        // Core logical processes inside your sports engine only awaken if the hash matches.
        return Ok(new { Message = "Weather metrics ingested safely." });
    }
}
public record WeatherPayload(string EventType, double RainVolumeMillimeters);
