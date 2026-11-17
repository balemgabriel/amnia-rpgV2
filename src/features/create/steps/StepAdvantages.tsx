import { useMemo, useState } from 'react'
import { DotRating } from '@/components/DotRating'
import { Badge, Callout, Card, SectionTitle } from '@/components/ui'
import { cn } from '@/lib/cn'
import {
  antecedentGroupOf,
  antecedentMaxPoints,
  antecedents,
  buildAntecedentAdvantage,
  findAntecedentLevel,
  resolveAdvantageDescription,
  type AntecedentGroup,
} from '@/rules/advantages'
import { creationBudget } from '@/rules/amnia'
import { advantagePoints, validateAdvantages, type Character } from '@/rules/character'
import { advantages, type AdvantageDef } from '@/rules/data'
import { checkAdvantageRequirement } from '@/rules/requirements'
import { useDraft } from '@/store/draft'

type Tab = 'vantagem' | 'desvantagem'

const TABS: Tab[] = ['vantagem', 'desvantagem']

const KIND_LABEL: Record<Tab, string> = {
  vantagem: 'Vantagens',
  desvantagem: 'Desvantagens',
}

interface CategoryCatalog {
  defs: AdvantageDef[]
  /** Antecedentes da categoria, comprados diretamente pelos pontos. */
  groups: AntecedentGroup[]
}

