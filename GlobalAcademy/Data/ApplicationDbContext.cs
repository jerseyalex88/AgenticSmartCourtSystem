using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using GlobalAcademy.Security;
using GlobalAcademy.Models;

namespace GlobalAcademy.Data;

// FIX: Must inherit from IdentityDbContext
public class ApplicationDbContext : IdentityDbContext
{
    private readonly ITenantProvider _tenantProvider;
    private readonly Guid _tenantId;

    // FIX: DbContextOptions must match ApplicationDbContext explicitly
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options, ITenantProvider tenantProvider)
        : base(options)
    {
        _tenantProvider = tenantProvider;
        _tenantId = _tenantProvider.GetTenantId();
    }

    // 1. Add these physical table hooks inside your main ApplicationDbContext class body:
    public DbSet<Academy> Academies { get; set; }
    public DbSet<Branch> Branches { get; set; }
    public DbSet<Court> Courts { get; set; }
    public DbSet<UserBranch> UserBranches { get; set; }
    public DbSet<UserCourt> UserCourts { get; set; }
    public DbSet<Booking> Bookings { get; set; }
    public DbSet<ShadowQueue> ShadowQueues { get; set; }
    public DbSet<MaintenanceTicket> MaintenanceTickets { get; set; }
    public DbSet<UnifiedCatalogItem> UnifiedCatalogItems { get; set; }
    public DbSet<Invoice> Invoices { get; set; }
    public DbSet<InvoiceLineItem> InvoiceLineItems { get; set; }
    public DbSet<LedgerTransaction> LedgerTransactions { get; set; }
    public DbSet<CourtDiagnosticSnapshot> CourtDiagnosticSnapshots { get; set; }
    public DbSet<CourtDiagnosticAnomaly> CourtDiagnosticAnomalies { get; set; }
    public DbSet<SavedAgentQuery> SavedAgentQueries { get; set; }

    // 2. Append this relational configuration inside your existing OnModelCreating method:
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // 🚀 DATABASE CEILING: Explicitly instruct Npgsql to automatically run 
        // the extension setup logic directly on your PostgreSQL database engine
        modelBuilder.HasPostgresExtension("vector");
        base.OnModelCreating(modelBuilder);

        // A. Define the primary key for the User-to-Branch link
        modelBuilder.Entity<UserBranch>()
            .HasKey(ub => new { ub.UserId, ub.BranchId });

        // B. Define the primary key for the User-to-Court link (incorporating the branch ID)
        modelBuilder.Entity<UserCourt>()
            .HasKey(uc => new { uc.UserId, uc.BranchId, uc.CourtId });

        // C. Force the explicit hierarchical rule: UserCourt CANNOT exist without its matching UserBranch parent
        modelBuilder.Entity<UserCourt>()
            .HasOne<UserBranch>()
            .WithMany(ub => ub.AssignedCourts)
            .HasForeignKey(uc => new { uc.UserId, uc.BranchId })
            .OnDelete(DeleteBehavior.Cascade); // If a user is removed from a branch, clear their court tasks automatically

        modelBuilder.Entity<Branch>().HasQueryFilter(b => b.AcademyId == CurrentTenantId);
        modelBuilder.Entity<Court>().HasQueryFilter(c => c.AcademyId == CurrentTenantId);
        modelBuilder.Entity<Booking>().HasQueryFilter(bk => bk.AcademyId == CurrentTenantId);
        modelBuilder.Entity<ShadowQueue>().HasQueryFilter(sq => sq.AcademyId == CurrentTenantId);
        modelBuilder.Entity<MaintenanceTicket>().HasQueryFilter(mt => mt.AcademyId == CurrentTenantId);
        modelBuilder.Entity<Invoice>().HasQueryFilter(i => i.AcademyId == CurrentTenantId);
        modelBuilder.Entity<LedgerTransaction>().HasQueryFilter(lt => lt.AcademyId == CurrentTenantId);
        modelBuilder.Entity<UserBranch>().HasQueryFilter(ub => ub.AcademyId == CurrentTenantId);
        modelBuilder.Entity<UserCourt>().HasQueryFilter(uc => uc.AcademyId == CurrentTenantId);
        modelBuilder.Entity<CourtDiagnosticSnapshot>().HasQueryFilter(uc => uc.AcademyId == CurrentTenantId);
        modelBuilder.Entity<CourtDiagnosticAnomaly>().HasQueryFilter(uc => uc.AcademyId == CurrentTenantId);
        modelBuilder.Entity<SavedAgentQuery>().HasQueryFilter(sq => sq.AcademyId == CurrentTenantId);
        modelBuilder.Entity<CourtMaintenanceKnowledge>().HasQueryFilter(k => k.AcademyId == CurrentTenantId);

        modelBuilder.Entity<Booking>()
            .Property(b => b.Status)
            .HasConversion<string>(); // Stores enum states as readable text ("Cancelled") natively in Postgres

        // Configure precise decimal scales for financial properties
        modelBuilder.Entity<UnifiedCatalogItem>()
            .Property(p => p.UnitPrice)
            .HasPrecision(18, 2);

        modelBuilder.Entity<Invoice>()
            .Property(p => p.TotalAmount)
            .HasPrecision(18, 2);

        modelBuilder.Entity<InvoiceLineItem>()
            .Property(p => p.UnitPrice)
            .HasPrecision(18, 2);

        modelBuilder.Entity<LedgerTransaction>()
            .Property(p => p.Amount)
            .HasPrecision(18, 2);
        
        modelBuilder.Entity<Invoice>()
                .HasOne(i => i.AssociatedTransaction)
                .WithMany() // A transaction can be mapped to many invoices, but has no inverse list collection
                .HasForeignKey(i => i.AssociatedTransactionId)
                .OnDelete(DeleteBehavior.Restrict); // Prevents accidental cascading purges of audit ledger data

        modelBuilder.Entity<CourtDiagnosticAnomaly>()
        .HasOne(a => a.Snapshot)
        .WithMany(s => s.Anomalies)
        .HasForeignKey(a => a.SessionId)
        .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<CourtMaintenanceKnowledge>()
            .HasIndex(k => new { k.AcademyId, k.BranchId });
    }
    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        // 🛡️ DESIGN-TIME SAFETY GATE: If options aren't fully initialized by the runtime dependency injector,
        // manually construct an isolated configuration anchor to map the pgvector driver parameters cleanly
        if (!optionsBuilder.IsConfigured)
        {
            // Build a direct path pointer to find and parse your root appsettings.json file
            var configuration = new ConfigurationBuilder()
                .SetBasePath(Directory.GetCurrentDirectory())
                .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
                .Build();

            var connectionString = configuration.GetConnectionString("DefaultConnection");

            optionsBuilder.UseNpgsql(
                connectionString,
                npgsqlOptions => npgsqlOptions.UseVector() // 🚀 FORCES TYPE REGISTRATION FOR CLI TOOLS
            );
        }
    }
    private System.Linq.Expressions.LambdaExpression ConvertFilterExpression(Type type)
    {
        var parameter = System.Linq.Expressions.Expression.Parameter(type, "e");
        var property = System.Linq.Expressions.Expression.Property(parameter, nameof(IMultiTenant.AcademyId));
        var tenantIdConstant = System.Linq.Expressions.Expression.Constant(_tenantId);
        var body = System.Linq.Expressions.Expression.Equal(property, tenantIdConstant);
        
        return System.Linq.Expressions.Expression.Lambda(body, parameter);
    }
    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var entries = ChangeTracker.Entries<IMultiTenant>()
            .Where(e => e.State == EntityState.Added || e.State == EntityState.Modified);

        foreach (var entry in entries)
        {
            if (entry.State == EntityState.Added)
            {
                // FIX: Only overwrite the AcademyId if we have a valid, authenticated human tenant session.
                // If _tenantId is empty, it means an automated background script (like our seed engine) 
                // is explicitly setting up system infrastructure data rows.
                if (_tenantId != Guid.Empty)
                {
                    entry.Entity.AcademyId = _tenantId;
                }
            }
            else if (entry.State == EntityState.Modified)
            {
                if (_tenantId != Guid.Empty)
                {
                    entry.Property(x => x.AcademyId).IsModified = false;
                }
            }
        }

        return base.SaveChangesAsync(cancellationToken);
    }

    // Reusable dynamic context evaluation helper property
    private Guid CurrentTenantId => _tenantProvider.GetTenantId();
}
