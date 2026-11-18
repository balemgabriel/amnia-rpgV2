import type { ReactNode } from 'react'
import { Badge } from '@/components/ui'
import { circleColor } from '@/rules/circleColors'
import { withAlpha } from '@/rules/lineageColors'
import { runeName } from '@/rules/runes'
import {
  CONDITION_LABELS,
  DURATION_OPTIONS,
  TARGET_OPTIONS,
  AREA_OPTIONS,
  conditionImpactLabel,
  allConditions,
  formatModifier,
  optionLabel,
  spellCircleInfo,
  spellCost,
  spellCx,
  spellRuneSummary,
  type Spell,
  type SpellContext,
} from '@/rules/spell'

/**
 * Uma magia já salva na ficha. Mostra o custo e a Complexidade calculados a
 * partir das runas/condições — nada é digitado à mão.
 */
export function SpellCard({
  spell,
  context,
  onEdit,
  onDelete,
  footer,
}: {
  spell: Spell
  context: SpellContext
  onEdit?: () => void
  onDelete?: () => void
  /** Ações extras (ex.: adicionar a um personagem, na Oficina). */
  footer?: ReactNode
}) {
  const cost = spellCost(spell, context)
  const cx = spellCx(spell, context)
  const circles = spellCircleInfo(spell, context)
  const hasMeta =
    spell.targets !== 'single' ||
    spell.duration !== 'instant' ||
    spell.area !== 'none' ||
    spell.range.trim() !== '' ||
    spell.targetDescription.trim() !== ''

  return (
    <article className="print-avoid-break rounded-lg border border-ink/10 bg-white/45 p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-lg leading-tight tracking-wide">
            {spell.name.trim() || 'Magia sem nome'}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge tone="gold">{cost.total} PM</Badge>
            <Badge>Cx {cx.total}</Badge>
            {spell.personal ? <Badge tone="accent">Magia Pessoal</Badge> : null}
            {circles.map((circle) => {
              const tone = circleColor(circle.id)
              return (
                <span
                  key={circle.id}
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                  style={
                    tone
                      ? {
                          borderColor: withAlpha(tone, 0.5),
                          backgroundColor: withAlpha(tone, 0.08),
                          color: tone,
                        }
                      : undefined
                  }
                >
                  <span
                    aria-hidden
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: tone ?? 'currentColor' }}
                  />
                  {circle.name}
                  {circle.modifier !== 0 ? ` ${formatModifier(circle.modifier)}` : ''}
                </span>
              )
            })}
          </div>
        </div>
        {onEdit || onDelete ? (
          <div className="no-print flex shrink-0 items-center gap-2 text-xs">
            {onEdit ? (
              <button
                type="button"
                onClick={onEdit}
                className="text-ink-soft transition hover:text-ink"
              >
                editar
              </button>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                onClick={onDelete}
                className="text-ink-soft transition hover:text-accent"
              >
                excluir
              </button>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className="mt-3 space-y-2 text-sm">
        <p>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
            Runas:{' '}
          </span>
          {spell.runes.length === 0
            ? 'nenhuma'
            : spell.runes.map((rune) => spellRuneSummary(spell, rune)).join(' · ')}
        </p>

        {hasMeta ? (
          <p className="text-xs text-ink-soft">
            {[
              `Alvos: ${optionLabel(TARGET_OPTIONS, spell.targets)}`,
              `Duração: ${optionLabel(DURATION_OPTIONS, spell.duration)}`,
              spell.area !== 'none'
                ? `Área: ${optionLabel(AREA_OPTIONS, spell.area)}`
                : null,
              spell.range.trim() ? `Alcance: ${spell.range.trim()}` : null,
              spell.targetDescription.trim()
                ? `Alvo: ${spell.targetDescription.trim()}`
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        ) : null}

        {allConditions(spell).length > 0 ? (
          <ul className="space-y-1">
            {spell.runes.flatMap((rune) =>
              rune.conditions.map((condition) => (
                <li
                  key={`${rune.runeId}-${condition.id}`}
                  className="text-xs leading-snug text-ink-soft"
                >
                  <span className="font-semibold text-ink">
                    {CONDITION_LABELS[condition.weight]}
                  </span>{' '}
                  <span className="text-ink-soft/80">({conditionImpactLabel(condition)})</span>
                  {condition.text.trim() ? ` — ${condition.text.trim()}` : null}
                  <span className="text-ink-soft/80"> · {runeName(rune.runeId)}</span>
                </li>
              )),
            )}
          </ul>
        ) : null}

        {spell.effect.trim() ? (
          <p className="whitespace-pre-line border-t border-ink/8 pt-2 leading-relaxed">
            {spell.effect.trim()}
          </p>
        ) : null}

        {spell.notes.trim() ? (
          <p className="whitespace-pre-line text-xs leading-relaxed text-ink-soft">
            {spell.notes.trim()}
          </p>
        ) : null}
      </div>

      {footer ? (
        <div className="no-print mt-3 border-t border-ink/8 pt-3">{footer}</div>
      ) : null}
    </article>
  )
}