export function StepAdvantages() {
  const character = useDraft((state) => state.character)
  const removeAdvantage = useDraft((state) => state.removeAdvantage)
  const setAdvantagePoints = useDraft((state) => state.setAdvantagePoints)
  const updateAdvantage = useDraft((state) => state.updateAdvantage)

  const [tab, setTab] = useState<Tab>('vantagem')

  const summary = advantagePoints(character.advantages)
  const validation = validateAdvantages(
    character.advantages,
    creationBudget.advantagePoints,
    creationBudget.minDisadvantagePoints,
  )

  const categories = useMemo(() => {
    const map = new Map<string, CategoryCatalog>()

    for (const def of advantages) {
      if (def.kind !== tab) continue
      const entry = map.get(def.category) ?? { defs: [], groups: [] }
      entry.defs.push(def)
      map.set(def.category, entry)
    }

    // Antecedentes são vantagens compradas em pontos. Eles entram na própria
    // categoria (Fama, Refúgio…) em vez de uma seção separada, para o jogador
    // escolher os pontos no mesmo lugar em que lê a explicação.
    if (tab === 'vantagem') {
      for (const group of antecedents) {
        const entry = map.get(group.category) ?? { defs: [], groups: [] }
        entry.groups.push(group)
        map.set(group.category, entry)
      }
    }

    return [...map.entries()]
  }, [tab])

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
              const antecedent = antecedentGroupOf(item)
              const description = resolveAdvantageDescription(item)
              const requirement = checkAdvantageRequirement(description, character)
              const canAdjust = antecedent !== undefined || source?.pointsMax !== undefined
              const maxPoints = antecedent
                ? antecedentMaxPoints(antecedent)
                : (source?.pointsMax ?? item.points)

              function step(delta: number) {
                const next = item.points + delta
                if (antecedent) {
                  updateAdvantage(item.id, buildAntecedentAdvantage(antecedent, next))
                } else {
                  setAdvantagePoints(item.id, next)
                }
              }

              return (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-md bg-ink/[0.04] px-3 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-baseline gap-2">
                      <strong>{item.name}</strong>
                      <span
                        className={cn(
                          'text-xs',
                          item.kind === 'desvantagem' ? 'text-emerald-800' : 'text-ink-soft',
                        )}
                      >
                        · {antecedent ? 'antecedente' : item.kind}
                      </span>
                    </span>
                    {description ? (
                      <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">
                        {description}
                      </span>
                    ) : null}
                    {requirement?.status === 'unmet' ? (
                      <span className="mt-0.5 block text-xs font-medium text-red-700">
                        Requisito não atendido: {requirement.detail}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {canAdjust ? (
                      <span className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => step(-1)}
                          disabled={item.points <= 1}
                          className="size-6 rounded border border-ink/15 text-xs disabled:opacity-30"
                        >
                          −
                        </button>
                        <span className="w-4 text-center tabular-nums">{item.points}</span>
                        <button
                          type="button"
                          onClick={() => step(1)}
                          disabled={item.points >= maxPoints}
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
        {TABS.map((kind) => (
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

      {categories.length === 0 ? (
        <Callout>Os dados de vantagens ainda estão sendo extraídos do material.</Callout>
      ) : (
        categories.map(([category, entry]) => (
          <Card key={category}>
            <h3 className="mb-3 font-display text-lg tracking-wide">{category}</h3>
            <ul className="space-y-2">
              {entry.groups.map((group) => (
                <AntecedentOption key={group.baseId} group={group} character={character} />
              ))}
              {entry.defs.map((item) => (
                <CatalogOption key={item.id} item={item} character={character} />
              ))}
            </ul>
          </Card>
        ))
      )}
    </div>
  )
}

/**
 * Antecedente comprado diretamente pelos pontos, no lugar em que a ficha
 * mostra a explicação. Cada ponto troca o texto pelo nível correspondente.
 */
function AntecedentOption({
  group,
  character,
}: {
  group: AntecedentGroup
  character: Character
}) {
  const addAdvantage = useDraft((state) => state.addAdvantage)
  const removeAdvantage = useDraft((state) => state.removeAdvantage)
  const updateAdvantage = useDraft((state) => state.updateAdvantage)

  const selected = character.advantages.find(
    (item) => antecedentGroupOf(item)?.baseId === group.baseId,
  )
  const points = selected?.points ?? 0
  const maxPoints = antecedentMaxPoints(group)
  const level = points > 0 ? findAntecedentLevel(group, points) : null
  const requirement = level ? checkAdvantageRequirement(level.description, character) : null
  const blocked = requirement?.status === 'unmet'

  function choose(value: number) {
    if (value <= 0) {
      if (selected) removeAdvantage(selected.id)
      return
    }

    const next = buildAntecedentAdvantage(group, value)
    if (selected) updateAdvantage(selected.id, next)
    else addAdvantage(next)
  }

  return (
    <li>
      <div
        className={cn(
          'rounded-lg border p-3 transition',
          selected ? 'border-accent/40 bg-accent/[0.05]' : 'border-ink/10',
        )}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{group.name}</span>
            <DotRating
              value={points}
              max={maxPoints}
              min={0}
              label={group.name}
              size="sm"
              onChange={blocked && !selected ? undefined : choose}
              className={blocked && !selected ? 'opacity-50' : undefined}
            />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
              antecedente
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            {level
              ? `${level.points} ${level.points === 1 ? 'ponto' : 'pontos'}: ${level.description}`
              : `Sem pontos. Escolha de 1 a ${maxPoints} para comprar este antecedente.`}
          </p>
          {requirement?.status === 'unmet' ? (
            <p className="mt-1 text-xs font-medium text-red-700">
              Requisito não atendido: {requirement.detail}
            </p>
          ) : null}
          {requirement?.status === 'unknown' ? (
            <p className="mt-1 text-xs text-ink-soft">
              Requisito não verificável automaticamente.
            </p>
          ) : null}
        </div>
      </div>
    </li>
  )
}

/** Vantagem/desvantagem comum do catálogo, com pontos quando o material prevê. */
function CatalogOption({ item, character }: { item: AdvantageDef; character: Character }) {
  const addAdvantage = useDraft((state) => state.addAdvantage)
  const removeAdvantage = useDraft((state) => state.removeAdvantage)
  const setAdvantagePoints = useDraft((state) => state.setAdvantagePoints)

  const selected = character.advantages.find((option) => option.sourceId === item.id)
  const requirement = checkAdvantageRequirement(item.description, character)
  const blocked = requirement?.status === 'unmet'
  const adjustable = item.pointsMax !== undefined
  const maxPoints = item.pointsMax ?? item.points

  function add(points: number) {
    addAdvantage({
      sourceId: item.id,
      name: item.name,
      kind: item.kind === 'desvantagem' ? 'desvantagem' : 'vantagem',
      points,
      description: item.description,
    })
  }

  function choose(value: number) {
    if (value <= 0) {
      if (selected) removeAdvantage(selected.id)
      return
    }
    if (selected) setAdvantagePoints(selected.id, value)
    else add(value)
  }

  return (
    <li>
      <div
        className={cn(
          'rounded-lg border p-3 transition',
          selected
            ? 'border-accent/40 bg-accent/[0.05]'
            : blocked
              ? 'border-ink/10 opacity-70'
              : 'border-ink/10',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{item.name}</span>
              {adjustable ? (
                <DotRating
                  value={selected?.points ?? 0}
                  max={maxPoints}
                  min={0}
                  label={item.name}
                  size="sm"
                  onChange={blocked && !selected ? undefined : choose}
                  className={blocked && !selected ? 'opacity-50' : undefined}
                />
              ) : (
                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                  {item.points} pt
                </span>
              )}
              {blocked ? <Badge tone="warn">requisito</Badge> : null}
            </div>
            <p
              className={cn(
                'mt-1 text-sm leading-relaxed',
                blocked ? 'text-red-800/90' : 'text-ink-soft',
              )}
            >
              {item.description}
            </p>
            {requirement?.status === 'unmet' ? (
              <p className="mt-1 text-xs font-medium text-red-700">{requirement.detail}</p>
            ) : null}
            {requirement?.status === 'unknown' ? (
              <p className="mt-1 text-xs text-ink-soft">
                Requisito não verificável automaticamente.
              </p>
            ) : null}
          </div>
          {adjustable ? null : (
            <button
              type="button"
              disabled={!selected && blocked}
              title={!selected && blocked ? requirement?.detail : undefined}
              onClick={() => (selected ? removeAdvantage(selected.id) : add(item.points))}
              className={cn(
                'shrink-0 rounded-md border px-2.5 py-1 text-xs transition',
                selected
                  ? 'border-accent/40 text-accent hover:bg-accent/10'
                  : blocked
                    ? 'cursor-not-allowed border-ink/10 text-ink-soft/60'
                    : 'border-ink/15 text-ink-soft hover:border-ink/30 hover:text-ink',
              )}
            >
              {selected ? 'remover' : blocked ? 'bloqueado' : 'adicionar'}
            </button>
          )}
        </div>
      </div>
    </li>
  )
}
