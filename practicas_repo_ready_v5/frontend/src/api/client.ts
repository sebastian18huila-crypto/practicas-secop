import axios, { AxiosError } from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

// Inyectar token JWT
client.interceptors.request.use((config) => {
  try {
    const raw   = localStorage.getItem('secop-auth')
    const token = raw ? JSON.parse(raw)?.state?.token : null
    if (token) config.headers.Authorization = `Bearer ${token}`
  } catch { /* ignorar */ }
  return config
})

// Manejar errores globalmente
client.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('secop-auth')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default client
