# Global Academy & Smart Court Management System

An enterprise-grade, multi-tenant SaaS Sports Director Operating System designed to manage elite global sports infrastructures, localized facility telemetry, and predictive scheduling optimization. 

Built on a modern backend framework using **.NET Core**, **Entity Framework Core**, and **PostgreSQL**, this system abstracts hyper-localized physical operations (such as court drying matrices and solar-calculated IoT overrides) while leveraging autonomous **Agentic AI** workflows to maximize venue utilization and player progression.

---

## 🚀 Key Architectural Pillars

### 1. Virtualization & Infrastructure Hierarchy
* **Enterprise Multi-Location Architecture:** Top-down structural hierarchy mapping an Academy Tenant to multiple physical **Branches** (Locations), which own standalone **Courts**.
* **Localized Time Engine Matrix:** All cross-location transactions, bookings, and shift metrics are securely anchored to **UTC** in the database layer and converted to native IANA time zones on the fly.
* **Polymorphic Schedule Transparency:** The scheduling engine automatically adapts queries to the caller's role. An `AcademyDirector` can scan all court reservations across the entire venue simultaneously, while standard `Players` remain securely locked within their personal calendar spaces.

### 2. Iron-Clad Multi-Tenant Data Isolation & Security
* **Global Query Filters:** Custom Entity Framework Core interceptors automatically append `WHERE AcademyId = tenant_id` to every database transaction, entirely neutralizing the risk of multi-academy data leaks.
* **Automatic Write Protection:** The runtime context intercepts data manipulation pipeline events, stamping or locking down the data scope to match the user's validated cryptographic identity badge.
* **Fail-Fast Identity Protections:** Controller entry points handle role-based authorization dynamically. Security logic intercepts and discards tampered payloads instantly—such as preventing standard players from changing their role variables or editing cross-user profile slates.

### 3. Integrated Unified Ledger & Payment Gateways
* **Consolidated Multi-Invoice Single-Charging:** Processes the combined balance of multiple outstanding `Unpaid` invoices into a single gateway sweep, mitigating multiple third-party transaction fee overhead costs while atomically updating rows in PostgreSQL.
* **Unified Financial Reversal Core:** Seamlessly links scheduling cancellation events to the financial engine. Dropping an upcoming booking instantly calculates refund eligibility, automatically executing database voids for unpaid dues or issuing real-time credit reversals back to original accounts.
* **Multi-Vendor Sandbox Gateways:** Fully features discrete frontend tokenization views paired with strongly-typed server-to-server adapter classes for **Square Web Payments (Credit Card)** and **Braintree SDK (PayPal Smart Buttons)**.

### 4. Agentic AI Orchestration & IoT Foundations
* **Conversational AI Core Binding:** Leverages Microsoft's **Semantic Kernel Orchestration Engine** to expose underlying cancellation pipelines directly to natural language. Conversational commands like *"Cancel my booking tomorrow"* automatically run timing checks, release court slots, and process financial gateway refunds conversationally.
* **The Autonomous "Match-Saver" Agent:** Dispatches webhooks to reroute matches to indoor courts or nearby sister academies instantly upon picking up real-time microclimatic rain events.
* **Predictive Preventive-Maintenance Agent:** Processes telemetry logs and post-match player feedback through semantic analysis to trigger groundskeeper tickets during low-utilization operating hours.

---

## 🛠️ Technology Stack & Dependencies

This project relies entirely on **free, open-source enterprise frameworks**:

* **Backend Engine:** `.NET Core` (v8/v9/v10) with ASP.NET Core Web APIs.
* **Database Management:** `PostgreSQL` Object-Relational Database Server.
* **Object-Relational Mapper:** `Entity Framework Core` with `Npgsql`.
* **Security & Authentication:** `Microsoft.AspNetCore.Identity.EntityFrameworkCore` and `JwtBearer` extensions.
* **AI Orchestration Framework:** `Microsoft.SemanticKernel` Core Package.
* **Third-Party Payment SDKs:** Official `Braintree` and `Square` .NET SDK NuGet assemblies.
* **Frontend App Architecture:** `Vite` + `React` SPA with `Axios` (`apiClient`), `Tailwind CSS`, and `Square Web Payments / Braintree Drop-in SDK` integrations.
* **Interactive Documentation Engine:** Native Microsoft OpenAPI schema generation integrated with the `Scalar API Reference` dashboard.

---

## 📁 System Architecture Directory Matrix

