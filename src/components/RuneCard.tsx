import type { KeyboardEvent, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { runeCircleLabels } from '@/rules/amnia'
import { circleColor } from '@/rules/circleColors'
import type { RuneDef } from '@/rules/data'
import { withAlpha } from '@/rules/lineageColors'
import { RUNE_LEVELS } from '@/rules/runes'

interface RuneCardProps {
  rune: RuneDef
  /** Carta em destaque (conhecida, ou presente na magia). */
  active?: boolean
  /**
   * Linha da escada a destacar — na criação de magias, o nível escolhido
   * (o efeito que o jogador está pagando).
   */
  highlightLevel?: number | null
  /**
   * Quando presente, a carta inteira alterna ACESSO (conhecida/desconhecida).
   * Sem isto a carta é só leitura.
   */
  onToggle?: () => void
  /** Só vale com `onToggle`: impede a ação (ex.: limite de runas atingido). */
  disabled?: boolean
  /** Motivo do bloqueio, exibido abaixo do requisito (ex.: "Arcanismo 4 (atual 1)"). */
  blockedReason?: string
  /** Selo no canto superior (ex.: "Conhecida"). */
  badge?: ReactNode
  /** Área livre abaixo da escada (ex.: seletor de nível na tela de magias). */
  footer?: ReactNode
  className?: string
}

/**
 * Carta de runa. A escada completa de níveis 1 a 7 (bolinhas + descrição) é
 * SEMPRE exibida, em qualquer tela, e nunca é interativa: é a referência de
 * "o que esta runa faz do 1 ao 7". Escolher nível é responsabilidade de quem
 * usa a carta (via `footer`), não da carta.
 */
export function RuneCard({
  rune,
  active = false,
  highlightLevel = null,
  onToggle,
  disabled = false,
  blockedReason,
  badge,
  footer,
  className,
}: RuneCardProps) {
  const tone = circleColor(rune.circle)
  const toggleable = Boolean(onToggle)
  const blocked = toggleable && disabled && !active

  function activate() {
    if (!onToggle || blocked) return
    onToggle()
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      activate()
    }
  }

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="font-display text-base leading-tight tracking-wide">{rune.name}</h4>
          <p
            className="text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: tone ?? undefined }}
          >
            {runeCircleLabels[rune.circle]}
          </p>
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>

      {rune.requirement ? (
        <p
          className={cn(
            'mt-1 text-[11px] font-semibold',
            blocked ? 'text-red-800' : 'text-amber-800',
          )}
        >
          {rune.requirement}
        </p>
      ) : null}

      {blocked && blockedReason ? (
        <p className="mt-0.5 text-[11px] font-semibold text-red-800">
          Requisito não atendido — {blockedReason}
        </p>
      ) : null}

      <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{rune.description}</p>

      <ol className="mt-3 space-y-0.5" aria-label={`Níveis de ${rune.name}`}>
        {RUNE_LEVELS.map((level) => {
          const effect = rune.levels.find((item) => item.level === level)?.effect
          const highlighted = highlightLevel === level
          return (
            <li
              key={level}
              aria-current={highlighted ? 'true' : undefined}
              data-level={level}
              data-highlighted={highlighted ? 'true' : undefined}
              className={cn(
                'grid grid-cols-[4.1rem_minmax(0,1fr)] gap-2 rounded px-1.5 py-1 text-xs leading-snug',
                highlighted ? 'font-medium text-ink' : 'text-ink-soft',
              )}
              style={
                highlighted
                  ? {
                      backgroundColor: withAlpha(tone ?? '#5c5044', 0.15),
                      boxShadow: `inset 3px 0 0 ${tone ?? '#5c5044'}`,
                    }
                  : undefined
              }
            >
              <span className="flex items-start gap-[3px] pt-[5px]" aria-hidden>
                {RUNE_LEVELS.map((dot) => (
                  <span
                    key={dot}
                    className="size-[5px] rounded-full border"
                    style={{
                      borderColor: tone ?? 'currentColor',
                      backgroundColor: dot <= level ? (tone ?? 'currentColor') : 'transparent',
                    }}
                  />
                ))}
              </span>
              <span className={effect ? undefined : 'italic opacity-60'}>
                <span className="sr-only">Nível {level}: </span>
                {effect ?? 'Sem efeito neste nível.'}
              </span>
            </li>
          )
        })}
      </ol>

      {footer ? <div className="mt-3 border-t border-ink/10 pt-3">{footer}</div> : null}
    </>
  )

  const classes = cn(
    'rounded-lg border border-l-4 p-3 text-left transition',
    active ? 'bg-ink/[0.04] shadow-sm' : 'bg-white/40',
    toggleable && !blocked && 'cursor-pointer hover:bg-ink/[0.05]',
    blocked && 'cursor-not-allowed opacity-55',
    className,
  )
  const style = {
    borderTopColor: active ? (tone ?? undefined) : withAlpha(tone ?? '#5c5044', 0.25),
    borderRightColor: active ? (tone ?? undefined) : withAlpha(tone ?? '#5c5044', 0.25),
    borderBottomColor: active ? (tone ?? undefined) : withAlpha(tone ?? '#5c5044', 0.25),
    borderLeftColor: tone ?? undefined,
  }

  if (toggleable) {
    return (
      <div
        role="checkbox"
        aria-checked={active}
        aria-disabled={blocked || undefined}
        tabIndex={blocked ? -1 : 0}
        onClick={activate}
        onKeyDown={onKeyDown}
        className={cn(
          classes,
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
        )}
        style={style}
        data-rune-id={rune.id}
      >
        {body}
      </div>
    )
  }

  return (
    <article className={classes} style={style} data-rune-id={rune.id}>
      {body}
    </article>
  )
}
