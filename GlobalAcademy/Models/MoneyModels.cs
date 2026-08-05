using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GlobalAcademy.Models
{
    public enum LineItemType { CourtSlot, RacketRental, ProShopItem }
    public enum InvoiceStatus { Unpaid, Paid, Partially_Refunded, Refunded, Voided }
    public enum PaymentMethod { CreditCard, Cash, Crypto_USDC }
    public enum PreferredGateway { Braintree, Square }

    public class UnifiedCatalogItem : Security.IMultiTenant
    {
        [Key] public Guid CatalogItemId { get; set; }
        public Guid AcademyId { get; set; } // Strict MT Partition Rule
        [Required] public string? SKU { get; set; }
        [Required] public string? Name { get; set; }
        public LineItemType ItemType { get; set; }
        [Column(TypeName = "decimal(18,2)")] public decimal UnitPrice { get; set; }
        public bool IsActive { get; set; } = true;
    }

    public class Invoice : Security.IMultiTenant
    {
        [Key] public Guid InvoiceId { get; set; }
        public Guid AcademyId { get; set; }
        public string? IssuedToUserId { get; set; } // Identity email/Guid string
        public string? CustomerName { get; set; }
        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
        public InvoiceStatus Status { get; set; } = InvoiceStatus.Unpaid;
        [Column(TypeName = "decimal(18,2)")] public decimal TotalAmount { get; set; }
        
        public ICollection<InvoiceLineItem> LineItems { get; set; } = new List<InvoiceLineItem>();
        public Guid? AssociatedTransactionId { get; set; }
        public LedgerTransaction? AssociatedTransaction { get; set; }
        // public ICollection<LedgerTransaction> Transactions { get; set; } = new List<LedgerTransaction>();
    }

    public class InvoiceLineItem
    {
        [Key] public Guid LineItemId { get; set; }
        public Guid InvoiceId { get; set; }
        public Guid? CatalogItemId { get; set; } // Linked catalog reference
        public string? ItemDescription { get; set; }
        public int Quantity { get; set; }
        [Column(TypeName = "decimal(18,2)")] public decimal UnitPrice { get; set; }
        [Column(TypeName = "decimal(18,2)")] public decimal LineTotal => Quantity * UnitPrice;
        
        // Optional contextual linking field for Phase 2 telemetry mapping
        public Guid? AssociatedBookingId { get; set; } 
    }
    public class LedgerTransaction : Security.IMultiTenant
    {
        [Key] public Guid TransactionId { get; set; }
        public Guid AcademyId { get; set; } // Firewall rule boundary
        // public Guid InvoiceId { get; set; }
        
        // Tracks the payment type choice (CreditCard, Cash, Crypto)
        public PaymentMethod Method { get; set; } 
        
        [Required] public PreferredGateway ProcessedByGateway { get; set; } 
        
        // Stores the reference returned from the gateway (e.g., BT-xxxx or SQ-xxxx)
        [Required] public string? GatewayReferenceId { get; set; } 
        
        [Column(TypeName = "decimal(18,2)")] public decimal Amount { get; set; }
        public DateTime TimestampUtc { get; set; } = DateTime.UtcNow;
        public bool IsSuccess { get; set; }
    }
}
