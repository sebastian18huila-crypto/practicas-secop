import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  TrendingUp, AlertCircle, Minus, Zap, Search,
  ChevronDown, ChevronUp, ExternalLink, Filter, X, Building2,
} from 'lucide-react'
import { oportunidadesApi, schedulerApi } from '../api'
import { ScoreBadge } from '../components/Badge'
import { ScanLoader } from '../components/Spinner'
import { useAuthStore } from '../store/authStore'
import { useEmpresaStore } from '../store/empresaStore'
import type { Oportunidad, FiltrosOportunidades, ScanStatus, Estadisticas } from '../types'

const DEPARTAMENTOS_COLOMBIA = [
  'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bogotá D.C.', 'Bolívar', 'Boyacá', 'Caldas', 'Caquetá',
  'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca', 'Guainía', 'Guaviare', 'Huila',
  'La Guajira', 'Magdalena', 'Meta', 'Nariño', 'Norte de Santander', 'Putumayo', 'Quindío', 'Risaralda',
  'San Andrés, Providencia y Santa Catalina', 'Santander', 'Sucre', 'Tolima', 'Valle del Cauca', 'Vaupés', 'Vichada',
]

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: any; color: string
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <div className={`p-1.5 rounded-lg ${color}`}>
          <Icon size={14} className="text-white" />
        </div>
      </div>
      <p className="text-3xl font-semibold text-gray-900">{value.toLocaleString()}</p>
    </div>
  )
}

function SeleccioneEmpresa() {
  return (
    <div className="card p-8 text-center text-gray-500">
      <Building2 size={32} className="mx-auto mb-3 text-gray-300"/>
      <p className="text-sm font-medium text-gray-700">Seleccione una empresa para visualizar información.</p>
      <p className="text-xs mt-1">El SUPERADMIN debe escoger la empresa desde el panel lateral.</p>
    </div>
  )
}

