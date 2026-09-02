"""In-Memory Sliding Window Rate Limiter for FastAPI.

Provides thread-safe request throttling to protect external AI APIs (Gemini),
OCR/document parsers, and push notifications against exhaustion and abuse.
"""

import asyncio
import time
from collections import defaultdict
from typing import Dict, List

from fastapi import HTTPException, Request, status


class RateLimiter:
    """Sliding Window in-memory rate limiter dependency for FastAPI.

    Attributes:
        requests (int): Maximum allowed requests within the time window.
        seconds (int): Time window duration in seconds.
        error_message (str): Customized error detail returned on 429 status.
    """

    def __init__(
        self,
        requests: int = 10,
        seconds: int = 60,
        error_message: str = "Quá nhiều yêu cầu. Vui lòng thử lại sau.",
    ):
        self.requests = requests
        self.seconds = seconds
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

        now = time.time()
        window_start = now - self.seconds

        async with self._lock:
            # Filter out timestamps older than the sliding window
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

            # Periodically prune stale clients
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


# Pre-configured rate limiters for key application endpoints
ai_chat_limiter = RateLimiter(
    requests=20,
    seconds=60,
    error_message="Bạn đã gửi câu hỏi quá nhanh. Vui lòng đợi trong giây lát trước khi tiếp tục trò chuyện với AI Advisor.",
)

pdf_parser_limiter = RateLimiter(
    requests=10,
    seconds=60,
    error_message="Đã vượt giới hạn trích xuất sao kê PDF. Vui lòng thử lại sau 1 phút.",
)

telegram_test_limiter = RateLimiter(
    requests=6,
    seconds=60,
    error_message="Đã vượt giới hạn thử nghiệm Telegram Bot. Vui lòng đợi 1 phút trước khi gửi lại.",
)
