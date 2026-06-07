"""
main.py — Entrada principal de la API.
Incluye: seguridad, CORS, scheduler, Swagger personalizado.
"""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from apscheduler.schedulers.background import BackgroundScheduler

from config import settings
from database import ConfigScheduler, Empresa, SessionLocal, inicializar_base_de_datos
from middleware.security import (
    SecurityHeadersMiddleware,
    RateLimitMiddleware,
    RequestLoggingMiddleware,
)
from routers import auth, empresas, gobernanza, notificaciones, oportunidades, scheduler, secop_search, servicios

os.environ["HF_TOKEN"] = settings.HF_TOKEN

# ── Scheduler ─────────────────────────────────────────────────────────────────
apscheduler = BackgroundScheduler(timezone="America/Bogota")


def arrancar_jobs() -> None:
    from pipeline import ejecutar_pipeline
    db = SessionLocal()
    configs = (
        db.query(ConfigScheduler, Empresa)
        .join(Empresa, Empresa.id == ConfigScheduler.empresa_id)
        .filter(ConfigScheduler.activo == True, Empresa.activo == True)
        .all()
    )
    db.close()

    for cfg, empresa in configs:
        h_m, min_m = cfg.hora_manana.split(":")
        h_t, min_t = cfg.hora_tarde.split(":")
        apscheduler.add_job(
            ejecutar_pipeline,
            "cron",
            hour=int(h_m),
            minute=int(min_m),
            id=f"scan_manana_empresa_{empresa.id}",
            replace_existing=True,
            kwargs={"empresa_id": empresa.id},
        )
        apscheduler.add_job(
            ejecutar_pipeline,
            "cron",
            hour=int(h_t),
            minute=int(min_t),
            id=f"scan_tarde_empresa_{empresa.id}",
            replace_existing=True,
            kwargs={"empresa_id": empresa.id},
        )
        print(f"[Scheduler] {empresa.nombre}: {cfg.hora_manana} y {cfg.hora_tarde} (Bogotá)")


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"\n{'='*55}")
    print("  Practicas — SECOP Intelligence multiempresa")
    print(f"{'='*55}")
    inicializar_base_de_datos()
    arrancar_jobs()
    apscheduler.start()
    print("[App] API lista en http://localhost:8000")
    print("[App] Docs en      http://localhost:8000/docs")
    print(f"[App] Ambiente:    {settings.ENVIRONMENT}\n")
    yield
    apscheduler.shutdown()
    print("[App] Servidor detenido")


# ── FastAPI App ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="Practicas SECOP Intelligence API",
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
    description="""
## Detección de oportunidades en SECOP II con IA semántica y operación multiempresa

La aplicación analiza licitaciones publicadas en SECOP II y las compara semánticamente
contra catálogos de servicios configurados por empresa.

### Funcionalidades principales

- **Multiempresa**: empresas, usuarios, servicios, branding y oportunidades separados por empresa.
- **Matching semántico**: comparación entre servicios y licitaciones con sentence-transformers + FAISS.
- **Destinatarios configurables**: correo y WhatsApp por empresa.
- **Roles**: SUPERADMIN / ADMIN / ANALISTA / VIEWER.
- **Gobernanza**: eliminación controlada de procesos almacenados para liberar información de BD.
- **Auditoría**: registro de acciones importantes.

### Roles y permisos

| Acción | VIEWER | ANALISTA | ADMIN | SUPERADMIN |
|--------|--------|----------|-------|------------|
| Ver oportunidades | ✅ | ✅ | ✅ | ✅ |
| Buscar en SECOP | ✅ | ✅ | ✅ | ✅ |
| Ejecutar scan | ❌ | ✅ | ✅ | ✅ |
| Gestionar servicios | ❌ | ❌ | ✅ | ✅ |
| Gestionar usuarios de empresa | ❌ | ❌ | ✅ | ✅ |
| Gestionar destinatarios | ❌ | ❌ | ✅ | ✅ |
| Liberar procesos BD | ❌ | ❌ | ✅ | ✅ |
| Gestionar empresas | ❌ | ❌ | ❌ | ✅ |
""",
    version="3.0.0",
    lifespan=lifespan,
)

# ── Middlewares ───────────────────────────────────────────────────────────────
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(empresas.router)
app.include_router(servicios.router)
app.include_router(oportunidades.router)
app.include_router(scheduler.router)
app.include_router(secop_search.router)
app.include_router(notificaciones.router)
app.include_router(gobernanza.router)


@app.get("/", tags=["Health"])
def root():
    return {
        "name": "Practicas SECOP Intelligence",
        "version": "3.0.0",
        "status": "ok",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
def health():
    return {"status": "healthy"}


# ── Swagger personalizado ────────────────────────────────────────────────────
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
        }
    }
    for path in openapi_schema["paths"].values():
        for method in path.values():
            method.setdefault("security", [{"BearerAuth": []}])
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi
