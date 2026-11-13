import { cn } from '@/lib/cn'
import type { RuneDef } from '@/rules/data'
import { RUNE_LEVELS, UNLOCK_WEIGHTS, isLevelDefined } from '@/rules/runes'
import { isRuneLevelLocked, type SpellRune } from '@/rules/spell'

function LockIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  )
}

/**
 * Seletor de nível de uma runa JÁ JOGADA na magia. Nível = PM pago por este
 * efeito. 1–5 livres; 6–7 com cadeado até a runa ter uma condição Severa,
 * Extrema ou Absoluta. As condições de OUTRAS runas da magia não contam.
 */
export function RuneLevelSelector({
  rune,
  spellRune,
  onChange,
  tone,
}: {
  rune: RuneDef | undefined
  spellRune: SpellRune
  onChange: (level: number) => void
  tone?: string | null
}) {
  const anyLocked = RUNE_LEVELS.some(
    (level) => isLevelDefined(rune, level) && isRuneLevelLocked(spellRune, level),
  )

  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
        Nível · custo em PM
      </p>
      <div role="radiogroup" aria-label="Nível da runa na magia" className="flex flex-wrap gap-1">
        {RUNE_LEVELS.map((level) => {
          const selected = spellRune.level === level
          const missing = !isLevelDefined(rune, level)
          const locked = !missing && isRuneLevelLocked(spellRune, level)
          const unavailable = locked || missing
          return (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={unavailable || undefined}
              disabled={unavailable}
              data-level={level}
              data-locked={locked ? 'true' : undefined}
              title={
                locked
                  ? `Bloqueado: adicione uma condição ${UNLOCK_WEIGHTS.join(', ')} a esta runa.`
                  : missing
                    ? 'Esta runa não tem efeito neste nível.'
                    : `Nível ${level} (${level} PM)`
              }
              onClick={() => onChange(level)}
              className={cn(
                'inline-flex h-7 min-w-7 items-center justify-center gap-0.5 rounded border px-1.5 text-xs tabular-nums transition',
                selected ? 'text-parchment' : 'text-ink-soft hover:text-ink',
                unavailable && 'cursor-not-allowed opacity-45 hover:text-ink-soft',
              )}
              style={{
                borderColor: tone ?? undefined,
                backgroundColor: selected ? (tone ?? undefined) : undefined,
              }}
            >
              {locked ? <LockIcon /> : null}
              {level}
            </button>
          )
        })}
      </div>
      {anyLocked ? (
        <p className="mt-1 text-[11px] leading-snug text-ink-soft">
          Níveis 6 e 7 só destravam com uma condição Severa, Extrema ou Absoluta vinculada a{' '}
          <strong className="text-ink">esta runa</strong>.
        </p>
      ) : null}
    </div>
  )
}
