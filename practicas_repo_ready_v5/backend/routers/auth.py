"""
routers/auth.py — Autenticación JWT + gestión de usuarios multiempresa.
Endpoints: login, register, forgot-password, reset-password, change-password, me, users, branding
"""
import hashlib
import re
import secrets
import ssl
import smtplib
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.orm import Session

from config import settings
from database import AuditLog, Empresa, PasswordResetToken, RolUsuario, Usuario, get_db
from utils.audit import log_action

router = APIRouter(prefix="/auth", tags=["Autenticación"])
pwd_context  = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

PASSWORD_RE = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,}$")


def _hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _validar_password_segura(password: str) -> str:
    if not PASSWORD_RE.match(password or ""):
        raise ValueError("La contraseña debe tener mínimo 12 caracteres, una mayúscula, una minúscula y un número")
    return password


# ── JWT ───────────────────────────────────────────────────────────────────────
def crear_token(email: str, rol: str, empresa_id: Optional[int]) -> str:
    payload = {
        "sub": email,
        "rol": rol,
        "empresa_id": empresa_id,
        "exp": datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def get_usuario_actual(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Usuario:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido o expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if not email:
            raise credentials_error
    except JWTError:
        raise credentials_error

    usuario = db.query(Usuario).filter_by(email=email, activo=True).first()
    if not usuario:
        raise credentials_error
    return usuario


def _empresa_para_usuario(db: Session, usuario: Usuario, empresa_id: Optional[int] = None) -> Empresa:
    if usuario.rol == RolUsuario.SUPERADMIN and empresa_id:
        empresa = db.query(Empresa).filter_by(id=empresa_id, activo=True).first()
        if not empresa:
            raise HTTPException(404, "Empresa no encontrada")
        return empresa

    if not usuario.empresa_id:
        raise HTTPException(400, "El usuario no tiene empresa asociada")

    empresa = db.query(Empresa).filter_by(id=usuario.empresa_id, activo=True).first()
    if not empresa:
        raise HTTPException(404, "Empresa no encontrada o inactiva")
    return empresa


# ── Email reset ───────────────────────────────────────────────────────────────
def _enviar_email_reset(db: Session, usuario: Usuario, token: str) -> None:
    empresa = usuario.empresa or db.query(Empresa).filter_by(activo=True).first()
    empresa_nombre = empresa.nombre if empresa else settings.EMPRESA_NOMBRE
    color = empresa.color_primary if empresa else settings.EMPRESA_COLOR_PRIMARY
    correo_emisor = (empresa.correo_emisor if empresa and empresa.correo_emisor else settings.CORREO_EMISOR)
    correo_contrasena = (empresa.correo_contrasena if empresa and empresa.correo_contrasena else settings.CORREO_CONTRASENA)

    if not correo_emisor or not correo_contrasena:
        print("[Auth] Correo no configurado para reset")
        return

    url = f"{settings.FRONTEND_URL}/reset-password/{token}"
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Recuperar contraseña — {empresa_nombre}"
    msg["From"]    = correo_emisor
    msg["To"]      = usuario.email

    html = f"""
    <html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
    <div style="max-width:500px;margin:0 auto;background:white;border-radius:10px;
                padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
      <h2 style="color:{color};margin-top:0">{empresa_nombre}</h2>
      <h3>Recuperar contraseña</h3>
      <p>Recibimos una solicitud para restablecer tu contraseña.</p>
      <p>Haz clic en el siguiente enlace válido por <strong>1 hora</strong>:</p>
      <p style="text-align:center;margin:28px 0">
        <a href="{url}" style="background:{color};color:white;padding:12px 28px;
           text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block">
          Restablecer contraseña
        </a>
      </p>
      <p style="font-size:12px;color:#9ca3af;margin-top:24px">
        Si no solicitaste esto, ignora este correo. El enlace expira en 1 hora.<br>
        Por seguridad, nunca compartas este enlace.
      </p>
    </div>
    </body></html>
    """
    msg.attach(MIMEText(html, "html"))
    try:
        ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL(settings.SMTP_SERVER, 465, context=ctx) as s:
            s.login(correo_emisor, correo_contrasena)
            s.sendmail(correo_emisor, usuario.email, msg.as_string())
    except Exception as e:
        print(f"[Auth] Error enviando email reset: {e}")


# ── Schemas ───────────────────────────────────────────────────────────────────
class TokenOut(BaseModel):
    id:           int
    access_token: str
    token_type:   str = "bearer"
    nombre:       str
    email:        str
    rol:          str
    empresa_id:   Optional[int] = None
    empresa_nombre: Optional[str] = None


class RegisterIn(BaseModel):
    email:      EmailStr
    nombre:     str
    password:   str
    rol:        RolUsuario = RolUsuario.VIEWER
    empresa_id: Optional[int] = None

    @field_validator("password")
    @classmethod
    def validar_password(cls, v: str) -> str:
        return _validar_password_segura(v)


class UsuarioOut(BaseModel):
    id:           int
    empresa_id:   Optional[int]
    empresa_nombre: Optional[str] = None
    email:        str
    nombre:       str
    rol:          RolUsuario
    activo:       bool
    ultimo_acceso: Optional[datetime]
    creado_en:    datetime

    class Config:
        from_attributes = True


class UpdateUsuarioIn(BaseModel):
    nombre:     Optional[str] = None
    rol:        Optional[RolUsuario] = None
    activo:     Optional[bool] = None
    empresa_id: Optional[int] = None


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token:           str
    nueva_password:  str

    @field_validator("nueva_password")
    @classmethod
    def validar_nueva_password(cls, v: str) -> str:
        return _validar_password_segura(v)


class ChangePasswordIn(BaseModel):
    password_actual: str
    nueva_password:  str

    @field_validator("nueva_password")
    @classmethod
    def validar_nueva_password(cls, v: str) -> str:
        return _validar_password_segura(v)


# ── Endpoints Auth ────────────────────────────────────────────────────────────
@router.post("/login", response_model=TokenOut, summary="Iniciar sesión")
def login(
    request: Request,
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    usuario = db.query(Usuario).filter_by(email=form.username, activo=True).first()
    if not usuario or not pwd_context.verify(form.password, usuario.hashed_password):
        log_action(db, "LOGIN_FAIL", email=form.username, ip=request.client.host)
        db.commit()
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    if usuario.rol != RolUsuario.SUPERADMIN:
        if not usuario.empresa or not usuario.empresa.activo:
            raise HTTPException(status_code=403, detail="Empresa inactiva o no asociada")

    usuario.ultimo_acceso = datetime.now()
    log_action(
        db,
        "LOGIN_OK",
        email=usuario.email,
        usuario_id=usuario.id,
        empresa_id=usuario.empresa_id,
        ip=request.client.host,
    )
    db.commit()

    return TokenOut(
        id=usuario.id,
        access_token=crear_token(usuario.email, usuario.rol.value, usuario.empresa_id),
        nombre=usuario.nombre,
        email=usuario.email,
        rol=usuario.rol.value,
        empresa_id=usuario.empresa_id,
        empresa_nombre=usuario.empresa_nombre,
    )


@router.post("/register", status_code=201, summary="Registrar usuario")
def register(
    data: RegisterIn,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(get_usuario_actual),
):
    if usuario_actual.rol not in (RolUsuario.SUPERADMIN, RolUsuario.ADMIN):
        raise HTTPException(403, "Solo administradores pueden crear usuarios")

    if data.rol == RolUsuario.SUPERADMIN and usuario_actual.rol != RolUsuario.SUPERADMIN:
        raise HTTPException(403, "Solo SUPERADMIN puede crear otros SUPERADMIN")

    empresa_id = data.empresa_id if usuario_actual.rol == RolUsuario.SUPERADMIN else usuario_actual.empresa_id
    if data.rol != RolUsuario.SUPERADMIN and not empresa_id:
        raise HTTPException(400, "Debe seleccionar una empresa")

    if empresa_id and not db.query(Empresa).filter_by(id=empresa_id, activo=True).first():
        raise HTTPException(404, "Empresa no encontrada")

    if db.query(Usuario).filter_by(email=data.email).first():
        raise HTTPException(400, "El email ya está registrado")

    nuevo = Usuario(
        empresa_id=empresa_id,
        email=data.email,
        nombre=data.nombre,
        hashed_password=pwd_context.hash(data.password),
        rol=data.rol,
    )
    db.add(nuevo)
    log_action(
        db,
        "CREATE_USER",
        email=usuario_actual.email,
        usuario_id=usuario_actual.id,
        empresa_id=empresa_id,
        detalle=f"Nuevo usuario: {data.email} | Rol: {data.rol.value}",
    )
    db.commit()
    return {"mensaje": "Usuario creado correctamente", "email": data.email, "rol": data.rol, "empresa_id": empresa_id}


@router.post("/forgot-password", summary="Solicitar reset de contraseña")
def forgot_password(data: ForgotIn, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter_by(email=data.email, activo=True).first()
    if usuario:
        token = secrets.token_urlsafe(48)
        db.add(PasswordResetToken(
            email=data.email,
            token=_hash_reset_token(token),
            expira_en=datetime.utcnow() + timedelta(hours=1),
        ))
        db.commit()
        _enviar_email_reset(db, usuario, token)
    return {"mensaje": "Si el correo existe, recibirás un enlace de recuperación"}


@router.post("/reset-password", summary="Confirmar nueva contraseña")
def reset_password(data: ResetIn, db: Session = Depends(get_db)):
    registro = db.query(PasswordResetToken).filter_by(token=_hash_reset_token(data.token), usado=False).first()
    if not registro:
        raise HTTPException(400, "Token inválido o ya utilizado")
    if datetime.utcnow() > registro.expira_en:
        raise HTTPException(400, "El token ha expirado. Solicita uno nuevo.")
    usuario = db.query(Usuario).filter_by(email=registro.email, activo=True).first()
    if not usuario:
        raise HTTPException(404, "Usuario no encontrado")
    usuario.hashed_password = pwd_context.hash(data.nueva_password)
    registro.usado = True
    log_action(db, "RESET_PASSWORD", email=usuario.email, usuario_id=usuario.id, empresa_id=usuario.empresa_id)
    db.commit()
    return {"mensaje": "Contraseña actualizada correctamente"}


@router.post("/change-password", summary="Cambiar contraseña estando autenticado")
def change_password(
    data: ChangePasswordIn,
    usuario: Usuario = Depends(get_usuario_actual),
    db: Session = Depends(get_db),
):
    if not pwd_context.verify(data.password_actual, usuario.hashed_password):
        raise HTTPException(400, "La contraseña actual es incorrecta")
    usuario.hashed_password = pwd_context.hash(data.nueva_password)
    log_action(db, "CHANGE_PASSWORD", email=usuario.email, usuario_id=usuario.id, empresa_id=usuario.empresa_id)
    db.commit()
    return {"mensaje": "Contraseña cambiada correctamente"}


@router.get("/me", response_model=UsuarioOut, summary="Perfil del usuario actual")
def get_me(usuario: Usuario = Depends(get_usuario_actual)):
    return usuario


# ── Gestión de usuarios ───────────────────────────────────────────────────────
@router.get("/users", response_model=List[UsuarioOut], summary="Listar usuarios [ADMIN]")
def listar_usuarios(
    empresa_id: Optional[int] = None,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_usuario_actual),
):
    if actual.rol not in (RolUsuario.SUPERADMIN, RolUsuario.ADMIN):
        raise HTTPException(403, "Acceso denegado")

    q = db.query(Usuario)
    if actual.rol == RolUsuario.ADMIN:
        q = q.filter(Usuario.empresa_id == actual.empresa_id)
    elif empresa_id:
        q = q.filter(Usuario.empresa_id == empresa_id)

    return q.order_by(Usuario.creado_en.desc()).all()


@router.put("/users/{user_id}", response_model=UsuarioOut, summary="Actualizar usuario [ADMIN]")
def actualizar_usuario(
    user_id: int,
    data: UpdateUsuarioIn,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_usuario_actual),
):
    if actual.rol not in (RolUsuario.SUPERADMIN, RolUsuario.ADMIN):
        raise HTTPException(403, "Acceso denegado")

    usuario = db.query(Usuario).filter_by(id=user_id).first()
    if not usuario:
        raise HTTPException(404, "Usuario no encontrado")

    if actual.rol == RolUsuario.ADMIN and usuario.empresa_id != actual.empresa_id:
        raise HTTPException(403, "No puedes editar usuarios de otra empresa")

    if data.empresa_id is not None:
        if actual.rol != RolUsuario.SUPERADMIN:
            raise HTTPException(403, "Solo SUPERADMIN puede cambiar la empresa del usuario")
        if not db.query(Empresa).filter_by(id=data.empresa_id, activo=True).first():
            raise HTTPException(404, "Empresa no encontrada")
        usuario.empresa_id = data.empresa_id

    if data.nombre is not None:
        usuario.nombre = data.nombre
    if data.activo is not None:
        usuario.activo = data.activo
    if data.rol is not None:
        if data.rol == RolUsuario.SUPERADMIN and actual.rol != RolUsuario.SUPERADMIN:
            raise HTTPException(403, "Solo SUPERADMIN puede asignar ese rol")
        usuario.rol = data.rol

    log_action(
        db,
        "UPDATE_USER",
        email=actual.email,
        usuario_id=actual.id,
        empresa_id=usuario.empresa_id,
        detalle=f"Editó usuario ID {user_id}",
    )
    db.commit()
    db.refresh(usuario)
    return usuario


@router.delete("/users/{user_id}", summary="Desactivar usuario [ADMIN]")
def desactivar_usuario(
    user_id: int,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_usuario_actual),
):
    if actual.rol not in (RolUsuario.SUPERADMIN, RolUsuario.ADMIN):
        raise HTTPException(403, "Acceso denegado")
    if actual.id == user_id:
        raise HTTPException(400, "No puedes desactivar tu propia cuenta")

    usuario = db.query(Usuario).filter_by(id=user_id).first()
    if not usuario:
        raise HTTPException(404, "Usuario no encontrado")
    if actual.rol == RolUsuario.ADMIN and usuario.empresa_id != actual.empresa_id:
        raise HTTPException(403, "No puedes desactivar usuarios de otra empresa")

    usuario.activo = False
    log_action(
        db,
        "DEACTIVATE_USER",
        email=actual.email,
        usuario_id=actual.id,
        empresa_id=usuario.empresa_id,
        detalle=f"Desactivó usuario: {usuario.email}",
    )
    db.commit()
    return {"mensaje": f"Usuario {usuario.email} desactivado"}


# ── Audit log ─────────────────────────────────────────────────────────────────
@router.get("/audit", summary="Log de auditoría [ADMIN]")
def audit_log(
    limite: int = 100,
    empresa_id: Optional[int] = None,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_usuario_actual),
):
    if actual.rol not in (RolUsuario.SUPERADMIN, RolUsuario.ADMIN):
        raise HTTPException(403, "Acceso denegado")

    q = db.query(AuditLog)
    if actual.rol == RolUsuario.ADMIN:
        q = q.filter_by(empresa_id=actual.empresa_id)
    elif empresa_id:
        q = q.filter_by(empresa_id=empresa_id)

    logs = q.order_by(AuditLog.creado_en.desc()).limit(limite).all()
    return [
        {
            "id": l.id,
            "empresa_id": l.empresa_id,
            "email": l.email,
            "accion": l.accion,
            "detalle": l.detalle,
            "ip": l.ip,
            "creado_en": l.creado_en.isoformat() if l.creado_en else None,
        }
        for l in logs
    ]


# ── Branding ──────────────────────────────────────────────────────────────────
@router.get("/branding", summary="Obtener configuración de marca")
def get_branding(
    empresa_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Empresa).filter_by(activo=True)
    empresa = q.filter_by(id=empresa_id).first() if empresa_id else q.order_by(Empresa.id.asc()).first()
    if not empresa:
        return {
            "empresa_nombre": settings.EMPRESA_NOMBRE,
            "empresa_logo_url": settings.EMPRESA_LOGO_URL,
            "empresa_color_primary": settings.EMPRESA_COLOR_PRIMARY,
            "empresa_color_secondary": settings.EMPRESA_COLOR_SECONDARY,
        }
    return {
        "empresa_id": empresa.id,
        "empresa_nombre": empresa.nombre,
        "empresa_logo_url": empresa.logo_url or "",
        "empresa_color_primary": empresa.color_primary,
        "empresa_color_secondary": empresa.color_secondary,
    }
