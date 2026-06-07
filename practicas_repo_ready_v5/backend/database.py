"""
database.py — Modelos ORM multiempresa con roles, branding, destinatarios y gobernanza.
Roles: SUPERADMIN | ADMIN | ANALISTA | VIEWER
"""
import enum
from datetime import datetime
from typing import Generator

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, Float, ForeignKey,
    Integer, String, Text, UniqueConstraint, create_engine, event,
)
from sqlalchemy.orm import DeclarativeBase, Session, relationship, sessionmaker

from config import settings


# ── Engine ────────────────────────────────────────────────────────────────────
def _build_engine():
    url = settings.DATABASE_URL
    if url.startswith("sqlite"):
        eng = create_engine(
            url,
            connect_args={"check_same_thread": False},
        )

        @event.listens_for(eng, "connect")
        def set_sqlite_pragma(dbapi_conn, _):
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()
        return eng
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
    )


engine = _build_engine()
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


# ── Enums ─────────────────────────────────────────────────────────────────────
class RolUsuario(str, enum.Enum):
    SUPERADMIN = "SUPERADMIN"
    ADMIN      = "ADMIN"
    ANALISTA   = "ANALISTA"
    VIEWER     = "VIEWER"


class EstadoNotificacion(str, enum.Enum):
    PENDIENTE      = "PENDIENTE"
    ENVIADO_EMAIL  = "ENVIADO_EMAIL"
    ENVIADO_WA     = "ENVIADO_WA"
    COMPLETO       = "COMPLETO"


# ── Modelos ───────────────────────────────────────────────────────────────────
class Empresa(Base):
    __tablename__ = "empresas"

    id                       = Column(Integer, primary_key=True, autoincrement=True)
    nombre                   = Column(String(255), nullable=False, unique=True, index=True)
    nit                      = Column(String(80), nullable=True)
    dominio                  = Column(String(255), nullable=True)
    logo_url                 = Column(Text, nullable=True)
    color_primary            = Column(String(20), default="#1a56db")
    color_secondary          = Column(String(20), default="#0e3a8c")
    correo_emisor            = Column(String(255), nullable=True)
    correo_contrasena        = Column(String(255), nullable=True)
    url_api_whatsapp         = Column(String(500), nullable=True)
    token_whatsapp           = Column(String(500), nullable=True)
    activo                   = Column(Boolean, default=True, index=True)
    creado_en                = Column(DateTime, default=datetime.now)

    usuarios                 = relationship("Usuario", back_populates="empresa")
    servicios                = relationship("ServicioCatalogo", back_populates="empresa")
    destinatarios            = relationship("DestinatarioNotificacion", back_populates="empresa")


class Usuario(Base):
    __tablename__ = "usuarios"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    empresa_id       = Column(Integer, ForeignKey("empresas.id", ondelete="SET NULL"), nullable=True, index=True)
    email            = Column(String(255), unique=True, nullable=False, index=True)
    nombre           = Column(String(255), nullable=False)
    hashed_password  = Column(String(255), nullable=False)
    rol              = Column(Enum(RolUsuario), default=RolUsuario.VIEWER, nullable=False)
    activo           = Column(Boolean, default=True)
    ultimo_acceso    = Column(DateTime, nullable=True)
    creado_en        = Column(DateTime, default=datetime.now)

    empresa          = relationship("Empresa", back_populates="usuarios")

    @property
    def es_admin(self) -> bool:
        return self.rol in (RolUsuario.SUPERADMIN, RolUsuario.ADMIN)

    @property
    def empresa_nombre(self) -> str | None:
        return self.empresa.nombre if self.empresa else None


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id        = Column(Integer, primary_key=True, autoincrement=True)
    email     = Column(String(255), nullable=False, index=True)
    token     = Column(String(255), nullable=False, unique=True, index=True)
    usado     = Column(Boolean, default=False)
    expira_en = Column(DateTime, nullable=False)
    creado_en = Column(DateTime, default=datetime.now)


class ServicioCatalogo(Base):
    __tablename__ = "catalogo_servicios"
    __table_args__ = (
        UniqueConstraint("empresa_id", "nombre_servicio", name="uq_servicio_empresa_nombre"),
    )

    id              = Column(Integer, primary_key=True, autoincrement=True)
    empresa_id      = Column(Integer, ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False, index=True)
    nombre_servicio = Column(String(500), nullable=False)
    descripcion     = Column(Text, nullable=True)
    categoria       = Column(String(100), nullable=True)
    activo          = Column(Boolean, default=True)
    creado_en       = Column(DateTime, default=datetime.now)
    creado_por      = Column(String(255), nullable=True)

    empresa         = relationship("Empresa", back_populates="servicios")


