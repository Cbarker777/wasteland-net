import type { ReactNode, Ref } from 'react'

export function Panel({ title, right, children, className = '' }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel rounded-sm p-4 ${className}`}>
      {(title || right) && (
        <header className="mb-3 flex items-baseline justify-between gap-3 border-b border-line pb-2">
          <h2 className="label !text-signal">{title}</h2>
          {right && <div className="label">{right}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

type Tone = 'signal' | 'rad' | 'rust' | 'sky' | 'static'
const FILL: Record<Tone, string> = { signal: 'bg-signal', rad: 'bg-rad', rust: 'bg-rust', sky: 'bg-sky', static: 'bg-static' }

export function Meter({ value, max, tone = 'signal', className = '' }: { value: number; max: number; tone?: Tone; className?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div className={`h-2 w-full overflow-hidden rounded-[1px] bg-dust ring-1 ring-line ${className}`} role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className={`h-full ${FILL[tone]} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
    </div>
  )
}

/** Segmented 0–max level readout, like a signal-strength ladder. */
export function Segments({ value, max, tone = 'signal' }: { value: number; max: number; tone?: Tone }) {
  return (
    <div className="flex gap-[3px]" aria-label={`${value} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`h-3 flex-1 rounded-[1px] ${i < value ? FILL[tone] : 'bg-panel-2 ring-1 ring-line'}`} />
      ))}
    </div>
  )
}

type Variant = 'primary' | 'ghost' | 'danger'
const VARIANT: Record<Variant, string> = {
  primary: 'bg-signal text-dust hover:bg-[#ffc56e] font-bold',
  ghost: 'border border-line text-sand hover:border-signal-dim hover:text-signal',
  danger: 'border border-rust-dim text-rust hover:bg-rust-dim/40',
}

export function Button({
  children,
  onClick,
  variant = 'ghost',
  disabled,
  className = '',
  type = 'button',
  ref,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: Variant
  disabled?: boolean
  className?: string
  type?: 'button' | 'submit'
  ref?: Ref<HTMLButtonElement>
}) {
  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-sm px-4 py-2 text-sm tracking-[0.08em] uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${VARIANT[variant]} ${className}`}
    >
      {children}
    </button>
  )
}