function OportunidadRow({ o }: { o: Oportunidad }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <tr className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setOpen(!open)}>
        <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-[180px] truncate">{o.entidad_publica}</td>
        <td className="px-4 py-3">
          <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{o.id_proceso_secop}</span>
        </td>
        <td className="px-4 py-3 text-sm text-gray-700 max-w-[200px] truncate">{o.servicio_relacionado}</td>
        <td className="px-4 py-3"><ScoreBadge score={o.score_ia} /></td>
        <td className="px-4 py-3 text-sm text-gray-600">{o.fecha_limite}</td>
        <td className="px-4 py-3 text-sm text-gray-500">{o.departamento ?? '—'}</td>
        <td className="px-4 py-3 text-gray-400">{open ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</td>
      </tr>
      {open && (
        <tr className="bg-blue-50/60">
          <td colSpan={7} className="px-4 py-3">
            <div className="text-sm space-y-2 animate-fade-in">
              <p className="text-gray-700 leading-relaxed">
                <span className="font-medium">Descripción: </span>{o.descripcion_licitacion}
              </p>
              <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                {o.modalidad && <span><strong>Modalidad:</strong> {o.modalidad}</span>}
                {o.ciudad    && <span><strong>Ciudad:</strong> {o.ciudad}</span>}
                {o.valor_estimado && o.valor_estimado !== 'None' && (
                  <span><strong>Valor:</strong> ${Number(o.valor_estimado).toLocaleString('es-CO')} COP</span>
                )}
                <span><strong>Detectada:</strong> {o.fecha_descubrimiento}</span>
              </div>
              <a href="https://community.secop.gov.co/STS/Users/Login/Index?SkinName=CCE"
                 target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                 className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:underline mt-1">
                <ExternalLink size={12}/> Buscar {o.id_proceso_secop} en SECOP II
              </a>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function Dashboard() {
  const qc = useQueryClient()
  const usuario = useAuthStore(s => s.usuario)
  const selectedEmpresaId = useEmpresaStore(s => s.selectedEmpresaId)
  const esSuperAdmin = usuario?.rol === 'SUPERADMIN'
  const empresaId = esSuperAdmin ? selectedEmpresaId : usuario?.empresa_id ?? null

  const [filtros,       setFiltros]      = useState<FiltrosOportunidades>({ score_minimo: 0, limite: 100 })
  const [fServicio,     setFServicio]    = useState('')
  const [fDepto,        setFDepto]       = useState('')
  const [fScore,        setFScore]       = useState('0')
  const [scanDesde,     setScanDesde]    = useState('')
  const [scanHasta,     setScanHasta]    = useState('')
  const [scanDepto,     setScanDepto]    = useState('')
  const [scanRunning,   setScanRunning]  = useState(false)
  const [scanMsg,       setScanMsg]      = useState('')
  const [finalizando,   setFinalizando]  = useState(false)

  const { data: stats } = useQuery<Estadisticas>({
    queryKey: ['estadisticas', empresaId],
    queryFn:  () => oportunidadesApi.estadisticas(empresaId),
    enabled:  !!empresaId,
    refetchInterval: scanRunning ? 5_000 : false,
  })

  const { data: oportunidades = [], isLoading, refetch: refetchOportunidades } = useQuery<Oportunidad[]>({
    queryKey: ['oportunidades', empresaId, filtros],
    queryFn:  () => oportunidadesApi.listar({ ...filtros, empresa_id: empresaId ?? undefined }),
    enabled:  !!empresaId,
    refetchInterval: scanRunning ? 5_000 : false,
  })

  const { data: scanStatus } = useQuery<ScanStatus>({
    queryKey: ['scan-status', empresaId],
    queryFn:  () => schedulerApi.estado(empresaId),
    enabled:  !!empresaId && scanRunning,
    refetchInterval: scanRunning ? 3_000 : false,
  })

  const departamentosFiltro = useMemo(
    () => Array.from(new Set(stats?.departamentos ?? [])).filter(Boolean).sort(),
    [stats?.departamentos],
  )

  const serviciosFiltro = useMemo(
    () => Array.from(new Set(stats?.servicios ?? [])).filter(Boolean).sort(),
    [stats?.servicios],
  )

  const departamentosEscaneo = useMemo(
    () => Array.from(new Set([...DEPARTAMENTOS_COLOMBIA, ...departamentosFiltro])).sort(),
    [departamentosFiltro],
  )

  const scanMut = useMutation({
    mutationFn: () => schedulerApi.ejecutarAhora(
      empresaId,
      scanDesde || undefined,
      scanHasta || undefined,
      scanDepto || undefined,
    ),
    onMutate: () => {
      setFinalizando(false)
      setScanRunning(true)
      setScanMsg('Escaneo en ejecución. La información se actualizará automáticamente al finalizar.')
    },
    onSuccess: (data) => setScanMsg(data.mensaje || 'Escaneo en ejecución.'),
    onError: () => {
      setScanRunning(false)
      setFinalizando(false)
      setScanMsg('')
    },
  })

  useEffect(() => {
    if (!scanRunning || finalizando || !scanStatus) return

    if (scanStatus.estado === 'COMPLETED') {
      setFinalizando(true)
      setScanMsg('Escaneo finalizado. Actualizando cards y oportunidades encontradas...')
      Promise.all([
        qc.refetchQueries({ queryKey: ['estadisticas', empresaId] }),
        refetchOportunidades(),
      ]).finally(() => {
        setScanRunning(false)
        setFinalizando(false)
        setScanMsg('')
      })
    }

    if (scanStatus.estado === 'ERROR') {
      setScanMsg(scanStatus.mensaje || 'Error durante el escaneo.')
      setTimeout(() => {
        setScanRunning(false)
        setFinalizando(false)
        setScanMsg('')
      }, 2500)
    }
  }, [scanRunning, finalizando, scanStatus, qc, empresaId, refetchOportunidades])

  const aplicar = () => setFiltros({
    empresa_id:    empresaId ?? undefined,
    servicio:      fServicio  || undefined,
    departamento:  fDepto     || undefined,
    score_minimo:  parseFloat(fScore) || 0,
    limite:        100,
  })

  const limpiar = () => {
    setFServicio(''); setFDepto(''); setFScore('0')
    setFiltros({ score_minimo: 0, limite: 100 })
  }

  const hayFiltros = fServicio || fDepto || fScore !== '0'

  return (
    <div className="p-6 space-y-6">
      {scanRunning && (
        <ScanLoader mensaje={scanMsg || 'Escaneo en ejecución...'} />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Oportunidades SECOP II detectadas por IA</p>
        </div>
        <button
          onClick={() => scanMut.mutate()}
          disabled={!empresaId || scanRunning || scanMut.isPending}
          className="btn-primary"
        >
          <Zap size={15}/>
          {scanRunning ? 'Escaneando...' : 'Escanear ahora'}
        </button>
      </div>

      {!empresaId ? <SeleccioneEmpresa /> : (
        <>
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Total detectadas"     value={stats?.total          ?? 0} icon={Search}      color="bg-gray-400"/>
            <StatCard label="Alta prioridad ≥75%"  value={stats?.alta_prioridad ?? 0} icon={TrendingUp}  color="bg-emerald-500"/>
            <StatCard label="Media prioridad ≥60%" value={stats?.media_prioridad ?? 0} icon={AlertCircle} color="bg-amber-500"/>
            <StatCard label="Baja prioridad"       value={stats?.baja_prioridad ?? 0} icon={Minus}       color="bg-gray-400"/>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={14} className="text-gray-400"/>
              <span className="text-sm font-medium text-gray-700">Parámetros opcionales para escanear ahora</span>
            </div>
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 md:col-span-3">
                <label className="block text-[11px] font-medium text-gray-500 mb-1">Fecha desde</label>
                <input type="date" value={scanDesde} onChange={e => setScanDesde(e.target.value)} className="input" />
              </div>
              <div className="col-span-12 md:col-span-3">
                <label className="block text-[11px] font-medium text-gray-500 mb-1">Fecha hasta</label>
                <input type="date" value={scanHasta} onChange={e => setScanHasta(e.target.value)} className="input" />
              </div>
              <div className="col-span-12 md:col-span-4">
                <label className="block text-[11px] font-medium text-gray-500 mb-1">Departamento SECOP</label>
                <select value={scanDepto} onChange={e => setScanDepto(e.target.value)} className="input">
                  <option value="">Todos los departamentos</option>
                  {departamentosEscaneo.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <button onClick={() => scanMut.mutate()} disabled={!empresaId || scanRunning || scanMut.isPending}
                      className="btn-primary col-span-12 md:col-span-2 justify-center self-end">
                <Zap size={15}/>{scanRunning ? 'Escaneando...' : 'Escanear'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Estos campos solo aplican al escaneo manual. No filtran las oportunidades ya almacenadas.
            </p>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter size={14} className="text-gray-400"/>
              <span className="text-sm font-medium text-gray-700">Filtros de oportunidades encontradas</span>
              {hayFiltros && (
                <button onClick={limpiar} className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                  <X size={12}/> Limpiar
                </button>
              )}
            </div>
            <div className="grid grid-cols-12 gap-3">
              <select value={fServicio} onChange={e => setFServicio(e.target.value)} className="input col-span-12 md:col-span-4">
                <option value="">Todos los servicios encontrados</option>
                {serviciosFiltro.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={fDepto} onChange={e => setFDepto(e.target.value)} className="input col-span-12 md:col-span-4">
                <option value="">Todos los departamentos encontrados</option>
                {departamentosFiltro.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={fScore} onChange={e => setFScore(e.target.value)} className="input col-span-12 md:col-span-2">
                <option value="0">Todos los scores</option>
                <option value="0.75">Alta ≥75%</option>
                <option value="0.60">Media+ ≥60%</option>
                <option value="0.50">≥50%</option>
              </select>
              <button onClick={aplicar} className="btn-primary col-span-12 md:col-span-2 justify-center">Filtrar</button>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Oportunidades</span>
                <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                  {oportunidades.length}
                </span>
              </div>
              <p className="text-xs text-gray-400">Haz clic en una fila para ver detalle</p>
            </div>

            {isLoading ? (
              <div className="py-16 text-center text-sm text-gray-400">
                <div className="loader w-6 h-6 mx-auto mb-2"/>Cargando oportunidades...
              </div>
            ) : oportunidades.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-400">
                Sin resultados. Ajusta los filtros o ejecuta un escaneo.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Entidad','ID SECOP','Servicio','Match IA','Cierre','Depto.',''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {oportunidades.map((o: Oportunidad) => <OportunidadRow key={o.id} o={o}/>) }
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
