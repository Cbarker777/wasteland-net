import { useEffect } from 'react'
import { useGame } from '../store'

export function Toasts() {
  const toasts = useGame((s) => s.toasts)
  const dismiss = useGame((s) => s.dismissToast)

  useEffect(() => {
    if (!toasts.length) return
    const t = setTimeout(() => dismiss(toasts[0].id), 6000)
    return () => clearTimeout(t)
  }, [toasts, dismiss])

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
      {toasts.slice(0, 3).map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`toast-in pointer-events-auto rounded-sm border bg-panel-2 p-3 text-left shadow-lg ${t.kind === 'rank' ? 'border-signal' : 'border-rad'}`}
        >
          <div className={`text-sm font-bold ${t.kind === 'rank' ? 'text-signal glow' : 'text-rad glow-rad'}`}>{t.title}</div>
          <div className="mt-1 text-xs text-sand-dim">{t.body}</div>
        </button>
      ))}
    </div>
  )
}
