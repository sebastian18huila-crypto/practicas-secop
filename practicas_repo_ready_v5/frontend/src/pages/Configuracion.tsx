import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock, Sliders, Save, Palette, UsersRound, Trash2, Eye, Plus, X, Building2 } from 'lucide-react'
import { authApi, empresasApi, gobernanzaApi, notificacionesApi, oportunidadesApi, schedulerApi } from '../api'
import { useAuthStore } from '../store/authStore'
import { useBrandingStore } from '../store/brandingStore'
import { useEmpresaStore } from '../store/empresaStore'
import { useToast } from '../components/Badge'
import type { Destinatario, Empresa, SchedulerConfig } from '../types'

const hoy = new Date().toISOString().slice(0, 10)

export default function Configuracion() {
  const qc = useQueryClient()
  const usuario  = useAuthStore(s => s.usuario)
  const esAdmin  = usuario?.rol === 'SUPERADMIN' || usuario?.rol === 'ADMIN'
  const esSuperAdmin = usuario?.rol === 'SUPERADMIN'
  const { setBranding } = useBrandingStore()
  const { selectedEmpresaId, setSelectedEmpresaId } = useEmpresaStore()
  const { show, ToastComponent } = useToast()

  const { data: empresas = [] } = useQuery<Empresa[]>({
    queryKey: ['empresas'],
    queryFn: () => empresasApi.listar(false),
    enabled: esSuperAdmin,
  })

  const empresaId = esSuperAdmin ? selectedEmpresaId : usuario?.empresa_id ?? null

  const empresaActual = useMemo(() => {
    if (esSuperAdmin) return empresas.find(e => e.id === empresaId) ?? null
    return null
  }, [empresas, empresaId, esSuperAdmin])

  const { data: brandingActual } = useQuery({
    queryKey: ['branding-config', empresaId],
    queryFn: () => authApi.getBranding(empresaId),
    enabled: !!empresaId,
  })

  const [form, setForm] = useState<SchedulerConfig>({
    empresa_id: empresaId,
    hora_manana: '09:00', hora_tarde: '15:00',
    activo: true, umbral_ia: 0.50, filtro_depto: null,
  })

  const [brandingForm, setBrandingForm] = useState({
    nombre: '', logo_url: '', color_primary: '#1a56db', color_secondary: '#0e3a8c',
  })

  const [destForm, setDestForm] = useState<any>({
    nombre: '', email: '', telefono_whatsapp: '', recibe_email: true, recibe_whatsapp: false, activo: true,
  })

  const [limpieza, setLimpieza] = useState({
    antes_de: hoy, score_maximo: '0.60', servicio: '', departamento: '',
  })
  const [preview, setPreview] = useState<any>(null)

  const { data: config } = useQuery<SchedulerConfig>({
    queryKey: ['scheduler-config', empresaId],
    queryFn: () => schedulerApi.getConfig(empresaId),
    enabled: !!empresaId,
  })

  const { data: destinatarios = [] } = useQuery<Destinatario[]>({
    queryKey: ['destinatarios', empresaId],
    queryFn: () => notificacionesApi.listar(empresaId),
    enabled: !!empresaId,
  })

  const { data: stats } = useQuery({
    queryKey: ['estadisticas-config', empresaId],
    queryFn: () => oportunidadesApi.estadisticas(empresaId),
    enabled: !!empresaId,
  })

  useEffect(() => { if (config) setForm(config) }, [config])
  useEffect(() => {
    if (empresaActual) {
      setBrandingForm({
        nombre: empresaActual.nombre,
        logo_url: empresaActual.logo_url ?? '',
        color_primary: empresaActual.color_primary,
        color_secondary: empresaActual.color_secondary,
      })
    } else if (brandingActual) {
      setBrandingForm({
        nombre: brandingActual.empresa_nombre,
        logo_url: brandingActual.empresa_logo_url ?? '',
        color_primary: brandingActual.empresa_color_primary,
        color_secondary: brandingActual.empresa_color_secondary,
      })
    }
  }, [empresaActual, brandingActual])

  const saveMut = useMutation({
    mutationFn: () => schedulerApi.updateConfig({ ...form, empresa_id: empresaId }),
    onSuccess: (d) => show(d.mensaje),
    onError: (e: any) => show(e.response?.data?.detail ?? 'Error al guardar', 'error'),
  })

  const brandingMut = useMutation({
    mutationFn: () => empresasApi.actualizarBranding(empresaId!, brandingForm),
    onSuccess: (empresa: Empresa) => {
      qc.invalidateQueries({ queryKey: ['empresas'] })
      setBranding({
        empresa_id: empresa.id,
        empresa_nombre: empresa.nombre,
        empresa_logo_url: empresa.logo_url ?? '',
        empresa_color_primary: empresa.color_primary,
        empresa_color_secondary: empresa.color_secondary,
      })
      show('Imagen corporativa actualizada')
    },
    onError: (e: any) => show(e.response?.data?.detail ?? 'Error al guardar branding', 'error'),
  })

  const crearDestMut = useMutation({
    mutationFn: () => notificacionesApi.crear({ ...destForm, empresa_id: empresaId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['destinatarios'] })
      setDestForm({ nombre: '', email: '', telefono_whatsapp: '', recibe_email: true, recibe_whatsapp: false, activo: true })
      show('Destinatario agregado')
    },
    onError: (e: any) => show(e.response?.data?.detail ?? 'Error al crear destinatario', 'error'),
  })

  const eliminarDestMut = useMutation({
    mutationFn: (id: number) => notificacionesApi.eliminar(id, empresaId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['destinatarios'] }); show('Destinatario desactivado') },
    onError: () => show('Error al desactivar destinatario', 'error'),
  })

  const previewMut = useMutation({
    mutationFn: () => gobernanzaApi.previsualizar({
      empresa_id: empresaId,
      antes_de: limpieza.antes_de || null,
      score_maximo: limpieza.score_maximo ? Number(limpieza.score_maximo) : null,
      servicio: limpieza.servicio || null,
      departamento: limpieza.departamento || null,
    }),
    onSuccess: setPreview,
    onError: (e: any) => show(e.response?.data?.detail ?? 'Error al previsualizar', 'error'),
  })

  const liberarMut = useMutation({
    mutationFn: () => gobernanzaApi.liberar({
      empresa_id: empresaId,
      antes_de: limpieza.antes_de || null,
      score_maximo: limpieza.score_maximo ? Number(limpieza.score_maximo) : null,
      servicio: limpieza.servicio || null,
      departamento: limpieza.departamento || null,
      confirmar: true,
    }),
    onSuccess: (d) => {
      setPreview(null)
      qc.invalidateQueries({ queryKey: ['oportunidades'] })
      qc.invalidateQueries({ queryKey: ['estadisticas'] })
      show(`Procesos eliminados: ${d.registros_eliminados}`)
    },
    onError: (e: any) => show(e.response?.data?.detail ?? 'Error al liberar procesos', 'error'),
  })

  const set = (k: keyof SchedulerConfig, v: any) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {ToastComponent}

      <div>
        <h1 className="text-xl font-semibold text-gray-900">Configuración</h1>
        <p className="text-sm text-gray-500 mt-0.5">Parámetros por empresa, destinatarios y gobernanza de información</p>
      </div>

      {esSuperAdmin && (
        <div className="card p-5">
          <label className="label">Empresa a configurar</label>
          <select className="input max-w-md" value={empresaId ?? ''} onChange={e => { setSelectedEmpresaId(e.target.value ? Number(e.target.value) : null); setPreview(null) }}>
            <option value="">Seleccione empresa</option>
            {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
      )}

      {!empresaId ? (
        <div className="card p-8 text-center text-gray-500">
          <Building2 size={32} className="mx-auto mb-3 text-gray-300"/>
          <p className="text-sm font-medium text-gray-700">Seleccione una empresa para configurar parámetros.</p>
          <p className="text-xs mt-1">El SUPERADMIN debe escoger la empresa desde el panel lateral o desde este selector.</p>
        </div>
      ) : (
      <>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5 space-y-5">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-brand-600"/>
            <h2 className="text-sm font-semibold text-gray-800">Horario de escaneo automático</h2>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-700">Escaneo activo</p>
              <p className="text-xs text-gray-500">Habilita o deshabilita el ciclo automático diario para la empresa.</p>
            </div>
            <button onClick={() => esAdmin && set('activo', !form.activo)} disabled={!esAdmin} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.activo ? 'bg-brand-600' : 'bg-gray-300'} ${!esAdmin ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.activo ? 'translate-x-6' : 'translate-x-1'}`}/>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Escaneo mañana</label>
              <input type="time" value={form.hora_manana} onChange={e => set('hora_manana', e.target.value)} disabled={!esAdmin} className="input"/>
            </div>
            <div>
              <label className="label">Escaneo tarde</label>
              <input type="time" value={form.hora_tarde} onChange={e => set('hora_tarde', e.target.value)} disabled={!esAdmin} className="input"/>
            </div>
          </div>

          <div>
            <label className="label">Filtro por departamento</label>
            <input type="text" value={form.filtro_depto ?? ''} onChange={e => set('filtro_depto', e.target.value || null)} disabled={!esAdmin} placeholder="Ej: Huila — vacío busca en Colombia" className="input"/>
          </div>
        </div>

        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Sliders size={16} className="text-brand-600"/>
            <h2 className="text-sm font-semibold text-gray-800">Parámetros de IA</h2>
          </div>

          <div>
            <label className="label">Umbral de similitud — <strong>{(form.umbral_ia * 100).toFixed(0)}%</strong></label>
            <p className="text-xs text-gray-500 mb-3">Mínimo score para considerar una licitación relevante. Recomendado: 45–55%.</p>
            <div className="flex items-center gap-4">
              <input type="range" min="0.30" max="0.85" step="0.05" value={form.umbral_ia} onChange={e => set('umbral_ia', parseFloat(e.target.value))} disabled={!esAdmin} className="flex-1 accent-brand-600 disabled:opacity-50"/>
              <span className="w-14 text-center text-sm font-semibold bg-gray-100 px-2 py-1 rounded-lg">{(form.umbral_ia * 100).toFixed(0)}%</span>
            </div>
          </div>

          {esAdmin && (
            <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !empresaId} className="btn-primary">
              <Save size={15}/>{saveMut.isPending ? 'Guardando...' : 'Guardar configuración'}
            </button>
          )}
        </div>
      </div>

      {esAdmin && empresaId && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Palette size={16} className="text-brand-600"/>
            <h2 className="text-sm font-semibold text-gray-800">Imagen corporativa</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nombre visible</label>
              <input className="input" value={brandingForm.nombre} onChange={e => setBrandingForm(f => ({ ...f, nombre: e.target.value }))}/>
            </div>
            <div>
              <label className="label">Logo URL</label>
              <input className="input" value={brandingForm.logo_url} onChange={e => setBrandingForm(f => ({ ...f, logo_url: e.target.value }))}/>
            </div>
            <div>
              <label className="label">Color primario</label>
              <input type="color" className="input h-10 p-1" value={brandingForm.color_primary} onChange={e => setBrandingForm(f => ({ ...f, color_primary: e.target.value }))}/>
            </div>
            <div>
              <label className="label">Color secundario</label>
              <input type="color" className="input h-10 p-1" value={brandingForm.color_secondary} onChange={e => setBrandingForm(f => ({ ...f, color_secondary: e.target.value }))}/>
            </div>
          </div>
          <button onClick={() => brandingMut.mutate()} disabled={brandingMut.isPending} className="btn-primary"><Save size={15}/>Guardar imagen corporativa</button>
        </div>
      )}

      {esAdmin && empresaId && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <UsersRound size={16} className="text-brand-600"/>
            <h2 className="text-sm font-semibold text-gray-800">Destinatarios de notificación</h2>
          </div>
          <div className="grid grid-cols-5 gap-3">
            <input className="input" placeholder="Nombre" value={destForm.nombre} onChange={e => setDestForm((f: any) => ({ ...f, nombre: e.target.value }))}/>
            <input className="input" placeholder="Correo" value={destForm.email} onChange={e => setDestForm((f: any) => ({ ...f, email: e.target.value }))}/>
            <input className="input" placeholder="WhatsApp" value={destForm.telefono_whatsapp} onChange={e => setDestForm((f: any) => ({ ...f, telefono_whatsapp: e.target.value }))}/>
            <div className="flex items-center gap-3 text-xs text-gray-600">
              <label className="flex items-center gap-1"><input type="checkbox" checked={destForm.recibe_email} onChange={e => setDestForm((f: any) => ({ ...f, recibe_email: e.target.checked }))}/> Email</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={destForm.recibe_whatsapp} onChange={e => setDestForm((f: any) => ({ ...f, recibe_whatsapp: e.target.checked }))}/> WhatsApp</label>
            </div>
            <button className="btn-primary" onClick={() => crearDestMut.mutate()} disabled={!destForm.nombre.trim()}><Plus size={15}/>Agregar</button>
          </div>
          <div className="overflow-hidden border rounded-lg">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>{['Nombre','Correo','WhatsApp','Canales','Estado',''].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {destinatarios.map(d => (
                  <tr key={d.id}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{d.nombre}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{d.email ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{d.telefono_whatsapp ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{[d.recibe_email && 'Email', d.recibe_whatsapp && 'WhatsApp'].filter(Boolean).join(' / ') || '—'}</td>
                    <td className="px-4 py-3"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${d.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>{d.activo ? 'Activo' : 'Inactivo'}</span></td>
                    <td className="px-4 py-3 text-right">{d.activo && <button onClick={() => confirm(`¿Desactivar ${d.nombre}?`) && eliminarDestMut.mutate(d.id)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><X size={13}/></button>}</td>
                  </tr>
                ))}
                {destinatarios.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">No hay destinatarios configurados</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {esAdmin && empresaId && (
        <div className="card p-5 space-y-4 border-red-200">
          <div className="flex items-center gap-2">
            <Trash2 size={16} className="text-red-600"/>
            <h2 className="text-sm font-semibold text-gray-800">Gobernanza y liberación de BD</h2>
          </div>
          <p className="text-xs text-gray-500">Permite eliminar oportunidades ya trasladadas al CRM/Excel o información que no se requiere conservar.</p>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="label">Antes de</label>
              <input type="date" className="input" value={limpieza.antes_de} onChange={e => setLimpieza(f => ({ ...f, antes_de: e.target.value }))}/>
            </div>
            <div>
              <label className="label">Score máximo</label>
              <input type="number" min="0" max="1" step="0.05" className="input" value={limpieza.score_maximo} onChange={e => setLimpieza(f => ({ ...f, score_maximo: e.target.value }))}/>
            </div>
            <div>
              <label className="label">Servicio contiene</label>
              <input className="input" value={limpieza.servicio} onChange={e => setLimpieza(f => ({ ...f, servicio: e.target.value }))}/>
            </div>
            <div>
              <label className="label">Departamento</label>
              <select className="input" value={limpieza.departamento} onChange={e => setLimpieza(f => ({ ...f, departamento: e.target.value }))}>
                <option value="">Todos</option>
                {(preview?.departamentos ?? stats?.departamentos ?? []).map((d: string) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => previewMut.mutate()} className="btn-secondary"><Eye size={15}/>Previsualizar</button>
            <button onClick={() => preview?.total > 0 && confirm(`Se eliminarán ${preview.total} procesos. ¿Continuar?`) && liberarMut.mutate()} disabled={!preview?.total} className="btn-danger"><Trash2 size={15}/>Eliminar procesos filtrados</button>
          </div>
          {preview && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-red-800">Procesos encontrados: {preview.total}</p>
              <div className="mt-2 space-y-1 text-xs text-red-700">
                {preview.muestras?.map((m: any) => <p key={m.id}>• {m.id_proceso_secop} — {m.entidad_publica} — {m.departamento ?? 'Sin departamento'} — {(m.score_ia * 100).toFixed(1)}%</p>)}
              </div>
            </div>
          )}
        </div>
      )}
      </>
      )}
    </div>
  )
}
