# =========================================================================
# PROJECT: GLOBAL ACADEMY AGENTIC AI OPERATIONS ENGINE
# PATH: GlobalAcademy-PythonAi/database/connection.py
# DESCRIPTION: Manages the asynchronous database connection lifecycle pool
# =========================================================================

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from config.settings import settings
from typing import AsyncGenerator
from contextlib import asynccontextmanager

# 🚀 INITIALIZE HARDENED ASYNC POOL ENGINE
# Engineered with explicit safety sizing boundaries matching our scale matrices
async_engine = create_async_engine(
    url=settings.DATABASE_URL,
    pool_size=20,
    max_overflow=10,
    pool_timeout=30.0,
    echo=False
)

# Instantiate a thread-safe, reusable async session maker factory channel
async_session_factory = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False
)

@asynccontextmanager
async def get_async_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Defensive Asynchronous Context Manager Context.
    Guarantees transactional rollback on exceptions and releases pools cleanly.
    """
    session: AsyncSession = async_session_factory()
    try:
        yield session
    except Exception as e:
        print(f"⚠️ [DATABASE SESSION TRANSACTION FAULT]: Reverting modifications: {e}")
        await session.rollback()
        raise
    finally:
        await session.close()
