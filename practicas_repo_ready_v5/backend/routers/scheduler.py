"""routers/scheduler.py — Configuración del scheduler y disparo manual por empresa."""
import threading
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import ConfigScheduler, Empresa, RolUsuario, Usuario, get_db
from routers.auth import get_usuario_actual
from utils.audit import log_action

router = APIRouter(prefix="/scheduler", tags=["Scheduler"])

SCAN_STATUS: dict[int, dict] = {}


class SchedulerConfigIn(BaseModel):
    empresa_id:    Optional[int] = None
    hora_manana:   str
    hora_tarde:    str
    activo:        bool
    umbral_ia:     float
    filtro_depto:  Optional[str] = None


def _resolver_empresa_id(db: Session, actual: Usuario, empresa_id: Optional[int]) -> int:
    if actual.rol == RolUsuario.SUPERADMIN:
        eid = empresa_id or actual.empresa_id
        if not eid:
            raise HTTPException(400, "Debe seleccionar una empresa")
        if not db.query(Empresa).filter_by(id=eid, activo=True).first():
            raise HTTPException(404, "Empresa no encontrada")
        return eid
    if not actual.empresa_id:
        raise HTTPException(400, "El usuario no tiene empresa asociada")
    return actual.empresa_id


def _validar_fecha(valor: Optional[str], campo: str) -> Optional[str]:
    if not valor:
        return None
    try:
        datetime.strptime(valor, "%Y-%m-%d")
        return valor
    except ValueError:
        raise HTTPException(400, f"El campo {campo} debe tener formato YYYY-MM-DD")


def _get_or_create_config(db: Session, empresa_id: int) -> ConfigScheduler:
    cfg = db.query(ConfigScheduler).filter_by(empresa_id=empresa_id).first()
    if not cfg:
        cfg = ConfigScheduler(empresa_id=empresa_id)
        db.add(cfg)
        db.flush()
    return cfg


def _scan_worker(empresa_id: int, fecha_desde: Optional[str], fecha_hasta: Optional[str], departamento: Optional[str]) -> None:
    SCAN_STATUS[empresa_id] = {
        "estado": "RUNNING",
        "mensaje": "Escaneo en ejecución. La información se actualizará al finalizar.",
        "empresa_id": empresa_id,
        "iniciado_en": datetime.now().isoformat(timespec="seconds"),
        "finalizado_en": None,
    }
    try:
        from pipeline import ejecutar_pipeline
        ejecutar_pipeline(
            empresa_id=empresa_id,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            departamento=departamento,
        )
        SCAN_STATUS[empresa_id].update({
            "estado": "COMPLETED",
            "mensaje": "Escaneo finalizado. Información actualizada.",
            "finalizado_en": datetime.now().isoformat(timespec="seconds"),
        })
    except Exception as e:
        SCAN_STATUS[empresa_id].update({
            "estado": "ERROR",
            "mensaje": f"Error durante el escaneo: {e}",
            "finalizado_en": datetime.now().isoformat(timespec="seconds"),
        })


@router.get("/config", summary="Obtener configuración del scheduler")
def get_config(
    empresa_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_usuario_actual),
):
    eid = _resolver_empresa_id(db, actual, empresa_id)
    cfg = _get_or_create_config(db, eid)
    db.commit()
    return {
        "empresa_id":    cfg.empresa_id,
        "hora_manana":   cfg.hora_manana,
        "hora_tarde":    cfg.hora_tarde,
        "activo":        cfg.activo,
        "umbral_ia":     cfg.umbral_ia,
        "filtro_depto":  cfg.filtro_depto,
    }


@router.put("/config", summary="Actualizar configuración [ADMIN]")
def update_config(
    data: SchedulerConfigIn,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_usuario_actual),
):
    if actual.rol not in (RolUsuario.SUPERADMIN, RolUsuario.ADMIN):
        raise HTTPException(403, "Se requiere rol ADMIN o superior")
    eid = _resolver_empresa_id(db, actual, data.empresa_id)
    cfg = _get_or_create_config(db, eid)
    cfg.hora_manana  = data.hora_manana
    cfg.hora_tarde   = data.hora_tarde
    cfg.activo       = data.activo
    cfg.umbral_ia    = data.umbral_ia
    cfg.filtro_depto = data.filtro_depto
    log_action(db, "UPDATE_SCHEDULER", email=actual.email, usuario_id=actual.id, empresa_id=eid, detalle=f"umbral={data.umbral_ia}, activo={data.activo}")
    db.commit()
    return {"mensaje": "Configuración guardada correctamente"}


@router.post("/ejecutar-ahora", summary="Ejecutar scan manual [ANALISTA+]")
def ejecutar_ahora(
    empresa_id: Optional[int] = Query(None),
    fecha_desde: Optional[str] = Query(None),
    fecha_hasta: Optional[str] = Query(None),
    departamento: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_usuario_actual),
):
    if actual.rol not in (RolUsuario.SUPERADMIN, RolUsuario.ADMIN, RolUsuario.ANALISTA):
        raise HTTPException(403, "Se requiere rol ANALISTA o superior")
    eid = _resolver_empresa_id(db, actual, empresa_id)
    fd = _validar_fecha(fecha_desde, "fecha_desde")
    fh = _validar_fecha(fecha_hasta, "fecha_hasta")
    if fd and fh and fd > fh:
        raise HTTPException(400, "La fecha desde no puede ser mayor a la fecha hasta")
    if SCAN_STATUS.get(eid, {}).get("estado") == "RUNNING":
        return {
            "mensaje": "Ya existe un escaneo en ejecución para la empresa seleccionada.",
            "estado": "RUNNING",
            "empresa_id": eid,
        }

    hilo = threading.Thread(
        target=_scan_worker,
        kwargs={
            "empresa_id": eid,
            "fecha_desde": fd,
            "fecha_hasta": fh,
            "departamento": departamento.strip() if departamento and departamento.strip() else None,
        },
        daemon=True,
    )
    hilo.start()
    log_action(
        db,
        "MANUAL_SCAN",
        email=actual.email,
        usuario_id=actual.id,
        empresa_id=eid,
        detalle=f"fecha_desde={fd or ''}, fecha_hasta={fh or ''}, departamento={departamento or ''}",
    )
    db.commit()
    return {
        "mensaje": "Escaneo iniciado para la empresa seleccionada.",
        "estado": "RUNNING",
        "empresa_id": eid,
    }


@router.get("/estado", summary="Estado del último scan manual")
def estado_scan(
    empresa_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_usuario_actual),
):
    eid = _resolver_empresa_id(db, actual, empresa_id)
    return SCAN_STATUS.get(eid, {
        "estado": "IDLE",
        "mensaje": "Sin escaneo en ejecución.",
        "empresa_id": eid,
        "iniciado_en": None,
        "finalizado_en": None,
    })
