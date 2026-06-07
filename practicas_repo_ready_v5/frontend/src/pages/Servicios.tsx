import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Pencil, Check, X, Briefcase, Filter, Building2 } from 'lucide-react'
import { serviciosApi } from '../api'
import { useAuthStore } from '../store/authStore'
import { useEmpresaStore } from '../store/empresaStore'
import { useToast } from '../components/Badge'
import type { Servicio } from '../types'

const CATEGORIAS_SECOP_FALLBACK = [
  'Agricultura, pesca, silvicultura y fauna',
  'Alimentos, bebidas y tabaco',
  'Animales vivos y productos animales',
  'Combustibles, lubricantes y anticorrosivos',
  'Componentes y suministros de fabricación',
  'Construcción, obras civiles e infraestructura',
  'Consultoría, gestión y servicios profesionales',
  'Defensa, seguridad y vigilancia',
  'Deportes, recreación y cultura',
  'Educación, formación y capacitación',
  'Equipos, suministros y accesorios de oficina',
  'Equipos y suministros de laboratorio y medición',
  'Equipos y suministros médicos, odontológicos y hospitalarios',
  'Ferretería, herramientas y maquinaria',
  'Gestión ambiental, aseo y saneamiento básico',
  'Impresos, publicaciones y material promocional',
  'Mantenimiento, reparación e instalación',
  'Materiales de construcción y estructuras',
  'Muebles, mobiliario y dotación',
  'Productos químicos y farmacéuticos',
  'Ropa, calzado, elementos de protección y textiles',
  'Salud, servicios sociales y asistenciales',
  'Servicios administrativos y de apoyo',
  'Servicios de alimentación y catering',
  'Servicios de arquitectura, ingeniería e interventoría',
  'Servicios de transporte, logística y almacenamiento',
  'Servicios financieros, seguros y fiduciarios',
  'Servicios públicos y energía',
  'Tecnologías de la información y telecomunicaciones',
  'Vehículos, repuestos y equipos de transporte',
  'Viajes, hotelería y eventos',
]

function SeleccioneEmpresa() {
  return (
    <div className="card p-8 text-center text-gray-500">
      <Building2 size={32} className="mx-auto mb-3 text-gray-300"/>
      <p className="text-sm font-medium text-gray-700">Seleccione una empresa para administrar servicios.</p>
      <p className="text-xs mt-1">El catálogo de servicios alimenta las sugerencias y el motor de IA de cada empresa.</p>
    </div>
  )
}

