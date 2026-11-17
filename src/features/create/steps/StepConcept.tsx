import { useState } from 'react'
import { Badge, Callout, Card, Field, SectionTitle, TextInput } from '@/components/ui'
import { cn } from '@/lib/cn'
import { creationBudget } from '@/rules/amnia'
import {
  lineages,
  type Lineage,
  type SubLineage,
  type Trait,
  type TraitPath,
} from '@/rules/data'
import { ancestryColor, lineageColor, withAlpha } from '@/rules/lineageColors'
import {
  findCaste,
  findLineage,
  findSublineage,
  groupedLineages,
  lineageTraits,
  selectedPathOption,
} from '@/rules/lineages'
import { useDraft } from '@/store/draft'

const WIP_NOTE =
  'Esta linhagem ainda está em construção no material oficial: pode não ter descrição, traços ou ramificações completas. Os dados serão completados em uma atualização futura.'

export function StepConcept() {
  const character = useDraft((state) => state.character)
  const patch = useDraft((state) => state.patch)

  const lineage = findLineage(character.ancestryId)
  const caste = findCaste(lineage, character.casteId)
  const path = lineage?.path ?? null
  const pathOption = selectedPathOption(lineage, character.ancestryTraits)

  /** Linhagem selecionada pode ser recolhida sem perder os traços comprados. */
  const [collapsedId, setCollapsedId] = useState<string | null>(null)
  /** Linhagem bloqueada pode ser aberta só para leitura, sem ser escolhida. */
  const [previewId, setPreviewId] = useState<string | null>(null)

  const allTraits: Trait[] = lineageTraits(lineage)

  const selectedIds = new Set([...character.ancestryTraits, ...character.negativeTraits])
  const spent = allTraits
    .filter((trait) => selectedIds.has(trait.id))
    .reduce((sum, trait) => sum + trait.cost, 0)
  const available = creationBudget.ancestryPoints - spent

  function chooseAncestry(id: string) {
    if (character.ancestryId === id) return
    // Trocar de raça invalida casta, linhagem e todos os traços comprados nelas.
    patch({
      ancestryId: id,
      casteId: null,
      sublineageId: null,
      ancestryTraits: [],
      negativeTraits: [],
    })
    setCollapsedId(null)
    setPreviewId(null)
  }

  function chooseCaste(id: string) {
    if (character.casteId === id) return

    // Trocar de casta remove os traços da casta anterior e invalida a linhagem
    // se ela exigir outra casta.
    const previous = findCaste(lineage, character.casteId)
    const previousIds = new Set(previous?.traits.map((trait) => trait.id) ?? [])

    const currentSublineage = findSublineage(lineage, character.sublineageId)
    const keepsSublineage =
      currentSublineage?.casteId === undefined || currentSublineage.casteId === id
    const removedSublineageIds = new Set(
      keepsSublineage ? [] : (currentSublineage?.traits.map((trait) => trait.id) ?? []),
    )

    patch({
      casteId: id,
      sublineageId: keepsSublineage ? character.sublineageId : null,
      ancestryTraits: character.ancestryTraits.filter(
        (traitId) => !previousIds.has(traitId) && !removedSublineageIds.has(traitId),
      ),
    })

    if (!keepsSublineage) {
      setCollapsedId(null)
      setPreviewId(null)
    }
  }

  function chooseSublineage(item: SubLineage) {
    if (character.sublineageId === item.id) return

    // Ao trocar de linhagem, remove apenas os traços da linhagem anterior:
    // traços raciais, negativos e da casta continuam valendo.
    const previous = findSublineage(lineage, character.sublineageId)
    const previousIds = new Set(previous?.traits.map((trait) => trait.id) ?? [])

    patch({
      sublineageId: item.id,
      ancestryTraits: character.ancestryTraits.filter((traitId) => !previousIds.has(traitId)),
    })
  }

  function casteLock(item: SubLineage): string | null {
    if (!item.casteId || item.casteId === character.casteId) return null
    const required = lineage?.castes?.find((entry) => entry.id === item.casteId)
    return character.casteId
      ? `Requer casta ${required?.name ?? item.casteId}`
      : 'Escolha uma casta para liberar esta linhagem'
  }

  function toggleSublineage(item: SubLineage) {
    if (casteLock(item)) {
      setPreviewId((current) => (current === item.id ? null : item.id))
      return
    }

    if (character.sublineageId === item.id) {
      setCollapsedId((current) => (current === item.id ? null : item.id))
      setPreviewId(null)
      return
    }

    setCollapsedId(null)
    setPreviewId(null)
    chooseSublineage(item)
  }

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

  function choosePath(option: Trait) {
    const pathIds = new Set(path?.options.map((entry) => entry.id) ?? [])
    const withoutPath = character.ancestryTraits.filter((id) => !pathIds.has(id))

    // Clicar na opção já escolhida remove o caminho.
    if (pathOption?.id === option.id) {
      patch({ ancestryTraits: withoutPath })
      return
    }

    // Trocar de opção é gratuito: o custo da opção anterior é liberado antes.
    const budget = available + (pathOption?.cost ?? 0)
    if (option.cost > budget) return

    patch({ ancestryTraits: [...withoutPath, option.id] })
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

      {lineages.length === 0 ? (
        <Card>
          <Callout>
            Os dados das linhagens ainda estão sendo extraídos do material. A estrutura já está
            pronta — assim que o arquivo chegar, as opções aparecem aqui.
          </Callout>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-display text-lg tracking-wide">Ancestralidade &amp; Linhagem</h3>
              <p className="text-xs text-ink-soft">
                Escolha a raça à esquerda e, se ela tiver ramificações, a linhagem à direita.
              </p>
            </div>
            <Badge tone={available < 0 ? 'warn' : 'gold'}>
              {available} / {creationBudget.ancestryPoints} pontos
            </Badge>
          </div>

          <div className="grid items-start gap-6 md:grid-cols-2">
            <Card className="space-y-4">
              <div>
                <h4 className="font-display text-lg tracking-wide">Ancestralidade</h4>
                <p className="text-xs text-ink-soft">A raça do personagem.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {lineages.map((item) => {
                  const color = ancestryColor(item.id)
                  const active = character.ancestryId === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => chooseAncestry(item.id)}
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

              {lineage ? (
                <>
                  <p className="text-sm leading-relaxed text-ink-soft">{lineage.description}</p>

                  {lineage.wip ? (
                    <Callout tone="warn">
                      <strong>{lineage.name} está em construção (WIP).</strong> {WIP_NOTE}
                    </Callout>
                  ) : null}

                  <TraitList
                    title="Traços raciais"
                    hint="Compartilham os mesmos pontos de ancestralidade."
                    traits={lineage.racialTraits}
                    selectedIds={selectedIds}
                    available={available}
                    color={ancestryColor(lineage.id)}
                    onToggle={toggleTrait}
                  />

                  <TraitList
                    title="Traços negativos"
                    hint="Comprar um traço negativo devolve pontos de ancestralidade."
                    traits={lineage.negativeTraits}
                    selectedIds={selectedIds}
                    available={available}
                    color={ancestryColor(lineage.id)}
                    onToggle={toggleTrait}
                  />
                </>
              ) : (
                <Callout>Escolha uma ancestralidade para ver a descrição e os traços raciais.</Callout>
              )}
            </Card>

            <div className="space-y-6">
              {lineage?.castes && lineage.castes.length > 0 ? (
                <Card className="space-y-4">
                  <div>
                    <h4 className="font-display text-lg tracking-wide">Casta</h4>
                    <p className="text-xs text-ink-soft">
                      A função do personagem na colmeia Skaraeb.
                    </p>
                  </div>

                  {lineage.casteDescription ? (
                    <p className="text-sm leading-relaxed text-ink-soft">
                      {lineage.casteDescription}
                    </p>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    {lineage.castes.map((item) => {
                      const active = character.casteId === item.id
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => chooseCaste(item.id)}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition',
                            active
                              ? 'border-accent/50 bg-accent/[0.08] text-ink'
                              : 'border-ink/15 text-ink-soft hover:border-ink/30 hover:text-ink',
                          )}
                        >
                          {item.name}
                        </button>
                      )
                    })}
                  </div>

                  {caste ? (
                    <TraitList
                      title={`Traços de ${caste.name}`}
                      hint="A casta também usa os pontos de ancestralidade."
                      traits={caste.traits}
                      selectedIds={selectedIds}
                      available={available}
                      color={ancestryColor(lineage.id)}
                      onToggle={toggleTrait}
                    />
                  ) : (
                    <Callout>
                      Escolha uma casta para liberar as linhagens correspondentes.
                    </Callout>
                  )}
                </Card>
              ) : null}

              {path ? (
                <PathCard
                  path={path}
                  selectedOption={pathOption}
                  available={available}
                  onChoose={choosePath}
                />
              ) : (
                <LineageCard
                  lineage={lineage}
                  casteId={character.casteId}
                  selectedIds={selectedIds}
                  available={available}
                  activeId={character.sublineageId}
                  collapsedId={collapsedId}
                  previewId={previewId}
                  onToggle={toggleSublineage}
                  onToggleTrait={toggleTrait}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Cartão de linhagens, com grupos descritos (Kuetz/Tlahkoa, Qatae/Khayat/Rasasa). */
function LineageCard({
  lineage,
  casteId,
  selectedIds,
  available,
  activeId,
  collapsedId,
  previewId,
  onToggle,
  onToggleTrait,
}: {
  lineage: Lineage | null
  casteId: string | null
  selectedIds: Set<string>
  available: number
  activeId: string | null
  collapsedId: string | null
  previewId: string | null
  onToggle: (item: SubLineage) => void
  onToggleTrait: (trait: Trait) => void
}) {
  const { groups, ungrouped } = groupedLineages(lineage)

  function renderItem(item: SubLineage) {
    const requiredCaste = item.casteId
      ? lineage?.castes?.find((entry) => entry.id === item.casteId)?.name
      : undefined
    const locked = item.casteId !== undefined && item.casteId !== casteId
    const active = activeId === item.id
    const open = (active && collapsedId !== item.id) || previewId === item.id

    return (
      <SublineageItem
        key={item.id}
        item={item}
        requiredCaste={requiredCaste}
        locked={locked}
        lockedReason={
          locked
            ? casteId
              ? `Requer casta ${requiredCaste ?? item.casteId}`
              : 'Escolha uma casta para liberar esta linhagem'
            : undefined
        }
        active={active}
        open={open}
        color={lineageColor(item.id) ?? (lineage ? ancestryColor(lineage.id) : null)}
        selectedIds={selectedIds}
        available={available}
        onToggle={() => onToggle(item)}
        onToggleTrait={onToggleTrait}
      />
    )
  }

  return (
    <Card className="space-y-4">
      <div>
        <h4 className="font-display text-lg tracking-wide">Linhagem</h4>
        <p className="text-xs text-ink-soft">
          {lineage?.castes
            ? 'Cada linhagem tem uma opção para cada casta.'
            : 'A sub-ramificação da ancestralidade escolhida.'}
        </p>
      </div>

      {!lineage ? (
        <Callout>
          As linhagens aparecem aqui depois que você escolher uma ancestralidade.
        </Callout>
      ) : lineage.lineages.length === 0 ? (
        <Callout>
          {lineage.name} não tem linhagens no material. Use os traços raciais ao lado.
        </Callout>
      ) : groups.length > 0 ? (
        <div className="space-y-5">
          {groups.map(({ group, lineages: items }) => {
            const color = lineageColor(group.id) ?? ancestryColor(lineage.id)
            return (
              <section key={group.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full border border-ink/20"
                    style={{ backgroundColor: color ?? 'transparent' }}
                  />
                  <h5 className="font-display text-base tracking-wide">{group.name}</h5>
                </div>
                <p className="text-sm leading-relaxed text-ink-soft">{group.description}</p>
                <ul className="space-y-2">{items.map(renderItem)}</ul>
              </section>
            )
          })}
          {ungrouped.length > 0 ? (
            <ul className="space-y-2">{ungrouped.map(renderItem)}</ul>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-2">{lineage.lineages.map(renderItem)}</ul>
      )}
    </Card>
  )
}

/** Uma linhagem em acordeão; bloqueada apenas para leitura quando a casta não bate. */
function SublineageItem({
  item,
  requiredCaste,
  locked,
  lockedReason,
  active,
  open,
  color,
  selectedIds,
  available,
  onToggle,
  onToggleTrait,
}: {
  item: SubLineage
  requiredCaste?: string
  locked: boolean
  lockedReason?: string
  active: boolean
  open: boolean
  color: string | null
  selectedIds: Set<string>
  available: number
  onToggle: () => void
  onToggleTrait: (trait: Trait) => void
}) {
  const count = item.traits.length

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={
          color
            ? {
                borderColor: active ? color : withAlpha(color, 0.45),
                backgroundColor: active ? withAlpha(color, 0.1) : undefined,
              }
            : undefined
        }
        className={cn(
          'flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition',
          active
            ? 'text-ink'
            : 'border-ink/15 text-ink-soft hover:border-ink/30 hover:text-ink',
          locked && 'border-dashed opacity-75',
        )}
      >
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full border border-ink/20"
          style={{ backgroundColor: color ?? 'transparent' }}
        />
        <span className="flex flex-1 flex-wrap items-center gap-1.5">
          <span className="font-medium">{item.name}</span>
          {requiredCaste ? (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
              {requiredCaste}
            </span>
          ) : null}
        </span>
        {locked ? (
          <span className="rounded-full bg-amber-600/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800">
            bloqueada
          </span>
        ) : (
          <span className="text-[11px] tabular-nums text-ink-soft">
            {count} {count === 1 ? 'traço' : 'traços'}
          </span>
        )}
        <span
          aria-hidden
          className={cn('text-xs text-ink-soft transition-transform', open && 'rotate-90')}
        >
          ›
        </span>
      </button>

      {open ? (
        <div className="mt-2 space-y-2 border-l border-ink/10 pl-3">
          {item.description ? (
            <p className="text-xs leading-relaxed text-ink-soft">{item.description}</p>
          ) : null}
          {locked && lockedReason ? <Callout tone="warn">{lockedReason}</Callout> : null}
          <TraitList
            title={requiredCaste ? `Traço de ${item.name}` : 'Traços da linhagem'}
            traits={item.traits}
            selectedIds={selectedIds}
            available={available}
            color={color}
            onToggle={onToggleTrait}
            disabled={locked}
          />
        </div>
      ) : null}
    </li>
  )
}

/** Caminho com opções exclusivas, como O Caminho da Vida dos Golshoy. */
function PathCard({
  path,
  selectedOption,
  available,
  onChoose,
}: {
  path: TraitPath
  selectedOption: Trait | null
  available: number
  onChoose: (option: Trait) => void
}) {
  return (
    <Card className="space-y-4">
      <div>
        <h4 className="font-display text-lg tracking-wide">{path.name}</h4>
        <p className="text-xs text-ink-soft">Escolha um único fenômeno de nascimento.</p>
      </div>

      <p className="text-sm leading-relaxed text-ink-soft">{path.description}</p>

      <Badge tone="gold">
        {path.cost} ponto · escolha 1
      </Badge>

      <ul className="space-y-2">
        {path.options.map((option) => {
          const selected = selectedOption?.id === option.id
          const budget = available + (selectedOption?.cost ?? 0)
          const affordable = selected || option.cost <= budget

          return (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => onChoose(option)}
                disabled={!affordable}
                className={cn(
                  'w-full rounded-lg border p-3 text-left transition',
                  selected
                    ? 'border-accent/40 bg-accent/[0.06]'
                    : 'border-ink/10 hover:border-ink/25',
                  !affordable && 'cursor-not-allowed opacity-40',
                )}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{option.name}</span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-ink-soft">
                    +{option.cost} pt
                  </span>
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-ink-soft">
                  {option.description}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {selectedOption ? (
        <Callout tone="ok">Caminho escolhido: {selectedOption.name}.</Callout>
      ) : (
        <Callout>Escolha um dos cinco fenômenos. Apenas um pode ser comprado.</Callout>
      )}
    </Card>
  )
}

/**
 * Lista de traços compráveis. Os mesmos pontos de ancestralidade valem para
 * traços raciais, negativos, de casta e de linhagem.
 */
function TraitList({
  title,
  hint,
  traits,
  selectedIds,
  available,
  color,
  onToggle,
  disabled = false,
}: {
  title: string
  hint?: string
  traits: Trait[]
  selectedIds: Set<string>
  available: number
  color: string | null
  onToggle: (trait: Trait) => void
  disabled?: boolean
}) {
  if (traits.length === 0) return null

  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
        {title}
      </p>
      {hint ? <p className="mb-2 text-xs text-ink-soft">{hint}</p> : null}
      <ul className="space-y-2">
        {traits.map((trait) => {
          const selected = selectedIds.has(trait.id)
          const affordable = !disabled && (selected || trait.cost <= available)
          return (
            <li key={trait.id}>
              <button
                type="button"
                onClick={() => onToggle(trait)}
                disabled={!affordable}
                style={
                  color
                    ? {
                        borderColor: selected ? color : withAlpha(color, 0.3),
                        backgroundColor: selected ? withAlpha(color, 0.07) : undefined,
                      }
                    : undefined
                }
                className={cn(
                  'w-full rounded-lg border p-3 text-left transition',
                  !selected && 'border-ink/10 hover:border-ink/25',
                  selected && !color && 'border-accent/40 bg-accent/[0.06]',
                  (disabled || !affordable) && 'cursor-not-allowed opacity-40',
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