```text
GlobalAcademy/
├── AI/
│   └── Plugins/
│       └── PlayerBookingPlugin.cs # Semantic Kernel AI metadata wrappers for chat agent binding
├── Controllers/
│   ├── AuthController.cs          # Multi-tenant user provisioning & JWT issuance endpoints
│   ├── CheckoutController.cs      # Handshake endpoints, batching, and single-charge consolidated processors
│   └── PlayerBookingController.cs # Dynamic reservation fetching and reversal-hardened cancellation handlers
├── Data/
│   └── ApplicationDbContext.cs    # Multi-tenant interceptors, snapshot models & global query filters
├── Models/
│   ├── Booking.cs                 # Scheduled match allocation slots and state flags
│   ├── Invoice.cs                 # General financial ledger records (Unpaid, Paid, Voided, Refunded)
│   ├── InvoiceLineItem.cs         # Sub-scoped billing links matching physical booking IDs
│   ├── LedgerTransaction.cs       # Transaction receipts carrying gateway tracking tokens (SQ- / BT- / REF-)
│   └── User.cs                    # Core identity accounts mapping to authorization clearance tiers
├── Security/
│   ├── IMultiTenant.cs            # Universal data isolation boundary interface
│   └── TenantProvider.cs          # Scoped JWT identity-extraction claim service
├── Services/
│   ├── CheckoutService.cs         # Core transaction coordinator managing consolidated checkouts and refunds
│   ├── PaymentService.cs          # Unified IPaymentGatewayService containing Square and Braintree SDK loops
│   └── PaymentGatewayFactory.cs   # Factory resolving strongly-typed gateway adapters dynamically via DI
├── Program.cs                     # Core application middleware, SK Plugins, and gateway registration loops
└── appsettings.json               # Environment credentials, sandbox API tokens & cryptographic settings
```

---

## 🏃‍♂️ Quickstart Local Setup

### Prerequisites
1. Install the **.NET SDK** matching your target ecosystem layout.
2. Install **Node.js** (LTS variant) and **PostgreSQL** Server.

### Local Configuration & Sandbox Credentials
Ensure your local database is active and retrieve your testing keys from the respective [Square Developer](https://squareup.com) and [Braintree Sandbox](https://braintreegateway.com) consoles. Update your connection strings inside **`appsettings.json`**:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=SmartCourtDb;Username=postgres;Password=YOUR_SECURE_PASSWORD;"
  },
  "Braintree": {
    "MerchantId": "YOUR_BRAINTREE_MERCHANT_ID",
    "PublicKey": "YOUR_PUBLIC_KEY",
    "PrivateKey": "YOUR_PRIVATE_KEY"
  },
  "Square": {
    "ApplicationId": "sandbox-sq0idb-YOUR_APP_ID",
    "AccessToken": "EAAAEO_YOUR_SANDBOX_ACCESS_TOKEN"
  }
}
```

### Application Execution Commands
To bypass cross-origin browser isolation errors during sandbox client-token handshakes, your local development engines must boot with specific configuration flags. Execute the following terminal sequences:

#### 1. Spin Up the Backend Server
```bash
cd GlobalAcademy
dotnet restore
dotnet build

# Apply outstanding model snapshots natively to your PostgreSQL container
dotnet ef migrations add SyncFinancialReversalEngine
dotnet ef database update

dotnet run
```

#### 2. Spin Up the Client Application
```bash
cd Frontend
npm install

# Forces Vite to clear build caches and injects permissive cross-origin opener headers
npm run dev -- --force
```

Once running, you can log into your dashboard portal interface.

---

## 🛡️ Sandbox Simulation & Testing Protocols

### 1. Multi-Invoice Consolidated Card Clearance
* Navigate to your **Billing Dashboard** panel page. The client-side sorting automatically floats all outstanding bills to the absolute top of the table.
* Scroll to the bottom **Credit Card Quick-Pay** panel (which handles rendering dynamically without freezing modal frames).
* Type Square's official sandbox card number: **`4111 1111 1111 1111`**, choose any future expiration date, and submit.
* The system will make a single consolidated network call to charge the collective sum. Upon approval, all target invoice lines transition to `Paid` inside a single atomic database transaction.

### 2. Dashboard Cancellation Gateway Refunds
* Open your **My Active Court Reservations** scheduling page. Paid bookings will display a green `✓ Paid Secured` badge.
* Click the **Cancel Slot** action button.
* If the reservation start time is greater than 24 hours out (passing your player policy checks), your click fires the `ReleaseReservationSlot` pipeline.
* The system fetches the transaction handle (`SQ-xxxx` or `BT-xxxx`), contacts the payment processor's server API to reverse the transaction, registers a `REF-` ledger tracking item in PostgreSQL, and safely returns funds to the player's account.

### 3. Conversational AI Assistant Commands
* Open the expandable AI chat assistant bubble panel interface layer.
* Type a natural command line: *"Please cancel my upcoming reservation slot for booking ID [PASTE_GUID]"*.
* The Semantic Kernel Agentic framework automatically handles parameter parsing, executes your underlying cancellation services, clears the court grid, and prints the gateway refund confirmation trace reference code directly into an inline chat bubble.

## 🛡️ Ongoing Security Verification Actions
### To maintain an iron-clad infrastructure, every operational request requires a verified identity loop:
1. POST /api/Auth/register-academy initializes a unique tenant entity block.
2. POST /api/Auth/login processes validated users and outputs a signed cryptographic token.
3. Include the returned token in the headers of all downstream requests (Authorization: Bearer <token>) to allow the underlying security engine to automatically isolate data contexts.
