# File: GlobalAcademy-AiEngine/app/config.py
import os
from pydantic import BaseModel

class AppSettings(BaseModel):
    """Global configuration settings registry for the Python AI Engine service."""
    title: str = "Smart Court Agentic AI Engine"
    description: str = "Advanced Operational Brain for Global Academy ERP Ecosystem Platforms"
    version: str = "4.0.0"
    default_port: int = 8000
    v2_default_port: int = 8001

    # 🚀 SECURE ISOLATED ENVIRONMENT BUCKETS: Sourced exclusively from system environment variables
    postgres_connection_string: str = os.getenv(
        "DATABASE_URL", 
        "Host=localhost;"
    )
    
    openai_api_key: str = os.getenv(
        "OPENAI_API_KEY", 
        "sk-proj-"
    )

settings = AppSettings()
