import client from './client'
import type { FiltrosOportunidades, LiberarProcesosPayload, SchedulerConfig } from '../types'

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) => {
    const params = new URLSearchParams()
    params.append('username', email)
    params.append('password', password)
    return client.post('/auth/login', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }).then(r => r.data)
  },
  register: (data: { email: string; nombre: string; password: string; rol: string; empresa_id?: number | null }) =>
    client.post('/auth/register', data).then(r => r.data),
  forgotPassword: (email: string) =>
    client.post('/auth/forgot-password', { email }).then(r => r.data),
  resetPassword: (token: string, nueva_password: string) =>
    client.post('/auth/reset-password', { token, nueva_password }).then(r => r.data),
  changePassword: (password_actual: string, nueva_password: string) =>
    client.post('/auth/change-password', { password_actual, nueva_password }).then(r => r.data),
  me: () => client.get('/auth/me').then(r => r.data),
  getUsers: (empresa_id?: number | null) => client.get('/auth/users', { params: { empresa_id } }).then(r => r.data),
  updateUser: (id: number, data: any) => client.put(`/auth/users/${id}`, data).then(r => r.data),
  deleteUser: (id: number) => client.delete(`/auth/users/${id}`).then(r => r.data),
  getAuditLog: (limite = 100, empresa_id?: number | null) => client.get('/auth/audit', { params: { limite, empresa_id } }).then(r => r.data),
  getBranding: (empresa_id?: number | null) => client.get('/auth/branding', { params: { empresa_id } }).then(r => r.data),
}

// ── Empresas ──────────────────────────────────────────────────────────────────
export const empresasApi = {
  listar: (incluir_inactivas = true) => client.get('/empresas/', { params: { incluir_inactivas } }).then(r => r.data),
  crear: (data: any) => client.post('/empresas/', data).then(r => r.data),
  editar: (id: number, data: any) => client.put(`/empresas/${id}`, data).then(r => r.data),
  actualizarBranding: (id: number, data: any) => client.put(`/empresas/${id}/branding`, data).then(r => r.data),
  desactivar: (id: number) => client.delete(`/empresas/${id}`).then(r => r.data),
}

// ── Oportunidades ─────────────────────────────────────────────────────────────
export const oportunidadesApi = {
  listar: (filtros: FiltrosOportunidades = {}) =>
    client.get('/oportunidades/', { params: filtros }).then(r => r.data),
  estadisticas: (empresa_id?: number | null, fecha_desde?: string, fecha_hasta?: string) => client.get('/oportunidades/estadisticas', { params: { empresa_id, fecha_desde, fecha_hasta } }).then(r => r.data),
}

// ── Servicios ─────────────────────────────────────────────────────────────────
export const serviciosApi = {
  listar: (solo_activos = true, categoria?: string, empresa_id?: number | null) =>
    client.get('/servicios/', { params: { solo_activos, categoria, empresa_id } }).then(r => r.data),
  categorias: (empresa_id?: number | null) => client.get('/servicios/categorias', { params: { empresa_id } }).then(r => r.data),
  categoriasDisponibles: () => client.get('/servicios/categorias-disponibles').then(r => r.data),
  crear: (data: { empresa_id?: number | null; nombre_servicio: string; descripcion?: string; categoria?: string }) =>
    client.post('/servicios/', data).then(r => r.data),
  editar: (id: number, data: any) => client.put(`/servicios/${id}`, data).then(r => r.data),
  eliminar: (id: number, empresa_id?: number | null) => client.delete(`/servicios/${id}`, { params: { empresa_id } }).then(r => r.data),
}

// ── Scheduler ─────────────────────────────────────────────────────────────────
export const schedulerApi = {
  getConfig: (empresa_id?: number | null) => client.get('/scheduler/config', { params: { empresa_id } }).then(r => r.data),
  updateConfig: (data: SchedulerConfig) => client.put('/scheduler/config', data).then(r => r.data),
  ejecutarAhora: (empresa_id?: number | null, fecha_desde?: string, fecha_hasta?: string, departamento?: string) =>
    client.post('/scheduler/ejecutar-ahora', null, { params: { empresa_id, fecha_desde, fecha_hasta, departamento } }).then(r => r.data),
  estado: (empresa_id?: number | null) => client.get('/scheduler/estado', { params: { empresa_id } }).then(r => r.data),
}

// ── Destinatarios ─────────────────────────────────────────────────────────────
export const notificacionesApi = {
  listar: (empresa_id?: number | null) => client.get('/notificaciones/', { params: { empresa_id } }).then(r => r.data),
  crear: (data: any) => client.post('/notificaciones/', data).then(r => r.data),
  editar: (id: number, data: any) => client.put(`/notificaciones/${id}`, data).then(r => r.data),
  eliminar: (id: number, empresa_id?: number | null) => client.delete(`/notificaciones/${id}`, { params: { empresa_id } }).then(r => r.data),
}

// ── Gobernanza ────────────────────────────────────────────────────────────────
export const gobernanzaApi = {
  previsualizar: (data: LiberarProcesosPayload) => client.post('/gobernanza/procesos/previsualizar', data).then(r => r.data),
  liberar: (data: LiberarProcesosPayload) => client.post('/gobernanza/procesos/liberar', data).then(r => r.data),
}

// ── Búsqueda SECOP ────────────────────────────────────────────────────────────
export const searchApi = {
  buscar: (q: string, limite = 20, empresa_id?: number | null, fecha_desde?: string, fecha_hasta?: string) =>
    client.get('/secop-search/', { params: { q, limite, empresa_id, fecha_desde, fecha_hasta } }).then(r => r.data),
  sugerencias: (empresa_id?: number | null) => client.get('/secop-search/sugerencias', { params: { empresa_id } }).then(r => r.data),
}
