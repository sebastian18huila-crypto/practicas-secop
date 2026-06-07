import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Target, Eye, EyeOff } from 'lucide-react'
import { authApi } from '../api'
import { useAuthStore } from '../store/authStore'
import { useBrandingStore } from '../store/brandingStore'

interface Form { email: string; password: string }

export default function Login() {
  const navigate     = useNavigate()
  const setAuth      = useAuthStore(s => s.setAuth)
  const { branding, setBranding } = useBrandingStore()
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [showPass, setShowPass] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<Form>()

  const onSubmit = async (data: Form) => {
    setError(''); setLoading(true)
    try {
      const res = await authApi.login(data.email, data.password)
      setAuth(res.access_token, {
        id: res.id,
        email: res.email ?? data.email,
        nombre: res.nombre,
        rol: res.rol,
        activo: true,
        empresa_id: res.empresa_id ?? null,
        empresa_nombre: res.empresa_nombre ?? null,
      })
      if (res.empresa_id) {
        authApi.getBranding(res.empresa_id).then(setBranding).catch(() => {})
      }
      navigate('/dashboard')
    } catch (e: any) {
      setError(e.response?.data?.detail ?? 'Credenciales incorrectas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: `linear-gradient(135deg, ${branding.empresa_color_primary} 0%, ${branding.empresa_color_secondary} 100%)` }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          {branding.empresa_logo_url ? (
            <img src={branding.empresa_logo_url} alt={branding.empresa_nombre}
                 className="h-12 mx-auto mb-3 object-contain" />
          ) : (
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3"
                 style={{ background: branding.empresa_color_primary }}>
              <Target className="text-white" size={24} />
            </div>
          )}
          <h1 className="text-xl font-bold text-gray-900">{branding.empresa_nombre}</h1>
          <p className="text-sm text-gray-500 mt-1">SECOP Intelligence v3.0</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Correo electrónico</label>
            <input type="email" className="input"
              placeholder="admin@empresa.com"
              {...register('email', { required: 'El correo es obligatorio' })}
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="label">Contraseña</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} className="input pr-10"
                placeholder="••••••••"
                {...register('password', { required: 'La contraseña es obligatoria' })}
              />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
            {loading ? (
              <><span className="loader w-4 h-4 inline-block" /> Iniciando sesión...</>
            ) : 'Iniciar sesión'}
          </button>
        </form>

        <div className="mt-5 space-y-2 text-center text-sm">
          <Link to="/forgot-password" className="block text-gray-500 hover:underline"
                style={{ color: branding.empresa_color_primary }}>
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
      </div>
    </div>
  )
}