export default function Servicios() {
  const qc      = useQueryClient()
  const usuario = useAuthStore(s => s.usuario)
  const selectedEmpresaId = useEmpresaStore(s => s.selectedEmpresaId)
  const esAdmin = usuario?.rol === 'SUPERADMIN' || usuario?.rol === 'ADMIN'
  const esSuperAdmin = usuario?.rol === 'SUPERADMIN'
  const empresaId = esSuperAdmin ? selectedEmpresaId : usuario?.empresa_id ?? null
  const { show, ToastComponent } = useToast()

  const [nombre,     setNombre]     = useState('')
  const [desc,       setDesc]       = useState('')
  const [catNueva,   setCatNueva]   = useState('')
  const [catFiltro,  setCatFiltro]  = useState('')
  const [editId,     setEditId]     = useState<number | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editDesc,   setEditDesc]   = useState('')
  const [editCat,    setEditCat]    = useState('')

  const { data: categoriasBase = CATEGORIAS_SECOP_FALLBACK } = useQuery<string[]>({
    queryKey: ['categorias-secop-disponibles'],
    queryFn:  () => serviciosApi.categoriasDisponibles(),
    staleTime: 60 * 60 * 1000,
  })

  const { data: categoriasRegistradas = [] } = useQuery<string[]>({
    queryKey: ['servicios-categorias', empresaId],
    queryFn:  () => serviciosApi.categorias(empresaId),
    enabled:  !!empresaId,
  })

  const categoriasDisponibles = useMemo(
    () => Array.from(new Set([...categoriasBase, ...categoriasRegistradas])).sort(),
    [categoriasBase, categoriasRegistradas],
  )

  const { data: servicios = [], isLoading } = useQuery<Servicio[]>({
    queryKey: ['servicios', catFiltro, empresaId],
    queryFn:  () => serviciosApi.listar(true, catFiltro || undefined, empresaId),
    enabled:  !!empresaId,
  })

  const crearMut = useMutation({
    mutationFn: () => serviciosApi.crear({ empresa_id: empresaId, nombre_servicio: nombre.trim(), descripcion: desc.trim() || undefined, categoria: catNueva || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['servicios'] })
      qc.invalidateQueries({ queryKey: ['servicios-categorias'] })
      qc.invalidateQueries({ queryKey: ['sugerencias'] })
      setNombre(''); setDesc(''); setCatNueva('')
      show('Servicio agregado correctamente')
    },
    onError: (e: any) => show(e.response?.data?.detail ?? 'Error al agregar', 'error'),
  })

  const editarMut = useMutation({
    mutationFn: (id: number) => serviciosApi.editar(id, { empresa_id: empresaId, nombre_servicio: editNombre.trim(), descripcion: editDesc.trim() || undefined, categoria: editCat || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['servicios'] })
      qc.invalidateQueries({ queryKey: ['servicios-categorias'] })
      qc.invalidateQueries({ queryKey: ['sugerencias'] })
      setEditId(null)
      show('Servicio actualizado')
    },
    onError: () => show('Error al editar', 'error'),
  })

  const eliminarMut = useMutation({
    mutationFn: (id: number) => serviciosApi.eliminar(id, empresaId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['servicios'] })
      qc.invalidateQueries({ queryKey: ['servicios-categorias'] })
      qc.invalidateQueries({ queryKey: ['sugerencias'] })
      show('Servicio eliminado')
    },
    onError: () => show('Error al eliminar', 'error'),
  })

  const startEdit = (s: Servicio) => { setEditId(s.id); setEditNombre(s.nombre_servicio); setEditDesc(s.descripcion ?? ''); setEditCat(s.categoria ?? '') }

  return (
    <div className="p-6 space-y-6">
      {ToastComponent}

      <div>
        <h1 className="text-xl font-semibold text-gray-900">Catálogo de Servicios</h1>
        <p className="text-sm text-gray-500 mt-0.5">Servicios usados por la IA para identificar oportunidades en SECOP II</p>
      </div>

      {!empresaId ? <SeleccioneEmpresa /> : (
        <>
          {esAdmin && (
            <div className="card p-5">
              <h2 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <Plus size={15} className="text-emerald-600"/> Agregar nuevo servicio
              </h2>
              <div className="grid grid-cols-12 gap-3">
                <input value={nombre} onChange={e => setNombre(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && nombre.trim() && crearMut.mutate()}
                  placeholder="Nombre del servicio (obligatorio)"
                  className="input col-span-12 lg:col-span-4"/>
                <input value={desc} onChange={e => setDesc(e.target.value)}
                  placeholder="Descripción (opcional)"
                  className="input col-span-12 lg:col-span-3"/>
                <select value={catNueva} onChange={e => setCatNueva(e.target.value)} className="input col-span-12 lg:col-span-3">
                  <option value="">Categoría SECOP</option>
                  {categoriasDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={() => nombre.trim() && crearMut.mutate()}
                        disabled={!nombre.trim() || crearMut.isPending}
                        className="btn-primary col-span-12 lg:col-span-2 justify-center">
                  <Plus size={15}/>{crearMut.isPending ? 'Agregando...' : 'Agregar'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Las categorías corresponden a agrupaciones generales usadas para búsquedas SECOP y clasificación por empresa.
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Filter size={14} className="text-gray-400"/>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setCatFiltro('')}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${!catFiltro ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                Todos ({servicios.length})
              </button>
              {categoriasRegistradas.map(c => (
                <button key={c} onClick={() => setCatFiltro(c === catFiltro ? '' : c)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${catFiltro === c ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <Briefcase size={15} className="text-gray-400"/>
              <span className="text-sm font-medium text-gray-700">Servicios registrados</span>
              <span className="ml-auto bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                {servicios.length} activos
              </span>
            </div>

            {isLoading ? (
              <div className="py-12 text-center text-sm text-gray-400">
                <div className="loader w-6 h-6 mx-auto mb-2"/>Cargando...
              </div>
            ) : servicios.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">No hay servicios registrados</div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-8">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Servicio</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-72">Categoría SECOP</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                    {esAdmin && <th className="px-4 py-3 w-24"/>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {servicios.map((s: Servicio, i: number) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-400">{i+1}</td>
                      <td className="px-4 py-3">
                        {editId === s.id
                          ? <input value={editNombre} onChange={e => setEditNombre(e.target.value)} className="input"/>
                          : <span className="text-sm text-gray-900">{s.nombre_servicio}</span>}
                      </td>
                      <td className="px-4 py-3">
                        {editId === s.id
                          ? <select value={editCat} onChange={e => setEditCat(e.target.value)} className="input">
                              <option value="">—</option>
                              {categoriasDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          : s.categoria && <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{s.categoria}</span>}
                      </td>
                      <td className="px-4 py-3">
                        {editId === s.id
                          ? <input value={editDesc} onChange={e => setEditDesc(e.target.value)} className="input" placeholder="Descripción (opcional)"/>
                          : <span className="text-sm text-gray-500">{s.descripcion ?? '—'}</span>}
                      </td>
                      {esAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 justify-end">
                            {editId === s.id ? (
                              <>
                                <button onClick={() => editarMut.mutate(s.id)}
                                        className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200">
                                  <Check size={13}/>
                                </button>
                                <button onClick={() => setEditId(null)}
                                        className="p-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">
                                  <X size={13}/>
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => startEdit(s)}
                                        className="p-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">
                                  <Pencil size={13}/>
                                </button>
                                <button onClick={() => eliminarMut.mutate(s.id)}
                                        className="p-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200">
                                  <Trash2 size={13}/>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
