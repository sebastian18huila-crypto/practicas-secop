"""
routers/secop_search.py — Búsqueda directa en SECOP II por palabras clave.
Los resultados NO se guardan en BD. Es un buscador en tiempo real.
"""
import re
from datetime import datetime
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import settings
from database import Empresa, RolUsuario, ServicioCatalogo, Usuario, get_db
from routers.auth import get_usuario_actual

router = APIRouter(prefix="/secop-search", tags=["Búsqueda SECOP"])

SECOP_URLS = [
    "https://www.datos.gov.co/resource/p6dx-8zbt.json",
    "https://www.datos.gov.co/resource/jbjy-vk9h.json",
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; PracticasSecopBot/2.0)",
}
if settings.SECOP_APP_TOKEN:
    HEADERS["X-App-Token"] = settings.SECOP_APP_TOKEN

SAFE_SEARCH_RE = re.compile(r"[^0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s\-_/\.]")

FECHA_COLUMNAS = [
    "fecha_de_apertura_efectiva",
    "fecha_de_apertura_de_respuesta",
    "fecha_de_recepcion_de",
    "fecha_de_presentacion_de_ofertas",
]

# ── Schemas ───────────────────────────────────────────────────────────────────
class ResultadoBusqueda(BaseModel):
    id_proceso:    str
    titulo:        str
    entidad:       str
    departamento:  Optional[str]
    ciudad:        Optional[str]
    descripcion:   str
    fecha_cierre:  Optional[str]
    modalidad:     Optional[str]
    valor:         Optional[str]
    url_secop:     str


# ── Helpers ───────────────────────────────────────────────────────────────────
def _resolver_empresa_id(db: Session, actual: Usuario, empresa_id: Optional[int]) -> int:
    if actual.rol == RolUsuario.SUPERADMIN:
        if not empresa_id:
            raise HTTPException(400, "Debe seleccionar una empresa")
        if not db.query(Empresa).filter_by(id=empresa_id, activo=True).first():
            raise HTTPException(404, "Empresa no encontrada")
        return empresa_id
    if not actual.empresa_id:
        raise HTTPException(400, "El usuario no tiene empresa asociada")
    return actual.empresa_id



def _limpiar_texto_busqueda(valor: str) -> str:
    limpio = SAFE_SEARCH_RE.sub(" ", valor or "")
    limpio = re.sub(r"\s+", " ", limpio).strip()
    if len(limpio) < 3:
        raise HTTPException(400, "La búsqueda debe tener al menos 3 caracteres válidos")
    return limpio[:80]

def _validar_fecha(valor: Optional[str], campo: str) -> Optional[str]:
    if not valor:
        return None
    try:
        datetime.strptime(valor, "%Y-%m-%d")
        return valor
    except ValueError:
        raise HTTPException(400, f"El campo {campo} debe tener formato YYYY-MM-DD")


def _fecha_registro(r: dict) -> Optional[str]:
    for col in FECHA_COLUMNAS:
        valor = r.get(col)
        if valor and str(valor).lower() not in ("nan", "none", ""):
            return str(valor).split("T")[0]
    return None


def _cumple_rango_fecha(r: dict, fecha_desde: Optional[str], fecha_hasta: Optional[str]) -> bool:
    fecha = _fecha_registro(r)
    if not fecha:
        return not fecha_desde and not fecha_hasta
    if fecha_desde and fecha < fecha_desde:
        return False
    if fecha_hasta and fecha > fecha_hasta:
        return False
    return True


def _normalizar_registro(r: dict, url_base: str) -> ResultadoBusqueda:
    """Normaliza un registro de SECOP a esquema común."""
    if "descripci_n_del_procedimiento" in r or "nombre_del_procedimiento" in r:
        id_proc    = r.get("id_del_proceso", r.get("proceso_de_compra", ""))
        titulo     = r.get("nombre_del_procedimiento", "")
        descripcion= r.get("descripci_n_del_procedimiento", r.get("descripcion_del_procedimiento", ""))
        fecha      = r.get("fecha_de_apertura_efectiva", r.get("fecha_de_recepcion_de", ""))
        modalidad  = r.get("modalidad_de_contratacion", "")
        valor      = r.get("precio_base", r.get("valor_total_adjudicacion", ""))
    else:
        id_proc    = r.get("id_del_proceso", "")
        titulo     = r.get("nombre_del_proceso", "")
        descripcion= r.get("descripcion_del_proceso", "")
        fecha      = r.get("fecha_de_presentacion_de_ofertas", "")
        modalidad  = r.get("modalidad_de_contratacion", "")
        valor      = r.get("precio_base", "")

    if fecha and "T" in str(fecha):
        fecha = str(fecha).split("T")[0]

    url_secop = (
        f"https://community.secop.gov.co/Public/Tendering/"
        f"ContractNoticeManagement/Index?currentLanguage=es-CO&id={id_proc}"
    )

    return ResultadoBusqueda(
        id_proceso   = str(id_proc),
        titulo       = str(titulo),
        entidad      = str(r.get("entidad", "")),
        departamento = r.get("departamento_entidad"),
        ciudad       = r.get("ciudad_entidad"),
        descripcion  = str(descripcion)[:500],
        fecha_cierre = str(fecha) if fecha else None,
        modalidad    = str(modalidad) if modalidad else None,
        valor        = str(valor) if valor and str(valor) not in ("None", "") else None,
        url_secop    = url_secop,
    )


