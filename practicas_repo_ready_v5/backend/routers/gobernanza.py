"""routers/gobernanza.py — Liberación controlada de procesos almacenados."""
import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import Empresa, LiberacionProcesosLog, MatchOportunidad, RolUsuario, Usuario, get_db
from routers.auth import get_usuario_actual
from utils.audit import log_action

router = APIRouter(prefix="/gobernanza", tags=["Gobernanza"])


class LiberarProcesosIn(BaseModel):
    empresa_id:      Optional[int] = None
    antes_de:        Optional[str] = None
    score_maximo:    Optional[float] = None
    servicio:        Optional[str] = None
    departamento:    Optional[str] = None
    confirmar:       bool = False


def _resolver_empresa_id(db: Session, actual: Usuario, empresa_id: Optional[int]) -> int:
    if actual.rol == RolUsuario.SUPERADMIN:
        eid = empresa_id or actual.empresa_id
        if not eid:
            raise HTTPException(400, "Debe seleccionar una empresa")
        if not db.query(Empresa).filter_by(id=eid).first():
            raise HTTPException(404, "Empresa no encontrada")
        return eid
    if actual.rol != RolUsuario.ADMIN:
        raise HTTPException(403, "Se requiere rol ADMIN o superior")
    if not actual.empresa_id:
        raise HTTPException(400, "El usuario no tiene empresa asociada")
    return actual.empresa_id


def _aplicar_filtros(q, data: LiberarProcesosIn):
    if data.antes_de:
        try:
            fecha = datetime.strptime(data.antes_de, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(400, "El campo antes_de debe tener formato YYYY-MM-DD")
        q = q.filter(MatchOportunidad.fecha_descubrimiento < fecha)
    if data.score_maximo is not None:
        q = q.filter(MatchOportunidad.score_ia <= data.score_maximo)
    if data.servicio:
        q = q.filter(MatchOportunidad.servicio_relacionado.ilike(f"%{data.servicio}%"))
    if data.departamento:
        q = q.filter(MatchOportunidad.departamento.ilike(f"%{data.departamento}%"))
    return q


@router.post("/procesos/previsualizar", summary="Previsualizar procesos a liberar [ADMIN]")
def previsualizar(
    data: LiberarProcesosIn,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_usuario_actual),
):
    eid = _resolver_empresa_id(db, actual, data.empresa_id)
    base = db.query(MatchOportunidad).filter_by(empresa_id=eid)
    departamentos = (
        base.with_entities(MatchOportunidad.departamento)
        .filter(MatchOportunidad.departamento.isnot(None))
        .distinct()
        .order_by(MatchOportunidad.departamento.asc())
        .all()
    )
    q = _aplicar_filtros(db.query(MatchOportunidad).filter_by(empresa_id=eid), data)
    total = q.count()
    muestras = q.order_by(MatchOportunidad.fecha_descubrimiento.asc()).limit(10).all()
    return {
        "empresa_id": eid,
        "total": total,
        "departamentos": sorted([d[0] for d in departamentos if d[0]]),
        "muestras": [
            {
                "id": item.id,
                "id_proceso_secop": item.id_proceso_secop,
                "entidad_publica": item.entidad_publica,
                "servicio_relacionado": item.servicio_relacionado,
                "departamento": item.departamento,
                "ciudad": item.ciudad,
                "score_ia": item.score_ia,
                "fecha_descubrimiento": item.fecha_descubrimiento.isoformat() if item.fecha_descubrimiento else None,
            }
            for item in muestras
        ],
    }


@router.post("/procesos/liberar", summary="Eliminar procesos filtrados [ADMIN]")
def liberar(
    data: LiberarProcesosIn,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_usuario_actual),
):
    if not data.confirmar:
        raise HTTPException(400, "Debe enviar confirmar=true para eliminar información")

    eid = _resolver_empresa_id(db, actual, data.empresa_id)
    q = _aplicar_filtros(db.query(MatchOportunidad).filter_by(empresa_id=eid), data)
    total = q.count()

    filtros = data.model_dump()
    q.delete(synchronize_session=False)
    db.add(LiberacionProcesosLog(
        empresa_id=eid,
        usuario_id=actual.id,
        email=actual.email,
        filtros=json.dumps(filtros, ensure_ascii=False),
        registros_eliminados=total,
    ))
    log_action(
        db,
        "DELETE_PROCESSES",
        email=actual.email,
        usuario_id=actual.id,
        empresa_id=eid,
        detalle=f"Registros eliminados: {total} | filtros={filtros}",
    )
    db.commit()
    return {"mensaje": "Procesos eliminados correctamente", "registros_eliminados": total, "empresa_id": eid}
