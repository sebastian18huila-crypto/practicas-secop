"""
utils/permissions.py — Sistema de permisos basado en roles.

Roles y capacidades:
  SUPERADMIN → Todo
  ADMIN      → Gestión empresa (servicios, usuarios, config, scan)
  ANALISTA   → Ver oportunidades, buscar, ejecutar scan, exportar
  VIEWER     → Solo lectura de oportunidades
"""
from functools import wraps
from typing import Callable

from fastapi import Depends, HTTPException, status

from database import RolUsuario, Usuario


# ── Dependencias de FastAPI ────────────────────────────────────────────────────

def require_roles(*roles: RolUsuario) -> Callable:
    """Genera una dependencia que valida que el usuario tenga uno de los roles."""
    from routers.auth import get_usuario_actual

    async def checker(usuario: Usuario = Depends(get_usuario_actual)) -> Usuario:
        if usuario.rol not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permiso denegado. Roles requeridos: {[r.value for r in roles]}",
            )
        return usuario

    return checker


# Atajos listos para usar en los routers
require_superadmin = require_roles(RolUsuario.SUPERADMIN)
require_admin      = require_roles(RolUsuario.SUPERADMIN, RolUsuario.ADMIN)
require_analista   = require_roles(RolUsuario.SUPERADMIN, RolUsuario.ADMIN, RolUsuario.ANALISTA)
require_viewer     = require_roles(
    RolUsuario.SUPERADMIN, RolUsuario.ADMIN, RolUsuario.ANALISTA, RolUsuario.VIEWER
)


# ── Matriz de permisos ────────────────────────────────────────────────────────
PERMISOS = {
    "ver_oportunidades":     [RolUsuario.SUPERADMIN, RolUsuario.ADMIN, RolUsuario.ANALISTA, RolUsuario.VIEWER],
    "exportar_excel":        [RolUsuario.SUPERADMIN, RolUsuario.ADMIN, RolUsuario.ANALISTA],
    "ejecutar_scan":         [RolUsuario.SUPERADMIN, RolUsuario.ADMIN, RolUsuario.ANALISTA],
    "buscar_secop":          [RolUsuario.SUPERADMIN, RolUsuario.ADMIN, RolUsuario.ANALISTA, RolUsuario.VIEWER],
    "gestionar_servicios":   [RolUsuario.SUPERADMIN, RolUsuario.ADMIN],
    "gestionar_usuarios":    [RolUsuario.SUPERADMIN, RolUsuario.ADMIN],
    "ver_audit_log":         [RolUsuario.SUPERADMIN, RolUsuario.ADMIN],
    "configurar_scheduler":  [RolUsuario.SUPERADMIN, RolUsuario.ADMIN],
    "gestionar_branding":    [RolUsuario.SUPERADMIN, RolUsuario.ADMIN],
    "gestionar_empresas":    [RolUsuario.SUPERADMIN],
    "liberar_procesos":      [RolUsuario.SUPERADMIN, RolUsuario.ADMIN],
}


def tiene_permiso(usuario: Usuario, permiso: str) -> bool:
    roles_permitidos = PERMISOS.get(permiso, [])
    return usuario.rol in roles_permitidos