async def _buscar_en_endpoint(
    url: str,
    palabras: str,
    limite: int,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
) -> List[ResultadoBusqueda]:
    """Hace la consulta a un endpoint de SECOP con filtro por texto y rango de fechas."""
    col_desc_opciones = [
        "descripci_n_del_procedimiento",
        "descripcion_del_proceso",
    ]
    col_nombre_opciones = [
        "nombre_del_procedimiento",
        "nombre_del_proceso",
    ]

    resultados = []
    limite_consulta = min(100, max(limite, limite * 5 if (fecha_desde or fecha_hasta) else limite))

    async with httpx.AsyncClient(timeout=25, headers=HEADERS) as client:
        for col_desc, col_nombre in zip(col_desc_opciones, col_nombre_opciones):
            where = (
                f"upper({col_nombre}) like upper('%{palabras}%') OR "
                f"upper({col_desc}) like upper('%{palabras}%')"
            )
            params = {
                "$where": where,
                "$limit": limite_consulta,
                "$order": ":id DESC",
            }
            try:
                resp = await client.get(url, params=params)
                if resp.status_code == 200:
                    data = resp.json()
                    if data:
                        for r in data:
                            if not _cumple_rango_fecha(r, fecha_desde, fecha_hasta):
                                continue
                            try:
                                resultados.append(_normalizar_registro(r, url))
                            except Exception:
                                pass
                        break
            except Exception:
                pass

    return resultados


def _categoria_sugerencia(categoria: Optional[str]) -> str:
    valor = (categoria or "servicios").strip().lower()
    if not valor:
        return "servicios"
    return valor[:40]


# ── Endpoint principal ────────────────────────────────────────────────────────
@router.get(
    "/",
    response_model=List[ResultadoBusqueda],
    summary="Buscar licitaciones por palabras clave [TIEMPO REAL]",
    description="""
Busca licitaciones en SECOP II usando palabras clave.
**Los resultados NO se guardan en base de datos.**
Úsalo para explorar oportunidades fuera del catálogo de servicios.
    """,
)
async def buscar_secop(
    q: str = Query(..., min_length=3, description="Palabras clave de búsqueda"),
    limite: int = Query(default=20, ge=1, le=100),
    empresa_id: Optional[int] = Query(None),
    fecha_desde: Optional[str] = Query(None),
    fecha_hasta: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_usuario_actual),
):
    _resolver_empresa_id(db, actual, empresa_id)
    if not q.strip():
        raise HTTPException(400, "La búsqueda no puede estar vacía")

    fd = _validar_fecha(fecha_desde, "fecha_desde")
    fh = _validar_fecha(fecha_hasta, "fecha_hasta")
    if fd and fh and fd > fh:
        raise HTTPException(400, "La fecha desde no puede ser mayor a la fecha hasta")

    palabras = _limpiar_texto_busqueda(q)
    resultados: List[ResultadoBusqueda] = []

    for url in SECOP_URLS:
        try:
            res = await _buscar_en_endpoint(url, palabras, limite, fd, fh)
            resultados.extend(res)
            if resultados:
                break
        except Exception as e:
            print(f"[Search] Error en {url}: {e}")
            continue

    seen = set()
    unicos = []
    for r in resultados:
        if r.id_proceso not in seen:
            seen.add(r.id_proceso)
            unicos.append(r)

    return unicos[:limite]


@router.get(
    "/sugerencias",
    summary="Términos de búsqueda sugeridos por empresa",
    description="Devuelve términos sugeridos según el catálogo de servicios de la empresa seleccionada.",
)
async def sugerencias(
    empresa_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_usuario_actual),
):
    eid = _resolver_empresa_id(db, actual, empresa_id)
    servicios = (
        db.query(ServicioCatalogo)
        .filter_by(empresa_id=eid, activo=True)
        .order_by(ServicioCatalogo.categoria.asc(), ServicioCatalogo.nombre_servicio.asc())
        .all()
    )

    grupos: dict[str, list[str]] = {}
    for servicio in servicios:
        categoria = _categoria_sugerencia(servicio.categoria)
        grupos.setdefault(categoria, [])
        for termino in [servicio.nombre_servicio, servicio.descripcion]:
            if termino and termino.strip() and termino.strip() not in grupos[categoria]:
                grupos[categoria].append(termino.strip()[:80])
        grupos[categoria] = grupos[categoria][:8]

    return grupos
