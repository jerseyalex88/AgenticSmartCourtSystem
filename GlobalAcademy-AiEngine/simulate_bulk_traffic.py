# simulate_bulk_traffic.py
import asyncio
import random
import time
import uuid
import httpx
from datetime import datetime, timezone
from app.schemas.court_diagnostics import CourtDiagnosticsPayloadSchema

# Configuration targets pointing straight to your active FastAPI system container
BASE_URL = "http://localhost:8000/api/ai"
TOTAL_SIMULATION_COUNT = 150  # Total test case profiles to generate and process simultaneously

# Host configuration properties
NET_API_URL = "https://localhost:7290/api/maintenance/court-diagnostics"
TOKEN_URL = "https://localhost:7290/api/Auth/token"
SAMPLE_COURT_ID = "858a1dbe-cc50-4916-b09e-78a3dfc83aa1"

async def run_pricing_simulation_test(client: httpx.AsyncClient, index: int):
    """Generates a randomized multi-tenant booking profile and tests the pricing engine."""
    # Build randomized realistic parameters simulating an active resort ecosystem
    payload = {
        "base_price": random.uniform(50.0, 1000.0),
        "month_of_year": random.randint(1, 12),
        "current_occupancy_pct": random.uniform(5.0, 98.0),
        "days_until_arrival": random.randint(0, 120),
        "is_program_demand_spiking": random.choice([True, False])
    }
    
    try:
        start_time = time.perf_counter()
        response = await client.post(f"{BASE_URL}/predict-pricing", json=payload)
        elapsed = (time.perf_counter() - start_time) * 1000.0 # Convert to milliseconds
        
        if response.status_code == 200:
            return {"type": "Pricing", "success": True, "latency_ms": elapsed}
        return {"type": "Pricing", "success": False, "error": f"HTTP {response.status_code}"}
    except Exception as e:
        return {"type": "Pricing", "success": False, "error": str(e)}

async def run_maintenance_simulation_test(client: httpx.AsyncClient, index: int):
    """Generates a randomized court asset state profile and tests the wear engine."""
    payload = {
        "court_id": f"court-guid-mock-00{index}",
        "surface_type": random.choice(["Clay", "Grass", "Hard"]),
        "aggregate_minutes_played": random.randint(0, 90000),
        "days_since_last_resurface": random.randint(0, 1200),
        "is_indoor": random.choice([True, False])
    }
    
    try:
        start_time = time.perf_counter()
        response = await client.post(f"{BASE_URL}/predict-court-maintenance", json=payload)
        elapsed = (time.perf_counter() - start_time) * 1000.0
        
        if response.status_code == 200:
            # Check if our critical safety lockout engine was successfully tripped by the data
            data = response.json()
            is_locked = data.get("system_lockout_triggered", False)
            return {"type": "Maintenance", "success": True, "latency_ms": elapsed, "lockout_triggered": is_locked}
        return {"type": "Maintenance", "success": False, "error": f"HTTP {response.status_code}"}
    except Exception as e:
        return {"type": "Maintenance", "success": False, "error": str(e)}

async def acquire_shared_token(client: httpx.AsyncClient) -> str:
    """Acquires the authorized JWT token before launching parallel operations."""
    # Matches your C# LoginDto model shape exactly
    auth_payload = {
        "Email": "areyesbiz@hotmail.com", # Update to a valid system email
        "Password": "Londonpass!@#4"
    }
    
    response = await client.post(TOKEN_URL, json=auth_payload)
    response.raise_for_status()
    
    # Unpacks your exact custom lowercase 'token' JSON object key
    data = response.json()
    token = data.get("token")
    
    if not token:
        raise ValueError("Authentication successful, but 'token' key was missing from response.")
        
    return token

