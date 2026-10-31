# =========================================================================
# PROJECT: TENNIS ACADEMY AGENTIC AI OPERATIONS ENGINE
# PATH: GlobalAcademy-PythonAi/config/settings.py
# DESCRIPTION: Enforces environment configuration injection and model thresholds
# =========================================================================

import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
import urllib

class ProjectSettings(BaseSettings):
    """
    Enterprise configuration manager utilizing environment variables.
    Provides strict default overrides for multi-tenant dev sandboxes.
    """
    # CENTRAL DATABASE CONNECTION PERIMETERS
    # Defaults map cleanly to an asynchronous PostgreSQL adapter setup
    SAFE_PASSWORD: str = urllib.parse.quote_plus("Chiki2tennis!@#4")
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:Chiki2tennis!%40#4@localhost:5432/SmartCourtDb",
        description="The absolute asyncpg connection path to the PostgreSQL server."
    )
    
    # CORE LLM HYPERPARAMETERS
    OPENAI_API_KEY: str = Field(
        default="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",
        description="The secure cryptographic API token for your primary model gateway."
    )
    LLM_MODEL_NAME: str = Field(
        default="gpt-4o-mini",
        description="The targeting identifier for the chat completion engine."
    )
    LLM_TEMPERATURE: float = Field(
        default=0.0,
        description="Forces absolute deterministic consistency (0.0) across evaluation tracks."
    )
    
    # WORKFLOW CONTROL GUARDRAILS
    MAX_LOOP_ITERATIONS: int = Field(
        default=10,
        description="The circuit-breaker safety ceiling preventing infinite agent loops."
    )

    # Enables automatic loading of local secret variables via a hidden .env file block
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

# Instantiate a single, globally accessible configuration singleton instance
settings = ProjectSettings()
