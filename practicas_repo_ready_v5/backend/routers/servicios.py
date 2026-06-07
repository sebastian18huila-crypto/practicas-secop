"""routers/servicios.py — CRUD del catálogo de servicios por empresa [ADMIN+]."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import Empresa, RolUsuario, ServicioCatalogo, Usuario, get_db
from routers.auth import get_usuario_actual
from utils.audit import log_action

router = APIRouter(prefix="/servicios", tags=["Catálogo de Servicios"])

CATEGORIAS_SECOP = [
    "Agricultura, pesca, silvicultura y fauna",
    "Alimentos, bebidas y tabaco",
    "Animales vivos y productos animales",
    "Combustibles, lubricantes y anticorrosivos",
    "Componentes y suministros de fabricación",
    "Construcción, obras civiles e infraestructura",
    "Consultoría, gestión y servicios profesionales",
    "Defensa, seguridad y vigilancia",
    "Deportes, recreación y cultura",
    "Educación, formación y capacitación",
    "Equipos, suministros y accesorios de oficina",
    "Equipos y suministros de laboratorio y medición",
    "Equipos y suministros médicos, odontológicos y hospitalarios",
    "Ferretería, herramientas y maquinaria",
    "Gestión ambiental, aseo y saneamiento básico",
    "Impresos, publicaciones y material promocional",
    "Mantenimiento, reparación e instalación",
    "Materiales de construcción y estructuras",
    "Muebles, mobiliario y dotación",
    "Productos químicos y farmacéuticos",
    "Ropa, calzado, elementos de protección y textiles",
    "Salud, servicios sociales y asistenciales",
    "Servicios administrativos y de apoyo",
    "Servicios de alimentación y catering",
    "Servicios de arquitectura, ingeniería e interventoría",
    "Servicios de transporte, logística y almacenamiento",
    "Servicios financieros, seguros y fiduciarios",
    "Servicios públicos y energía",
    "Tecnologías de la información y telecomunicaciones",
    "Vehículos, repuestos y equipos de transporte",
    "Viajes, hotelería y eventos",
]


class ServicioIn(BaseModel):
    empresa_id:       Optional[int] = None
    nombre_servicio:  str
    descripcion:      Optional[str] = None
    categoria:        Optional[str] = None


class ServicioOut(BaseModel):
    id:              int
    empresa_id:      int
    nombre_servicio: str
    descripcion:     Optional[str]
    categoria:       Optional[str]
    activo:          bool
    creado_por:      Optional[str]

    class Config:
        from_attributes = True


def _empresa_id_para_consulta(db: Session, actual: Usuario, empresa_id: Optional[int]) -> int:
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


@router.get("/", response_model=List[ServicioOut], summary="Listar servicios")
def listar(
    solo_activos: bool = True,
    categoria: Optional[str] = None,
    empresa_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_usuario_actual),
):
    eid = _empresa_id_para_consulta(db, actual, empresa_id)
    q = db.query(ServicioCatalogo).filter_by(empresa_id=eid)
    if solo_activos:
        q = q.filter_by(activo=True)
    if categoria:
        q = q.filter_by(categoria=categoria)
    return q.order_by(ServicioCatalogo.id).all()


@router.get("/categorias-disponibles", summary="Categorías SECOP disponibles")
def categorias_disponibles(
    actual: Usuario = Depends(get_usuario_actual),
):
    return CATEGORIAS_SECOP


@router.get("/categorias", summary="Categorías registradas por empresa")
def categorias(
    empresa_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_usuario_actual),
):
    eid = _empresa_id_para_consulta(db, actual, empresa_id)
    cats = (
        db.query(ServicioCatalogo.categoria)
        .filter(ServicioCatalogo.empresa_id == eid)
        .filter(ServicioCatalogo.activo == True)
        .filter(ServicioCatalogo.categoria.isnot(None))
        .distinct()
        .all()
    )
    return sorted([c[0] for c in cats if c[0]])


@router.post("/", response_model=ServicioOut, status_code=201, summary="Crear servicio [ADMIN]")
def crear(
    data: ServicioIn,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_usuario_actual),
):
    if actual.rol not in (RolUsuario.SUPERADMIN, RolUsuario.ADMIN):
        raise HTTPException(403, "Se requiere rol ADMIN o superior")
    eid = _empresa_id_para_consulta(db, actual, data.empresa_id)
    if db.query(ServicioCatalogo).filter_by(
        empresa_id=eid,
        nombre_servicio=data.nombre_servicio,
        activo=True,
    ).first():
        raise HTTPException(400, "Ya existe un servicio con ese nombre para la empresa")
    nuevo = ServicioCatalogo(
        empresa_id=eid,
        nombre_servicio=data.nombre_servicio,
        descripcion=data.descripcion,
        categoria=data.categoria,
        creado_por=actual.email,
    )
    db.add(nuevo)
    log_action(db, "CREATE_SERVICE", email=actual.email, usuario_id=actual.id, empresa_id=eid, detalle=f"Servicio: {data.nombre_servicio}")
    db.commit()
    db.refresh(nuevo)
    return nuevo


@router.put("/{sid}", response_model=ServicioOut, summary="Editar servicio [ADMIN]")
def editar(
    sid: int,
    data: ServicioIn,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_usuario_actual),
):
    if actual.rol not in (RolUsuario.SUPERADMIN, RolUsuario.ADMIN):
        raise HTTPException(403, "Se requiere rol ADMIN o superior")
    svc = db.query(ServicioCatalogo).filter_by(id=sid).first()
    if not svc:
        raise HTTPException(404, "Servicio no encontrado")
    eid = _empresa_id_para_consulta(db, actual, data.empresa_id or svc.empresa_id)
    if svc.empresa_id != eid:
        raise HTTPException(403, "No puedes editar servicios de otra empresa")

    svc.nombre_servicio = data.nombre_servicio
    svc.descripcion     = data.descripcion
    svc.categoria       = data.categoria
    log_action(db, "UPDATE_SERVICE", email=actual.email, usuario_id=actual.id, empresa_id=eid, detalle=f"ID {sid}")
    db.commit()
    db.refresh(svc)
    return svc


@router.delete("/{sid}", summary="Eliminar servicio [ADMIN]")
def eliminar(
    sid: int,
    empresa_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_usuario_actual),
):
    if actual.rol not in (RolUsuario.SUPERADMIN, RolUsuario.ADMIN):
        raise HTTPException(403, "Se requiere rol ADMIN o superior")
    svc = db.query(ServicioCatalogo).filter_by(id=sid).first()
    if not svc:
        raise HTTPException(404, "Servicio no encontrado")
    eid = _empresa_id_para_consulta(db, actual, empresa_id or svc.empresa_id)
    if svc.empresa_id != eid:
        raise HTTPException(403, "No puedes eliminar servicios de otra empresa")

    svc.activo = False
    log_action(db, "DELETE_SERVICE", email=actual.email, usuario_id=actual.id, empresa_id=eid, detalle=f"Servicio: {svc.nombre_servicio}")
    db.commit()
    return {"mensaje": f"Servicio '{svc.nombre_servicio}' eliminado"}
