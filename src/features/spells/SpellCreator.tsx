import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/Modal'
import { RuneCard } from '@/components/RuneCard'
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
import { runes as allRunes, type RuneCircleId, type RuneDef } from '@/rules/data'
import { computeDerived } from '@/rules/derive'
import {
  defaultLevel,
  hasUnlockingCondition,
  isLevelDefined,
  isLevelLocked,
  runeById,
  runeName,
} from '@/rules/runes'
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
  allConditions,
  conditionMode,
  effectiveRuneLevel,
  emptySpell,
  exponentialIssue,
  exponentialReleasedLevel,
  exponentialRune,
  exponentialTargetRune,
  formatModifier,
  isExponencializar,
  lockedRunes,
  normalizeRune,
  personalMagicOwner,
  spellCost,
  spellCx,
  spellSchema,
  spellWarnings,
  type ConditionWeight,
  type Spell,
  type SpellCondition,
  type SpellOption,
  type SpellRune,
} from '@/rules/spell'
import { spellContext, workshopSpellContext } from '@/rules/spellContext'
import { RuneLevelSelector } from './RuneLevelSelector'
import { getCharacter, saveCharacter } from '@/storage/characters'
import { getLibrarySpell, saveLibrarySpell } from '@/storage/spellLibrary'

const RUNE_CIRCLES: RuneCircleId[] = [...circleOrder, 'miscelanea']

