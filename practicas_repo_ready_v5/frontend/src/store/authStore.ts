import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthState, Usuario } from '../types'

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token:    null,
      usuario:  null,
      setAuth:  (token, usuario) => set({ token, usuario }),
      clearAuth:() => set({ token: null, usuario: null }),
    }),
    { name: 'secop-auth' }
  )
)
