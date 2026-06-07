"""
middleware/security.py — Seguridad centralizada: headers, rate limiting, logging.
"""
import time
from collections import defaultdict
from typing import Callable

from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from config import settings

# ── Rate limiting en memoria (simple, para Railway single instance) ───────────
_request_counts: dict[str, list[float]] = defaultdict(list)


def _is_rate_limited(ip: str) -> bool:
    now = time.time()
    window = 60.0  # 1 minuto
    # Limpiar timestamps viejos
    _request_counts[ip] = [t for t in _request_counts[ip] if now - t < window]
    if len(_request_counts[ip]) >= settings.RATE_LIMIT_PER_MINUTE:
        return True
    _request_counts[ip].append(now)
    return False


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Agrega headers de seguridad a todas las respuestas."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"]    = "nosniff"
        response.headers["X-Frame-Options"]           = "DENY"
        response.headers["X-XSS-Protection"]          = "1; mode=block"
        response.headers["Referrer-Policy"]           = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"]        = "geolocation=(), microphone=()"
        response.headers["Content-Security-Policy"]   = "default-src 'self'; frame-ancestors 'none'; base-uri 'self'"
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting por IP. Exento: /health, /docs, /openapi.json."""

    EXEMPT_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if request.url.path in self.EXEMPT_PATHS:
            return await call_next(request)

        forwarded_for = request.headers.get("x-forwarded-for", "")
        ip = forwarded_for.split(",")[0].strip() if forwarded_for else (request.client.host if request.client else "unknown")
        if _is_rate_limited(ip):
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": f"Demasiadas peticiones. Límite: {settings.RATE_LIMIT_PER_MINUTE}/min"},
                headers={"Retry-After": "60"},
            )
        return await call_next(request)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log básico de requests para auditoría."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start = time.perf_counter()
        response = await call_next(request)
        duration = (time.perf_counter() - start) * 1000
        # Solo loguear rutas de API, no assets
        if request.url.path.startswith("/"):
            print(
                f"[HTTP] {request.method} {request.url.path} "
                f"→ {response.status_code} ({duration:.1f}ms)"
            )
        return response
