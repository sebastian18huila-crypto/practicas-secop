import { useQuery } from '@tanstack/react-query'
import { Shield, RefreshCw, Building2 } from 'lucide-react'
import { authApi } from '../api'
import { useAuthStore } from '../store/authStore'
import { useEmpresaStore } from '../store/empresaStore'
import type { AuditEntry } from '../types'

const ACCION_COLORS: Record<string, string> = {
  LOGIN_OK:         'bg-emerald-100 text-emerald-800',
  LOGIN_FAIL:       'bg-red-100 text-red-800',
  CREATE_USER:      'bg-blue-100 text-blue-800',
  UPDATE_USER:      'bg-blue-100 text-blue-800',
  DEACTIVATE_USER:  'bg-orange-100 text-orange-800',
  CREATE_SERVICE:   'bg-teal-100 text-teal-800',
  UPDATE_SERVICE:   'bg-teal-100 text-teal-800',
  DELETE_SERVICE:   'bg-red-100 text-red-800',
  DELETE_PROCESSES: 'bg-red-100 text-red-800',
  MANUAL_SCAN:      'bg-purple-100 text-purple-800',
  UPDATE_SCHEDULER: 'bg-amber-100 text-amber-800',
  RESET_PASSWORD:   'bg-gray-100 text-gray-700',
  CHANGE_PASSWORD:  'bg-gray-100 text-gray-700',
}

export default function Auditoria() {
  const usuario = useAuthStore(s => s.usuario)
  const selectedEmpresaId = useEmpresaStore(s => s.selectedEmpresaId)
  const esSuperAdmin = usuario?.rol === 'SUPERADMIN'
  const empresaId = esSuperAdmin ? selectedEmpresaId : usuario?.empresa_id ?? null

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery<AuditEntry[]>({
    queryKey: ['audit-log', empresaId],
    queryFn:  () => authApi.getAuditLog(200, empresaId),
    enabled:  !!empresaId || !esSuperAdmin,
    staleTime: 30_000,
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Log de Auditoría</h1>
          <p className="text-sm text-gray-500 mt-0.5">Registro de acciones importantes por empresa</p>
        </div>
        <button onClick={() => refetch()} disabled={!empresaId || isFetching} className="btn-secondary">
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''}/>
          Actualizar
        </button>
      </div>

      {!empresaId && esSuperAdmin ? (
        <div className="card p-8 text-center text-gray-500">
          <Building2 size={32} className="mx-auto mb-3 text-gray-300"/>
          <p className="text-sm font-medium text-gray-700">Seleccione una empresa para consultar auditoría.</p>
          <p className="text-xs mt-1">El log se filtra por la empresa seleccionada.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Shield size={15} className="text-gray-400"/>
            <span className="text-sm font-medium text-gray-700">Eventos registrados</span>
            <span className="ml-auto bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
              {logs.length}
            </span>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-sm text-gray-400">
              <div className="loader w-6 h-6 mx-auto mb-2"/>Cargando logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">No hay eventos registrados</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {['Fecha','Acción','Usuario','Detalle','IP'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((l: AuditEntry) => (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(l.creado_en).toLocaleString('es-CO')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                                          ${ACCION_COLORS[l.accion] ?? 'bg-gray-100 text-gray-600'}`}>
                          {l.accion}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700">{l.email ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[280px] truncate">{l.detalle ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-400 font-mono">{l.ip ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
