# main.py; source venv/bin/activate; dotnet run --launch-profile "https"
import os
import sys
from pathlib import Path

os.environ["STAN_BACKEND"] = "CMDSTANPY"

# Default paths for standard pip-installed cmdstan profiles
home_dir = str(Path.home())
default_cmdstan_path = os.path.join(home_dir, ".cmdstan", "cmdstan-2.35.0") # Adjust version if different

if os.path.exists(default_cmdstan_path):
    os.environ["CMDSTAN"] = default_cmdstan_path

# os.environ["STAN_LOG_LEVEL"] = "5"
# os.environ["PROPHET_PLOTLY_DISABLED"] = "True"

import uvicorn
from fastapi import FastAPI
from app.config import settings
from app.routers import pricing, maintenance, court_diagnostics, calibration, video_analytics
from app.routers.predictive_video_analytics import router as predictive_video_router
from app.routers.voice_agent_analytics import router as voice_agent_router
from app.routers.text_to_speech_analytics import router as tts_generator_router
from app.routers.court_report_analytics import router as executive_court_report_router
from app.routers.financial_report_analytics import router as executive_financial_router
from app.routers.invoice_integrity_report_analytics import router as executive_integrity_router
from app.routers.v2_text_to_speech_analytics import router as v2_tts_router
from app.routers.v2_report_analytics import router as v2_knowledge_ingestion_router

# 🚀 THE PROPHET STAN BACKEND FIX:
# Automatically download and install a clean, container-safe cmdstan binary 
# toolchain if it isn't discovered in the virtual environment on startup loops.
try:
    import cmdstanpy
    # Checks if the compiled binary compiler is missing
    if not cmdstanpy.utils.cmdstan_path():
        print("🧬 [STAN BACKEND RECOVERY]: Compiling container-safe toolchain rails...")
        cmdstanpy.install_cmdstan(interactive=False)
    print("✅ [STAN BACKEND RECOVERY]: Binary compilation architecture live!")
except Exception as stan_ex:
    print(f"⚠️ [STAN BACKEND WARNING]: Automated toolchain configuration passed with notice: {stan_ex}")

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
app.include_router(executive_court_report_router)
app.include_router(executive_financial_router)
app.include_router(executive_integrity_router)

app.include_router(v2_tts_router)
app.include_router(v2_knowledge_ingestion_router)

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
