interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  fullscreen?: boolean
}

const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' }

export function Spinner({ size = 'md', text, fullscreen = false }: SpinnerProps) {
  const spinner = (
    <div className="flex flex-col items-center gap-3">
      <div className={`loader ${sizes[size]}`} />
      {text && <p className="text-sm text-gray-500 animate-pulse">{text}</p>}
    </div>
  )
  if (fullscreen) {
    return (
      <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50
                      flex items-center justify-center">
        {spinner}
      </div>
    )
  }
  return spinner
}

// Banner de carga para operaciones largas (scan IA)
export function ScanLoader({ mensaje }: { mensaje: string }) {
  const pasos = [
    'Conectando con SECOP II...',
    'Descargando licitaciones abiertas...',
    'Generando embeddings semánticos...',
    'Comparando con catálogo de servicios...',
    'Guardando resultados...',
  ]
  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50
                    flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center
                      animate-fade-in">
        {/* Animación circular */}
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-gray-100" />
          <div className="absolute inset-0 rounded-full border-4 border-t-brand-600
                          animate-spin" />
          <div className="absolute inset-3 rounded-full bg-brand-50 flex items-center
                          justify-center">
            <span className="text-2xl">🤖</span>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Motor IA en ejecución
        </h3>
        <p className="text-sm text-gray-500 mb-6">{mensaje}</p>

        {/* Pasos animados */}
        <div className="space-y-2 text-left">
          {pasos.map((paso, i) => (
            <div
              key={paso}
              className="flex items-center gap-2 text-xs text-gray-500"
              style={{ animationDelay: `${i * 0.5}s` }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-brand-600 animate-pulse-fast"
                   style={{ animationDelay: `${i * 0.3}s` }} />
              {paso}
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400 mt-6">
          Este proceso puede tardar 2-3 minutos.<br />
          Puedes seguir navegando mientras tanto.
        </p>
      </div>
    </div>
  )
}
