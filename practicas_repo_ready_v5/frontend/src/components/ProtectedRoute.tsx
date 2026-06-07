import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import type { Rol } from '../types'

interface Props {
  children:   React.ReactNode
  roles?:     Rol[]
}

export default function ProtectedRoute({ children, roles }: Props) {
  const { token, usuario } = useAuthStore()

  if (!token) return <Navigate to="/login" replace />

  if (roles && usuario && !roles.includes(usuario.rol as Rol)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
