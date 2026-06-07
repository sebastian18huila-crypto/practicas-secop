import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, ExternalLink, Tag, ChevronDown, ChevronUp, Info, Building2 } from 'lucide-react'
import { searchApi } from '../api'
import { Spinner } from '../components/Spinner'
import { useAuthStore } from '../store/authStore'
import { useEmpresaStore } from '../store/empresaStore'
import type { ResultadoBusqueda } from '../types'

function ResultadoCard({ r }: { r: ResultadoBusqueda }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 leading-tight mb-1">
              {r.titulo || 'Sin título'}
            </h3>
            <p className="text-xs text-gray-500 mb-2">{r.entidad}</p>
            <div className="flex flex-wrap gap-2 text-xs">
              {r.departamento && (
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{r.departamento}</span>
              )}
              {r.ciudad && (
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{r.ciudad}</span>
              )}
              {r.modalidad && (
                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{r.modalidad}</span>
              )}
              {r.fecha_cierre && (
                <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded">
                  Fecha: {r.fecha_cierre}
                </span>
              )}
              {r.valor && r.valor !== 'None' && (
                <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-medium">
                  ${Number(r.valor).toLocaleString('es-CO')} COP
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a href={r.url_secop} target="_blank" rel="noopener noreferrer"
               className="btn-secondary text-xs px-3 py-1.5">
              <ExternalLink size={12}/> SECOP II
            </a>
            <button onClick={() => setOpen(!open)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              {open ? <ChevronUp size={16}/> : <ChevronDown size={16}/>} 
            </button>
          </div>
        </div>

        {open && (
          <div className="mt-3 pt-3 border-t border-gray-100 animate-fade-in">
            <p className="text-xs text-gray-600 leading-relaxed mb-2">
              <span className="font-medium">Descripción: </span>{r.descripcion}
            </p>
            <p className="text-xs text-gray-400 font-mono">ID: {r.id_proceso}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function SeleccioneEmpresa() {
  return (
    <div className="card p-8 text-center text-gray-500">
      <Building2 size={32} className="mx-auto mb-3 text-gray-300"/>
      <p className="text-sm font-medium text-gray-700">Seleccione una empresa para buscar en SECOP.</p>
      <p className="text-xs mt-1">Las sugerencias dependen del catálogo de servicios de la empresa seleccionada.</p>
    </div>
  )
}

export default function Buscar() {
  const usuario = useAuthStore(s => s.usuario)
  const selectedEmpresaId = useEmpresaStore(s => s.selectedEmpresaId)
  const esSuperAdmin = usuario?.rol === 'SUPERADMIN'
  const empresaId = esSuperAdmin ? selectedEmpresaId : usuario?.empresa_id ?? null

  const [query,      setQuery]      = useState('')
  const [ejecutar,   setEjecutar]   = useState(false)
  const [limite,     setLimite]     = useState(20)
  const [fechaDesde, setFechaDesde] = useState('')
  const fechaActual = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [fechaHasta, setFechaHasta] = useState(fechaActual)

  const { data: sugerencias } = useQuery({
    queryKey: ['sugerencias', empresaId],
    queryFn:  () => searchApi.sugerencias(empresaId),
    enabled:  !!empresaId,
    staleTime: 60_000,
  })

  const { data: resultados = [], isLoading, isFetching } = useQuery<ResultadoBusqueda[]>({
    queryKey: ['secop-search', empresaId, query, limite, fechaDesde, fechaHasta],
    queryFn:  () => searchApi.buscar(query, limite, empresaId, fechaDesde || undefined, fechaHasta || undefined),
    enabled:  !!empresaId && ejecutar && query.trim().length >= 3,
    staleTime: 60_000,
  })

  const buscar = () => {
    if (!empresaId || query.trim().length < 3) return
    setEjecutar(true)
  }

  const usarSugerencia = (term: string) => {
    setQuery(term)
    setEjecutar(true)
  }

  const totalSugerencias = sugerencias ? Object.values(sugerencias).flat().length : 0

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Buscar en SECOP II</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Búsqueda en tiempo real por palabras clave. Los resultados <strong>no se guardan</strong> en la base de datos.
        </p>
      </div>

      {!empresaId ? <SeleccioneEmpresa /> : (
        <>
          {/* Aviso */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <Info size={16} className="text-blue-500 mt-0.5 shrink-0"/>
            <p className="text-sm text-blue-700">
              Las sugerencias se generan con los servicios activos de la empresa seleccionada. El rango de fechas filtra los procesos devueltos por SECOP.
            </p>
          </div>

          {/* Buscador */}
          <div className="card p-5">
            <div className="grid grid-cols-12 gap-3">
              <div className="relative col-span-12 lg:col-span-5">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input
                  type="text"
                  value={query}
                  onChange={e => { setQuery(e.target.value); setEjecutar(false) }}
                  onKeyDown={e => e.key === 'Enter' && buscar()}
                  placeholder="Ej: soporte técnico, mantenimiento, cámaras..."
                  className="input pl-9"
                />
              </div>
              <div className="col-span-6 lg:col-span-2">
                <label className="block text-[11px] font-medium text-gray-500 mb-1">Fecha desde</label>
                <input type="date" value={fechaDesde} onChange={e => { setFechaDesde(e.target.value); setEjecutar(false) }} className="input" />
              </div>
              <div className="col-span-6 lg:col-span-2">
                <label className="block text-[11px] font-medium text-gray-500 mb-1">Fecha hasta</label>
                <input type="date" value={fechaHasta} onChange={e => { setFechaHasta(e.target.value); setEjecutar(false) }} className="input" />
              </div>
              <select value={limite} onChange={e => setLimite(Number(e.target.value))} className="input col-span-5 lg:col-span-1">
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <button onClick={buscar} disabled={query.trim().length < 3 || isFetching}
                      className="btn-primary col-span-7 lg:col-span-2 justify-center">
                {isFetching ? (
                  <><span className="loader w-4 h-4 inline-block"/> Buscando...</>
                ) : (
                  <><Search size={15}/> Buscar</>
                )}
              </button>
            </div>

            {/* Sugerencias */}
            {sugerencias && !ejecutar && (
              <div className="mt-4 space-y-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Búsquedas sugeridas por empresa</p>
                {totalSugerencias === 0 ? (
                  <p className="text-xs text-gray-400">No hay sugerencias. Registra servicios activos para esta empresa.</p>
                ) : Object.entries(sugerencias).map(([cat, terms]) => (
                  <div key={cat}>
                    <p className="text-xs font-medium text-gray-600 mb-1.5 capitalize">{cat}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(terms as string[]).map(term => (
                        <button key={term} onClick={() => usarSugerencia(term)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600
                                           text-xs rounded-full hover:bg-brand-100 hover:text-brand-700
                                           transition-colors">
                          <Tag size={10}/>{term}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resultados */}
          {isLoading && (
            <div className="py-10 flex justify-center">
              <Spinner size="md" text="Consultando SECOP II en tiempo real..." />
            </div>
          )}

          {ejecutar && !isLoading && resultados.length === 0 && (
            <div className="card p-8 text-center text-gray-400">
              <Search size={32} className="mx-auto mb-3 opacity-30"/>
              <p className="text-sm">No se encontraron resultados para <strong>"{query}"</strong></p>
              <p className="text-xs mt-1">Prueba con términos más generales, otro rango de fechas o sinónimos</p>
            </div>
          )}

          {resultados.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  <strong>{resultados.length}</strong> resultado{resultados.length !== 1 ? 's' : ''} para
                  <strong> "{query}"</strong>
                </p>
                <p className="text-xs text-gray-400">Resultados en tiempo real — no guardados en BD</p>
              </div>
              <div className="space-y-3">
                {resultados.map(r => <ResultadoCard key={r.id_proceso} r={r}/>) }
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
