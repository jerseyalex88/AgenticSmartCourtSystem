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

    // 2. Append this relational configuration inside your existing OnModelCreating method:
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
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

        // --- GLOBAL QUERY FILTERS ---
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (typeof(IMultiTenant).IsAssignableFrom(entityType.ClrType))
            {
                modelBuilder.Entity(entityType.ClrType)
                    .HasQueryFilter(ConvertFilterExpression(entityType.ClrType));
            }
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

}
