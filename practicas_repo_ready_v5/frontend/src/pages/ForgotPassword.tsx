import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Target, ArrowLeft } from 'lucide-react'
import { authApi } from '../api'
import { useBrandingStore } from '../store/brandingStore'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ForgotPassword() {
  const { branding } = useBrandingStore()
  const [ok, setOk] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { register, handleSubmit, formState: { errors } } = useForm<{ email: string }>()

  const onSubmit = async (data: { email: string }) => {
    setLoading(true); setError('')
    try { await authApi.forgotPassword(data.email); setOk(true) }
    catch { setError('Error al procesar la solicitud. Intenta de nuevo.') }
    finally { setLoading(false) }
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
          <h1 className="text-xl font-bold text-gray-900">Recuperar contraseña</h1>
          <p className="text-sm text-gray-500 mt-1">Te enviaremos un enlace a tu correo</p>
        </div>

        {ok ? (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-lg">
              ✅ Si el correo existe, recibirás un enlace de recuperación en tu bandeja de entrada.
            </div>
            <Link to="/login" className="flex items-center justify-center gap-2 text-sm hover:underline"
                  style={{ color: branding.empresa_color_primary }}>
              <ArrowLeft size={14} /> Volver al login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Correo electrónico</label>
              <input type="email" className="input" placeholder="tu@correo.com"
                {...register('email', {
                  required: 'El correo es obligatorio',
                  pattern: { value: EMAIL_REGEX, message: 'Correo electrónico inválido' },
                })} />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
            </div>
            {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg border border-red-200">{error}</div>}
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
              {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
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
