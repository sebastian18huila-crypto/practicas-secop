# Despliegue en Railway — Proyecto `practicas`

Este proyecto se despliega como 3 servicios:

1. `backend` — FastAPI.
2. `frontend` — React/Vite.
3. `PostgreSQL` — base de datos administrada por Railway.

## 1. Preparar repositorio local

Desde la carpeta raíz del proyecto:

```powershell
git init
git add .
git commit -m "Proyecto practicas listo para Railway"
```

Crea un repositorio vacío en GitHub, por ejemplo:

```text
practicas-secop
```

Conecta el remoto:

```powershell
git remote add origin https://github.com/TU_USUARIO/practicas-secop.git
git branch -M main
git push -u origin main
```

## 2. Crear cuenta en Railway

1. Entra a Railway.
2. Crea cuenta con GitHub.
3. Autoriza acceso al repositorio.

## 3. Crear proyecto Railway

1. New Project.
2. Deploy from GitHub repo.
3. Selecciona el repositorio `practicas-secop`.

## 4. Agregar PostgreSQL

Dentro del proyecto Railway:

1. New.
2. Database.
3. PostgreSQL.

Railway generará la variable `DATABASE_URL`. Esa variable se debe usar en el servicio `backend`.

## 5. Crear servicio backend

Si Railway creó un servicio desde la raíz, ajusta:

```text
Root Directory: backend
```

Configuración esperada:

```text
Build: Nixpacks
Start command: uvicorn main:app --host 0.0.0.0 --port $PORT
Healthcheck: /health
```

El archivo `backend/railway.json` ya incluye el start command.

### Variables backend

En el servicio `backend`, entra a Variables y configura:

```env
ENVIRONMENT=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
SECRET_KEY=reemplaza_por_una_clave_larga_real_de_32_o_mas_caracteres
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
ADMIN_EMAIL=admin@tudominio.com
ADMIN_PASSWORD=ClaveSeguraProduccion123
ALLOWED_ORIGINS=https://URL_FRONTEND_RAILWAY
FRONTEND_URL=https://URL_FRONTEND_RAILWAY
SECOP_APP_TOKEN=
HF_TOKEN=
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=465
CORREO_EMISOR=
CORREO_CONTRASENA=
CORREO_RECEPTOR=
URL_API_WHATSAPP=https://api.callmebot.com/whatsapp.php
TOKEN_WHATSAPP=
TELEFONO_DESTINO_WA=
UMBRAL_SIMILITUD=0.50
RATE_LIMIT_PER_MINUTE=60
EMPRESA_NOMBRE=Practicas
EMPRESA_LOGO_URL=
EMPRESA_COLOR_PRIMARY=#1a56db
EMPRESA_COLOR_SECONDARY=#0e3a8c
```

Importante:

- No uses `localhost` en `ALLOWED_ORIGINS` cuando `ENVIRONMENT=production`.
- No uses `ALLOWED_ORIGINS=*`.
- No uses SQLite en producción.

## 6. Crear servicio frontend

Agrega otro servicio desde el mismo repositorio.

Configura:

```text
Root Directory: frontend
```

El archivo `frontend/railway.json` ya incluye:

```text
Build command: npm ci && npm run build
Start command: npm run start
```

### Variables frontend

En el servicio `frontend`, configura:

```env
VITE_API_URL=https://URL_BACKEND_RAILWAY
```

Después de cambiar `VITE_API_URL`, redeploya el frontend.

## 7. Ajustar CORS después de tener URLs reales

Cuando Railway te entregue las URLs:

```text
Backend:  https://backend-production.up.railway.app
Frontend: https://frontend-production.up.railway.app
```

Actualiza en backend:

```env
ALLOWED_ORIGINS=https://frontend-production.up.railway.app
FRONTEND_URL=https://frontend-production.up.railway.app
```

Actualiza en frontend:

```env
VITE_API_URL=https://backend-production.up.railway.app
```

Redeploya backend y frontend.

## 8. Validación postdespliegue

Valida backend:

```text
https://URL_BACKEND_RAILWAY/health
```

Debe responder:

```json
{"status":"healthy"}
```

Valida frontend:

```text
https://URL_FRONTEND_RAILWAY
```

Orden de pruebas:

1. Login con `ADMIN_EMAIL` y `ADMIN_PASSWORD`.
2. Crear empresa.
3. Seleccionar empresa como SUPERADMIN.
4. Crear servicios.
5. Crear usuarios.
6. Buscar en SECOP.
7. Escanear ahora.
8. Validar dashboard.
9. Validar gobernanza.
10. Validar recuperación de contraseña si el correo SMTP ya está configurado.

## 9. Comandos útiles

Subir cambios:

```powershell
git add .
git commit -m "Ajustes de despliegue"
git push
```

Railway redeploya automáticamente después del push si el repositorio está conectado.
