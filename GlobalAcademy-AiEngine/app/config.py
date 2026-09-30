# File: GlobalAcademy-AiEngine/app/config.py
import os
import json
import warnings
from pathlib import Path

import urllib
from pydantic import BaseModel
from dotenv import load_dotenv # 🚀 IMPORT THE HANDSHAKE INTEGRATION

warnings.filterwarnings("ignore", category=LangChainPendingDeprecationWarning) if 'LangChainPendingDeprecationWarning' in globals() else warnings.filterwarnings("ignore", message=".*allowed_objects.*")

# Locate your .env file relative to this script's position
# Adjusts cleanly to find 'GlobalAcademy-AiEngine/.env' from 'GlobalAcademy-AiEngine/app/'
dotenv_path = Path(__file__).resolve().parents[1] / ".env"

# 🚀 INITIALIZE DOTENV: Forces the environment variables straight into your machine's system memory!
if dotenv_path.exists():
    load_dotenv(dotenv_path=dotenv_path, override=False)
    print(f"🔑 [ENV BOOT SUCCESS]: Hydrated runtime variables from file: {dotenv_path}")
else:
    load_dotenv(override=False) # Fallback standard sweep

class AppSettings(BaseModel):
    """Global configuration settings registry for the Python AI Engine service."""
    title: str = "Smart Court Agentic AI Engine"
    description: str = "Advanced Operational Brain for Global Academy ERP Ecosystem Platforms"
    version: str = "4.0.0"
    default_port: int = 8000
    v2_default_port: int = 8001

    # 🚀 SECURE ISOLATED ENVIRONMENT BUCKETS: Sourced exclusively from system environment variables
    postgres_connection_string: str = ""

    # 🚀 Version 2. SECURE ISOLATED ENVIRONMENT BUCKETS: Sourced exclusively from system environment variables
    postgres_connection_string_2: str = ""
    
    openai_api_key: str = os.getenv(
        "OPENAI_API_KEY", 
        "sk-proj-"
    )

    def __init__(self, **data):
        super().__init__(**data)
        # Fetch the raw configuration string from the system environment
        raw_connection = os.getenv(
            "DATABASE_URL", 
            ""
        )
        # print(f"\n[v2 DEBUG]: raw_connection: {raw_connection}")
        # Run our automatic translation gate step
        self.postgres_connection_string = self._translate_ado_to_uri(raw_connection, "v1")
        self.postgres_connection_string_2 = self._translate_ado_to_uri(raw_connection, "v2")

    def _translate_ado_to_uri(self, raw_str: str, version: str) -> str:
        """
        Dynamically cross-translates a C# ADO.NET semicolon-delimited connection 
        string into a standard, operational PostgreSQL URI schema layout.
        """
        if not raw_str:
            return ""

        # print(f"🔄 [DEBUG config.py]: Translating ADO.NET connection string to PostgreSQL URI: {raw_str}")

        # If it's already a standard postgres:// URI, pass it through completely untouched
        if raw_str.strip().startswith(("postgresql://", "postgres://")):
            return raw_str.strip()

        # Parse key-value pairs out of the C# style string parameters
        kv_pairs = {}
        segments = raw_str.split(";")
        for chunk in segments:
            if "=" in chunk:
                key, val = chunk.split("=", 1)
                kv_pairs[key.strip().lower()] = val.strip()
                # print(f"🔑 [DEBUG config.py]: Key: {key.strip().lower()} | Value: {val.strip()}")

        # Extract structural variables using standardized key overrides
        host = kv_pairs.get("host") or kv_pairs.get("Host") or "localhost"
        port = kv_pairs.get("port") or kv_pairs.get("Port") or "5432"
        database = kv_pairs.get("database") or kv_pairs.get("Database") or "SmartCourtDb"
        username = kv_pairs.get("username") or kv_pairs.get("Username") or "postgres"
        password = kv_pairs.get("password") or kv_pairs.get("Password") or ""

        # 🚀 THE CRUCIAL ENCODING STEP: Automatically converts characters like @ into %40, # into %23, etc.
        safe_password = urllib.parse.quote_plus(password)

        # Assemble the clean, asyncpg-permissive URI string configuration safely!
        uri_output = f"postgresql://{username}:{safe_password}@{host}:{port}/{database}"

        if version == "v2":
            uri_output = f"postgresql+asyncpg://{username}:{safe_password}@{host}:{port}/{database}"

        # print(f"🗄️ [CONNECTION STRING TRANSLATOR]: Translated ADO.NET config and safely URL-encoded special characters.")
        return uri_output
    
settings = AppSettings()