async def run_court_diagnostics_simulation_test(client: httpx.AsyncClient, token: str, iteration: int) -> dict:
    """Asynchronously fires the precise Pydantic-validated court diagnostics schema."""
    # Instantiates type-safe defaults utilizing a unique session id per stress injection
    payload = CourtDiagnosticsPayloadSchema(
        session_id=str(uuid.uuid4()),
        court_id=SAMPLE_COURT_ID,
        timestamp=datetime.now(timezone.utc).isoformat()
    )
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    start_time = time.perf_counter()
    try:
        response = await client.post(NET_API_URL, json=payload.model_dump(mode="json"), headers=headers)
        latency = (time.perf_counter() - start_time) * 1000
        
        if response.status_code == 200:
            return {"type": "Diagnostics", "success": True, "latency_ms": latency}

        # --- DEBUG LOGGING: Print exactly what .NET says ---
        if iteration == 0: # Only print once so your terminal isn't flooded 150 times
            print(f"\n🛑 [DEBUG] .NET Server Rejected Diagnostics Request!")
            print(f"   ↳ Status Code: {response.status_code}")
            print(f"   ↳ Response Body: {response.text}")

        return {"type": "Diagnostics", "success": False, "status_code": response.status_code}
    except Exception as e:
        if iteration == 0:
            print(f"\n❌ [DEBUG] Connection Exception: {e}")
        return {"type": "Diagnostics", "success": False}

async def main():
    print(f"🚀 INITIALIZING AGENTIC STRESS ENGINE MATRIX...")
    
    # Configure limits to allow ultra-fast connection throughput limits
    limits = httpx.Limits(max_keepalive_connections=20, max_connections=50)
    
    async with httpx.AsyncClient(limits=limits, timeout=10.0, verify=False) as client:
        # Acquire token once to securely distribute across concurrent worker pipelines
        try:
            print("🔑 Authenticating Agent Engine and acquiring shared JWT Bearer Token...")
            shared_jwt = await acquire_shared_token(client)
        except Exception as auth_err:
            print(f"❌ Aborting Matrix: Authentication handshake failed: {auth_err}")
            return

        print(f"Generating and dispatching {TOTAL_SIMULATION_COUNT} parallel data telemetry sets...")
        
        # Create an execution array bundling pricing, maintenance, and court diagnostics together
        tasks = []
        for i in range(TOTAL_SIMULATION_COUNT):
            tasks.append(run_pricing_simulation_test(client, i))
            tasks.append(run_maintenance_simulation_test(client, i))
            tasks.append(run_court_diagnostics_simulation_test(client, shared_jwt, i))
            
        # Fire off all requests concurrently over local communication ports
        start_matrix_time = time.perf_counter()
        results = await asyncio.gather(*tasks)
        total_matrix_time = time.perf_counter() - start_matrix_time

    # 📊 COMPILE PERFORMANCE INSIGHTS REPORT
    pricing_success = 0
    maintenance_success = 0
    diagnostics_success = 0
    failures = 0
    total_latency = 0.0
    lockouts_tripped = 0

    for res in results:
        if res["success"]:
            total_latency += res["latency_ms"]
            if res["type"] == "Pricing":
                pricing_success += 1
            elif res["type"] == "Maintenance":
                maintenance_success += 1
                if res.get("lockout_triggered", False):
                    lockouts_tripped += 1
            elif res["type"] == "Diagnostics":
                diagnostics_success += 1
        else:
            failures += 1

    processed_count = len(results)
    avg_latency = (total_latency / (processed_count - failures)) if processed_count > failures else 0

    print("\n" + "="*60)
    print("📊 AGENTIC SIMULATION SYSTEM REPORT")
    print("="*60)
    print(f"Total Combined HTTP Injections:   {processed_count}")
    print(f"Successful Pricing Computes:     {pricing_success}")
    print(f"Successful Telemetry Wear Profiles: {maintenance_success}")
    print(f"Successful Court Diagnostics:     {diagnostics_success}")
    print(f"Ecosystem Network Failures:       {failures}")
    print(f"Critical Court Lockouts Fired:    {lockouts_tripped}")
    print(f"Average Engine Response Time:     {avg_latency:.2f} ms")
    print(f"Total Execution Loop Duration:    {total_matrix_time:.2f} seconds")
    print("="*60 + "\n")

if __name__ == "__main__":
    asyncio.run(main())
