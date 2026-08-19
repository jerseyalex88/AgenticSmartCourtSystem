# app/config.py
from pydantic import BaseModel

class AppSettings(BaseModel):
    """Global configuration settings registry for the Python AI Engine service."""
    title: str = "Smart Court Agentic AI Engine"
    description: str = "Advanced Operational Brain for Global Academy ERP Ecosystem Platforms"
    version: str = "4.0.0"
    default_port: int = 8000

settings = AppSettings()
