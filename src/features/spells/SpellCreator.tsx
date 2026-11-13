import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Callout, Card, Field, TextArea, TextInput } from '@/components/ui'
import { cn } from '@/lib/cn'
import { circleOrder, runeCircleLabels } from '@/rules/amnia'
import {
  characterSchema,
  rulesVersion,
  SHEET_VERSION,
  type Character,
} from '@/rules/character'
import { circleColor } from '@/rules/circleColors'
import { computeDerived } from '@/rules/derive'
import { runes, type RuneCircleId, type RuneDef } from '@/rules/data'
import { withAlpha } from '@/rules/lineageColors'
import {
  AREA_OPTIONS,
  CONDITION_LABELS,
  CONDITION_LIMITS,
  CONDITION_SUMMARIES,
  CONDITION_WEIGHTS,
  DURATION_OPTIONS,
  MAGIA_PESSOAL_TRAIT_ID,
  TARGET_OPTIONS,
  conditionMode,
  emptySpell,
  formatModifier,
  personalMagicOwner,
  spellCost,
  spellCx,
  spellWarnings,
  type ConditionWeight,
  type Spell,
  type SpellCondition,
  type SpellOption,
} from '@/rules/spell'
import { ownedMaxLevels, spellContext } from '@/rules/spellContext'
import { getCharacter, saveCharacter } from '@/storage/characters'

const RUNE_CIRCLES: RuneCircleId[] = [...circleOrder, 'miscelanea']

/** Opção de nível exibida em uma carta de runa. */
interface RuneLevelOption {
  level: number
  effect?: string
}

/** Runa que o personagem possui, já ligada ao catálogo. */
interface OwnedRune {
  rune: Character['runes'][number]
  source?: RuneDef
  levels: RuneLevelOption[]
}

