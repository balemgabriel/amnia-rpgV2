<Button
  variant="ghost"
  disabled={!classe.disponivel}
  onClick={() => setClasseSelecionada(classe.id)}
  style={
    classeSelecionada === classe.id
      ? ({
          outline: `2px solid ${classe.cor}`,
          outlineOffset: '2px',
          boxShadow: `0 0 10px ${classe.cor}55`,
        } as CSSProperties)
      : undefined
  }
>
  {classe.name}
</Button>

import type {
  ButtonHTMLAttributes,
  CSSProperties,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from 'react'
import { cn } from '@/lib/cn'

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'quiet' }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-parchment',
        'disabled:cursor-not-allowed disabled:opacity-40',
        variant === 'primary' && 'bg-accent text-parchment hover:bg-accent/90',
        variant === 'ghost' && 'border border-ink/20 text-ink hover:bg-ink/5',
        variant === 'quiet' && 'text-ink-soft hover:text-ink hover:bg-ink/5',
        className,
      )}
      {...props}
    />
  )
}

export function Card({
  className,
  style,
  children,
}: {
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <div className={cn('rounded-xl border border-ink/10 bg-white/45 p-5', className)} style={style}>
      {children}
    </div>
  )
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-2xl leading-tight tracking-wide">{children}</h2>
      {hint ? <p className="mt-1 text-sm text-ink-soft">{hint}</p> : null}
    </div>
  )
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string
  hint?: string
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-ink-soft">{hint}</span> : null}
    </label>
  )
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-md border border-ink/15 bg-parchment/70 px-3 py-2 text-sm text-ink placeholder:text-ink-soft/60',
        'focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold',
        className,
      )}
      {...props}
    />
  )
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'w-full rounded-md border border-ink/15 bg-parchment/70 px-3 py-2 text-sm leading-relaxed text-ink placeholder:text-ink-soft/60',
        'focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold',
        className,
      )}
      {...props}
    />
  )
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'gold' | 'accent' | 'ok' | 'warn'
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        tone === 'neutral' && 'bg-ink/8 text-ink-soft',
        tone === 'gold' && 'bg-gold/20 text-ink',
        tone === 'accent' && 'bg-accent/12 text-accent',
        tone === 'ok' && 'bg-emerald-700/12 text-emerald-800',
        tone === 'warn' && 'bg-amber-600/15 text-amber-800',
      )}
    >
      {children}
    </span>
  )
}

export function Callout({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'warn' | 'ok'
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2 text-sm',
        tone === 'neutral' && 'border-ink/10 bg-ink/[0.03] text-ink-soft',
        tone === 'warn' && 'border-amber-700/25 bg-amber-600/10 text-amber-900',
        tone === 'ok' && 'border-emerald-700/25 bg-emerald-700/10 text-emerald-900',
      )}
    >
      {children}
    </div>
  )
}
