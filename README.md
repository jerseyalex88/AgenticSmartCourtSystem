# Global Academy & Smart Court Management System

An enterprise-grade, multi-tenant SaaS Sports Director Operating System designed to manage elite global sports infrastructures, localized facility telemetry, and predictive scheduling optimization. 

Built on a modern backend framework using **.NET (Core)**, **Entity Framework Core**, and **PostgreSQL**, this system abstracts hyper-localized physical operations (such as court drying matrices and solar-calculated IoT overrides) while leveraging autonomous **Agentic AI** workflows to maximize venue utilization and player progression.

---

## 🚀 Key Architectural Pillars

### 1. Virtualization & Infrastructure Hierarchy
* **Enterprise Multi-Location Architecture:** Top-down structural hierarchy mapping an Academy Tenant to multiple physical **Branches** (Locations), which own standalone **Courts**.
* **Localized Time Engine Matrix:** All cross-location transactions, bookings, and shift metrics are securely anchored to **UTC** in the database layer and converted to native IANA time zones on the fly.
* **Granular Staff Assignment Routing:** Nested access routing ensuring staff or groundskeepers can only be assigned to specific courts if they carry active security clearance at that physical branch.

### 2. Multi-Tenant Data Isolation (Iron-Clad Security)
* **Global Query Filters:** Custom Entity Framework Core interceptors automatically append `WHERE AcademyId = tenant_id` to every query, entirely neutralizing the risk of multi-academy data leaks.
* **Automatic Write Protection:** The runtime context intercepts data manipulation pipeline events, stamping or locking down the data scope to match the user's validated cryptographic identity badge.
* **Stateless JWT Authorization:** Decoupled role-based access management (`GlobalAdmin`, `AcademyDirector`, `Groundskeeper`, `Player`) injected through secure JSON Web Tokens.

### 3. Agentic AI Orchestration & IoT Foundations (Roadmap Feature-Set)
* **The Autonomous "Match-Saver" Agent:** Dispatches webhooks to reroute matches to indoor courts or nearby sister academies instantly upon picking up real-time microclimatic rain events.
* **Predictive Preventive-Maintenance Agent:** Processes telemetry logs and post-match player feedback through semantic analysis to trigger groundskeeper tickets during low-utilization operating hours.
* **Dynamic "Ghost-Scheduler" Optimizer:** Converts dead calendar gaps into flash-sale booking notifications targeted at highly active local ladder players.

---

## 🛠️ Technology Stack & Dependencies

This project relies entirely on **free, open-source enterprise frameworks**:

* **Backend Engine:** `.NET (Core)` Runtime with ASP.NET Core Minimal APIs / Web APIs.
* **Database Management:** `PostgreSQL` Object-Relational Database Server.
* **Object-Relational Mapper:** `Entity Framework Core` with `Npgsql`.
* **Security & Authentication:** `Microsoft.AspNetCore.Identity.EntityFrameworkCore` and `JwtBearer` extensions.
* **Interactive Documentation Engine:** Native Microsoft OpenAPI schema generation integrated with the `Scalar API Reference` dashboard.

---

## 📁 System Architecture Directory Matrix

```text
GlobalAcademy/
├── Controllers/
│   └── AuthController.cs          # Register-Academy and JWT issuance endpoints
├── Data/
│   └── ApplicationDbContext.cs    # Multi-tenant interceptors & global query filters
├── Models/
│   ├── Branch.cs                  # Physical facility locations
│   ├── Court.cs                   # Surface metrics & structural telemetry configuration
│   ├── UserBranch.cs              # Employee/Member assignment bridge mappings
│   └── UserCourt.cs               # Sub-scoped court assignment permission mappings
├── Security/
│   ├── IMultiTenant.cs            # Universal data isolation boundary interface
│   └── TenantProvider.cs          # Scoped JWT identity-extraction claim service
├── Program.cs                     # Core application middleware and DI pipeline setup
└── appsettings.json               # Environment credentials & cryptographic settings
```

---

## 🏃‍♂️ Quickstart Local Setup

### Prerequisites
1. Install the **.NET SDK** (Version 8, 9, or 10 preview variants).
2. Install **PostgreSQL** Server (via Homebrew on macOS using `brew install postgresql@18`).

### Local Database Configuration
Ensure your local PostgreSQL server is actively running in the background and configure a dedicated superuser role. Then update your connection details inside **`appsettings.json`**:

```json
"ConnectionStrings": {
  "DefaultConnection": "Host=localhost;Port=5432;Database=SmartCourtDb;Username=postgres;Password=YOUR_SECURE_PASSWORD;"
}
```

### Application Commands
Open your terminal inside the root project directory and execute the following compilation and execution sequence:

```bash
# 1. Restore required open-source dependencies
dotnet restore

# 2. Compile and verify project components
dotnet build

# 3. Generate database migrations and push the relational architecture to PostgreSQL
dotnet ef migrations add InitialSystemSetup
dotnet ef database update

# 4. Turn on the local API engine server
dotnet run
```

Once running, navigate your web browser to `http://localhost:<PORT>/scalar/v1` to pull up your **Scalar Interactive Dashboard** to perform end-to-end integration tests.

---

## 🛡️ Ongoing Security Verification Actions
To maintain an iron-clad infrastructure, every operational request requires a verified identity loop:
1. `POST /api/Auth/register-academy` initializes a unique tenant entity block.
2. `POST /api/Auth/login` processes validated users and outputs a signed cryptographic token.
3. Include the returned token in the headers of all downstream requests (`Authorization: Bearer <token>`) to allow the underlying security engine to automatically isolate data contexts.