export function SpellCreator({
  characterId,
  spellId,
  onDone,
}: {
  characterId: string
  spellId?: string
  onDone: () => void
}) {
  const [character, setCharacter] = useState<Character | null>(null)
  const [spell, setSpell] = useState<Spell | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [circleFilter, setCircleFilter] = useState<RuneCircleId | 'all'>('all')

  useEffect(() => {
    let active = true
    getCharacter(characterId)
      .then((record) => {
        if (!active) return
        if (!record) {
          setError('Ficha não encontrada.')
          return
        }
        const parsed = characterSchema.safeParse(record.data)
        if (!parsed.success) {
          setError('O formato desta ficha é incompatível com a versão atual.')
          return
        }
        const loaded = parsed.data
        setCharacter(loaded)
        const existing = spellId
          ? loaded.spells.find((item) => item.id === spellId)
          : undefined
        if (spellId && !existing) {
          setError('Magia não encontrada nesta ficha.')
          return
        }
        setSpell(existing ?? emptySpell())
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar a ficha.')
      })
    return () => {
      active = false
    }
  }, [characterId, spellId])

  const owned = useMemo<OwnedRune[]>(() => {
    if (!character) return []
    return character.runes.map((rune) => {
      const source = runes.find((item) => item.id === rune.sourceId)
      const levels: RuneLevelOption[] = source
        ? source.levels
            .filter((item) => item.level <= rune.level)
            .map((item) => ({ level: item.level, effect: item.effect }))
        : Array.from({ length: rune.level }, (_, index) => ({ level: index + 1 }))
      return { rune, source, levels }
    })
  }, [character])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return owned.filter((item) => {
      if (circleFilter !== 'all' && item.rune.circle !== circleFilter) return false
      if (!term) return true
      return (
        item.rune.name.toLowerCase().includes(term) ||
        (item.source?.description ?? '').toLowerCase().includes(term)
      )
    })
  }, [owned, query, circleFilter])

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm text-accent">{error}</p>
        <div className="mt-4">
          <Button variant="ghost" onClick={onDone}>
            ← Voltar
          </Button>
        </div>
      </div>
    )
  }

  if (!character || !spell) {
    return <p className="px-6 py-16 text-sm text-ink-soft">Carregando magia…</p>
  }

  const context = spellContext(character)
  const cost = spellCost(spell, context)
  const cx = spellCx(spell, context)
  const maxLevels = ownedMaxLevels(character)
  const derived = computeDerived(character)
  const pm = derived.find((stat) => stat.id === 'pm')?.value
  const limiar = derived.find((stat) => stat.id === 'limiar')?.value
  const warnings = spellWarnings(spell, context, { pm, limiar, ownedMaxLevels: maxLevels })

  const hasPersonalTrait = context.ancestryTraits.includes(MAGIA_PESSOAL_TRAIT_ID)
  const personalOwner = personalMagicOwner(context, spell.id)
  const personalAllowed = hasPersonalTrait && !personalOwner
  const canSave = spell.name.trim() !== '' && spell.runes.length > 0

  function update(partial: Partial<Spell>) {
    setSpell((previous) =>
      previous ? { ...previous, ...partial, updatedAt: Date.now() } : previous,
    )
  }

  function toggleRune(item: OwnedRune, level: number) {
    setSpell((previous) => {
      if (!previous) return previous
      const existing = previous.runes.find((rune) => rune.sourceId === item.rune.sourceId)
      const now = Date.now()

      if (existing && existing.level === level) {
        return {
          ...previous,
          runes: previous.runes.filter((rune) => rune.id !== existing.id),
          conditions: previous.conditions.map((condition) =>
            condition.targetRuneId === existing.id
              ? { ...condition, targetRuneId: null }
              : condition,
          ),
          updatedAt: now,
        }
      }

      if (existing) {
        return {
          ...previous,
          runes: previous.runes.map((rune) =>
            rune.id === existing.id ? { ...rune, level } : rune,
          ),
          updatedAt: now,
        }
      }

      return {
        ...previous,
        runes: [
          ...previous.runes,
          {
            id: crypto.randomUUID(),
            sourceId: item.rune.sourceId,
            name: item.rune.name,
            circle: item.rune.circle,
            level,
          },
        ],
        updatedAt: now,
      }
    })
  }

  function addCondition(weight: ConditionWeight) {
    if (!spell) return
    const count = spell.conditions.filter((condition) => condition.weight === weight).length
    if (count >= CONDITION_LIMITS[weight]) return
    const condition: SpellCondition = {
      id: crypto.randomUUID(),
      weight,
      description: '',
      mode:
        weight === 'severa' || weight === 'extrema'
          ? 'levels'
          : weight === 'absoluta'
            ? 'cx'
            : undefined,
      targetRuneId: null,
    }
    update({ conditions: [...spell.conditions, condition] })
  }

  function updateCondition(id: string, partial: Partial<SpellCondition>) {
    if (!spell) return
    update({
      conditions: spell.conditions.map((condition) =>
        condition.id === id ? { ...condition, ...partial } : condition,
      ),
    })
  }

  function removeCondition(id: string) {
    if (!spell) return
    update({ conditions: spell.conditions.filter((condition) => condition.id !== id) })
  }

  async function save() {
    if (!character || !spell || !canSave) return
    setSaving(true)
    setError(null)
    try {
      const now = Date.now()
      const saved: Spell = { ...spell, name: spell.name.trim(), updatedAt: now }
      const exists = character.spells.some((item) => item.id === saved.id)
      const spells = exists
        ? character.spells.map((item) => (item.id === saved.id ? saved : item))
        : [...character.spells, saved]
      const updatedCharacter: Character = { ...character, spells, updatedAt: now }
      await saveCharacter({
        id: character.id,
        name: updatedCharacter.name,
        rulesVersion,
        sheetVersion: SHEET_VERSION,
        data: updatedCharacter,
      })
      onDone()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a magia.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-10 border-b border-ink/10 bg-parchment/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <Button variant="quiet" onClick={onDone} className="px-2">
            ← {character.name || 'Ficha'}
          </Button>
          <div className="text-center">
            <p className="font-display text-lg leading-tight tracking-wide">
              {spellId ? 'Editar magia' : 'Nova magia'}
            </p>
            <p className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">
              Criador de magias
            </p>
          </div>
          <Button onClick={save} disabled={saving || !canSave}>
            {saving ? 'Salvando…' : 'Salvar magia'}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {error ? (
          <div className="mb-4">
            <Callout tone="warn">{error}</Callout>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <div className="space-y-6">
            <Card>
              <h2 className="mb-3 font-display text-xl tracking-wide">Identidade</h2>
              <div className="space-y-3">
                <Field label="Nome da magia" htmlFor="spell-name">
                  <TextInput
                    id="spell-name"
                    value={spell.name}
                    onChange={(event) => update({ name: event.target.value })}
                    placeholder="Ex.: Segredo do Ladino"
                  />
                </Field>
                <Field
                  label="Efeito"
                  htmlFor="spell-effect"
                  hint="O que a magia faz, em linguagem direta."
                >
                  <TextArea
                    id="spell-effect"
                    rows={5}
                    value={spell.effect}
                    onChange={(event) => update({ effect: event.target.value })}
                    placeholder="Descreva o efeito…"
                  />
                </Field>
                <Field label="Anotações" htmlFor="spell-notes">
                  <TextArea
                    id="spell-notes"
                    rows={2}
                    value={spell.notes}
                    onChange={(event) => update({ notes: event.target.value })}
                    placeholder="Detalhes, limitações, lembretes…"
                  />
                </Field>
              </div>
            </Card>

            <Card>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-xl tracking-wide">Runas</h2>
                <Badge tone={spell.runes.length > 0 ? 'ok' : 'gold'}>
                  {spell.runes.length} na composição
                </Badge>
              </div>
              <p className="mb-3 text-sm text-ink-soft">
                Só aparecem as runas que este personagem conhece. Clique em um nível para
                adicionar; clique de novo para remover.
              </p>

              {owned.length === 0 ? (
                <Callout tone="warn">
                  Este personagem ainda não conhece nenhuma runa. Volte à ficha para registrar
                  as runas antes de criar magias.
                </Callout>
              ) : (
                <>
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCircleFilter('all')}
                      className={cn(
                        'rounded-md border px-2.5 py-1 text-xs transition',
                        circleFilter === 'all'
                          ? 'border-accent bg-accent/[0.08] text-ink'
                          : 'border-ink/12 text-ink-soft hover:border-ink/30 hover:text-ink',
                      )}
                    >
                      Todas
                    </button>
                    {RUNE_CIRCLES.map((id) => {
                      const tone = circleColor(id)
                      const active = circleFilter === id
                      const count = owned.filter((item) => item.rune.circle === id).length
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setCircleFilter(id)}
                          disabled={count === 0}
                          style={
                            tone
                              ? {
                                  borderColor: active ? tone : withAlpha(tone, 0.4),
                                  backgroundColor: active ? withAlpha(tone, 0.1) : undefined,
                                }
                              : undefined
                          }
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition disabled:opacity-35',
                            active ? 'text-ink' : 'text-ink-soft hover:text-ink',
                          )}
                        >
                          <span
                            aria-hidden
                            className="size-1.5 rounded-full"
                            style={{ backgroundColor: tone ?? 'currentColor' }}
                          />
                          {runeCircleLabels[id]}
                          <span className="tabular-nums text-ink-soft">{count}</span>
                        </button>
                      )
                    })}
                  </div>

                  <div className="mb-3">
                    <TextInput
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Buscar runa pelo nome ou descrição…"
                    />
                  </div>

                  {filtered.length === 0 ? (
                    <Callout>Nenhuma runa encontrada com esse filtro.</Callout>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {filtered.map((item) => {
                        const tone = circleColor(item.rune.circle)
                        const selected = spell.runes.find(
                          (rune) => rune.sourceId === item.rune.sourceId,
                        )
                        const selectedEffect = selected
                          ? item.levels.find((level) => level.level === selected.level)?.effect
                          : undefined
                        return (
                          <div
                            key={item.rune.id}
                            className={cn(
                              'rounded-lg border border-l-4 p-3 transition',
                              selected ? 'bg-ink/[0.035]' : 'border-ink/12',
                            )}
                            style={{
                              borderColor: selected
                                ? (tone ?? undefined)
                                : withAlpha(tone ?? '#5c5044', 0.22),
                              borderLeftColor: tone ?? undefined,
                            }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold">{item.rune.name}</p>
                                <p className="text-[11px] uppercase tracking-wide text-ink-soft">
                                  {runeCircleLabels[item.rune.circle]}
                                </p>
                              </div>
                              <Badge>máx. {item.rune.level}</Badge>
                            </div>

                            {item.source?.description ? (
                              <p className="mt-1 line-clamp-2 text-xs leading-snug text-ink-soft">
                                {item.source.description}
                              </p>
                            ) : null}

                            <div className="mt-2 flex flex-wrap items-center gap-1">
                              <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                                Nível
                              </span>
                              {item.levels.map((option) => {
                                const active = selected?.level === option.level
                                return (
                                  <button
                                    key={option.level}
                                    type="button"
                                    title={option.effect}
                                    onClick={() => toggleRune(item, option.level)}
                                    className={cn(
                                      'size-6 rounded border text-xs tabular-nums transition',
                                      active
                                        ? 'text-parchment'
                                        : 'text-ink-soft hover:text-ink',
                                    )}
                                    style={{
                                      borderColor: tone ?? undefined,
                                      backgroundColor: active ? (tone ?? undefined) : undefined,
                                    }}
                                  >
                                    {option.level}
                                  </button>
                                )
                              })}
                            </div>

                            {selected ? (
                              <div className="mt-2 rounded-md bg-ink/[0.04] px-2 py-1.5 text-xs leading-relaxed">
                                <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                                  Nível {selected.level}
                                </span>
                                {selectedEffect ?? item.source?.description ?? 'Sem efeito cadastrado.'}
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </Card>

            <Card>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-xl tracking-wide">Condições</h2>
                <Badge>{spell.conditions.length} registradas</Badge>
              </div>
              <p className="mb-3 text-sm text-ink-soft">
                Condições restringem a magia em troca de níveis de runa ou desconto. Os limites
                do material são aplicados automaticamente.
              </p>

              <div className="mb-4 flex flex-wrap gap-1.5">
                {CONDITION_WEIGHTS.map((weight) => {
                  const count = spell.conditions.filter(
                    (condition) => condition.weight === weight,
                  ).length
                  const full = count >= CONDITION_LIMITS[weight]
                  return (
                    <Button
                      key={weight}
                      variant="ghost"
                      className="text-xs"
                      disabled={full}
                      onClick={() => addCondition(weight)}
                    >
                      + {CONDITION_LABELS[weight]} ({count}/{CONDITION_LIMITS[weight]})
                    </Button>
                  )
                })}
              </div>

              {spell.conditions.length === 0 ? (
                <p className="text-sm text-ink-soft">Nenhuma condição.</p>
              ) : (
                <ul className="space-y-2">
                  {spell.conditions.map((condition) => {
                    const mode = conditionMode(condition)
                    return (
                      <li
                        key={condition.id}
                        className="rounded-lg border border-ink/10 bg-ink/[0.02] p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              tone={
                                condition.weight === 'severa' || condition.weight === 'extrema'
                                  ? 'warn'
                                  : condition.weight === 'absoluta'
                                    ? 'accent'
                                    : 'neutral'
                              }
                            >
                              {CONDITION_LABELS[condition.weight]}
                            </Badge>
                            <span className="text-xs text-ink-soft">
                              {CONDITION_SUMMARIES[condition.weight]}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCondition(condition.id)}
                            className="text-xs text-ink-soft transition hover:text-accent"
                          >
                            remover
                          </button>
                        </div>

                        <div className="mt-2 space-y-2">
                          <TextInput
                            value={condition.description}
                            onChange={(event) =>
                              updateCondition(condition.id, {
                                description: event.target.value,
                              })
                            }
                            placeholder="Descreva a condição (ex.: deve estar em Fúria)."
                          />

                          <div className="flex flex-wrap gap-2">
                            {(condition.weight === 'severa' ||
                              condition.weight === 'extrema' ||
                              condition.weight === 'absoluta') && (
                              <label className="text-xs text-ink-soft">
                                <span className="mb-1 block font-semibold uppercase tracking-wide">
                                  Efeito
                                </span>
                                <select
                                  value={mode ?? 'levels'}
                                  onChange={(event) =>
                                    updateCondition(condition.id, {
                                      mode: event.target.value as 'levels' | 'pm' | 'cx',
                                    })
                                  }
                                  className="h-[34px] rounded-md border border-ink/15 bg-parchment/70 px-2 text-sm"
                                >
                                  {condition.weight === 'absoluta' ? (
                                    <option value="cx">−2 Cx</option>
                                  ) : (
                                    <option value="levels">+ níveis de runa</option>
                                  )}
                                  <option value="pm">desconto em PM</option>
                                </select>
                              </label>
                            )}

                            {mode === 'levels' && spell.runes.length > 1 ? (
                              <label className="text-xs text-ink-soft">
                                <span className="mb-1 block font-semibold uppercase tracking-wide">
                                  Runa afetada
                                </span>
                                <select
                                  value={condition.targetRuneId ?? ''}
                                  onChange={(event) =>
                                    updateCondition(condition.id, {
                                      targetRuneId: event.target.value || null,
                                    })
                                  }
                                  className="h-[34px] rounded-md border border-ink/15 bg-parchment/70 px-2 text-sm"
                                >
                                  <option value="">Bônus geral</option>
                                  {spell.runes.map((rune) => (
                                    <option key={rune.id} value={rune.id}>
                                      {rune.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>

            <Card>
              <h2 className="mb-3 font-display text-xl tracking-wide">Alcance e Alvos</h2>
              <div className="space-y-4">
                <OptionPicker
                  label="Alvos"
                  options={TARGET_OPTIONS}
                  value={spell.targets}
                  onChange={(value) => update({ targets: value })}
                />
                <OptionPicker
                  label="Duração"
                  options={DURATION_OPTIONS}
                  value={spell.duration}
                  onChange={(value) => update({ duration: value })}
                />
                <OptionPicker
                  label="Área"
                  options={AREA_OPTIONS}
                  value={spell.area}
                  onChange={(value) => update({ area: value })}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Alcance" htmlFor="spell-range">
                    <TextInput
                      id="spell-range"
                      value={spell.range}
                      onChange={(event) => update({ range: event.target.value })}
                      placeholder="Ex.: 10 metros, toque…"
                    />
                  </Field>
                  <Field label="Descrição do alvo" htmlFor="spell-target">
                    <TextInput
                      id="spell-target"
                      value={spell.targetDescription}
                      onChange={(event) => update({ targetDescription: event.target.value })}
                      placeholder="Ex.: uma criatura, o próprio corpo…"
                    />
                  </Field>
                </div>
              </div>
            </Card>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-20">
            <Card>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-ink/10 bg-white/50 p-3 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
                    Custo
                  </p>
                  <p className="font-display text-3xl leading-tight tabular-nums">
                    {cost.total}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-ink-soft">PM</p>
                </div>
                <div className="rounded-lg border border-ink/10 bg-white/50 p-3 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
                    Complexidade
                  </p>
                  <p className="font-display text-3xl leading-tight tabular-nums">{cx.total}</p>
                  <p className="text-[10px] uppercase tracking-wide text-ink-soft">Cx</p>
                </div>
              </div>

              <div className="mt-3 space-y-1 border-t border-ink/8 pt-3">
                {cost.lines.length === 0 ? (
                  <p className="text-xs text-ink-soft">Escolha runas para ver o custo.</p>
                ) : (
                  cost.lines.map((line, index) => (
                    <div
                      key={`${line.label}-${index}`}
                      className="flex items-baseline justify-between gap-2 text-xs"
                    >
                      <span className="min-w-0 text-ink-soft">{line.label}</span>
                      <span
                        className={cn(
                          'shrink-0 tabular-nums',
                          line.value < 0 ? 'text-emerald-800' : 'text-ink',
                        )}
                      >
                        {formatModifier(line.value)}
                      </span>
                    </div>
                  ))
                )}
                <div className="flex items-baseline justify-between gap-2 border-t border-ink/10 pt-1.5 text-sm font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">{cost.total} PM</span>
                </div>
              </div>

              <div className="mt-3 space-y-1 border-t border-ink/8 pt-3">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
                  Complexidade
                </p>
                {cx.lines.map((line, index) => (
                  <div
                    key={`${line.label}-${index}`}
                    className="flex items-baseline justify-between gap-2 text-xs"
                  >
                    <span className="min-w-0 text-ink-soft">{line.label}</span>
                    <span
                      className={cn(
                        'shrink-0 tabular-nums',
                        line.value < 0 ? 'text-emerald-800' : 'text-ink',
                      )}
                    >
                      {formatModifier(line.value)}
                    </span>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-2 border-t border-ink/10 pt-1.5 text-sm font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">Cx {cx.total}</span>
                </div>
              </div>

              <div className="mt-3 border-t border-ink/8 pt-3">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={spell.personal}
                    disabled={!personalAllowed && !spell.personal}
                    onChange={(event) => update({ personal: event.target.checked })}
                    className="mt-0.5"
                  />
                  <span className="text-sm">
                    <strong>Magia Pessoal</strong>{' '}
                    <span className="text-ink-soft">(−3 PM)</span>
                    <span className="mt-0.5 block text-xs text-ink-soft">
                      {hasPersonalTrait
                        ? personalOwner
                          ? `Já usada por “${
                              personalOwner.name.trim() || 'magia sem nome'
                            }”.`
                          : 'Traço Snegatnom: uma magia por personagem.'
                        : 'Traço exclusivo da linhagem Snegatnom (Elfos).'}
                    </span>
                  </span>
                </label>
              </div>

              {warnings.length > 0 ? (
                <ul className="mt-3 space-y-1 border-t border-ink/8 pt-3">
                  {warnings.map((warning, index) => (
                    <li
                      key={`${warning.message}-${index}`}
                      className={cn(
                        'text-xs leading-snug',
                        warning.tone === 'warn' ? 'text-amber-800' : 'text-ink-soft',
                      )}
                    >
                      • {warning.message}
                    </li>
                  ))}
                </ul>
              ) : null}

              <Button className="mt-4 w-full" onClick={save} disabled={saving || !canSave}>
                {saving ? 'Salvando…' : spellId ? 'Salvar alterações' : 'Adicionar à ficha'}
              </Button>
              {!canSave ? (
                <p className="mt-2 text-center text-xs text-ink-soft">
                  Dê um nome e escolha ao menos uma runa.
                </p>
              ) : null}
            </Card>
          </aside>
        </div>
      </main>
    </div>
  )
}

function OptionPicker<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: SpellOption<T>[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = value === option.id
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs transition',
                active
                  ? 'border-accent bg-accent/[0.08] text-ink'
                  : 'border-ink/12 text-ink-soft hover:border-ink/30 hover:text-ink',
              )}
            >
              {option.label}
              {option.cost > 0 ? (
                <span className="ml-1 tabular-nums text-ink-soft">+{option.cost}</span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
