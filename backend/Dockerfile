FROM python:3.12-slim

# Set environment variables for Python
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install necessary system dependencies and cleanup apt caches
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Create non-privileged user for security
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -s /bin/bash -m appuser

# Copy project source code
COPY . /app

# Set correct ownership for application directory and data cache
RUN mkdir -p /app/data && \
    chown -R appuser:appgroup /app && \
    chmod -R 777 /app/data

# Switch to non-root user
USER appuser

EXPOSE 8000

# Default production command using Gunicorn ASGI multi-workers
CMD ["gunicorn", "-c", "gunicorn_conf.py", "app.main:app"]
