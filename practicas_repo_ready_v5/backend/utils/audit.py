"""utils/audit.py — Helper para registrar acciones de auditoría."""
from sqlalchemy.orm import Session
from database import AuditLog


def log_action(
    db: Session,
    accion: str,
    email: str = None,
    usuario_id: int = None,
    empresa_id: int = None,
    detalle: str = None,
    ip: str = None,
) -> None:
    try:
        db.add(AuditLog(
            empresa_id=empresa_id,
            usuario_id=usuario_id,
            email=email,
            accion=accion,
            detalle=detalle,
            ip=ip,
        ))
        db.flush()
    except Exception as e:
        print(f"[Audit] Error registrando acción {accion}: {e}")