class MatchOportunidad(Base):
    __tablename__ = "matches_oportunidades"
    __table_args__ = (
        UniqueConstraint("empresa_id", "id_proceso_secop", name="uq_match_empresa_proceso"),
    )

    id                     = Column(Integer, primary_key=True, autoincrement=True)
    empresa_id             = Column(Integer, ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False, index=True)
    id_proceso_secop       = Column(String(255), nullable=False, index=True)
    entidad_publica        = Column(String(500), nullable=False)
    departamento           = Column(String(255), nullable=True)
    ciudad                 = Column(String(255), nullable=True)
    descripcion_licitacion = Column(Text, nullable=False)
    servicio_relacionado   = Column(String(500), nullable=False)
    score_ia               = Column(Float, nullable=False)
    fecha_limite           = Column(String(50), nullable=False)
    modalidad              = Column(String(255), nullable=True)
    valor_estimado         = Column(String(100), nullable=True)
    fecha_descubrimiento   = Column(DateTime, default=datetime.now)
    estado_notificacion    = Column(
        Enum(EstadoNotificacion),
        default=EstadoNotificacion.PENDIENTE,
    )


class ConfigScheduler(Base):
    __tablename__ = "config_scheduler"
    __table_args__ = (
        UniqueConstraint("empresa_id", name="uq_scheduler_empresa"),
    )

    id             = Column(Integer, primary_key=True, autoincrement=True)
    empresa_id     = Column(Integer, ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False, index=True)
    hora_manana    = Column(String(10), default="09:00")
    hora_tarde     = Column(String(10), default="15:00")
    activo         = Column(Boolean, default=True)
    umbral_ia      = Column(Float, default=0.50)
    filtro_depto   = Column(String(255), nullable=True)
    actualizado_en = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class DestinatarioNotificacion(Base):
    __tablename__ = "destinatarios_notificacion"

    id                = Column(Integer, primary_key=True, autoincrement=True)
    empresa_id        = Column(Integer, ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False, index=True)
    nombre            = Column(String(255), nullable=False)
    email             = Column(String(255), nullable=True)
    telefono_whatsapp = Column(String(50), nullable=True)
    recibe_email      = Column(Boolean, default=True)
    recibe_whatsapp   = Column(Boolean, default=False)
    activo            = Column(Boolean, default=True)
    creado_en         = Column(DateTime, default=datetime.now)
    creado_por        = Column(String(255), nullable=True)

    empresa           = relationship("Empresa", back_populates="destinatarios")


class LiberacionProcesosLog(Base):
    __tablename__ = "liberacion_procesos_log"

    id                   = Column(Integer, primary_key=True, autoincrement=True)
    empresa_id            = Column(Integer, ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False, index=True)
    usuario_id            = Column(Integer, nullable=True)
    email                 = Column(String(255), nullable=True)
    filtros               = Column(Text, nullable=True)
    registros_eliminados  = Column(Integer, default=0)
    creado_en             = Column(DateTime, default=datetime.now)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    empresa_id = Column(Integer, nullable=True, index=True)
    usuario_id = Column(Integer, nullable=True)
    email      = Column(String(255), nullable=True)
    accion     = Column(String(100), nullable=False)
    detalle    = Column(Text, nullable=True)
    ip         = Column(String(50), nullable=True)
    creado_en  = Column(DateTime, default=datetime.now)


# ── Dependency ────────────────────────────────────────────────────────────────
def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Seed inicial ──────────────────────────────────────────────────────────────
def inicializar_base_de_datos() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        empresa = _seed_empresa(db)
        _seed_admin(db, empresa)
        _seed_catalogo(db, empresa)
        _seed_scheduler(db, empresa)
        _seed_destinatarios(db, empresa)
        db.commit()
    finally:
        db.close()


def _seed_empresa(db: Session) -> Empresa:
    empresa = db.query(Empresa).filter_by(nombre=settings.EMPRESA_NOMBRE).first()
    if empresa:
        return empresa
    empresa = Empresa(
        nombre=settings.EMPRESA_NOMBRE,
        logo_url=settings.EMPRESA_LOGO_URL,
        color_primary=settings.EMPRESA_COLOR_PRIMARY,
        color_secondary=settings.EMPRESA_COLOR_SECONDARY,
        correo_emisor=settings.CORREO_EMISOR or None,
        correo_contrasena=settings.CORREO_CONTRASENA or None,
        url_api_whatsapp=settings.URL_API_WHATSAPP or None,
        token_whatsapp=settings.TOKEN_WHATSAPP or None,
    )
    db.add(empresa)
    db.flush()
    print(f"[DB] Empresa base creada: {empresa.nombre}")
    return empresa


