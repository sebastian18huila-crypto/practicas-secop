import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { UserPlus, Pencil, UserX, Check, X, Users, Shield, Building2 } from 'lucide-react'
import { authApi, empresasApi } from '../api'
import { RolBadge, useToast } from '../components/Badge'
import { useAuthStore } from '../store/authStore'
import { useEmpresaStore } from '../store/empresaStore'
import type { Empresa, Usuario, Rol } from '../types'

const ROLES: Rol[] = ['SUPERADMIN', 'ADMIN', 'ANALISTA', 'VIEWER']
const ROLES_VISIBLES: Rol[] = ['ADMIN', 'ANALISTA', 'VIEWER']

const ROL_DESC: Record<Rol, string> = {
  SUPERADMIN: 'Acceso total y administración de empresas',
  ADMIN:      'Gestiona usuarios, servicios, configuración y gobernanza de su empresa',
  ANALISTA:   'Ejecuta scans, ve y exporta oportunidades',
  VIEWER:     'Solo lectura de oportunidades',
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface RegisterForm {
  email: string
  nombre: string
  password: string
  rol: Rol
  empresa_id?: number | null
}

function SeleccioneEmpresa() {
  return (
    <div className="card p-8 text-center text-gray-500">
      <Building2 size={32} className="mx-auto mb-3 text-gray-300"/>
      <p className="text-sm font-medium text-gray-700">Seleccione una empresa para gestionar usuarios.</p>
      <p className="text-xs mt-1">Los usuarios creados quedarán asociados a la empresa seleccionada.</p>
    </div>
  )
}

export default function Usuarios() {
  const qc                       = useQueryClient()
  const actual                   = useAuthStore(s => s.usuario)
  const selectedEmpresaId        = useEmpresaStore(s => s.selectedEmpresaId)
  const esSuperAdmin             = actual?.rol === 'SUPERADMIN'
  const empresaId                = esSuperAdmin ? selectedEmpresaId : actual?.empresa_id ?? null
  const { show, ToastComponent } = useToast()
  const [showForm, setShowForm]  = useState(false)
  const [editId,   setEditId]    = useState<number | null>(null)
  const [editRol,  setEditRol]   = useState<Rol>('VIEWER')
  const [editActivo, setEditActivo] = useState(true)
  const [editEmpresaId, setEditEmpresaId] = useState<number | null>(null)

  const { data: empresas = [] } = useQuery<Empresa[]>({
    queryKey: ['empresas'],
    queryFn: () => empresasApi.listar(false),
    enabled: esSuperAdmin,
  })

  const { data: usuarios = [], isLoading } = useQuery<Usuario[]>({
    queryKey: ['usuarios', empresaId],
    queryFn:  () => authApi.getUsers(empresaId),
    enabled:  !!empresaId || !esSuperAdmin,
  })

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<RegisterForm>({
    defaultValues: { rol: 'VIEWER', empresa_id: actual?.empresa_id ?? undefined },
  })

  const rolSeleccionado = watch('rol')

  const crearMut = useMutation({
    mutationFn: (data: RegisterForm) => authApi.register({
      ...data,
      email: data.email.trim().toLowerCase(),
      empresa_id: data.rol === 'SUPERADMIN' ? null : Number(data.empresa_id ?? empresaId),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios'] })
      reset({ rol: 'VIEWER', empresa_id: empresaId ?? undefined })
      setShowForm(false)
      show('Usuario creado correctamente')
    },
    onError: (e: any) => show(e.response?.data?.detail ?? 'Error al crear usuario', 'error'),
  })

  const editarMut = useMutation({
    mutationFn: (id: number) => authApi.updateUser(id, {
      rol: editRol,
      activo: editActivo,
      ...(esSuperAdmin ? { empresa_id: editRol === 'SUPERADMIN' ? null : editEmpresaId } : {}),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios'] })
      setEditId(null)
      show('Usuario actualizado')
    },
    onError: (e: any) => show(e.response?.data?.detail ?? 'Error al actualizar', 'error'),
  })

  const desactivarMut = useMutation({
    mutationFn: authApi.deleteUser,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['usuarios'] }); show('Usuario desactivado') },
    onError: (e: any) => show(e.response?.data?.detail ?? 'Error al desactivar', 'error'),
  })

  const startEdit = (u: Usuario) => {
    setEditId(u.id)
    setEditRol(u.rol as Rol)
    setEditActivo(u.activo)
    setEditEmpresaId(u.empresa_id ?? null)
  }

  return (
    <div className="p-6 space-y-6">
      {ToastComponent}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Gestión de Usuarios</h1>
          <p className="text-sm text-gray-500 mt-0.5">Administra usuarios, roles y empresa asociada</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} disabled={!empresaId && esSuperAdmin} className="btn-primary">
          <UserPlus size={15}/> Nuevo usuario
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {ROLES_VISIBLES.map(rol => (
          <div key={rol} className="card p-3 flex items-start gap-3">
            <Shield size={16} className="text-gray-400 mt-0.5 shrink-0"/>
            <div>
              <RolBadge rol={rol}/>
              <p className="text-xs text-gray-500 mt-1">{ROL_DESC[rol]}</p>
            </div>
          </div>
        ))}
      </div>

      {!empresaId && esSuperAdmin ? <SeleccioneEmpresa /> : (
        <>
          {showForm && (
            <div className="card p-5 animate-slide-up">
              <h2 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
                <UserPlus size={15}/> Crear nuevo usuario
              </h2>
              <form onSubmit={handleSubmit(d => crearMut.mutate(d))} className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Nombre completo</label>
                  <input className="input" placeholder="Juan Pérez" {...register('nombre', { required: 'Obligatorio' })}/>
                  {errors.nombre && <p className="text-xs text-red-500 mt-1">{errors.nombre.message}</p>}
                </div>
                <div>
                  <label className="label">Correo electrónico</label>
                  <input type="email" className="input" placeholder="juan@empresa.com" {...register('email', {
                    required: 'Obligatorio',
                    pattern: { value: EMAIL_REGEX, message: 'Correo electrónico inválido' },
                  })}/>
                  {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
                  <p className="text-[11px] text-gray-400 mt-1">Este correo se usará para recuperación de contraseña.</p>
                </div>
                <div>
                  <label className="label">Contraseña temporal</label>
                  <input type="password" className="input" placeholder="Mínimo 8 caracteres"
                    {...register('password', { required: 'Obligatorio', minLength: { value: 8, message: 'Mínimo 8 caracteres' } })}/>
                  {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
                </div>
                <div>
                  <label className="label">Rol</label>
                  <select className="input" {...register('rol')}>
                    {ROLES.filter(r => r !== 'SUPERADMIN' || esSuperAdmin).map(r => (
                      <option key={r} value={r}>{r} — {ROL_DESC[r]}</option>
                    ))}
                  </select>
                </div>
                {esSuperAdmin && rolSeleccionado !== 'SUPERADMIN' && (
                  <div className="col-span-2">
                    <label className="label">Empresa</label>
                    <select className="input" defaultValue={empresaId ?? ''} {...register('empresa_id', { required: 'Debe seleccionar una empresa' })}>
                      <option value="">Seleccione empresa</option>
                      {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                    </select>
                    {errors.empresa_id && <p className="text-xs text-red-500 mt-1">{errors.empresa_id.message}</p>}
                  </div>
                )}
                <div className="col-span-2 flex gap-3 justify-end pt-2">
                  <button type="button" onClick={() => { setShowForm(false); reset() }} className="btn-secondary">Cancelar</button>
                  <button type="submit" disabled={crearMut.isPending} className="btn-primary">
                    {crearMut.isPending ? 'Creando...' : 'Crear usuario'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <Users size={15} className="text-gray-400"/>
              <span className="text-sm font-medium text-gray-700">Usuarios registrados</span>
              <span className="ml-auto bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{usuarios.length}</span>
            </div>

            {isLoading ? (
              <div className="py-12 text-center text-sm text-gray-400"><div className="loader w-6 h-6 mx-auto mb-2"/>Cargando usuarios...</div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {['Nombre','Email','Empresa','Rol','Estado','Último acceso','Acciones'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {usuarios.map((u: Usuario) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{u.nombre}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {editId === u.id && esSuperAdmin && editRol !== 'SUPERADMIN' ? (
                          <select value={editEmpresaId ?? ''} onChange={e => setEditEmpresaId(Number(e.target.value))} className="input text-xs py-1">
                            <option value="">Seleccione</option>
                            {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                          </select>
                        ) : (u.empresa_nombre ?? '—')}
                      </td>
                      <td className="px-4 py-3">
                        {editId === u.id ? (
                          <select value={editRol} onChange={e => setEditRol(e.target.value as Rol)} className="input text-xs py-1">
                            {ROLES.filter(r => r !== 'SUPERADMIN' || esSuperAdmin).map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        ) : <RolBadge rol={u.rol}/>}
                      </td>
                      <td className="px-4 py-3">
                        {editId === u.id ? (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={editActivo} onChange={e => setEditActivo(e.target.checked)} className="w-4 h-4 accent-brand-600"/>
                            <span className="text-xs text-gray-600">Activo</span>
                          </label>
                        ) : (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${u.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
                            {u.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleDateString('es-CO') : '—'}</td>
                      <td className="px-4 py-3">
                        {u.id !== actual?.id && (
                          <div className="flex items-center gap-1.5">
                            {editId === u.id ? (
                              <>
                                <button onClick={() => editarMut.mutate(u.id)} className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200"><Check size={13}/></button>
                                <button onClick={() => setEditId(null)} className="p-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"><X size={13}/></button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => startEdit(u)} className="p-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"><Pencil size={13}/></button>
                                {u.activo && <button onClick={() => confirm(`¿Desactivar a ${u.nombre}?`) && desactivarMut.mutate(u.id)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><UserX size={13}/></button>}
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {usuarios.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">No hay usuarios registrados</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
