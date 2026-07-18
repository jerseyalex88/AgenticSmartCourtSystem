using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;
using GlobalAcademy.Data;
using GlobalAcademy.Security;
using GlobalAcademy.Services;
using Microsoft.SemanticKernel;
using GlobalAcademy.Plugins;
using GlobalAcademy.Context;

var builder = WebApplication.CreateBuilder(args);

// FIX: Prevent .NET from silently scrambling custom token claim strings into long XML schemas
System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler.DefaultInboundClaimTypeMap.Clear();

// FIX: Force .NET 10 to recognize and discover MVC controllers
builder.Services.AddControllers();

// FIX: Registers native Microsoft OpenAPI document engine instead of old Swagger
builder.Services.AddOpenApi();

// Register the Phase 2 Microclimatic Evaporation Service
builder.Services.AddSingleton<IWeatherGuardEngine, WeatherGuardEngine>();

// Register the Local Time Matrix translation service
builder.Services.AddSingleton<GlobalAcademy.Security.ILocalTimeEngine, GlobalAcademy.Security.LocalTimeEngine>();

// =========================================================================
// STEP 1 IMPLEMENTATION: MULTI-TENANCY & POSTGRESQL INFRASTRUCTURE
// =========================================================================
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ITenantProvider, TenantProvider>();
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// =========================================================================
// STEP 2 IMPLEMENTATION: IDENTITY & JWT ENGINE
// =========================================================================
var jwtSettings = builder.Configuration.GetSection("JwtSettings");
var secretKey = jwtSettings["Secret"] ?? throw new InvalidOperationException("JWT Secret is missing.");

builder.Services.AddIdentityCore<IdentityUser>(options => {
    options.Password.RequireDigit = true;         
    options.Password.RequiredLength = 8;         
})
.AddRoles<IdentityRole>()
.AddSignInManager()
.AddEntityFrameworkStores<ApplicationDbContext>();

builder.Services.AddAuthentication(options => {
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options => {
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,          
        ValidateAudience = true,        
        ValidateLifetime = true,        
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings["Issuer"],
        ValidAudience = jwtSettings["Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey))
    };
});

builder.Services.AddAuthorization(options => {
    options.AddPolicy("RequireGlobalAdmin", policy => policy.RequireRole("GlobalAdmin"));
    options.AddPolicy("RequireDirector", policy => policy.RequireRole("AcademyDirector"));
    options.AddPolicy("RequireGroundskeeper", policy => policy.RequireRole("Groundskeeper"));
    options.AddPolicy("RequirePlayer", policy => policy.RequireRole("Player"));
});

// =========================================================================
// ENVIRONMENT-AWARE DYNAMIC CORS POLICY CONFIGURATION
// =========================================================================
var allowedOrigins = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>() 
                     ?? new[] { "http://localhost:5173" }; // Fallback protection default

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactFrontend", policy =>
    {
        policy.WithOrigins(allowedOrigins) // Dynamically injects whatever env array is active!
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials(); 
    });
});

builder.Services.AddScoped<PlayerBookingContext>();

builder.Services.AddScoped<Kernel>(serviceProvider =>
{
    var kernelBuilder = Kernel.CreateBuilder();
    var aiConfig = builder.Configuration.GetSection("AI");

    // =========================================================================
    // ADDED FOR DEV ENVIRONMENT: NETWORK BYPASS COMPONENT
    // =========================================================================
    var handler = new System.Net.Http.SocketsHttpHandler
    {
        SslOptions = new System.Net.Security.SslClientAuthenticationOptions
        {
            // Bypasses the RevocationStatusUnknown operating system block locally
            CertificateRevocationCheckMode = System.Security.Cryptography.X509Certificates.X509RevocationMode.NoCheck
        }
    };
    var customHttpClient = new System.Net.Http.HttpClient(handler);
    // =========================================================================

    kernelBuilder.AddOpenAIChatCompletion(
        modelId: aiConfig["ModelId"] ?? "gpt-5.4-mini", 
        apiKey: builder.Configuration["AI:ApiKey"] ?? string.Empty,
        httpClient: customHttpClient // <-- FIXED: Injecting the client here inside your original method
    );

    // Register our fresh scheduling engine plugin
    var dbContext = serviceProvider.GetRequiredService<ApplicationDbContext>();
    kernelBuilder.Plugins.AddFromObject(new CourtSchedulingPlugin(dbContext), "SchedulingEngine");

    // ADD THIS LINE: Register the new multi-location spatial awareness tool
    kernelBuilder.Plugins.AddFromObject(new SisterAcademyPlugin(dbContext), "LocationEngine");

    // Inside your main Program.cs file where services are wired up:
    var playerBookingPlugin =
        serviceProvider.GetRequiredService<PlayerBookingPlugin>();

    kernelBuilder.Plugins.AddFromObject(
        playerBookingPlugin,
        "PlayerBookingPlugin");

    return kernelBuilder.Build();
});

// Register the AI Match-Saver engine service layer
builder.Services.AddScoped<MatchSaverService>();
builder.Services.AddScoped<PlayerBookingPlugin>();

var app = builder.Build();

// =========================================================================
// RUNTIME AUTOMATED DATABASE MIGRATION ENGINE
// =========================================================================
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<GlobalAcademy.Data.ApplicationDbContext>();
        
        // Physically checks and executes any missing database schema updates on application startup
        await context.Database.MigrateAsync();
        
        Console.WriteLine("--> PostgreSQL database updates verified and applied successfully.");
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "An error occurred while automatically applying database schema migrations.");
    }
}

// =========================================================================
// RUNTIME ENGINE PIPELINE
// =========================================================================
if (app.Environment.IsDevelopment())
{
    // Exposes the OpenAPI JSON schema at /openapi/v1.json
    app.MapOpenApi();
    
    // Renders Scalar documentation interface at /scalar/v1
    app.MapScalarApiReference();
}

app.UseHttpsRedirection();

// Enforce CORS right at the gateway before hitting identity verification tracks
app.UseCors("AllowReactFrontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// =========================================================================
// AUTOMATED SEED DATA INJECTION PIPELINE
// =========================================================================
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<GlobalAcademy.Data.ApplicationDbContext>();
        var userManager = services.GetRequiredService<UserManager<IdentityUser>>();
        var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();

        // RUNTIME CONFIGURATION PARAMETER:
        // Set 'resetDatabase: true' to completely nuke and recreate all tables on every fresh application boot.
        // Set 'resetDatabase: false' to perform a safe conditional skip check instead.
        //await GlobalAcademy.Data.DbInitializer.SeedAsync(context, userManager, roleManager, resetDatabase: false);
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "An anomaly occurred during system startup data initialization sequences.");
    }
}

app.Run();
