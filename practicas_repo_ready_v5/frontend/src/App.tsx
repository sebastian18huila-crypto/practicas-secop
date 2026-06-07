import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { authApi } from './api'
import { useAuthStore } from './store/authStore'
import { useBrandingStore } from './store/brandingStore'
import { useEmpresaStore } from './store/empresaStore'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

// Auth pages
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'

// App pages
import Dashboard from './pages/Dashboard'
import Buscar from './pages/Buscar'
import Servicios from './pages/Servicios'
import Configuracion from './pages/Configuracion'
import Usuarios from './pages/Usuarios'
import Auditoria from './pages/Auditoria'
import Empresas from './pages/Empresas'

function BrandingLoader() {
  const { setBranding, resetBranding } = useBrandingStore()
  const usuario = useAuthStore(s => s.usuario)
  const selectedEmpresaId = useEmpresaStore(s => s.selectedEmpresaId)

  useEffect(() => {
    const empresaId = usuario?.rol === 'SUPERADMIN' ? selectedEmpresaId : usuario?.empresa_id
    if (!empresaId) {
      resetBranding()
      return
    }
    authApi.getBranding(empresaId).then(setBranding).catch(() => resetBranding())
  }, [usuario?.empresa_id, usuario?.rol, selectedEmpresaId])

  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <BrandingLoader />
      <Routes>
        {/* ── Públicas ── */}
        <Route path="/login"                 element={<Login />} />
        <Route path="/register"              element={<Register />} />
        <Route path="/forgot-password"       element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        {/* ── Protegidas: todos los roles ── */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Layout><Dashboard /></Layout>
          </ProtectedRoute>
        }/>
        <Route path="/buscar" element={
          <ProtectedRoute>
            <Layout><Buscar /></Layout>
          </ProtectedRoute>
        }/>
        <Route path="/servicios" element={
          <ProtectedRoute>
            <Layout><Servicios /></Layout>
          </ProtectedRoute>
        }/>

        {/* ── Protegidas: solo SUPERADMIN ── */}
        <Route path="/empresas" element={
          <ProtectedRoute roles={['SUPERADMIN']}>
            <Layout><Empresas /></Layout>
          </ProtectedRoute>
        }/>

        {/* ── Protegidas: solo ADMIN+ ── */}
        <Route path="/usuarios" element={
          <ProtectedRoute roles={['SUPERADMIN','ADMIN']}>
            <Layout><Usuarios /></Layout>
          </ProtectedRoute>
        }/>
        <Route path="/configuracion" element={
          <ProtectedRoute roles={['SUPERADMIN','ADMIN']}>
            <Layout><Configuracion /></Layout>
          </ProtectedRoute>
        }/>
        <Route path="/auditoria" element={
          <ProtectedRoute roles={['SUPERADMIN','ADMIN']}>
            <Layout><Auditoria /></Layout>
          </ProtectedRoute>
        }/>

        {/* ── Redirects ── */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
