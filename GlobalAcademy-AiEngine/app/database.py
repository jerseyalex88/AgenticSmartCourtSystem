# File: GlobalAcademy-AiEngine/app/database.py (Conceptual baseline review)
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.config import settings

# 1. Pull the live authenticated connection string from your Docker compose environments
DATABASE_URL = settings.postgres_connection_string_2

# 2. Instantiate the asynchronous network execution engine ring
async_engine = create_async_engine(
    DATABASE_URL,
    pool_size=20,          # Keeps 20 channels open for multi-agent concurrency
    max_overflow=10,       # Allows spikes up to 30 parallel connections
    echo=False             # Set to True only if you want raw SQL queries in your console logs
)

# 🚀 3. THE FACTORY INDIRECTION METHOD:
# This is the exact sessionmaker instance our checkpointer uses to borrow database connections!
async_session_factory = sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False
)
