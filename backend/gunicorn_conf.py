"""Gunicorn Configuration for Production FastAPI Deployment.

Runs Uvicorn worker instances managed by Gunicorn process manager with dynamic worker sizing,
request throttling, graceful timeouts, and memory leak mitigation.
"""

import multiprocessing
import os

# Server Socket
bind = os.getenv("GUNICORN_BIND", "0.0.0.0:8000")
backlog = int(os.getenv("GUNICORN_BACKLOG", "2048"))

# Worker Processes
# Rule of thumb: (2 x Num_Cores) + 1, capped by environment variable or sensible default
default_workers = max(2, min(8, multiprocessing.cpu_count() * 2 + 1))
workers = int(os.getenv("WORKERS", default_workers))
worker_class = "uvicorn.workers.UvicornWorker"
worker_connections = int(os.getenv("WORKER_CONNECTIONS", "1000"))

# Worker Lifecycle & Memory Leak Mitigation
# Automatically restart workers after processing N requests to prevent memory growth
max_requests = int(os.getenv("MAX_REQUESTS", "1000"))
max_requests_jitter = int(os.getenv("MAX_REQUESTS_JITTER", "50"))

# Timeouts
timeout = int(os.getenv("TIMEOUT", "120"))  # Extended for PDF statement parsing & OCR
keepalive = int(os.getenv("KEEP_ALIVE", "65"))
graceful_timeout = int(os.getenv("GRACEFUL_TIMEOUT", "30"))

# Logging
accesslog = os.getenv("ACCESS_LOG", "-")
errorlog = os.getenv("ERROR_LOG", "-")
loglevel = os.getenv("LOG_LEVEL", "info")
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)sµs'

# Process Naming
proc_name = "credit_wallet_api"

# Security
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190
