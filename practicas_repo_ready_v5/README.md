# Practicas — SECOP Intelligence

Aplicación multiempresa para detección de oportunidades en SECOP, con FastAPI, React/Vite, control de roles, branding por empresa, destinatarios configurables y gobernanza de información.

## Estructura

```text
practicas/
├── backend/   # FastAPI + SQLAlchemy
├── frontend/  # React + Vite
└── DEPLOY_RAILWAY.md
```

## Requisitos locales

- Python 3.11
- Node.js 20 o superior
- Git

## Backend local

```powershell
cd backend
py -3.11 -m venv venv
venv\Scripts\activate
python -m pip install --upgrade pip
python -m pip install --prefer-binary -r requirements.txt
Copy-Item .env.example .env
python -m uvicorn main:app --reload --port 8000
```

Validar:

```text
http://localhost:8000/health
```

## Frontend local

```powershell
cd frontend
npm install
npm run dev
```

Abrir:

```text
http://localhost:5173
```

## Archivos que no se suben al repositorio

No subir:

```text
backend/.env
backend/secop.db
backend/venv/
frontend/node_modules/
frontend/dist/
```

## Despliegue

Ver paso a paso completo en:

```text
DEPLOY_RAILWAY.md
```

## Servicios Railway recomendados

- Servicio 1: `backend`, root directory `backend`.
- Servicio 2: `frontend`, root directory `frontend`.
- Servicio 3: PostgreSQL administrado por Railway.

## Variables principales

Backend:

```env
ENVIRONMENT=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
SECRET_KEY=clave_larga_real
ADMIN_EMAIL=admin@tudominio.com
ADMIN_PASSWORD=ClaveSeguraProduccion123
ALLOWED_ORIGINS=https://URL_FRONTEND
FRONTEND_URL=https://URL_FRONTEND
```

Frontend:

```env
VITE_API_URL=https://URL_BACKEND
```
