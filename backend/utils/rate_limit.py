from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Deque, Dict, Tuple

from fastapi import HTTPException, Request, status


@dataclass(frozen=True)
class RateLimit:
    limit: int
    window_seconds: int


class InMemoryRateLimiter:
    """
    Simple per-process in-memory rate limiter.
    Good enough for demos / single-instance deployments.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._events: Dict[Tuple[str, str], Deque[float]] = defaultdict(deque)

    def hit(self, *, key: Tuple[str, str], rule: RateLimit) -> None:
        now = time.time()
        cutoff = now - rule.window_seconds
        with self._lock:
            q = self._events[key]
            while q and q[0] < cutoff:
                q.popleft()
            if len(q) >= rule.limit:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many attempts. Please wait a moment and try again.",
                )
            q.append(now)


limiter = InMemoryRateLimiter()


def rate_limit(endpoint: str, *, limit: int, window_seconds: int):
    rule = RateLimit(limit=limit, window_seconds=window_seconds)

    def dep(request: Request) -> None:
        ip = (request.client.host if request.client else "unknown").strip()
        limiter.hit(key=(endpoint, ip), rule=rule)

    return dep


