"""routers/empresas.py — Gestión de empresas, branding y credenciales de notificación."""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from database import ConfigScheduler, Empresa, RolUsuario, Usuario, get_db
from routers.auth import get_usuario_actual
from utils.audit import log_action

router = APIRouter(prefix="/empresas", tags=["Empresas"])


def _validar_color_hex(valor: Optional[str]) -> Optional[str]:
    if valor is None:
        return valor
    valor = valor.strip()
    if not valor.startswith("#") or len(valor) not in (4, 7):
        raise ValueError("El color debe estar en formato hexadecimal, ejemplo: #1a56db")
    permitidos = "0123456789abcdefABCDEF"
    if any(c not in permitidos for c in valor[1:]):
        raise ValueError("El color debe estar en formato hexadecimal, ejemplo: #1a56db")
    return valor


class EmpresaIn(BaseModel):
    nombre:             str
    nit:                Optional[str] = None
    dominio:            Optional[str] = None
    logo_url:           Optional[str] = None
    color_primary:      str = "#1a56db"
    color_secondary:    str = "#0e3a8c"
    correo_emisor:      Optional[str] = None
    correo_contrasena:  Optional[str] = None
    url_api_whatsapp:   Optional[str] = None
    token_whatsapp:     Optional[str] = None
    activo:             bool = True


    @field_validator("color_primary", "color_secondary")
    @classmethod
    def validar_color(cls, v: str) -> str:
        return _validar_color_hex(v)


class EmpresaOut(BaseModel):
    id:                 int
    nombre:             str
    nit:                Optional[str]
    dominio:            Optional[str]
    logo_url:           Optional[str]
    color_primary:      str
    color_secondary:    str
    correo_emisor:      Optional[str]
    url_api_whatsapp:   Optional[str]
    activo:             bool
    creado_en:          datetime

    class Config:
        from_attributes = True


class BrandingUpdateIn(BaseModel):
    nombre:          Optional[str] = None
    logo_url:        Optional[str] = None
    color_primary:   Optional[str] = None
    color_secondary: Optional[str] = None

    @field_validator("color_primary", "color_secondary")
    @classmethod
    def validar_color(cls, v: Optional[str]) -> Optional[str]:
        return _validar_color_hex(v)


def _validar_superadmin(usuario: Usuario) -> None:
    if usuario.rol != RolUsuario.SUPERADMIN:
        raise HTTPException(403, "Solo SUPERADMIN puede administrar empresas")


@router.get("/", response_model=List[EmpresaOut], summary="Listar empresas [SUPERADMIN]")
def listar(
    incluir_inactivas: bool = True,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_usuario_actual),
):
    _validar_superadmin(actual)
    q = db.query(Empresa)
    if not incluir_inactivas:
        q = q.filter_by(activo=True)
    return q.order_by(Empresa.nombre.asc()).all()


@router.post("/", response_model=EmpresaOut, status_code=201, summary="Crear empresa [SUPERADMIN]")
def crear(
    data: EmpresaIn,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_usuario_actual),
):
    _validar_superadmin(actual)
    if db.query(Empresa).filter_by(nombre=data.nombre).first():
        raise HTTPException(400, "Ya existe una empresa con ese nombre")
    empresa = Empresa(**data.model_dump())
    db.add(empresa)
    db.flush()
    db.add(ConfigScheduler(empresa_id=empresa.id))
    log_action(db, "CREATE_COMPANY", email=actual.email, usuario_id=actual.id, empresa_id=empresa.id, detalle=empresa.nombre)
    db.commit()
    db.refresh(empresa)
    return empresa


@router.put("/{empresa_id}", response_model=EmpresaOut, summary="Actualizar empresa [SUPERADMIN]")
def actualizar(
    empresa_id: int,
    data: EmpresaIn,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_usuario_actual),
):
    _validar_superadmin(actual)
    empresa = db.query(Empresa).filter_by(id=empresa_id).first()
    if not empresa:
        raise HTTPException(404, "Empresa no encontrada")
    repetida = db.query(Empresa).filter(Empresa.nombre == data.nombre, Empresa.id != empresa_id).first()
    if repetida:
        raise HTTPException(400, "Ya existe otra empresa con ese nombre")

    for key, value in data.model_dump().items():
        if key in ("correo_contrasena", "token_whatsapp") and value in (None, ""):
            continue
        setattr(empresa, key, value)

    if not db.query(ConfigScheduler).filter_by(empresa_id=empresa.id).first():
        db.add(ConfigScheduler(empresa_id=empresa.id))

    log_action(db, "UPDATE_COMPANY", email=actual.email, usuario_id=actual.id, empresa_id=empresa.id, detalle=empresa.nombre)
    db.commit()
    db.refresh(empresa)
    return empresa


@router.put("/{empresa_id}/branding", response_model=EmpresaOut, summary="Actualizar branding de empresa [ADMIN]")
def actualizar_branding(
    empresa_id: int,
    data: BrandingUpdateIn,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_usuario_actual),
):
    if actual.rol not in (RolUsuario.SUPERADMIN, RolUsuario.ADMIN):
        raise HTTPException(403, "Se requiere rol ADMIN o superior")
    if actual.rol == RolUsuario.ADMIN and actual.empresa_id != empresa_id:
        raise HTTPException(403, "No puedes modificar la marca de otra empresa")

    empresa = db.query(Empresa).filter_by(id=empresa_id).first()
    if not empresa:
        raise HTTPException(404, "Empresa no encontrada")

    valores = data.model_dump(exclude_unset=True)
    for key, value in valores.items():
        if value is not None:
            setattr(empresa, key, value)

    log_action(db, "UPDATE_BRANDING", email=actual.email, usuario_id=actual.id, empresa_id=empresa.id, detalle=empresa.nombre)
    db.commit()
    db.refresh(empresa)
    return empresa


@router.delete("/{empresa_id}", summary="Desactivar empresa [SUPERADMIN]")
def desactivar(
    empresa_id: int,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_usuario_actual),
):
    _validar_superadmin(actual)
    empresa = db.query(Empresa).filter_by(id=empresa_id).first()
    if not empresa:
        raise HTTPException(404, "Empresa no encontrada")
    empresa.activo = False
    log_action(db, "DEACTIVATE_COMPANY", email=actual.email, usuario_id=actual.id, empresa_id=empresa.id, detalle=empresa.nombre)
    db.commit()
    return {"mensaje": f"Empresa {empresa.nombre} desactivada"}
