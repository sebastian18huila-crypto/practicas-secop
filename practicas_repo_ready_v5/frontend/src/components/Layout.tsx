import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { useBrandingStore } from '../store/brandingStore'
import { useEmpresaStore } from '../store/empresaStore'
import { empresasApi } from '../api'
import {
  LayoutDashboard, Briefcase, Search, Settings,
  LogOut, Users, Shield, ChevronRight, Target, Building2,
} from 'lucide-react'
import clsx from 'clsx'
import type { Empresa, Rol } from '../types'

interface NavItem {
  to:       string
  label:    string
  icon:     any
  roles:    Rol[]
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard',     label: 'Dashboard',        icon: LayoutDashboard, roles: ['SUPERADMIN','ADMIN','ANALISTA','VIEWER'] },
  { to: '/buscar',        label: 'Buscar en SECOP',  icon: Search,          roles: ['SUPERADMIN','ADMIN','ANALISTA','VIEWER'] },
  { to: '/servicios',     label: 'Servicios',        icon: Briefcase,       roles: ['SUPERADMIN','ADMIN','ANALISTA','VIEWER'] },
  { to: '/empresas',      label: 'Empresas',         icon: Building2,       roles: ['SUPERADMIN'] },
  { to: '/usuarios',      label: 'Usuarios',         icon: Users,           roles: ['SUPERADMIN','ADMIN'] },
  { to: '/configuracion', label: 'Configuración',    icon: Settings,        roles: ['SUPERADMIN','ADMIN'] },
  { to: '/auditoria',     label: 'Auditoría',        icon: Shield,          roles: ['SUPERADMIN','ADMIN'] },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { pathname }           = useLocation()
  const navigate               = useNavigate()
  const { usuario, clearAuth } = useAuthStore()
  const { branding }           = useBrandingStore()
  const {
    selectedEmpresaId,
    setSelectedEmpresa,
    setSelectedEmpresaId,
    clearEmpresa,
  } = useEmpresaStore()

  const esSuperAdmin = usuario?.rol === 'SUPERADMIN'

  const { data: empresas = [] } = useQuery<Empresa[]>({
    queryKey: ['empresas-selector'],
    queryFn: () => empresasApi.listar(false),
    enabled: esSuperAdmin,
  })

  useEffect(() => {
    if (!esSuperAdmin || !selectedEmpresaId || empresas.length === 0) return
    const empresa = empresas.find(e => e.id === selectedEmpresaId) ?? null
    setSelectedEmpresa(empresa)
  }, [empresas, esSuperAdmin, selectedEmpresaId, setSelectedEmpresa])

  useEffect(() => {
    if (!esSuperAdmin) clearEmpresa()
  }, [esSuperAdmin, clearEmpresa])

  const logout = () => {
    clearEmpresa()
    clearAuth()
    navigate('/login')
  }

  const visibleItems = NAV_ITEMS.filter(item =>
    usuario?.rol && item.roles.includes(usuario.rol as Rol)
  )

  const seleccionarEmpresa = (value: string) => {
    const id = value ? Number(value) : null
    setSelectedEmpresaId(id)
    setSelectedEmpresa(empresas.find(e => e.id === id) ?? null)
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* ── Sidebar ── */}
      <aside className="w-56 bg-brand-900 text-white flex flex-col shrink-0 fixed inset-y-0 left-0 z-30">
        {/* Logo / Nombre empresa */}
        <div className="px-4 py-5 border-b border-white/10 space-y-4">
          <div className="flex items-center gap-2.5">
            {branding.empresa_logo_url ? (
              <img
                src={branding.empresa_logo_url}
                alt={branding.empresa_nombre}
                className="w-8 h-8 rounded-lg object-contain bg-white p-0.5"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
                <Target size={16} />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate leading-tight">
                {branding.empresa_nombre}
              </p>
              <p className="text-xs text-white/40 leading-tight">SECOP Intelligence</p>
            </div>
          </div>

          {esSuperAdmin && (
            <div>
              <label className="block text-[11px] text-white/45 mb-1">Empresa a visualizar</label>
              <select
                value={selectedEmpresaId ?? ''}
                onChange={e => seleccionarEmpresa(e.target.value)}
                className="w-full rounded-lg bg-white/10 border border-white/15 px-2 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-white/30 [&>option]:text-gray-900"
              >
                <option value="">Seleccione empresa</option>
                {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-2.5 space-y-0.5 overflow-y-auto">
          {visibleItems.map(({ to, label, icon: Icon }) => {
            const active = pathname.startsWith(to)
            return (
              <Link
                key={to}
                to={to}
                className={clsx(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors group',
                  active
                    ? 'bg-white/15 text-white font-medium'
                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                )}
              >
                <Icon size={15} className="shrink-0" />
                <span className="flex-1 truncate">{label}</span>
                {active && <ChevronRight size={13} className="opacity-60" />}
              </Link>
            )
          })}
        </nav>

        {/* User footer */}
        <div className="p-2.5 border-t border-white/10">
          <div className="flex items-center gap-2 px-3 py-2 mb-1 rounded-lg">
            <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center
                            text-xs font-bold shrink-0">
              {usuario?.nombre?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-white truncate">{usuario?.nombre}</p>
              <p className="text-xs text-white/40 truncate">{usuario?.rol}</p>
              {usuario?.empresa_nombre && (
                <p className="text-xs text-white/40 truncate">{usuario.empresa_nombre}</p>
              )}
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-2 w-full rounded-lg text-sm
                       text-white/60 hover:bg-white/10 hover:text-white transition-colors"
          >
            <LogOut size={15} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 ml-56 min-h-screen overflow-auto">
        {children}
      </main>
    </div>
  )
}
