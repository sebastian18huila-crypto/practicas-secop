import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Empresa } from '../types'

interface EmpresaState {
  selectedEmpresaId: number | null
  selectedEmpresa: Empresa | null
  setSelectedEmpresa: (empresa: Empresa | null) => void
  setSelectedEmpresaId: (empresaId: number | null) => void
  clearEmpresa: () => void
}

export const useEmpresaStore = create<EmpresaState>()(
  persist(
    (set) => ({
      selectedEmpresaId: null,
      selectedEmpresa: null,
      setSelectedEmpresa: (empresa) => set({
        selectedEmpresa: empresa,
        selectedEmpresaId: empresa?.id ?? null,
      }),
      setSelectedEmpresaId: (empresaId) => set({ selectedEmpresaId: empresaId }),
      clearEmpresa: () => set({ selectedEmpresaId: null, selectedEmpresa: null }),
    }),
    { name: 'practicas-empresa' }
  )
)
