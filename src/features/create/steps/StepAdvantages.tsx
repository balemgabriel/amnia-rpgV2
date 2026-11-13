import { useMemo, useState } from 'react'
import { Badge, Callout, Card, SectionTitle } from '@/components/ui'
import { cn } from '@/lib/cn'
import { creationBudget } from '@/rules/amnia'
import { advantagePoints, validateAdvantages } from '@/rules/character'
import { advantages } from '@/rules/data'
import { useDraft } from '@/store/draft'

const KIND_LABEL = { vantagem: 'Vantagens', desvantagem: 'Desvantagens' } as const

export function StepAdvantages() {
  const character = useDraft((state) => state.character)
  const addAdvantage = useDraft((state) => state.addAdvantage)
  const removeAdvantage = useDraft((state) => state.removeAdvantage)
  const setAdvantagePoints = useDraft((state) => state.setAdvantagePoints)

  const [tab, setTab] = useState<'vantagem' | 'desvantagem'>('vantagem')

  const summary = advantagePoints(character.advantages)
  const validation = validateAdvantages(
    character.advantages,
    creationBudget.advantagePoints,
    creationBudget.minDisadvantagePoints,
  )

  const catalog = useMemo(
    () => advantages.filter((item) => item.kind === tab),
    [tab],
  )

  const categories = useMemo(
    () => [...new Set(catalog.map((item) => item.category))],
    [catalog],
  )

  return (
    <div className="space-y-6">
      <SectionTitle hint="7 pontos no total — e pelo menos 2 DEVEM ser gastos em desvantagens.">
        6 · Vantagens & Desvantagens
      </SectionTitle>

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={summary.total === creationBudget.advantagePoints ? 'ok' : 'gold'}>
            {summary.total} / {creationBudget.advantagePoints} pontos
          </Badge>
          <Badge tone={summary.desvantagens >= creationBudget.minDisadvantagePoints ? 'ok' : 'warn'}>
            desvantagens: {summary.desvantagens} / mín. {creationBudget.minDisadvantagePoints}
          </Badge>
          <Badge>
            vantagens: {summary.vantagens}
          </Badge>
        </div>
        <div className="mt-3">
          {validation.valid ? (
            <Callout tone="ok">Distribuição completa.</Callout>
          ) : (
            <Callout tone="warn">{validation.message}</Callout>
          )}
        </div>
      </Card>

      {character.advantages.length > 0 ? (
        <Card>
          <h3 className="mb-3 font-display text-lg tracking-wide">Selecionadas</h3>
          <ul className="space-y-1.5">
            {character.advantages.map((item) => {
              const source = advantages.find((option) => option.id === item.sourceId)
              const canAdjust = source?.pointsMax !== undefined
              return (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-md bg-ink/[0.04] px-3 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <strong>{item.name}</strong>{' '}
                    <span
                      className={cn(
                        'text-xs',
                        item.kind === 'desvantagem' ? 'text-emerald-800' : 'text-ink-soft',
                      )}
                    >
                      · {item.kind}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {canAdjust ? (
                      <span className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setAdvantagePoints(item.id, item.points - 1)}
                          disabled={item.points <= 1}
                          className="size-6 rounded border border-ink/15 text-xs disabled:opacity-30"
                        >
                          −
                        </button>
                        <span className="w-4 text-center tabular-nums">{item.points}</span>
                        <button
                          type="button"
                          onClick={() => setAdvantagePoints(item.id, item.points + 1)}
                          disabled={item.points >= (source?.pointsMax ?? item.points)}
                          className="size-6 rounded border border-ink/15 text-xs disabled:opacity-30"
                        >
                          +
                        </button>
                      </span>
                    ) : (
                      <span className="tabular-nums text-ink-soft">{item.points} pt</span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeAdvantage(item.id)}
                      className="text-xs text-ink-soft hover:text-accent"
                    >
                      remover
                    </button>
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>
      ) : null}

      <div className="flex gap-1 rounded-lg border border-ink/10 bg-ink/[0.03] p-1">
        {(['vantagem', 'desvantagem'] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => setTab(kind)}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition',
              tab === kind ? 'bg-parchment text-ink shadow-sm' : 'text-ink-soft hover:text-ink',
            )}
          >
            {KIND_LABEL[kind]}
          </button>
        ))}
      </div>

      {catalog.length === 0 ? (
        <Callout>Os dados de vantagens ainda estão sendo extraídos do material.</Callout>
      ) : (
        categories.map((category) => (
          <Card key={category}>
            <h3 className="mb-3 font-display text-lg tracking-wide">{category}</h3>
            <ul className="space-y-2">
              {catalog
                .filter((item) => item.category === category)
                .map((item) => {
                  const selected = character.advantages.find(
                    (option) => option.sourceId === item.id,
                  )
                  const pointsLabel =
                    item.pointsMax !== undefined
                      ? `${item.points}–${item.pointsMax} pt`
                      : `${item.points} pt`
                  return (
                    <li key={item.id}>
                      <div
                        className={cn(
                          'rounded-lg border p-3 transition',
                          selected ? 'border-accent/40 bg-accent/[0.05]' : 'border-ink/10',
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-baseline gap-2">
                              <span className="font-semibold">{item.name}</span>
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                                {pointsLabel}
                              </span>
                            </p>
                            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                              {item.description}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              selected
                                ? removeAdvantage(selected.id)
                                : addAdvantage({
                                    sourceId: item.id,
                                    name: item.name,
                                    kind: item.kind as 'vantagem' | 'desvantagem',
                                    points: item.points,
                                  })
                            }
                            className={cn(
                              'shrink-0 rounded-md border px-2.5 py-1 text-xs transition',
                              selected
                                ? 'border-accent/40 text-accent hover:bg-accent/10'
                                : 'border-ink/15 text-ink-soft hover:border-ink/30 hover:text-ink',
                            )}
                          >
                            {selected ? 'remover' : 'adicionar'}
                          </button>
                        </div>
                      </div>
                    </li>
                  )
                })}
            </ul>
          </Card>
        ))
      )}
    </div>
  )
}
