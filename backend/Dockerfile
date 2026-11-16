# Stage 1: Build & Dependency Resolution
FROM python:3.10-slim as builder

WORKDIR /build

# Install build tools and compilation prerequisites
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt sentence-transformers faiss-cpu pypdf

# Stage 2: Production Runtime
FROM python:3.10-slim as runtime

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app \
    PORT=8000 \
    HOST=0.0.0.0 \
    ENV=production \
    UPLOAD_DIR=uploads

WORKDIR /app

# Install runtime system dependencies (OpenCV libgl, curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

# Create non-root system user
RUN groupadd -g 1000 appuser && \
    useradd -u 1000 -g appuser -d /app -s /bin/bash appuser

# Copy installed dependencies from builder stage
COPY --from=builder /install /usr/local

# Copy application directories
COPY --chown=appuser:appuser backend/ /app/backend/
COPY --chown=appuser:appuser model/ /app/model/
COPY --chown=appuser:appuser knowledge_base/ /app/knowledge_base/
COPY --chown=appuser:appuser knowledge_base/ /app/backend/knowledge_base/

# Ensure uploads and logs directories exist with correct permissions
RUN mkdir -p /app/uploads /app/backend/logs && \
    chown -R appuser:appuser /app/uploads /app/backend/logs

# Switch to non-root user
USER appuser

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT}/api/v1/health || exit 1

# Launch ASGI server with configurable port
CMD ["sh", "-c", "uvicorn backend.app.main:app --host ${HOST} --port ${PORT} --workers 4"]
