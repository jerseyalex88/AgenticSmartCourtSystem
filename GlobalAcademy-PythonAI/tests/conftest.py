# =========================================================================
# PROJECT: GLOBAL ACADEMY AGENTIC AI OPERATIONS ENGINE
# PATH: GlobalAcademy-PythonAi/tests/conftest.py
# DESCRIPTION: Read-only live PostgreSQL test fixtures for database extraction
# =========================================================================

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from database.connection import async_engine

@pytest_asyncio.fixture(scope="function")
async def live_read_only_session() -> AsyncSession:
    """
    Exposes an isolated database session connected directly to your active PostgreSQL container.
    Maintains a strict read-only boundary loop to safely query active database profiles.
    """
    connection = await async_engine.connect()
    session = AsyncSession(bind=connection, expire_on_commit=False)
    
    try:
        yield session
    finally:
        await session.close()
        await connection.close()
