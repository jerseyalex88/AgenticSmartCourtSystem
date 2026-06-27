using System;
using TimeZoneConverter; // Cross-platform open-source library wrapper

namespace GlobalAcademy.Security;

public interface ILocalTimeEngine
{
    DateTime ToLocalTime(DateTime utcDateTime, string ianaTimeZoneId);
    DateTime ToUtcTime(DateTime localDateTime, string ianaTimeZoneId);
}

public class LocalTimeEngine : ILocalTimeEngine
{
    // Converts an absolute database UTC timestamp into local display time for a specific club branch
    public DateTime ToLocalTime(DateTime utcDateTime, string ianaTimeZoneId)
    {
        // Enforce the Golden Rule constraint
        if (utcDateTime.Kind == DateTimeKind.Local)
        {
            utcDateTime = DateTime.SpecifyKind(utcDateTime, DateTimeKind.Utc);
        }

        // Resolves system or IANA time strings natively on Windows, Linux, or macOS flawlessly
        TimeZoneInfo targetZone = TZConvert.GetTimeZoneInfo(ianaTimeZoneId);
        return TimeZoneInfo.ConvertTimeFromUtc(utcDateTime, targetZone);
    }

    // Converts a local client booking submission back into an absolute UTC anchor for DB storage
    public DateTime ToUtcTime(DateTime localDateTime, string ianaTimeZoneId)
    {
        TimeZoneInfo targetZone = TZConvert.GetTimeZoneInfo(ianaTimeZoneId);
        return TimeZoneInfo.ConvertTimeToUtc(localDateTime, targetZone);
    }
}
