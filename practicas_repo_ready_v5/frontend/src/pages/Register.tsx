import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Target } from 'lucide-react'
import { authApi } from '../api'
import { useBrandingStore } from '../store/brandingStore'

interface Form { nombre: string; email: string; password: string; confirmar: string }

export default function Register() {
  const navigate = useNavigate()
  const { branding } = useBrandingStore()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ok, setOk] = useState(false)
  const { register, handleSubmit, watch, formState: { errors } } = useForm<Form>()
  const password = watch('password')

  const onSubmit = async (data: Form) => {
    setError(''); setLoading(true)
    try {
      await authApi.register({ email: data.email, nombre: data.nombre, password: data.password, rol: 'VIEWER' })
      setOk(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (e: any) {
      setError(e.response?.data?.detail ?? 'Error al registrar usuario')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: `linear-gradient(135deg, ${branding.empresa_color_primary} 0%, ${branding.empresa_color_secondary} 100%)` }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 animate-fade-in">
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3"
               style={{ background: branding.empresa_color_primary }}>
            <Target className="text-white" size={24} />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Crear cuenta</h1>
          <p className="text-sm text-gray-500 mt-1">{branding.empresa_nombre}</p>
        </div>

        {ok ? (
          <div className="bg-emerald-50 text-emerald-700 text-sm px-4 py-3 rounded-lg text-center border border-emerald-200">
            ✅ Cuenta creada. Redirigiendo al login...
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Nombre completo</label>
              <input type="text" className="input" placeholder="Juan Pérez"
                {...register('nombre', { required: 'El nombre es obligatorio' })} />
              {errors.nombre && <p className="text-xs text-red-500 mt-1">{errors.nombre.message}</p>}
            </div>
            <div>
              <label className="label">Correo electrónico</label>
              <input type="email" className="input" placeholder="juan@empresa.com"
                {...register('email', { required: 'El correo es obligatorio' })} />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="label">Contraseña</label>
              <input type="password" className="input" placeholder="Mínimo 8 caracteres"
                {...register('password', { required: true, minLength: { value: 8, message: 'Mínimo 8 caracteres' } })} />
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
            </div>
            <div>
              <label className="label">Confirmar contraseña</label>
              <input type="password" className="input" placeholder="Repite la contraseña"
                {...register('confirmar', { validate: v => v === password || 'Las contraseñas no coinciden' })} />
              {errors.confirmar && <p className="text-xs text-red-500 mt-1">{errors.confirmar.message}</p>}
            </div>
            {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg border border-red-200">{error}</div>}
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
              {loading ? 'Registrando...' : 'Crear cuenta'}
            </button>
          </form>
        )}
        <p className="mt-5 text-center text-sm text-gray-500">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-medium hover:underline" style={{ color: branding.empresa_color_primary }}>
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
