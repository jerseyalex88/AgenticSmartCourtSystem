# simulate_bulk_traffic.py
import asyncio
import random
import time
import httpx

# Configuration targets pointing straight to your active FastAPI system container
BASE_URL = "http://localhost:8000/api/ai"
TOTAL_SIMULATION_COUNT = 150  # Total test case profiles to generate and process simultaneously

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

async def main():
    print(f"🚀 INITIALIZING AGENTIC STRESS ENGINE MATRIX...")
    print(f"Generating and dispatching {TOTAL_SIMULATION_COUNT} parallel data telemetry sets...")
    
    # Configure limits to allow ultra-fast connection throughput limits
    limits = httpx.Limits(max_keepalive_connections=20, max_connections=50)
    #limits = httpx.Limits(max_keepalive_connections=50, max_connections=100)
    
    async with httpx.AsyncClient(limits=limits, timeout=10.0) as client:
        # Create an execution array bundling pricing and maintenance tests together
        tasks = []
        for i in range(TOTAL_SIMULATION_COUNT):
            tasks.append(run_pricing_simulation_test(client, i))
            tasks.append(run_maintenance_simulation_test(client, i))
            
        # Fire off all requests concurrently over local communication ports
        start_matrix_time = time.perf_counter()
        results = await asyncio.gather(*tasks)
        total_matrix_time = time.perf_counter() - start_matrix_time

    # 📊 COMPILE PERFORMANCE INSIGHTS REPORT
    pricing_success = 0
    maintenance_success = 0
    failures = 0
    total_latency = 0.0
    lockouts_tripped = 0

    for res in results:
        if res["success"]:
            total_latency += res["latency_ms"]
            if res["type"] == "Pricing":
                pricing_success += 1
            else:
                maintenance_success += 1
                if res.get("lockout_triggered", False):
                    lockouts_tripped += 1
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
    print(f"Ecosystem Network Failures:       {failures}")
    print(f"Critical Court Lockouts Fired:    {lockouts_tripped}")
    print(f"Average Engine Response Time:     {avg_latency:.2f} ms")
    print(f"Total Execution Loop Duration:    {total_matrix_time:.2f} seconds")
    print("="*60 + "\n")

if __name__ == "__main__":
    asyncio.run(main())
