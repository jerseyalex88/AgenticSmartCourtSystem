# main.py; source venv/bin/activate; dotnet run --launch-profile "https"
import os
os.environ["STAN_LOG_LEVEL"] = "5"
os.environ["PROPHET_PLOTLY_DISABLED"] = "True"

import uvicorn
from fastapi import FastAPI
from app.config import settings
from app.routers import pricing, maintenance, court_diagnostics, calibration, video_analytics
from app.routers.predictive_video_analytics import router as predictive_video_router
from app.routers.voice_agent_analytics import router as voice_agent_router
from app.routers.text_to_speech_analytics import router as tts_generator_router

# Initialize the central application engine context using values from our config file
app = FastAPI(
    title=settings.title,
    description=settings.description,
    version=settings.version
)

# 🚀 REGISTER THE MODULAR ROUTERS (Like MapControllers() in ASP.NET Core)
app.include_router(pricing.router)
app.include_router(maintenance.router)
app.include_router(court_diagnostics.router)
app.include_router(calibration.router)
app.include_router(video_analytics.router)
app.include_router(predictive_video_router)
app.include_router(voice_agent_router)
app.include_router(tts_generator_router)

@app.get("/")
def read_root():
    """Service baseline landing node heartbeat validator mapping indicator."""
    return {
        "status": "Online",
        "service": settings.title,
        "architecture_mode": "Domain-Driven Clean Architecture Matrix Enabled"
    }

if __name__ == "__main__":
    # Enables script-level launch parameters matching dotnet run behaviors
    uvicorn.run("main:app", host="127.0.0.1", port=settings.default_port, reload=True)
