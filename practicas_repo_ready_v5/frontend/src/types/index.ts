export type Rol = 'SUPERADMIN' | 'ADMIN' | 'ANALISTA' | 'VIEWER'

export interface Empresa {
  id:                 number
  nombre:             string
  nit:                string | null
  dominio:            string | null
  logo_url:           string | null
  color_primary:      string
  color_secondary:    string
  correo_emisor:      string | null
  url_api_whatsapp:   string | null
  activo:             boolean
  creado_en:          string
}

export interface Usuario {
  id:             number
  empresa_id:     number | null
  empresa_nombre?: string | null
  email:          string
  nombre:         string
  rol:            Rol
  activo:         boolean
  ultimo_acceso?: string
  creado_en?:     string
}

export interface AuthState {
  token:    string | null
  usuario:  Usuario | null
  setAuth:  (token: string, usuario: Usuario) => void
  clearAuth:() => void
}

export interface Branding {
  empresa_id?:                 number
  empresa_nombre:              string
  empresa_logo_url:            string
  empresa_color_primary:       string
  empresa_color_secondary:     string
}

export interface Oportunidad {
  id:                     number
  empresa_id:             number
  id_proceso_secop:       string
  entidad_publica:        string
  departamento:           string | null
  ciudad:                 string | null
  descripcion_licitacion: string
  servicio_relacionado:   string
  score_ia:               number
  fecha_limite:           string
  modalidad:              string | null
  valor_estimado:         string | null
  fecha_descubrimiento:   string
  estado_notificacion:    string
}

export interface Estadisticas {
  total:           number
  alta_prioridad:  number
  media_prioridad: number
  baja_prioridad:  number
  departamentos:   string[]
  servicios:       string[]
}

export interface Servicio {
  id:              number
  empresa_id:      number
  nombre_servicio: string
  descripcion:     string | null
  categoria:       string | null
  activo:          boolean
  creado_por:      string | null
}

export interface Destinatario {
  id:                number
  empresa_id:        number
  nombre:            string
  email:             string | null
  telefono_whatsapp: string | null
  recibe_email:      boolean
  recibe_whatsapp:   boolean
  activo:            boolean
  creado_en:         string
  creado_por:        string | null
}

export interface ResultadoBusqueda {
  id_proceso:   string
  titulo:       string
  entidad:      string
  departamento: string | null
  ciudad:       string | null
  descripcion:  string
  fecha_cierre: string | null
  modalidad:    string | null
  valor:        string | null
  url_secop:    string
}

export interface ScanStatus {
  estado:        'IDLE' | 'RUNNING' | 'COMPLETED' | 'ERROR'
  mensaje:       string
  empresa_id:    number
  iniciado_en:   string | null
  finalizado_en: string | null
}

export interface SchedulerConfig {
  empresa_id?:    number | null
  hora_manana:    string
  hora_tarde:     string
  activo:         boolean
  umbral_ia:      number
  filtro_depto:   string | null
}

export interface AuditEntry {
  id:         number
  empresa_id: number | null
  email:      string
  accion:     string
  detalle:    string | null
  ip:         string | null
  creado_en:  string
}

export interface FiltrosOportunidades {
  empresa_id?:    number
  servicio?:      string
  departamento?:  string
  score_minimo?:  number
  fecha_desde?:   string
  fecha_hasta?:   string
  limite?:        number
  offset?:        number
}

export interface LiberarProcesosPayload {
  empresa_id?:    number | null
  antes_de?:      string | null
  score_maximo?:  number | null
  servicio?:      string | null
  departamento?:  string | null
  confirmar?:     boolean
}
