import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { empresasApi } from '../api'
import { useToast } from '../components/Badge'
import type { Empresa } from '../types'

const EMPRESA_DEFAULT = {
  nombre: '', nit: '', dominio: '', logo_url: '',
  color_primary: '#1a56db', color_secondary: '#0e3a8c',
  correo_emisor: '', correo_contrasena: '', url_api_whatsapp: '', token_whatsapp: '', activo: true,
}

export default function Empresas() {
  const qc = useQueryClient()
  const { show, ToastComponent } = useToast()
  const [form, setForm] = useState<any>(EMPRESA_DEFAULT)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)

  const { data: empresas = [], isLoading } = useQuery<Empresa[]>({
    queryKey: ['empresas'],
    queryFn: () => empresasApi.listar(true),
  })

  const crearMut = useMutation({
    mutationFn: () => empresasApi.crear(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['empresas'] })
      setForm(EMPRESA_DEFAULT); setShowForm(false)
      show('Empresa creada correctamente')
    },
    onError: (e: any) => show(e.response?.data?.detail ?? 'Error al crear empresa', 'error'),
  })

  const editarMut = useMutation({
    mutationFn: () => empresasApi.editar(editId!, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['empresas'] })
      setEditId(null); setForm(EMPRESA_DEFAULT)
      show('Empresa actualizada')
    },
    onError: (e: any) => show(e.response?.data?.detail ?? 'Error al actualizar empresa', 'error'),
  })

  const desactivarMut = useMutation({
    mutationFn: empresasApi.desactivar,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['empresas'] }); show('Empresa desactivada') },
    onError: () => show('Error al desactivar empresa', 'error'),
  })

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))
  const startEdit = (e: Empresa) => {
    setEditId(e.id)
    setShowForm(true)
    setForm({
      nombre: e.nombre,
      nit: e.nit ?? '',
      dominio: e.dominio ?? '',
      logo_url: e.logo_url ?? '',
      color_primary: e.color_primary,
      color_secondary: e.color_secondary,
      correo_emisor: e.correo_emisor ?? '',
      correo_contrasena: '',
      url_api_whatsapp: e.url_api_whatsapp ?? '',
      token_whatsapp: '',
      activo: e.activo,
    })
  }

  const cancelar = () => { setEditId(null); setShowForm(false); setForm(EMPRESA_DEFAULT) }

  return (
    <div className="p-6 space-y-6">
      {ToastComponent}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Empresas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Parametrización general para replicar el servicio por empresa</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm(EMPRESA_DEFAULT) }} className="btn-primary">
          <Plus size={15}/> Nueva empresa
        </button>
      </div>

      {showForm && (
        <div className="card p-5 space-y-4 animate-slide-up">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-brand-600"/>
            <h2 className="text-sm font-semibold text-gray-800">{editId ? 'Editar empresa' : 'Crear empresa'}</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nombre</label>
              <input className="input" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Nombre comercial"/>
            </div>
            <div>
              <label className="label">NIT</label>
              <input className="input" value={form.nit} onChange={e => set('nit', e.target.value)} placeholder="Opcional"/>
            </div>
            <div>
              <label className="label">Dominio</label>
              <input className="input" value={form.dominio} onChange={e => set('dominio', e.target.value)} placeholder="empresa.com"/>
            </div>
            <div>
              <label className="label">Logo URL</label>
              <input className="input" value={form.logo_url} onChange={e => set('logo_url', e.target.value)} placeholder="https://..."/>
            </div>
            <div>
              <label className="label">Color primario</label>
              <input type="color" className="input h-10 p-1" value={form.color_primary} onChange={e => set('color_primary', e.target.value)}/>
            </div>
            <div>
              <label className="label">Color secundario</label>
              <input type="color" className="input h-10 p-1" value={form.color_secondary} onChange={e => set('color_secondary', e.target.value)}/>
            </div>
            <div>
              <label className="label">Correo emisor</label>
              <input className="input" value={form.correo_emisor} onChange={e => set('correo_emisor', e.target.value)} placeholder="notificaciones@empresa.com"/>
            </div>
            <div>
              <label className="label">Contraseña correo</label>
              <input type="password" className="input" value={form.correo_contrasena} onChange={e => set('correo_contrasena', e.target.value)} placeholder={editId ? 'Dejar vacío para no cambiar' : 'Contraseña o app password'}/>
            </div>
            <div>
              <label className="label">URL API WhatsApp</label>
              <input className="input" value={form.url_api_whatsapp} onChange={e => set('url_api_whatsapp', e.target.value)} placeholder="https://..."/>
            </div>
            <div>
              <label className="label">Token WhatsApp</label>
              <input type="password" className="input" value={form.token_whatsapp} onChange={e => set('token_whatsapp', e.target.value)} placeholder={editId ? 'Dejar vacío para no cambiar' : 'Token'}/>
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.activo} onChange={e => set('activo', e.target.checked)} className="accent-brand-600"/>
            Empresa activa
          </label>

          <div className="flex justify-end gap-3">
            <button onClick={cancelar} className="btn-secondary"><X size={15}/> Cancelar</button>
            <button onClick={() => editId ? editarMut.mutate() : crearMut.mutate()} disabled={!form.nombre.trim()} className="btn-primary">
              <Check size={15}/>{editId ? 'Guardar cambios' : 'Crear empresa'}
            </button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <Building2 size={15} className="text-gray-400"/>
          <span className="text-sm font-medium text-gray-700">Empresas registradas</span>
          <span className="ml-auto bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{empresas.length}</span>
        </div>
        {isLoading ? (
          <div className="py-12 text-center text-sm text-gray-400"><div className="loader w-6 h-6 mx-auto mb-2"/>Cargando...</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {['Empresa','NIT','Dominio','Branding','Estado','Acciones'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {empresas.map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{e.nombre}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{e.nit ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{e.dominio ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded border" style={{ background: e.color_primary }}/>
                      <span className="w-5 h-5 rounded border" style={{ background: e.color_secondary }}/>
                      {e.logo_url && <span className="text-xs text-gray-500 truncate max-w-[120px]">Logo configurado</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${e.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
                      {e.activo ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => startEdit(e)} className="p-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"><Pencil size={13}/></button>
                      {e.activo && (
                        <button onClick={() => confirm(`¿Desactivar ${e.nombre}?`) && desactivarMut.mutate(e.id)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><Trash2 size={13}/></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
