# File: GlobalAcademy-AiEngine/v2_simulation_test.py
import asyncio
import io
import time
import httpx

async def simulate_court_video_upload(client: httpx.AsyncClient, simulation_id: int):
    """
    Simulates a player or court camera asynchronously uploading a tennis match 
    clip along with the 4-corner homography matrix calibration fields.
    """
    url = "http://localhost:8001/api/ai"
    print(f"📡 [SIMULATION {simulation_id}]: Initiating multipart handshake stream...")
    
    # 1. Mock a standard video file asset completely in-memory using byte buffers
    mock_video_bytes = b"MOCK_YOLO_STUB_DATA_FRAME_BYTES_010101"
    video_buffer = io.BytesIO(mock_video_bytes)
    
    # 2. Package your form fields exactly matching your router's explicit signature
    form_data = {
        "court_id": f"court-guid-0000-0000-0000-00000000000{simulation_id}",
        "academy_id": "academy-guid-9999-9999-9999-999999999999",
        "calib_width": "1920",
        "calib_height": "1080",
        "tl_x": "210.5", "tl_y": "150.2",   # Top-Left Corner
        "tr_x": "1710.0", "tr_y": "148.9",  # Top-Right Corner
        "bl_x": "50.2", "bl_y": "1020.6",   # Bottom-Left Corner
        "br_x": "1860.8", "br_y": "1022.1"   # Bottom-Right Corner
    }
    
    files = {
        "video_file": (f"simulation_clip_court_{simulation_id}.mp4", video_buffer, "video/mp4")
    }
    
    start_time = time.perf_counter()
    try:
        # 3. Fire the request over our async engine network channel
        response = await client.post(url, data=form_data, files=files)
        latency = time.perf_counter() - start_time
        
        if response.status_code == 202:
            data = response.json()
            print(f"✅ [SIMULATION {simulation_id} SUCCESS]: Status 202 ACCEPTED | Latency: {latency:.4f}s")
            print(f"   👉 Returned Background Job ID: {data.get('job_id')}")
        else:
            print(f"❌ [SIMULATION {simulation_id} FAULT]: Server rejected upload. Status: {response.status_code}")
            print(f"   👉 Details: {response.text}")
            
    except Exception as ex:
        print(f"❌ [SIMULATION {simulation_id} CRITICAL RUNTIME FAILURE]: {ex}")

async def main():
    print("\n" + "="*80)
    print("🔬 [V2 ENGINE ASYNCHRONOUS CONCURRENCY LOAD SIMULATION INTERFACE]")
    print("="*80)
    print("ℹ️ Ensure your v2 parallel application instance is actively tracking on Port 8001!\n")
    
    # Instantiate our local client pool for the test harness execution cycle
    async with httpx.AsyncClient(timeout=10.0) as client:
        # 4. Spin up 3 simultaneous tennis court video ingestion uploads concurrently!
        tasks = [
            simulate_court_video_upload(client, simulation_id=1),
            simulate_court_video_upload(client, simulation_id=2),
            simulate_court_video_upload(client, simulation_id=3)
        ]
        
        # Run them in parallel using asyncio.gather to prove our non-blocking design works
        await asyncio.gather(*tasks)
        
    print("\n" + "="*80)
    print("🏁 [SIMULATION TESTING CYCLE CONCLUDED SUCCESFULLY]")
    print("="*80 + "\n")

if __name__ == "__main__":
    asyncio.run(main())
