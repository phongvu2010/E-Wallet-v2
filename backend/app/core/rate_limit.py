"""Distributed Sliding Window Rate Limiter for FastAPI.

Provides cluster-wide request throttling across all Gunicorn worker processes using PostgreSQL
with transparent in-memory fallback to protect external AI APIs (Gemini),
OCR/document parsers, and push notifications against exhaustion and abuse.
"""

import asyncio
from datetime import datetime, timezone
import random
import time
from collections import defaultdict
from typing import Dict, List, Optional

from fastapi import HTTPException, Request, status
from sqlalchemy import text

from app.core.config import settings
from app.core.database import AsyncSessionLocal


class RateLimiter:
    """Sliding Window distributed rate limiter dependency for FastAPI.

    Attributes:
        requests (int): Maximum allowed requests within the time window.
        seconds (int): Time window duration in seconds.
        endpoint_tag (str): Unique identifier for this endpoint limit rule.
        error_message (str): Customized error detail returned on 429 status.
    """

    def __init__(
        self,
        requests: int = 10,
        seconds: int = 60,
        endpoint_tag: str = "default",
        error_message: str = "Quá nhiều yêu cầu. Vui lòng thử lại sau.",
    ):
        self.requests = requests
        self.seconds = seconds
        self.endpoint_tag = endpoint_tag
        self.error_message = error_message
        self._history: Dict[str, List[float]] = defaultdict(list)
        self._lock = asyncio.Lock()

    async def __call__(self, request: Request):
        # Identify client by X-Forwarded-For or client host IP
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            client_id = forwarded.split(",")[0].strip()
        else:
            client_id = request.client.host if request.client else "unknown"

        # Attempt Distributed PostgreSQL Rate Limiting
        if "sqlite" not in settings.async_database_url:
            try:
                await self._check_db_rate_limit(client_id)
                return
            except HTTPException:
                raise
            except Exception as exc:
                # Log warning and gracefully fallback to in-memory check
                pass

        # Fallback to Thread-safe In-Memory Sliding Window
        await self._check_in_memory_rate_limit(client_id)

    async def _check_db_rate_limit(self, client_id: str):
        """Perform distributed sliding window check against PostgreSQL rate_limit_records table."""
        async with AsyncSessionLocal() as session:
            # Query count and oldest timestamp within the sliding window
            res = await session.execute(
                text("""
                    SELECT COUNT(*), MIN(request_timestamp)
                    FROM rate_limit_records
                    WHERE client_key = :k
                      AND endpoint_tag = :tag
                      AND request_timestamp > (CURRENT_TIMESTAMP - (:sec * INTERVAL '1 second'));
                """),
                {"k": client_id, "tag": self.endpoint_tag, "sec": self.seconds},
            )
            row = res.one()
            count = row[0] or 0
            oldest_dt = row[1]

            if count >= self.requests:
                retry_after = self.seconds
                if oldest_dt:
                    now_utc = datetime.now(timezone.utc)
                    oldest_utc = oldest_dt if oldest_dt.tzinfo else oldest_dt.replace(tzinfo=timezone.utc)
                    elapsed = max(0, (now_utc - oldest_utc).total_seconds())
                    retry_after = max(1, int(self.seconds - elapsed))

                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail={
                        "success": False,
                        "message": self.error_message,
                        "retry_after_seconds": retry_after,
                        "limit": f"{self.requests} reqs / {self.seconds}s",
                    },
                    headers={"Retry-After": str(retry_after)},
                )

            # Record current request
            await session.execute(
                text("""
                    INSERT INTO rate_limit_records (client_key, endpoint_tag, request_timestamp)
                    VALUES (:k, :tag, CURRENT_TIMESTAMP);
                """),
                {"k": client_id, "tag": self.endpoint_tag},
            )
            await session.commit()

            # Randomly prune records older than 1 hour (2% chance per request to keep table compact)
            if random.random() < 0.02:
                try:
                    await session.execute(
                        text("DELETE FROM rate_limit_records WHERE request_timestamp < (CURRENT_TIMESTAMP - INTERVAL '1 hour');")
                    )
                    await session.commit()
                except Exception:
                    pass

    async def _check_in_memory_rate_limit(self, client_id: str):
        """Thread-safe in-memory sliding window fallback."""
        now = time.time()
        window_start = now - self.seconds

        async with self._lock:
            timestamps = [t for t in self._history[client_id] if t > window_start]

            if len(timestamps) >= self.requests:
                oldest_in_window = timestamps[0]
                retry_after = max(1, int(self.seconds - (now - oldest_in_window)))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail={
                        "success": False,
                        "message": self.error_message,
                        "retry_after_seconds": retry_after,
                        "limit": f"{self.requests} reqs / {self.seconds}s",
                    },
                    headers={"Retry-After": str(retry_after)},
                )

            timestamps.append(now)
            self._history[client_id] = timestamps

            if len(self._history) > 500:
                self._prune_stale(now)

    def _prune_stale(self, now: float):
        """Remove IP entries that haven't made requests in the current window."""
        stale_keys = [
            k
            for k, v in self._history.items()
            if not v or v[-1] < (now - self.seconds)
        ]
        for k in stale_keys:
            del self._history[k]


# Pre-configured distributed rate limiters for key application endpoints
ai_chat_limiter = RateLimiter(
    requests=20,
    seconds=60,
    endpoint_tag="ai_chat",
    error_message="Bạn đã gửi câu hỏi quá nhanh. Vui lòng đợi trong giây lát trước khi tiếp tục trò chuyện với AI Advisor.",
)

pdf_parser_limiter = RateLimiter(
    requests=10,
    seconds=60,
    endpoint_tag="pdf_parser",
    error_message="Đã vượt giới hạn trích xuất sao kê PDF. Vui lòng thử lại sau 1 phút.",
)

telegram_test_limiter = RateLimiter(
    requests=6,
    seconds=60,
    endpoint_tag="telegram_test",
    error_message="Đã vượt giới hạn thử nghiệm Telegram Bot. Vui lòng đợi 1 phút trước khi gửi lại.",
)
