using Xunit;
using Xunit.Abstractions;
using Microsoft.AspNetCore.Identity;

namespace GlobalAcademy.Tests;
public class IdentitySecurityTests
{
    private readonly ITestOutputHelper _output;

    public IdentitySecurityTests(ITestOutputHelper output)
    {
        _output = output;
    }

    [Fact]
    public void Generate_Cryptographic_Identity_Password_Hash()
    {
        // 💡 FIXED: Explicitly applied the 'IdentityUser' type argument to the generic class identifier
        var hasher = new PasswordHasher<IdentityUser>();
        
        var mockUser = new IdentityUser 
        { 
            Email = "globaladmin@hftennisacademy.com",
            NormalizedEmail = "GLOBALADMIN@HFTENNISACADEMY.COM",
            UserName = "Global Admin",
            NormalizedUserName = "GLOBAL ADMIN"
        };

        // Define your desired master plain-text password here
        string plainTextPassword = "Londonpass!@#4"; 
        string generatedHashString = hasher.HashPassword(mockUser, plainTextPassword);

        _output.WriteLine("=========================================================================");
        _output.WriteLine("🚀 PRODUCTION SECURITY PASSWORD HASH GENERATED SUCCESSFULLY");
        _output.WriteLine("=========================================================================");
        _output.WriteLine(generatedHashString);
        _output.WriteLine("=========================================================================");

        Assert.NotNull(generatedHashString);
    }
}