export function SpellCreator({
  characterId,
  spellId,
  onDone,
}: {
  /** Sem personagem, o criador funciona como Oficina de Magias. */
  characterId?: string
  spellId?: string
  onDone: () => void
}) {
  const [character, setCharacter] = useState<Character | null>(null)
  const [spell, setSpell] = useState<Spell | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [circleFilter, setCircleFilter] = useState<RuneCircleId | 'all'>('all')
  const [openRuneId, setOpenRuneId] = useState<string | null>(null)

  const workshop = characterId === undefined

  useEffect(() => {
    let active = true

    if (!characterId) {
      // Oficina: a magia vem da biblioteca, não de uma ficha.
      if (!spellId) {
        setSpell(emptySpell())
        return () => {
          active = false
        }
      }
      getLibrarySpell(spellId)
        .then((record) => {
          if (!active) return
          const parsed = record ? spellSchema.safeParse(record.data) : null
          if (!parsed || !parsed.success) {
            setError('Magia não encontrada na oficina.')
            return
          }
          setSpell(parsed.data)
        })
        .catch(() => {
          if (active) setError('Não foi possível carregar a magia da oficina.')
        })
      return () => {
        active = false
      }
    }

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

  /**
   * Runas disponíveis: na ficha, só as que o personagem conhece; na oficina,
   * o catálogo inteiro (a validação acontece ao adicionar a uma ficha).
   */
  const owned = useMemo<RuneDef[]>(() => {
    if (!character) return workshop ? allRunes : []
    return character.knownRunes
      .map((id) => runeById(id))
      .filter((rune): rune is RuneDef => rune !== undefined)
  }, [character, workshop])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return owned.filter((rune) => {
      if (circleFilter !== 'all' && rune.circle !== circleFilter) return false
      if (!term) return true
      return (
        rune.name.toLowerCase().includes(term) || rune.description.toLowerCase().includes(term)
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

  if (!spell || (!workshop && !character)) {
    return <p className="px-6 py-16 text-sm text-ink-soft">Carregando magia…</p>
  }

  const context = character ? spellContext(character) : workshopSpellContext()
  const cost = spellCost(spell, context)
  const cx = spellCx(spell, context)
  const derived = character ? computeDerived(character) : []
  const pm = derived.find((stat) => stat.id === 'pm')?.value
  const limiar = derived.find((stat) => stat.id === 'limiar')?.value
  const warnings = spellWarnings(
    spell,
    context,
    character ? { pm, limiar, knownRunes: character.knownRunes } : {},
  )

  const hasPersonalTrait = context.ancestryTraits.includes(MAGIA_PESSOAL_TRAIT_ID)
  const personalOwner = personalMagicOwner(context, spell.id)
  const personalAllowed = workshop || (hasPersonalTrait && !personalOwner)
  const hasLockedRune = lockedRunes(spell).length > 0
  const exponential = exponentialRune(spell)
  const exponentialTarget = exponentialTargetRune(spell)
  const exponentialProblem = exponentialIssue(spell)
  const canSave =
    spell.name.trim() !== '' &&
    spell.runes.length > 0 &&
    !hasLockedRune &&
    exponentialProblem === null
  const totalConditions = allConditions(spell).length
  const hasEffectiveBonus = spell.runes.some(
    (rune) => effectiveRuneLevel(rune, spell) !== rune.level,
  )
  const openRune = openRuneId ? owned.find((rune) => rune.id === openRuneId) : undefined
  const openSelected = openRune
    ? spell.runes.find((item) => item.runeId === openRune.id)
    : undefined
  const openEffective = openSelected ? effectiveRuneLevel(openSelected, spell) : null
  const openIsTarget =
    Boolean(openSelected) && exponentialTarget?.runeId === openSelected?.runeId

  function update(partial: Partial<Spell>) {
    setSpell((previous) =>
      previous ? { ...previous, ...partial, updatedAt: Date.now() } : previous,
    )
  }

  /** Joga a runa na magia (no menor nível livre) ou a tira dela. */
  function toggleRune(rune: RuneDef) {
    setSpell((previous) => {
      if (!previous) return previous
      const exponential = exponentialRune(previous)
      const exists = previous.runes.some((item) => item.runeId === rune.id)

      // Exponencializar liga/desliga sozinha: ao entrar, suprime o circuito e
      // deixa no máximo uma runa alvo (a única que já existia, se for o caso).
      if (isExponencializar(rune.id)) {
        if (exists) {
          return {
            ...previous,
            runes: previous.runes.filter((item) => !isExponencializar(item.runeId)),
            updatedAt: Date.now(),
          }
        }
        const others = previous.runes.filter((item) => !isExponencializar(item.runeId))
        const target = others.length === 1 ? others[0] : undefined
        const next: SpellRune = {
          runeId: rune.id,
          level: defaultLevel(rune),
          conditions: [],
          targetRuneId: target?.runeId ?? null,
        }
        return {
          ...previous,
          runes: target ? [next, target] : [next],
          updatedAt: Date.now(),
        }
      }

      // Com Exponencializar na composição, qualquer outra runa vira a alvo.
      if (exponential) {
        if (exists && exponential.targetRuneId === rune.id) {
          return {
            ...previous,
            runes: previous.runes.filter((item) => item.runeId !== rune.id),
            updatedAt: Date.now(),
          }
        }
        const targetRune: SpellRune = exists
          ? (previous.runes.find((item) => item.runeId === rune.id) as SpellRune)
          : {
              runeId: rune.id,
              level: defaultLevel(rune),
              conditions: [],
              targetRuneId: null,
            }
        return {
          ...previous,
          runes: [{ ...exponential, targetRuneId: rune.id }, targetRune],
          updatedAt: Date.now(),
        }
      }

      const runes: SpellRune[] = exists
        ? previous.runes.filter((item) => item.runeId !== rune.id)
        : [
            ...previous.runes,
            {
              runeId: rune.id,
              level: defaultLevel(rune),
              conditions: [],
              targetRuneId: null,
            },
          ]
      return { ...previous, runes, updatedAt: Date.now() }
    })
  }

  /** Troca (ou limpa) a runa alvo de Exponencializar sem mexer no resto. */
  function setExponentialTarget(runeId: string | null) {
    setSpell((previous) => {
      if (!previous) return previous
      const exponential = exponentialRune(previous)
      if (!exponential) return previous

      const target = runeId
        ? (previous.runes.find((item) => item.runeId === runeId) ??
          (() => {
            const def = runeById(runeId)
            if (!def) return undefined
            return {
              runeId,
              level: defaultLevel(def),
              conditions: [],
              targetRuneId: null,
            } satisfies SpellRune
          })())
        : undefined

      const exponentialRuneNext: SpellRune = {
        ...exponential,
        targetRuneId: target?.runeId ?? null,
      }

      return {
        ...previous,
        runes: target ? [exponentialRuneNext, target] : [exponentialRuneNext],
        updatedAt: Date.now(),
      }
    })
  }

  /** Muda o nível (= PM) de uma runa; níveis bloqueados ou inexistentes são recusados. */
  function setRuneLevel(runeId: string, level: number) {
    setSpell((previous) => {
      if (!previous) return previous
      return {
        ...previous,
        runes: previous.runes.map((item) => {
          if (item.runeId !== runeId) return item
          if (!isLevelDefined(runeById(runeId), level)) return item
          if (isLevelLocked(level, item.conditions)) return item
          return { ...item, level }
        }),
        updatedAt: Date.now(),
      }
    })
  }

  /** Aplica `change` às condições de UMA runa; recua o nível se a trava deixou de valer. */
  function changeRuneConditions(
    runeId: string,
    change: (conditions: SpellCondition[]) => SpellCondition[],
  ) {
    setSpell((previous) => {
      if (!previous) return previous
      return {
        ...previous,
        runes: previous.runes.map((item) =>
          item.runeId === runeId ? normalizeRune({ ...item, conditions: change(item.conditions) }) : item,
        ),
        updatedAt: Date.now(),
      }
    })
  }

  function addCondition(runeId: string, weight: ConditionWeight) {
    if (!spell) return
    // Os limites do material valem para a magia inteira, somando todas as runas.
    const count = allConditions(spell).filter((condition) => condition.weight === weight).length
    if (count >= CONDITION_LIMITS[weight]) return
    const condition: SpellCondition = {
      id: crypto.randomUUID(),
      weight,
      text: '',
      mode:
        weight === 'severa' || weight === 'extrema'
          ? 'levels'
          : weight === 'absoluta'
            ? 'cx'
            : undefined,
    }
    changeRuneConditions(runeId, (conditions) => [...conditions, condition])
  }

  function updateCondition(runeId: string, id: string, partial: Partial<SpellCondition>) {
    changeRuneConditions(runeId, (conditions) =>
      conditions.map((condition) => (condition.id === id ? { ...condition, ...partial } : condition)),
    )
  }

  function removeCondition(runeId: string, id: string) {
    changeRuneConditions(runeId, (conditions) => conditions.filter((condition) => condition.id !== id))
  }

  async function save() {
    if (!spell || !canSave) return
    setSaving(true)
    setError(null)
    try {
      const now = Date.now()
      const saved: Spell = { ...spell, name: spell.name.trim(), updatedAt: now }

      if (workshop) {
        await saveLibrarySpell(saved)
        onDone()
        return
      }

      if (!character) return
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
            ← {workshop ? 'Oficina' : character?.name || 'Ficha'}
          </Button>
          <div className="text-center">
            <p className="font-display text-lg leading-tight tracking-wide">
              {spellId ? 'Editar magia' : 'Nova magia'}
            </p>
            <p className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">
              {workshop ? 'Oficina de Magias' : 'Criador de magias'}
            </p>
          </div>
          <Button onClick={save} disabled={saving || !canSave}>
            {saving ? 'Salvando…' : workshop ? 'Salvar na oficina' : 'Salvar magia'}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {error ? (
          <div className="mb-4">
            <Callout tone="warn">{error}</Callout>
          </div>
        ) : null}

        {workshop ? (
          <div className="mb-4">
            <Callout>
              Esta magia fica guardada na <strong className="text-ink">Oficina</strong> e pode ser
              adicionada a qualquer personagem depois. O custo abaixo é a base: Círculo Inato,
              atributo chave e canalização entram quando ela é usada numa ficha.
            </Callout>
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
                {workshop
                  ? 'Todas as runas do catálogo estão disponíveis. Clique numa runa para abrir a carta completa, escolher o '
                  : 'Só aparecem as runas a que este personagem tem acesso. Clique numa runa para abrir a carta completa, escolher o '}
                <strong className="text-ink">nível</strong> (quanto PM você paga por aquele efeito) e
                jogá-la na magia. Condições elevam o nível efetivo da runa; a carta destaca o
                efeito alcançado e o PM pago continua no nível escolhido.
              </p>

              {owned.length === 0 ? (
                <Callout tone="warn">
                  Este personagem ainda não tem acesso a nenhuma runa. Escolha as runas conhecidas
                  na criação da ficha antes de montar magias.
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
                      const count = owned.filter((rune) => rune.circle === id).length
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
                    <div className="flex flex-wrap gap-1.5">
                      {filtered.map((rune) => {
                        const selected = spell.runes.find((item) => item.runeId === rune.id)
                        const effective = selected ? effectiveRuneLevel(selected, spell) : null
                        const isTarget =
                          Boolean(selected) && exponentialTarget?.runeId === selected?.runeId
                        const tone = circleColor(rune.circle) ?? '#5c5044'
                        return (
                          <button
                            key={rune.id}
                            type="button"
                            onClick={() => setOpenRuneId(rune.id)}
                            aria-haspopup="dialog"
                            aria-label={`Abrir a runa ${rune.name}`}
                            title={`Abrir ${rune.name}`}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition',
                              selected ? 'text-ink' : 'text-ink-soft hover:text-ink',
                            )}
                            style={{
                              borderColor: selected ? tone : withAlpha(tone, 0.35),
                              backgroundColor: selected ? withAlpha(tone, 0.12) : undefined,
                            }}
                          >
                            <span
                              aria-hidden
                              className="size-1.5 rounded-full"
                              style={{ backgroundColor: tone }}
                            />
                            <span className="font-medium">{rune.name}</span>
                            <span className="text-[9px] uppercase tracking-wide text-ink-soft">
                              {runeCircleLabels[rune.circle]}
                            </span>
                            {selected ? (
                              <span
                                className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
                                style={{ backgroundColor: withAlpha(tone, 0.18) }}
                                title={
                                  isTarget
                                    ? `Nível pago ${selected.level} · Exponencializar libera o efeito no nível ${effective}`
                                    : effective !== null && effective !== selected.level
                                      ? `Nível pago ${selected.level} · efeito nível ${effective} pelas condições`
                                      : `Nível ${selected.level}`
                                }
                              >
                                {effective !== null && effective !== selected.level
                                  ? `Nv ${selected.level} → ${effective}`
                                  : `Nv ${selected.level}`}
                              </span>
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {exponential ? (
                    <div className="mt-4 rounded-lg border border-ink/10 bg-ink/[0.02] p-3">
                      <p className="text-sm font-semibold">Runa alvo de Exponencializar</p>
                      <p className="mt-1 text-xs leading-snug text-ink-soft">
                        Exponencializar suprime todo o circuito: só ela e a runa alvo podem existir.
                        Todo o foco vai para a alvo, que é liberada no nível que a carta de
                        Exponencializar indica. O nível pago da alvo continua contando no custo.
                      </p>
                      <select
                        value={exponential.targetRuneId ?? ''}
                        onChange={(event) =>
                          setExponentialTarget(event.target.value || null)
                        }
                        aria-label="Runa alvo de Exponencializar"
                        className="mt-2 h-9 w-full rounded-md border border-ink/15 bg-parchment/70 px-2 text-sm"
                      >
                        <option value="">Escolha a runa alvo…</option>
                        {owned
                          .filter((rune) => !isExponencializar(rune.id))
                          .map((rune) => (
                            <option key={rune.id} value={rune.id}>
                              {rune.name}
                            </option>
                          ))}
                        {exponentialTarget &&
                        !owned.some((rune) => rune.id === exponentialTarget.runeId) ? (
                          <option value={exponentialTarget.runeId}>
                            {runeName(exponentialTarget.runeId)}
                          </option>
                        ) : null}
                      </select>
                      {exponentialTarget ? (
                        <p className="mt-2 text-xs leading-snug">
                          <strong className="text-ink">{runeName(exponentialTarget.runeId)}</strong>{' '}
                          paga nível {exponentialTarget.level} e é liberada no{' '}
                          <strong className="text-ink">
                            nível {effectiveRuneLevel(exponentialTarget, spell)}
                          </strong>
                          {effectiveRuneLevel(exponential) >= 2 ? (
                            <>
                              {' '}
                              (Exponencializar nível {effectiveRuneLevel(exponential)} → alvo{' '}
                              {exponentialReleasedLevel(effectiveRuneLevel(exponential))})
                            </>
                          ) : null}
                          .
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </Card>

            <Modal
              open={Boolean(openRune)}
              onClose={() => setOpenRuneId(null)}
              label={openRune ? `Runa ${openRune.name}` : 'Runa'}
              className="max-w-xl"
            >
              {openRune ? (
                <div
                  className="rounded-xl border border-ink/10 bg-parchment shadow-xl"
                  style={{ backgroundColor: '#f3ece0' }}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-ink/10 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
                      {runeCircleLabels[openRune.circle]}
                    </p>
                    <button
                      type="button"
                      onClick={() => setOpenRuneId(null)}
                      className="rounded-md border border-ink/20 px-2.5 py-1 text-xs text-ink-soft transition hover:text-ink"
                    >
                      fechar
                    </button>
                  </div>
                  <div className="p-4">
                    <RuneCard
                      rune={openRune}
                      active={Boolean(openSelected)}
                      highlightLevel={openEffective}
                      paidLevel={openSelected?.level ?? null}
                      badge={openSelected ? <Badge tone="ok">Na magia</Badge> : null}
                      footer={
                        openSelected ? (
                          <div className="space-y-2">
                            <RuneLevelSelector
                              rune={openRune}
                              spellRune={openSelected}
                              tone={circleColor(openRune.circle)}
                              effectiveLevel={openEffective}
                              effectiveNote={
                                openIsTarget
                                  ? `Exponencializar libera esta runa no nível ${openEffective}.`
                                  : undefined
                              }
                              onChange={(level) => setRuneLevel(openRune.id, level)}
                            />
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-ink-soft">
                                Custo desta runa:{' '}
                                <strong className="tabular-nums text-ink">
                                  {openSelected.level} PM
                                </strong>
                                {openEffective !== null &&
                                openEffective !== openSelected.level ? (
                                  <>
                                    {' '}
                                    · efeito nível{' '}
                                    <strong className="tabular-nums text-ink">
                                      {openEffective}
                                    </strong>{' '}
                                    <span className="text-[11px]">
                                      ({openIsTarget ? 'Exponencializar' : 'condições'})
                                    </span>
                                  </>
                                ) : null}
                              </span>
                              <Button
                                variant="quiet"
                                className="px-2 py-1 text-xs"
                                onClick={() => toggleRune(openRune)}
                              >
                                Tirar da magia
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            className="w-full text-xs"
                            onClick={() => toggleRune(openRune)}
                          >
                            Jogar na magia
                          </Button>
                        )
                      }
                    />
                  </div>
                </div>
              ) : null}
            </Modal>

            <Card>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-xl tracking-wide">Condições</h2>
                <Badge>{totalConditions} registradas</Badge>
              </div>
              <p className="mb-3 text-sm text-ink-soft">
                Cada condição pertence a uma runa específica. Para usar o nível 6 ou 7 de uma
                runa, é ela que precisa ter uma condição Severa, Extrema ou Absoluta; condições
                de outras runas da magia não destravam. Condições que dão níveis elevam o{' '}
                <strong className="text-ink">nível efetivo</strong> da runa, mas o PM pago continua
                sendo o nível base escolhido. Os limites do material valem para a magia inteira.
              </p>

              {spell.runes.length === 0 ? (
                <p className="text-sm text-ink-soft">
                  Jogue ao menos uma runa na magia para adicionar condições a ela.
                </p>
              ) : (
                <div className="space-y-5">
                  {spell.runes.map((spellRune) => {
                    const def = runeById(spellRune.runeId)
                    const tone = circleColor(def?.circle)
                    const unlocked = hasUnlockingCondition(spellRune.conditions)
                    const effective = effectiveRuneLevel(spellRune, spell)
                    const isTarget = exponentialTarget?.runeId === spellRune.runeId
                    return (
                      <section
                        key={spellRune.runeId}
                        className="rounded-lg border border-l-4 border-ink/10 p-3"
                        style={{ borderLeftColor: tone ?? undefined }}
                        aria-label={`Condições de ${runeName(spellRune.runeId)}`}
                      >
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold">
                            {runeName(spellRune.runeId)}{' '}
                            <span className="text-xs font-normal text-ink-soft">
                              · nível {spellRune.level}
                              {effective !== spellRune.level ? (
                                <>
                                  {' '}
                                  → <strong className="font-semibold text-ink">{effective}</strong>{' '}
                                  {isTarget ? 'via Exponencializar' : 'com condições'}
                                </>
                              ) : null}
                            </span>
                          </p>
                          <Badge tone={unlocked ? 'ok' : 'neutral'}>
                            {unlocked ? 'níveis 6–7 liberados' : 'níveis 6–7 bloqueados'}
                          </Badge>
                        </div>

                        {isTarget ? (
                          <p className="mb-3 rounded-md border border-ink/10 bg-ink/[0.02] px-2.5 py-2 text-xs leading-snug text-ink-soft">
                            Esta é a runa alvo de Exponencializar: o nível efetivo vem dela.
                            Condições aqui ainda contam para a Complexidade, mas não mudam o nível
                            liberado.
                          </p>
                        ) : null}

                        <div className="mb-3 flex flex-wrap gap-1.5">
                          {CONDITION_WEIGHTS.map((weight) => {
                            const count = allConditions(spell).filter(
                              (condition) => condition.weight === weight,
                            ).length
                            const full = count >= CONDITION_LIMITS[weight]
                            return (
                              <Button
                                key={weight}
                                variant="ghost"
                                className="text-xs"
                                disabled={full}
                                onClick={() => addCondition(spellRune.runeId, weight)}
                              >
                                + {CONDITION_LABELS[weight]} ({count}/{CONDITION_LIMITS[weight]})
                              </Button>
                            )
                          })}
                        </div>

                        {spellRune.conditions.length === 0 ? (
                          <p className="text-sm text-ink-soft">Nenhuma condição nesta runa.</p>
                        ) : (
                          <ul className="space-y-2">
                            {spellRune.conditions.map((condition) => {
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
                                          condition.weight === 'severa' ||
                                          condition.weight === 'extrema'
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
                                      onClick={() => removeCondition(spellRune.runeId, condition.id)}
                                      className="text-xs text-ink-soft transition hover:text-accent"
                                    >
                                      remover
                                    </button>
                                  </div>

                                  <div className="mt-2 space-y-2">
                                    <TextInput
                                      value={condition.text}
                                      onChange={(event) =>
                                        updateCondition(spellRune.runeId, condition.id, {
                                          text: event.target.value,
                                        })
                                      }
                                      placeholder="Descreva a condição (ex.: deve estar em Fúria)."
                                    />

                                    {condition.weight === 'severa' ||
                                    condition.weight === 'extrema' ||
                                    condition.weight === 'absoluta' ? (
                                      <label className="block text-xs text-ink-soft">
                                        <span className="mb-1 block font-semibold uppercase tracking-wide">
                                          Efeito
                                        </span>
                                        <select
                                          value={mode ?? 'levels'}
                                          onChange={(event) =>
                                            updateCondition(spellRune.runeId, condition.id, {
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
                                    ) : null}
                                  </div>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </section>
                    )
                  })}
                </div>
              )}
            </Card>

            <Card>
              <h2 className="mb-3 font-display text-xl tracking-wide">Modificações Extras</h2>
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
                {hasEffectiveBonus ? (
                  <p className="pt-1 text-[11px] leading-snug text-ink-soft">
                    O nível depois da seta é o efeito alcançado com condições ou
                    Exponencializar; o PM cobrado continua no nível pago.
                  </p>
                ) : null}
                {cost.lines.some((line) => line.label === 'Custo mínimo') ? (
                  <p className="pt-1 text-[11px] leading-snug text-ink-soft">
                    Toda magia custa pelo menos <strong className="text-ink">1 PM</strong>, mesmo
                    depois das reduções.
                  </p>
                ) : null}
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
                      {workshop
                        ? 'Na oficina a marcação é livre; a ficha avisa se o personagem não tiver o traço.'
                        : hasPersonalTrait
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
                {saving
                  ? 'Salvando…'
                  : spellId
                    ? 'Salvar alterações'
                    : workshop
                      ? 'Guardar na oficina'
                      : 'Adicionar à ficha'}
              </Button>
              {!canSave ? (
                <p className="mt-2 text-center text-xs text-ink-soft">
                  {exponentialProblem
                    ? exponentialProblem
                    : hasLockedRune
                      ? 'Há runa em nível 6 ou 7 sem condição Severa, Extrema ou Absoluta.'
                      : 'Dê um nome e escolha ao menos uma runa.'}
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
