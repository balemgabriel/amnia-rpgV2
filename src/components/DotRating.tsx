import { cn } from '@/lib/cn'

export type DotSize = 'sm' | 'md' | 'lg'

const DOT_SIZE: Record<DotSize, string> = {
  sm: 'size-3',
  md: 'size-4',
  lg: 'size-5',
}

interface DotRatingProps {
  /** Valor atual (0–max). */
  value: number
  /** Total de círculos desenhados. */
  max?: number
  /** Menor valor permitido ao clicar. */
  min?: number
  /** Maior valor selecionável agora (ex.: limite da distribuição de perícias). */
  limit?: number
  onChange?: (value: number) => void
  label: string
  size?: DotSize
  className?: string
}

/**
 * Cinco círculos vazios que vão sendo preenchidos ao clicar, como na ficha
 * tradicional. Clicar no último círculo preenchido "desmarca" um nível.
 *
 * Sem `onChange` vira somente leitura (usado na visualização da ficha).
 */
export function DotRating({
  value,
  max = 5,
  min = 0,
  limit = max,
  onChange,
  label,
  size = 'md',
  className,
}: DotRatingProps) {
  const dots = Array.from({ length: max }, (_, index) => index + 1)
  const sizeClass = DOT_SIZE[size]
  const interactive = Boolean(onChange)

  function select(dot: number) {
    if (!onChange || dot > limit) return
    onChange(dot === value ? Math.max(min, dot - 1) : dot)
  }

  return (
    <div
      className={cn('inline-flex items-center gap-1.5', className)}
      role={interactive ? 'group' : undefined}
      aria-label={interactive ? label : undefined}
    >
      {dots.map((dot) => {
        const filled = dot <= value
        const selectable = interactive && dot <= limit

        if (!interactive) {
          return (
            <span
              key={dot}
              aria-hidden
              className={cn(
                'inline-block rounded-full border',
                sizeClass,
                filled ? 'border-ink bg-ink' : 'border-ink/30 bg-transparent',
              )}
            />
          )
        }

        return (
          <button
            key={dot}
            type="button"
            disabled={!selectable}
            onClick={() => select(dot)}
            aria-label={`${label}: ${dot} de ${max}`}
            aria-pressed={filled}
            title={
              selectable
                ? undefined
                : `Limite atual: ${limit} ${limit === 1 ? 'nível' : 'níveis'}`
            }
            className={cn(
              'rounded-full border transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-parchment',
              sizeClass,
              filled ? 'border-ink bg-ink' : 'border-ink/30 bg-transparent',
              selectable && !filled && 'hover:border-ink/70 hover:bg-ink/5',
              !selectable && 'cursor-not-allowed opacity-30',
            )}
          />
        )
      })}

      {interactive ? (
        <span className="ml-1 w-4 text-center text-xs tabular-nums text-ink-soft">{value}</span>
      ) : null}
    </div>
  )
}
