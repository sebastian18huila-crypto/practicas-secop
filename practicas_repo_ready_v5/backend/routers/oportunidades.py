"""routers/oportunidades.py — Oportunidades SECOP matcheadas por empresa."""
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import MatchOportunidad, RolUsuario, Usuario, get_db
from routers.auth import get_usuario_actual

router = APIRouter(prefix="/oportunidades", tags=["Oportunidades"])


class OportunidadOut(BaseModel):
    id:                     int
    empresa_id:             int
    id_proceso_secop:       str
    entidad_publica:        str
    departamento:           Optional[str]
    ciudad:                 Optional[str]
    descripcion_licitacion: str
    servicio_relacionado:   str
    score_ia:               float
    fecha_limite:           str
    modalidad:              Optional[str]
    valor_estimado:         Optional[str]
    fecha_descubrimiento:   str
    estado_notificacion:    str


def _filtrar_empresa(q, actual: Usuario, empresa_id: Optional[int]):
    if actual.rol == RolUsuario.SUPERADMIN:
        if not empresa_id:
            raise HTTPException(400, "Debe seleccionar una empresa")
        return q.filter(MatchOportunidad.empresa_id == empresa_id)
    return q.filter(MatchOportunidad.empresa_id == actual.empresa_id)


def _parse_fecha(valor: Optional[str], campo: str) -> Optional[datetime]:
    if not valor:
        return None
    try:
        return datetime.strptime(valor, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(400, f"El campo {campo} debe tener formato YYYY-MM-DD")


@router.get("/", response_model=List[OportunidadOut], summary="Listar oportunidades")
def listar(
    servicio:     Optional[str] = Query(None),
    departamento: Optional[str] = Query(None),
    score_minimo: float = Query(0.0, ge=0.0, le=1.0),
    empresa_id:   Optional[int] = Query(None),
    fecha_desde:  Optional[str] = Query(None),
    fecha_hasta:  Optional[str] = Query(None),
    limite:       int   = Query(50, ge=1, le=500),
    offset:       int   = Query(0, ge=0),
    db: Session = Depends(get_db),
    actual: Usuario  = Depends(get_usuario_actual),
):
    q = _filtrar_empresa(db.query(MatchOportunidad), actual, empresa_id)
    if servicio:
        q = q.filter(MatchOportunidad.servicio_relacionado.ilike(f"%{servicio}%"))
    if departamento:
        q = q.filter(MatchOportunidad.departamento.ilike(f"%{departamento}%"))
    if score_minimo > 0:
        q = q.filter(MatchOportunidad.score_ia >= score_minimo)

    fd = _parse_fecha(fecha_desde, "fecha_desde")
    fh = _parse_fecha(fecha_hasta, "fecha_hasta")
    if fd:
        q = q.filter(MatchOportunidad.fecha_descubrimiento >= fd)
    if fh:
        q = q.filter(MatchOportunidad.fecha_descubrimiento < fh + timedelta(days=1))

    items = (
        q.order_by(MatchOportunidad.score_ia.desc(), MatchOportunidad.fecha_descubrimiento.desc())
        .offset(offset)
        .limit(limite)
        .all()
    )
    return [
        OportunidadOut(
            id=o.id,
            empresa_id=o.empresa_id,
            id_proceso_secop=o.id_proceso_secop,
            entidad_publica=o.entidad_publica,
            departamento=o.departamento,
            ciudad=o.ciudad,
            descripcion_licitacion=o.descripcion_licitacion,
            servicio_relacionado=o.servicio_relacionado,
            score_ia=o.score_ia,
            fecha_limite=o.fecha_limite,
            modalidad=o.modalidad,
            valor_estimado=o.valor_estimado,
            fecha_descubrimiento=(o.fecha_descubrimiento.strftime("%Y-%m-%d %H:%M") if o.fecha_descubrimiento else ""),
            estado_notificacion=str(o.estado_notificacion.value if hasattr(o.estado_notificacion, "value") else o.estado_notificacion),
        )
        for o in items
    ]


@router.get("/estadisticas", summary="Estadísticas del dashboard")
def estadisticas(
    empresa_id: Optional[int] = Query(None),
    fecha_desde: Optional[str] = Query(None),
    fecha_hasta: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    actual: Usuario  = Depends(get_usuario_actual),
):
    q = _filtrar_empresa(db.query(MatchOportunidad), actual, empresa_id)
    fd = _parse_fecha(fecha_desde, "fecha_desde")
    fh = _parse_fecha(fecha_hasta, "fecha_hasta")
    if fd:
        q = q.filter(MatchOportunidad.fecha_descubrimiento >= fd)
    if fh:
        q = q.filter(MatchOportunidad.fecha_descubrimiento < fh + timedelta(days=1))
    total = q.count()
    alta  = q.filter(MatchOportunidad.score_ia >= 0.75).count()
    media = q.filter(MatchOportunidad.score_ia >= 0.60, MatchOportunidad.score_ia < 0.75).count()
    baja  = q.filter(MatchOportunidad.score_ia < 0.60).count()

    q_scope = _filtrar_empresa(db.query(MatchOportunidad), actual, empresa_id)
    if fd:
        q_scope = q_scope.filter(MatchOportunidad.fecha_descubrimiento >= fd)
    if fh:
        q_scope = q_scope.filter(MatchOportunidad.fecha_descubrimiento < fh + timedelta(days=1))
    deptos = (
        q_scope.with_entities(MatchOportunidad.departamento)
        .filter(MatchOportunidad.departamento.isnot(None))
        .distinct().limit(60).all()
    )
    q_servicios = _filtrar_empresa(db.query(MatchOportunidad), actual, empresa_id)
    if fd:
        q_servicios = q_servicios.filter(MatchOportunidad.fecha_descubrimiento >= fd)
    if fh:
        q_servicios = q_servicios.filter(MatchOportunidad.fecha_descubrimiento < fh + timedelta(days=1))
    servicios_u = (
        q_servicios.with_entities(MatchOportunidad.servicio_relacionado)
        .distinct().limit(50).all()
    )
    return {
        "total":           total,
        "alta_prioridad":  alta,
        "media_prioridad": media,
        "baja_prioridad":  baja,
        "departamentos":   sorted([d[0] for d in deptos if d[0]]),
        "servicios":       sorted([s[0] for s in servicios_u if s[0]]),
    }
