# =========================================================================
# 🐍 STAGE 1: DEPLOY CLEAN INTERPRETER IMAGE ENVIRONMENT
# =========================================================================
FROM python:3.11-slim AS base

# Prevent Python from writing .pyc compiled files and force direct console logging output
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install standard linux system compiler utilities required for native package processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy your framework dependency version tracker requirements sheet
COPY requirements.txt .

# Install your full package grid cleanly directly onto the runtime image container core
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy your actual application system source codebase assets 
COPY . .

# Expose your standard internal communication channel port line
EXPOSE 8000

# Fire up high-performance production-ready execution strings
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