def _seed_admin(db: Session, empresa: Empresa) -> None:
    from passlib.context import CryptContext
    pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
    if not db.query(Usuario).filter_by(email=settings.ADMIN_EMAIL).first():
        db.add(Usuario(
            empresa_id=empresa.id,
            email=settings.ADMIN_EMAIL,
            nombre="Administrador",
            hashed_password=pwd.hash(settings.ADMIN_PASSWORD),
            rol=RolUsuario.SUPERADMIN,
        ))
        print(f"[DB] SuperAdmin creado: {settings.ADMIN_EMAIL}")


def _seed_catalogo(db: Session, empresa: Empresa) -> None:
    if db.query(ServicioCatalogo).filter_by(empresa_id=empresa.id).count() > 0:
        total = db.query(ServicioCatalogo).filter_by(empresa_id=empresa.id).count()
        print(f"[DB] Catálogo existente para {empresa.nombre}: {total} servicios")
        return

    servicios = [
        ("Implementación y consultoría SAP S/4HANA módulos financiero presupuestal contratación", "SAP"),
        ("Implementación SAP Business One ERP pequeñas medianas empresas", "SAP"),
        ("Soporte AMS mantenimiento correctivo evolutivo aplicaciones SAP", "SAP"),
        ("Migración actualización SAP ECC a S/4HANA cloud", "SAP"),
        ("Consultoría ciberseguridad diagnóstico madurez NIST ISO 27001", "Cyber"),
        ("Pruebas de penetración pentesting análisis vulnerabilidades aplicaciones", "Cyber"),
        ("Implementación SOC SIEM EDR protección ransomware Zero Trust", "Cyber"),
        ("Cumplimiento normativo Ley 1581 GDPR PCI-DSS seguridad información", "Cyber"),
        ("Migración infraestructura tecnológica cloud AWS Azure Google Cloud Platform", "Cloud"),
        ("Arquitectura Kubernetes Docker contenedores DevSecOps CI CD pipelines", "Cloud"),
        ("Optimización costos cloud disaster recovery alta disponibilidad", "Cloud"),
        ("Desarrollo software aplicaciones web móviles React Angular Flutter", "Dev"),
        ("Desarrollo APIs REST GraphQL microservicios arquitectura hexagonal", "Dev"),
        ("ERP a medida portales ciudadanos gobierno digital e-government", "Dev"),
        ("Plataforma Business Intelligence Power BI Tableau Qlik dashboards ejecutivos", "BI"),
        ("Ingeniería datos ETL Data Warehouse Data Lake Azure Synapse Databricks", "BI"),
        ("Modelos Machine Learning predicción demanda detección fraude analítica avanzada", "BI"),
        ("Gestión documental electrónica expediente digital ECM DMS", "Doc"),
        ("Automatización procesos RPA UiPath Automation Anywhere BPM workflows", "Doc"),
        ("Integración aplicaciones ORFEO firma electrónica flujos trabajo digitales PQRS", "Doc"),
    ]
    for nombre, categoria in servicios:
        db.add(ServicioCatalogo(
            empresa_id=empresa.id,
            nombre_servicio=nombre,
            categoria=categoria,
        ))
    print(f"[DB] {len(servicios)} servicios cargados para {empresa.nombre}")


def _seed_scheduler(db: Session, empresa: Empresa) -> None:
    if db.query(ConfigScheduler).filter_by(empresa_id=empresa.id).count() == 0:
        db.add(ConfigScheduler(empresa_id=empresa.id))


def _seed_destinatarios(db: Session, empresa: Empresa) -> None:
    if settings.CORREO_RECEPTOR and not db.query(DestinatarioNotificacion).filter_by(empresa_id=empresa.id).first():
        db.add(DestinatarioNotificacion(
            empresa_id=empresa.id,
            nombre="Destinatario principal",
            email=settings.CORREO_RECEPTOR,
            telefono_whatsapp=settings.TELEFONO_DESTINO_WA or None,
            recibe_email=True,
            recibe_whatsapp=bool(settings.TELEFONO_DESTINO_WA),
            creado_por=settings.ADMIN_EMAIL,
        ))
