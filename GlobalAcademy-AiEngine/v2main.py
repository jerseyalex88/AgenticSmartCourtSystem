# v2main.py; source venv/bin/activate; uvicorn v2main:v2app --reload --port 8000
import os
from contextlib import asynccontextmanager
import uvicorn
import httpx
from fastapi import FastAPI

# Import your original configuration objects
from app.config import settings
from app.routers.v2_video_analytics import router as v2_video_analytics_router

# Import your new optimized async routers as we build them week-by-week
# from app.routers.v2_predictive_video_analytics import router as v2_predictive_router

os.environ["STAN_LOG_LEVEL"] = "5"
os.environ["PROPHET_PLOTLY_DISABLED"] = "True"

# 1. Setup the Async Resource Lifespan Context Manager
@asynccontextmanager
async def v2_lifespan(app: FastAPI):
    print("🚀 [v2 STARTUP]: Initializing v2 enterprise async http connection pool...")
    app.state.async_http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(60.0, connect=5.0),
        verify=False, # Safe bypass for local .NET self-signed SSL dev environments
        limits=httpx.Limits(max_connections=100, max_keepalive_connections=20)
    )
    yield
    print("🛑 [v2 SHUTDOWN]: Draining and safely closing v2 http resource channels...")
    await app.state.async_http_client.aclose()


# 2. Initialize the parallel v2 central application engine context
v2app = FastAPI(
    title=f"{settings.title} - v2 Agentic Engine",
    description=settings.description,
    version="2.0.0",
    lifespan=v2_lifespan # Hooking your new async pipeline engine here
)

# 3. Register your v2 Modular Routers as they are developed
v2app.include_router(v2_video_analytics_router)

@v2app.get("/")
def read_v2_root():
    """Service baseline landing node heartbeat validator mapping indicator for v2."""
    return {
        "status": "Online",
        "service": f"{settings.title} (v2 Engine)",
        "architecture_mode": "Asynchronous Multi-Agent Architecture Enabled"
    }

if __name__ == "__main__":
    # Launch parameters point directly to v2main:v2app matching your original port configs
    uvicorn.run("v2main:v2app", host="127.0.0.1", port=settings.v2_default_port, reload=True)
