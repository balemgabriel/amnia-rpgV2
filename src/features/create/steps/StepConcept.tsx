import { useState } from 'react'
import { Badge, Callout, Card, Field, SectionTitle, TextInput } from '@/components/ui'
import { cn } from '@/lib/cn'
import { creationBudget } from '@/rules/amnia'
import { lineages, type Trait } from '@/rules/data'
import { ancestryColor, lineageColor, traitColor, withAlpha } from '@/rules/lineageColors'
import { useDraft } from '@/store/draft'

const WIP_NOTE =
  'Esta linhagem ainda está em construção no material oficial: pode não ter descrição, traços ou ramificações completas. Os dados serão completados em uma atualização futura.'

export function StepConcept() {
  const character = useDraft((state) => state.character)
  const patch = useDraft((state) => state.patch)

  const lineage = lineages.find((item) => item.id === character.ancestryId) ?? null
  const sublineage = lineage?.lineages.find((item) => item.id === character.sublineageId) ?? null

  const allTraits: Trait[] = lineage
    ? [...(sublineage?.traits ?? []), ...lineage.racialTraits, ...lineage.negativeTraits]
    : []

  const selectedIds = new Set([...character.ancestryTraits, ...character.negativeTraits])
  const spent = allTraits
    .filter((trait) => selectedIds.has(trait.id))
    .reduce((sum, trait) => sum + trait.cost, 0)
  const available = creationBudget.ancestryPoints - spent
  const activeColor = traitColor(character.ancestryId, character.sublineageId)

  function toggleTrait(trait: Trait) {
    if (selectedIds.has(trait.id)) {
      patch({
        ancestryTraits: character.ancestryTraits.filter((id) => id !== trait.id),
        negativeTraits: character.negativeTraits.filter((id) => id !== trait.id),
      })
      return
    }
    if (trait.cost > available) return
    if (trait.cost < 0) patch({ negativeTraits: [...character.negativeTraits, trait.id] })
    else patch({ ancestryTraits: [...character.ancestryTraits, trait.id] })
  }

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle hint="Quem é esse personagem antes de qualquer número?">
          1 · Conceito e Essência
        </SectionTitle>
      </div>

      <Card className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" htmlFor="nome">
            <TextInput
              id="nome"
              value={character.name}
              onChange={(event) => patch({ name: event.target.value })}
              placeholder="Como o mundo o chama?"
            />
          </Field>
          <Field label="Conceito" htmlFor="conceito" hint="Uma frase que resume o personagem.">
            <TextInput
              id="conceito"
              value={character.concept}
              onChange={(event) => patch({ concept: event.target.value })}
              placeholder="Gladiador showman, erudito exilado…"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Desejo" htmlFor="desejo" hint="O que você quer agora? Concede XP ao progredir.">
            <TextInput
              id="desejo"
              value={character.desire}
              onChange={(event) => patch({ desire: event.target.value })}
              placeholder="Ganhar o torneio de espadas desta cidade."
            />
          </Field>
          <Field label="Ambição" htmlFor="ambicao" hint="Qual é o objetivo de vida?">
            <TextInput
              id="ambicao"
              value={character.ambition}
              onChange={(event) => patch({ ambition: event.target.value })}
              placeholder="Encontrar quem assassinou meu mestre."
            />
          </Field>
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <ListEditor
          title="Convicções"
          hint="Até 3. Ditam o compasso moral — quebrá-las gera Culpa."
          placeholder="Eu nunca abandono um aliado em combate."
          values={character.convictions}
          max={3}
          onChange={(values) => patch({ convictions: values })}
        />
        <ListEditor
          title="Pilares"
          hint="Até 3. Pessoas, objetos ou locais de máxima importância."
          placeholder="A espada do meu pai."
          values={character.pillars}
          max={3}
          onChange={(values) => patch({ pillars: values })}
        />
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-display text-lg tracking-wide">Ancestralidade</h3>
          <Badge tone={available < 0 ? 'warn' : 'gold'}>
            {available} / {creationBudget.ancestryPoints} pontos
          </Badge>
        </div>

        {lineages.length === 0 ? (
          <Callout>
            Os dados das linhagens ainda estão sendo extraídos do material. A estrutura já está
            pronta — assim que o arquivo chegar, as opções aparecem aqui.
          </Callout>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {lineages.map((item) => {
                const color = ancestryColor(item.id)
                const active = character.ancestryId === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => patch({ ancestryId: item.id, sublineageId: null })}
                    style={
                      color
                        ? {
                            borderColor: active ? color : withAlpha(color, 0.45),
                            backgroundColor: active ? withAlpha(color, 0.1) : undefined,
                          }
                        : undefined
                    }
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition',
                      active
                        ? 'text-ink'
                        : 'border-ink/15 text-ink-soft hover:border-ink/30 hover:text-ink',
                    )}
                  >
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full border border-ink/20"
                      style={{ backgroundColor: color ?? 'transparent' }}
                    />
                    {item.name}
                    {item.wip ? (
                      <span className="rounded-full bg-amber-600/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800">
                        WIP
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>

            {lineage?.wip ? (
              <Callout tone="warn">
                <strong>{lineage.name} está em construção (WIP).</strong> {WIP_NOTE}
              </Callout>
            ) : null}

            {lineage && lineage.lineages.length > 0 ? (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
                  Linhagem
                </p>
                <div className="flex flex-wrap gap-2">
                  {lineage.lineages.map((item) => {
                    const color = lineageColor(item.id)
                    const active = character.sublineageId === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => patch({ sublineageId: item.id, ancestryTraits: [] })}
                        style={
                          color
                            ? {
                                borderColor: active ? color : withAlpha(color, 0.45),
                                backgroundColor: active ? withAlpha(color, 0.1) : undefined,
                              }
                            : undefined
                        }
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition',
                          active
                            ? 'text-ink'
                            : 'border-ink/15 text-ink-soft hover:border-ink/30 hover:text-ink',
                        )}
                      >
                        <span
                          aria-hidden
                          className="size-2 shrink-0 rounded-full border border-ink/20"
                          style={{ backgroundColor: color ?? 'transparent' }}
                        />
                        {item.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {allTraits.length > 0 ? (
              <ul className="space-y-2">
                {allTraits.map((trait) => {
                  const selected = selectedIds.has(trait.id)
                  const affordable = selected || trait.cost <= available
                  return (
                    <li key={trait.id}>
                      <button
                        type="button"
                        onClick={() => toggleTrait(trait)}
                        disabled={!affordable}
                        style={
                          activeColor
                            ? {
                                borderColor: selected
                                  ? activeColor
                                  : withAlpha(activeColor, 0.3),
                                backgroundColor: selected
                                  ? withAlpha(activeColor, 0.07)
                                  : undefined,
                              }
                            : undefined
                        }
                        className={cn(
                          'w-full rounded-lg border p-3 text-left transition',
                          !selected && 'border-ink/10 hover:border-ink/25',
                          selected && !activeColor && 'border-accent/40 bg-accent/[0.06]',
                          !affordable && 'cursor-not-allowed opacity-40',
                        )}
                      >
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="font-semibold">{trait.name}</span>
                          <span
                            className={cn(
                              'shrink-0 text-xs font-semibold tabular-nums',
                              trait.cost < 0 ? 'text-emerald-800' : 'text-ink-soft',
                            )}
                          >
                            {trait.cost > 0 ? '+' : ''}
                            {trait.cost} pt
                          </span>
                        </span>
                        <span className="mt-1 block text-sm leading-relaxed text-ink-soft">
                          {trait.description}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </div>
        )}
      </Card>
    </div>
  )
}

function ListEditor({
  title,
  hint,
  placeholder,
  values,
  max,
  onChange,
}: {
  title: string
  hint: string
  placeholder: string
  values: string[]
  max: number
  onChange: (values: string[]) => void
}) {
  const [draft, setDraft] = useState('')

  function add() {
    const value = draft.trim()
    if (!value || values.length >= max) return
    onChange([...values, value])
    setDraft('')
  }

  return (
    <Card>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="font-display text-lg tracking-wide">{title}</h3>
        <span className="text-xs tabular-nums text-ink-soft">
          {values.length}/{max}
        </span>
      </div>
      <p className="mb-3 text-xs text-ink-soft">{hint}</p>

      <ul className="mb-3 space-y-1.5">
        {values.map((value, index) => (
          <li
            key={`${value}-${index}`}
            className="flex items-start justify-between gap-2 rounded-md bg-ink/[0.04] px-2.5 py-1.5 text-sm"
          >
            <span className="leading-snug">{value}</span>
            <button
              type="button"
              onClick={() => onChange(values.filter((_, i) => i !== index))}
              className="shrink-0 text-xs text-ink-soft hover:text-accent"
              aria-label={`Remover ${value}`}
            >
              remover
            </button>
          </li>
        ))}
      </ul>

      {values.length < max ? (
        <div className="flex gap-2">
          <TextInput
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                add()
              }
            }}
            placeholder={placeholder}
          />
          <button
            type="button"
            onClick={add}
            className="shrink-0 rounded-md border border-ink/15 px-3 text-sm text-ink-soft transition hover:bg-ink/5 hover:text-ink"
          >
            +
          </button>
        </div>
      ) : null}
    </Card>
  )
}
