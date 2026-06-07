import { create } from 'zustand'
import type { Branding } from '../types'

interface BrandingState {
  branding: Branding
  setBranding: (b: Branding) => void
  resetBranding: () => void
}

export const DEFAULT_BRANDING: Branding = {
  empresa_nombre:          'SECOP Intelligence',
  empresa_logo_url:        '',
  empresa_color_primary:   '#1a56db',
  empresa_color_secondary: '#0e3a8c',
}

const aplicarBranding = (b: Branding) => {
  document.documentElement.style.setProperty('--brand-600', b.empresa_color_primary)
  document.documentElement.style.setProperty('--brand-700', b.empresa_color_secondary)
  document.documentElement.style.setProperty('--brand-900', b.empresa_color_secondary)
  document.title = `${b.empresa_nombre} — SECOP Intelligence`
}

export const useBrandingStore = create<BrandingState>((set) => ({
  branding: DEFAULT_BRANDING,
  setBranding: (b) => {
    set({ branding: b })
    aplicarBranding(b)
  },
  resetBranding: () => {
    set({ branding: DEFAULT_BRANDING })
    aplicarBranding(DEFAULT_BRANDING)
  },
}))
