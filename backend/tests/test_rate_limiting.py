import pytest
from httpx import ASGITransport, AsyncClient

from app.core.rate_limit import RateLimiter
from app.main import app


@pytest.mark.asyncio
async def test_rate_limiter_unit():
    limiter = RateLimiter(requests=3, seconds=10, error_message="Test limit exceeded")

    class MockRequest:
        headers = {}
        client = type("Client", (), {"host": "127.0.0.1"})()

    req = MockRequest()

    # Requests 1, 2, 3 should succeed
    await limiter(req)
    await limiter(req)
    await limiter(req)

    # Request 4 should be throttled (429)
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await limiter(req)

    assert exc_info.value.status_code == 429
    assert exc_info.value.detail["success"] is False
    assert "Test limit exceeded" in exc_info.value.detail["message"]
