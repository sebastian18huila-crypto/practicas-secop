"""
config.py — Configuración central con validación estricta.
Todas las variables sensibles vienen del entorno (.env).
NUNCA hardcodear secretos en este archivo.
"""
from functools import lru_cache
from typing import List
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Base de datos ─────────────────────────────────────────────────────
    DATABASE_URL: str

    # ── JWT ───────────────────────────────────────────────────────────────
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # ── CORS ─────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # ── Correo ────────────────────────────────────────────────────────────
    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_PORT: int = 465
    CORREO_EMISOR: str = ""
    CORREO_CONTRASENA: str = ""
    CORREO_RECEPTOR: str = ""
    FRONTEND_URL: str = "http://localhost:5173"

    # ── WhatsApp ──────────────────────────────────────────────────────────
    URL_API_WHATSAPP: str = "https://api.callmebot.com/whatsapp.php"
    TOKEN_WHATSAPP: str = ""
    TELEFONO_DESTINO_WA: str = ""

    # ── SECOP ─────────────────────────────────────────────────────────────
    UMBRAL_SIMILITUD: float = 0.50
    URLS_SECOP: str = (
        "https://www.datos.gov.co/resource/p6dx-8zbt.json?$limit=2000&$order=:id DESC,"
        "https://www.datos.gov.co/resource/jbjy-vk9h.json?$limit=2000&$order=:id DESC"
    )
    SECOP_APP_TOKEN: str = ""

    # ── Hugging Face ──────────────────────────────────────────────────────
    HF_TOKEN: str = ""

    # ── Admin inicial ─────────────────────────────────────────────────────
    ADMIN_EMAIL: str = "admin@netthplus.com"
    ADMIN_PASSWORD: str = ""

    # ── Empresa (branding) ────────────────────────────────────────────────
    EMPRESA_NOMBRE: str = "Netthplus"
    EMPRESA_LOGO_URL: str = ""
    EMPRESA_COLOR_PRIMARY: str = "#1a56db"
    EMPRESA_COLOR_SECONDARY: str = "#0e3a8c"

    # ── Rate limiting ─────────────────────────────────────────────────────
    RATE_LIMIT_PER_MINUTE: int = 60

    # ── Ambiente ─────────────────────────────────────────────────────────
    ENVIRONMENT: str = "development"  # development | production

    @field_validator("SECRET_KEY")
    @classmethod
    def secret_key_must_be_long(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("SECRET_KEY debe tener al menos 32 caracteres")
        return v

    @field_validator("ADMIN_PASSWORD")
    @classmethod
    def admin_password_required(cls, v: str) -> str:
        if not v:
            raise ValueError("ADMIN_PASSWORD no puede estar vacío")
        if len(v) < 8:
            raise ValueError("ADMIN_PASSWORD debe tener al menos 8 caracteres")
        return v

    @model_validator(mode="after")
    def validate_production_settings(self):
        if self.is_production:
            origins = self.get_allowed_origins()
            if not origins:
                raise ValueError("ALLOWED_ORIGINS debe configurarse en producción")
            invalid = [o for o in origins if o == "*" or "localhost" in o or "127.0.0.1" in o]
            if invalid:
                raise ValueError(f"ALLOWED_ORIGINS no puede usar localhost, 127.0.0.1 o * en producción: {invalid}")
            if "cambia_esta_clave" in self.SECRET_KEY:
                raise ValueError("SECRET_KEY debe ser real en producción")
            if "cambia_esta_clave" in self.ADMIN_PASSWORD:
                raise ValueError("ADMIN_PASSWORD debe ser real en producción")
            if len(self.ADMIN_PASSWORD) < 12:
                raise ValueError("ADMIN_PASSWORD debe tener al menos 12 caracteres en producción")
        return self

    def get_urls_secop(self) -> List[str]:
        return [u.strip() for u in self.URLS_SECOP.split(",") if u.strip()]

    def get_allowed_origins(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
