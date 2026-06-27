using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;
using GlobalAcademy.Data;
using GlobalAcademy.Security;

var builder = WebApplication.CreateBuilder(args);

// FIX: Force .NET 10 to recognize and discover MVC controllers
builder.Services.AddControllers();

// FIX: Registers native Microsoft OpenAPI document engine instead of old Swagger
builder.Services.AddOpenApi();

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

app.UseAuthentication(); 
app.UseAuthorization();  

app.MapControllers();

app.Run();
