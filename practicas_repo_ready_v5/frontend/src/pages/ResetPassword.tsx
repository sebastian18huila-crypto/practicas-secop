import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Target, ArrowLeft } from 'lucide-react'
import { authApi } from '../api'
import { useBrandingStore } from '../store/brandingStore'

interface Form { nueva_password: string; confirmar: string }

export default function ResetPassword() {
  const { token }    = useParams<{ token: string }>()
  const navigate     = useNavigate()
  const { branding } = useBrandingStore()
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [ok, setOk]           = useState(false)
  const { register, handleSubmit, watch, formState: { errors } } = useForm<Form>()
  const nueva_password = watch('nueva_password')

  const onSubmit = async (data: Form) => {
    if (!token) return
    setError(''); setLoading(true)
    try {
      await authApi.resetPassword(token, data.nueva_password)
      setOk(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (e: any) {
      setError(e.response?.data?.detail ?? 'Token inválido o expirado')
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
          <h1 className="text-xl font-bold text-gray-900">Nueva contraseña</h1>
        </div>

        {ok ? (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-lg text-center">
            ✅ Contraseña actualizada. Redirigiendo al login...
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Nueva contraseña</label>
              <input type="password" className="input" placeholder="Mínimo 8 caracteres"
                {...register('nueva_password', { required: true, minLength: { value: 8, message: 'Mínimo 8 caracteres' } })} />
              {errors.nueva_password && <p className="text-xs text-red-500 mt-1">{errors.nueva_password.message}</p>}
            </div>
            <div>
              <label className="label">Confirmar contraseña</label>
              <input type="password" className="input" placeholder="Repite la contraseña"
                {...register('confirmar', { validate: v => v === nueva_password || 'Las contraseñas no coinciden' })} />
              {errors.confirmar && <p className="text-xs text-red-500 mt-1">{errors.confirmar.message}</p>}
            </div>
            {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg border border-red-200">{error}</div>}
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
              {loading ? 'Guardando...' : 'Actualizar contraseña'}
            </button>
            <Link to="/login" className="flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
              <ArrowLeft size={14} /> Volver al login
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}
