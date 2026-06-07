"""routers/notificaciones.py — Destinatarios de correo y WhatsApp por empresa."""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, model_validator
from sqlalchemy.orm import Session

from database import DestinatarioNotificacion, Empresa, RolUsuario, Usuario, get_db
from routers.auth import get_usuario_actual
from utils.audit import log_action

router = APIRouter(prefix="/notificaciones", tags=["Notificaciones"])


class DestinatarioIn(BaseModel):
    empresa_id:        Optional[int] = None
    nombre:            str
    email:             Optional[EmailStr] = None
    telefono_whatsapp: Optional[str] = None
    recibe_email:      bool = True
    recibe_whatsapp:   bool = False
    activo:            bool = True

    @model_validator(mode="after")
    def validar_destino(self):
        if self.recibe_email and not self.email:
            raise ValueError("Debe registrar email cuando recibe_email está activo")
        if self.recibe_whatsapp and not self.telefono_whatsapp:
            raise ValueError("Debe registrar teléfono cuando recibe_whatsapp está activo")
        return self


class DestinatarioOut(BaseModel):
    id:                int
    empresa_id:        int
    nombre:            str
    email:             Optional[str]
    telefono_whatsapp: Optional[str]
    recibe_email:      bool
    recibe_whatsapp:   bool
    activo:            bool
    creado_en:         datetime
    creado_por:        Optional[str]

    class Config:
        from_attributes = True


def _resolver_empresa_id(db: Session, actual: Usuario, empresa_id: Optional[int]) -> int:
    if actual.rol == RolUsuario.SUPERADMIN:
        if not empresa_id:
            if actual.empresa_id:
                return actual.empresa_id
            raise HTTPException(400, "Debe seleccionar una empresa")
        if not db.query(Empresa).filter_by(id=empresa_id, activo=True).first():
            raise HTTPException(404, "Empresa no encontrada")
        return empresa_id
    if actual.rol != RolUsuario.ADMIN:
        raise HTTPException(403, "Se requiere rol ADMIN o superior")
    if not actual.empresa_id:
        raise HTTPException(400, "El usuario no tiene empresa asociada")
    return actual.empresa_id


@router.get("/", response_model=List[DestinatarioOut], summary="Listar destinatarios [ADMIN]")
def listar(
    empresa_id: Optional[int] = Query(None),
    incluir_inactivos: bool = True,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_usuario_actual),
):
    eid = _resolver_empresa_id(db, actual, empresa_id)
    q = db.query(DestinatarioNotificacion).filter_by(empresa_id=eid)
    if not incluir_inactivos:
        q = q.filter_by(activo=True)
    return q.order_by(DestinatarioNotificacion.creado_en.desc()).all()


@router.post("/", response_model=DestinatarioOut, status_code=201, summary="Crear destinatario [ADMIN]")
def crear(
    data: DestinatarioIn,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_usuario_actual),
):
    eid = _resolver_empresa_id(db, actual, data.empresa_id)
    destinatario = DestinatarioNotificacion(
        empresa_id=eid,
        nombre=data.nombre,
        email=str(data.email) if data.email else None,
        telefono_whatsapp=data.telefono_whatsapp,
        recibe_email=data.recibe_email,
        recibe_whatsapp=data.recibe_whatsapp,
        activo=data.activo,
        creado_por=actual.email,
    )
    db.add(destinatario)
    log_action(db, "CREATE_RECIPIENT", email=actual.email, usuario_id=actual.id, empresa_id=eid, detalle=data.nombre)
    db.commit()
    db.refresh(destinatario)
    return destinatario


@router.put("/{destinatario_id}", response_model=DestinatarioOut, summary="Actualizar destinatario [ADMIN]")
def actualizar(
    destinatario_id: int,
    data: DestinatarioIn,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_usuario_actual),
):
    destinatario = db.query(DestinatarioNotificacion).filter_by(id=destinatario_id).first()
    if not destinatario:
        raise HTTPException(404, "Destinatario no encontrado")
    eid = _resolver_empresa_id(db, actual, data.empresa_id or destinatario.empresa_id)
    if destinatario.empresa_id != eid:
        raise HTTPException(403, "No puedes modificar destinatarios de otra empresa")

    destinatario.nombre = data.nombre
    destinatario.email = str(data.email) if data.email else None
    destinatario.telefono_whatsapp = data.telefono_whatsapp
    destinatario.recibe_email = data.recibe_email
    destinatario.recibe_whatsapp = data.recibe_whatsapp
    destinatario.activo = data.activo

    log_action(db, "UPDATE_RECIPIENT", email=actual.email, usuario_id=actual.id, empresa_id=eid, detalle=data.nombre)
    db.commit()
    db.refresh(destinatario)
    return destinatario


@router.delete("/{destinatario_id}", summary="Desactivar destinatario [ADMIN]")
def desactivar(
    destinatario_id: int,
    empresa_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_usuario_actual),
):
    destinatario = db.query(DestinatarioNotificacion).filter_by(id=destinatario_id).first()
    if not destinatario:
        raise HTTPException(404, "Destinatario no encontrado")
    eid = _resolver_empresa_id(db, actual, empresa_id or destinatario.empresa_id)
    if destinatario.empresa_id != eid:
        raise HTTPException(403, "No puedes modificar destinatarios de otra empresa")

    destinatario.activo = False
    log_action(db, "DEACTIVATE_RECIPIENT", email=actual.email, usuario_id=actual.id, empresa_id=eid, detalle=destinatario.nombre)
    db.commit()
    return {"mensaje": f"Destinatario {destinatario.nombre} desactivado"}
