# =========================================================================
# PROJECT: GLOBAL ACADEMY AGENTIC AI OPERATIONS ENGINE
# PATH: GlobalAcademy-PythonAi/database/models.py
# DESCRIPTION: Declares SQLAlchemy ORM schema tables matching enterprise DDL
# =========================================================================

import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Integer, Float, Boolean, DateTime, text
# 🚀 FIXED: Import native PostgreSQL UUID and JSONB data types
from sqlalchemy.dialects.postgresql import UUID, JSONB

class BaseTableSchema(DeclarativeBase):
    pass

class CourtEntityModel(BaseTableSchema):
    __tablename__ = "Courts"

    # 🚀 FIXED: Shifted from generic strings to native PostgreSQL UUID mappers
    Id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, server_default=text("gen_random_uuid()"))
    AcademyId: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    BranchId: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False, server_default=text("'00000000-0000-0000-0000-000000000000'::uuid"))
    
    Description: Mapped[str] = mapped_column(String, nullable=False, server_default=text("''::text"))
    DryCoefficient: Mapped[float] = mapped_column(Float, nullable=False, server_default=text("0.0"))
    IsIndoor: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    Name: Mapped[str] = mapped_column(String, nullable=False, server_default=text("''::text"))
    SurfaceType: Mapped[str] = mapped_column(String, nullable=False, server_default=text("''::text"))
    CreatedAtUtc: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("'-infinity'::timestamp with time zone"))
    AggregateMinutesPlayed: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    EstimatedReopenTimeUtc: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    MaintenanceThresholdMinutes: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    Status: Mapped[str] = mapped_column(String, nullable=False, server_default=text("''::text"))
    FloodlightState: Mapped[str] = mapped_column(String, nullable=False, server_default=text("''::text"))
    IsDecommissioned: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    SpatialHeatmapJson: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    CameraCalibrationJson: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    PredictiveHeatmapJson: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)


class CourtMaintenanceKnowledgeModel(BaseTableSchema):
    __tablename__ = "CourtMaintenanceKnowledge"

    # 🚀 FIXED: Aligned lookup table keys to use native PostgreSQL UUID compiler types
    Id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, server_default=text("gen_random_uuid()"))
    AcademyId: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    BranchId: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    CourtId: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), nullable=True)
    
    DocumentName: Mapped[str] = mapped_column(String, nullable=False)
    TextChunkContent: Mapped[str] = mapped_column(String, nullable=False)
    PageNumber: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    Embedding: Mapped[str] = mapped_column(String, nullable=False)
    CreatedAtUtc: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False
    )
