import { useMemo, useState } from 'react'
import { ArcanaeHexagon } from '@/components/ArcanaeHexagon'
import { Badge, Button, Callout, Card, SectionTitle } from '@/components/ui'
import { cn } from '@/lib/cn'
import {
  channelingMethods,
  circleOrder,
  circleRelation,
  circleRelationLabels,
  circleRelationRules,
  circles,
  runeCircleLabels,
} from '@/rules/amnia'
import { circleColor } from '@/rules/circleColors'
import { runeAllowance } from '@/rules/character'
import { withAlpha } from '@/rules/lineageColors'
import { runes, type RuneCircleId, type RuneDef } from '@/rules/data'
import { useDraft } from '@/store/draft'

const RUNE_CIRCLES: RuneCircleId[] = [...circleOrder, 'miscelanea']
const RUNE_CIRCLE_LABELS = runeCircleLabels

/** Formata o modificador de custo com o sinal tipográfico (−) em vez do hífen. */
function formatModifier(value: number): string {
  if (value > 0) return `+${value}`
  if (value < 0) return `−${Math.abs(value)}`
  return '0'
}

export function StepMagic() {
  const character = useDraft((state) => state.character)
  const patch = useDraft((state) => state.patch)
  const setChannelingMethod = useDraft((state) => state.setChannelingMethod)
  const addRune = useDraft((state) => state.addRune)
  const removeRune = useDraft((state) => state.removeRune)

  const [runeCircle, setRuneCircle] = useState<RuneCircleId>('reforco')
  const [runeId, setRuneId] = useState<string | null>(null)
  const [runeLevel, setRuneLevel] = useState<number | null>(null)

  const allowance = runeAllowance(character.attributes.inteligencia)
  const remaining = allowance - character.runes.length
  const innate = circles.find((item) => item.id === character.innateCircle) ?? null

  const catalog = useMemo(
    () => runes.filter((rune) => rune.circle === runeCircle).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [runeCircle],
  )

  const selectedRune: RuneDef | null =
    catalog.find((rune) => rune.id === runeId) ?? catalog[0] ?? null
  const availableLevels = selectedRune?.levels.map((item) => item.level) ?? []
  const level = runeLevel !== null && availableLevels.includes(runeLevel) ? runeLevel : (availableLevels[0] ?? null)
  const effect = selectedRune?.levels.find((item) => item.level === level)?.effect ?? null

  const relation =
    runeCircle !== 'miscelanea' && character.innateCircle
      ? circleRelationRules[circleRelation(character.innateCircle, runeCircle)]
      : null

  function selectCircle(id: RuneCircleId) {
    setRuneCircle(id)
    setRuneId(null)
    setRuneLevel(null)
  }

  function selectRune(id: string) {
    setRuneId(id)
    setRuneLevel(null)
  }

  function submitRune() {
    if (!selectedRune || level === null || remaining <= 0) return
    addRune({
      sourceId: selectedRune.id,
      name: selectedRune.name,
      circle: selectedRune.circle,
      level,
    })
  }

  return (
    <div className="space-y-6">
      <SectionTitle hint="Como a sua mana é moldada e por quais Esferas ela passa.">
        3 · Círculo & Runas
      </SectionTitle>

      <Card>
        <h3 className="font-display text-lg tracking-wide">Círculo Inato</h3>
        <p className="mb-4 mt-1 text-sm text-ink-soft">
          A Esfera com que você nasceu. Runas dela custam −1 PM; opostas custam +2 PM.
        </p>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
          <div>
            <ArcanaeHexagon
              innate={character.innateCircle}
              onChange={(id) => patch({ innateCircle: id })}
            />
            <p className="mt-2 text-center text-xs text-ink-soft">
              Clique em uma Esfera para defini-la como o seu Círculo Inato.
            </p>
          </div>

          <div className="space-y-3">
            {innate ? (
              <div className="rounded-lg border border-ink/12 p-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-display text-lg tracking-wide">{innate.name}</h4>
                  <Badge tone="accent">inata</Badge>
                </div>
                <p className="mt-1 text-sm leading-snug text-ink-soft">{innate.description}</p>
                <p className="mt-1 text-xs italic text-ink-soft/80">{innate.examples}</p>
              </div>
            ) : (
              <Callout tone="warn">Escolha o seu Círculo Inato no hexágono.</Callout>
            )}

            {character.innateCircle ? (
              <div className="overflow-hidden rounded-lg border border-ink/10">
                <table className="w-full text-sm">
                  <thead className="bg-ink/[0.04] text-left text-[11px] uppercase tracking-wide text-ink-soft">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Esfera</th>
                      <th className="px-3 py-2 font-semibold">Relação</th>
                      <th className="px-3 py-2 text-right font-semibold">Custo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/8">
                    {circleOrder.map((id) => {
                      const item = circles.find((entry) => entry.id === id)
                      const relation = circleRelation(character.innateCircle!, id)
                      const rule = circleRelationRules[relation]
                      return (
                        <tr key={id} className={relation === 'inata' ? 'bg-gold/[0.08]' : undefined}>
                          <td className="px-3 py-2">{item?.name}</td>
                          <td className="px-3 py-2 capitalize text-ink-soft">
                            {circleRelationLabels[relation]}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatModifier(rule.costModifier)} PM
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="font-display text-lg tracking-wide">Método de Canalização</h3>
        <p className="mb-4 mt-1 text-sm text-ink-soft">
          Recebe 1 método na criação, no Nível 1. O Nível 2 custa 8 XP.
        </p>

        <div className="grid gap-2">
          {channelingMethods.map((method) => {
            const active = character.channelingMethodId === method.id
            return (
              <button
                key={method.id}
                type="button"
                onClick={() => setChannelingMethod(active ? null : method.id)}
                className={cn(
                  'rounded-lg border p-3 text-left transition',
                  active ? 'border-accent bg-accent/[0.07]' : 'border-ink/12 hover:border-ink/30',
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-display text-base tracking-wide">{method.name}</span>
                  {active ? <Badge tone="accent">nível 1</Badge> : null}
                </span>
                <span className="mt-0.5 block text-xs text-ink-soft">{method.description}</span>
                <span className="mt-1 block text-xs text-ink-soft">
                  <strong className="text-ink">Nível 1:</strong> {method.level1}
                </span>
              </button>
            )
          })}
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-display text-lg tracking-wide">Runas Conhecidas</h3>
          <Badge tone={remaining === 0 ? 'ok' : 'gold'}>
            {character.runes.length} / {allowance}
          </Badge>
        </div>
        <p className="mb-4 text-sm text-ink-soft">
          Você recebe <strong className="text-ink">3 + INT</strong> runas (3 +{' '}
          {character.attributes.inteligencia} = {allowance}). Runas compradas depois custam de 6 a
          9 XP conforme a relação com o seu círculo.
        </p>

        {character.runes.length > 0 ? (
          <ul className="mb-5 space-y-2">
            {character.runes.map((rune) => {
              const source = runes.find((item) => item.id === rune.sourceId)
              const runeEffect = source?.levels.find((item) => item.level === rune.level)?.effect
              return (
                <li
                  key={rune.id}
                  className="rounded-lg border border-ink/10 border-l-4 bg-ink/[0.03] px-3 py-2"
                  style={{ borderLeftColor: circleColor(rune.circle) ?? undefined }}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm">
                      <strong>{rune.name}</strong>{' '}
                      <span className="text-xs text-ink-soft">
                        · {RUNE_CIRCLE_LABELS[rune.circle]} · nível {rune.level}
                        {rune.level >= 6 ? ' (lendário)' : ''}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeRune(rune.id)}
                      className="shrink-0 text-xs text-ink-soft hover:text-accent"
                    >
                      remover
                    </button>
                  </div>
                  {runeEffect ? (
                    <p className="mt-1 text-xs leading-relaxed text-ink-soft">{runeEffect}</p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : null}

        <div className="rounded-lg border border-ink/10 p-3">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {RUNE_CIRCLES.map((id) => {
              const active = runeCircle === id
              const tone = circleColor(id)
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectCircle(id)}
                  style={
                    tone
                      ? {
                          borderColor: active ? tone : withAlpha(tone, 0.45),
                          backgroundColor: active ? withAlpha(tone, 0.1) : undefined,
                        }
                      : undefined
                  }
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition',
                    active
                      ? 'text-ink'
                      : 'border-ink/12 text-ink-soft hover:border-ink/30 hover:text-ink',
                  )}
                >
                  <span
                    aria-hidden
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: tone ?? 'currentColor' }}
                  />
                  {RUNE_CIRCLE_LABELS[id]}
                </button>
              )
            })}
          </div>

          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
                Runa
              </span>
              <select
                value={selectedRune?.id ?? ''}
                onChange={(event) => selectRune(event.target.value)}
                className="h-[38px] w-full rounded-md border border-ink/15 bg-parchment/70 px-2 text-sm"
              >
                {catalog.map((rune) => (
                  <option key={rune.id} value={rune.id}>
                    {rune.name}
                    {rune.requirement ? ' *' : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
                Nível
              </span>
              <select
                value={level ?? ''}
                onChange={(event) => setRuneLevel(Number(event.target.value))}
                className="h-[38px] w-full rounded-md border border-ink/15 bg-parchment/70 px-2 text-sm sm:w-24"
              >
                {availableLevels.map((option) => (
                  <option key={option} value={option}>
                    {option}
                    {option >= 6 ? ' ★' : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedRune ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs leading-relaxed text-ink-soft">{selectedRune.description}</p>
              {selectedRune.requirement ? (
                <p className="text-xs font-semibold text-amber-800">
                  {selectedRune.requirement}
                </p>
              ) : null}
              {effect ? (
                <p className="rounded-md bg-ink/[0.04] px-3 py-2 text-sm leading-relaxed">
                  <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                    Nível {level}
                  </span>
                  {effect}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-ink-soft">
                  {runeCircle === 'miscelanea'
                    ? 'Miscelânea: não pertence ao hexágono das Esferas.'
                    : relation
                      ? `Custo de mana: ${formatModifier(relation.costModifier)} PM · ${relation.relation}`
                      : 'Escolha o Círculo Inato para ver o custo de mana.'}
                </span>
                <Button onClick={submitRune} disabled={remaining <= 0}>
                  {remaining > 0 ? 'Adicionar runa' : 'Limite atingido'}
                </Button>
              </div>
            </div>
          ) : (
            <Callout>Nenhuma runa nesta Esfera.</Callout>
          )}
        </div>
      </Card>
    </div>
  )
}
