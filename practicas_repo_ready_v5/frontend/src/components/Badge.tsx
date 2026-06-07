import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react'

// ── Score Badge ────────────────────────────────────────────────────────────────
export function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  if (pct >= 75) return <span className="badge-alta">{pct}%</span>
  if (pct >= 60) return <span className="badge-media">{pct}%</span>
  return <span className="badge-baja">{pct}%</span>
}

// ── Role Badge ─────────────────────────────────────────────────────────────────
const rolStyles: Record<string, string> = {
  SUPERADMIN: 'bg-purple-100 text-purple-800',
  ADMIN:      'bg-blue-100 text-blue-800',
  ANALISTA:   'bg-teal-100 text-teal-800',
  VIEWER:     'bg-gray-100 text-gray-600',
}

export function RolBadge({ rol }: { rol: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${rolStyles[rol] ?? 'bg-gray-100 text-gray-600'}`}>
      {rol}
    </span>
  )
}

// ── Toast ──────────────────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'warning'

interface ToastProps {
  message:  string
  type?:    ToastType
  onClose?: () => void
}

const toastIcons = {
  success: CheckCircle,
  error:   XCircle,
  warning: AlertCircle,
}

const toastColors = {
  success: 'bg-emerald-600',
  error:   'bg-red-600',
  warning: 'bg-amber-500',
}

export function Toast({ message, type = 'success', onClose }: ToastProps) {
  const Icon = toastIcons[type]
  return (
    <div className={`fixed bottom-5 right-5 z-[100] flex items-center gap-3 px-4 py-3
                     rounded-xl text-white shadow-lg text-sm animate-slide-up
                     ${toastColors[type]} max-w-sm`}>
      <Icon size={18} className="shrink-0" />
      <span className="flex-1">{message}</span>
      {onClose && (
        <button onClick={onClose} className="opacity-70 hover:opacity-100">
          <X size={16} />
        </button>
      )}
    </div>
  )
}

// ── useToast hook ──────────────────────────────────────────────────────────────
export function useToast() {
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)

  const show = (message: string, type: ToastType = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const ToastComponent = toast ? (
    <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
  ) : null

  return { show, ToastComponent }
}
