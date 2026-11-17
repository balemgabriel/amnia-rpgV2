import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { ArcanaeHexagon } from '@/components/ArcanaeHexagon'
import {
  attributes,
  channelingMethods,
  circles,
  impulses,
  runeCircleLabels,
  skillGroups,
  skills,
} from '@/rules/amnia'
import type { Character } from '@/rules/character'
import { resolveAdvantageDescription } from '@/rules/advantages'
import { circleColor } from '@/rules/circleColors'
import { classIsWip, classTone, coreAbilityTone } from '@/rules/classColors'
import { classes, lineages } from '@/rules/data'
import { computeDerived } from '@/rules/derive'
import {
  activeBonuses,
  bonusChips,
  formatZg,
  itemById,
  type BonusChip,
} from '@/rules/equipment'
import { ancestryColor, lineageColor, withAlpha } from '@/rules/lineageColors'
import { runeById, runeName } from '@/rules/runes'
import { skillGroupColor } from '@/rules/skillColors'
import {
  AREA_OPTIONS,
  CONDITION_LABELS,
  DURATION_OPTIONS,
  TARGET_OPTIONS,
  allConditions,
  conditionImpactLabel,
  effectiveRuneLevel,
  formatModifier,
  optionLabel,
  spellCircleInfo,
  spellCost,
  spellCx,
  type Spell,
  type SpellContext,
} from '@/rules/spell'
import { spellContext } from '@/rules/spellContext'
import './export.css'

const GROUP_ORDER = ['fisica', 'social', 'mental'] as const

/** Stats derivados mostrados em uma única fileira, na ordem da ficha tradicional. */
const DERIVED_ORDER = [
  'pv',
  'pm',
  'limiar',
  'saveDc',
  'impeto',
  'deslocamentoGrid',
  'deslocamentoMetros',
  'pa',
] as const

const QUALITY_SHORT: Record<string, string> = {
  boa: 'Boa +1',
  'obra-prima': 'Obra-Prima +2',
  lendaria: 'Lendária +3',
}

export type ExportMode = 'pdf' | 'png'

/**
 * Layout de exportação da ficha. Nunca aparece na tela: é montado fora dela
 * (e só enquanto exporta) para virar PDF (uma imagem por página) ou PNG.
 *
 *  - Página 1: identidade, atributos, derivados, perícias e os cinco blocos.
 *  - Página 2: convicções, hexágono, runas, anotações, canalização e magias.
 *  - Página 3: só existe se as magias não couberem na página 2.
 *
 * As páginas têm tamanho A4 fixo. Se o conteúdo não cabe, a escala (--fit)
 * diminui até caber, então o PDF nunca passa de 3 páginas.
 */
export function ExportSheet({
  character,
  mode,
  docRef,
  onReady,
}: {
  character: Character
  mode: ExportMode
  docRef: RefObject<HTMLDivElement | null>
  /** Chamado quando as páginas já foram medidas e estão prontas para imprimir/capturar. */
  onReady: () => void
}) {
  const derived = useMemo(() => computeDerived(character), [character])
  const byId = useMemo(() => Object.fromEntries(derived.map((stat) => [stat.id, stat])), [derived])
  const equipped = useMemo(() => activeBonuses(character.inventory), [character.inventory])
  const context = useMemo(() => spellContext(character), [character])

  const lineage = lineages.find((item) => item.id === character.ancestryId)
  const sublineage = lineage?.lineages.find((item) => item.id === character.sublineageId)
  const classDef = classes.find((item) => item.id === character.classId)
  const ability = classDef?.coreAbilities.find((item) => item.id === character.classAbilityId)
  const abilityIndex =
    classDef?.coreAbilities.findIndex((item) => item.id === character.classAbilityId) ?? -1
  const talent = classDef?.talents.find((item) => item.id === character.classTalentId)
  const impulse = impulses.find((item) => item.id === character.impulseId)
  const circle = circles.find((item) => item.id === character.innateCircle)
  const method = channelingMethods.find((item) => item.id === character.channelingMethodId)

  const lineageLabel = lineage
    ? sublineage
      ? `${lineage.name} — ${sublineage.name}`
      : lineage.name
    : null
  const lineageTone =
    lineageColor(character.sublineageId) ?? ancestryColor(character.ancestryId) ?? '#5c5044'
  const classTint = classDef ? (classTone(classDef.id) ?? '#5c5044') : '#5c5044'

  const traitPool = [
    ...(sublineage?.traits ?? []),
    ...(lineage?.racialTraits ?? []),
    ...(lineage?.negativeTraits ?? []),
  ]
  const traitIds = [...character.ancestryTraits, ...character.negativeTraits]
  const traits = traitPool.filter((trait) => traitIds.includes(trait.id))

  const sortedInventory = [...character.inventory].sort(
    (a, b) => Number(b.equipped) - Number(a.equipped),
  )
  const rd = equipped.rd

  // ---- paginação ---------------------------------------------------------
  const spellCount = character.spells.length
  /** Quantas magias ficam na página 2; o resto vai para a 3. */
  const [limit, setLimit] = useState(spellCount)
  const refs = useRef<Record<string, HTMLElement | null>>({})
  const readyRef = useRef(false)
  const runRef = useRef(0)
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady

  const pageTwoSpells = character.spells.slice(0, limit)
  const pageThreeSpells = character.spells.slice(limit)
  const totalPages = pageThreeSpells.length > 0 ? 3 : 2

  useEffect(() => {
    const run = ++runRef.current
    let cancelled = false

    async function settle() {
      await waitForAssets(docRef.current)
      if (cancelled || run !== runRef.current) return

      const els = refs.current
      const p1 = els.p1
      const p2 = els.p2
      const p3 = els.p3
      if (p1 && els.p1Inner) fitPage(p1, els.p1Inner, 0.55)

      if (p2 && els.p2Inner && els.p2Spells) {
        fitFixedPart(p2, els.p2Inner, els.p2Spells)
        const overflowAt = firstOverflowingSpell(els.p2Inner, els.p2SpellGrid)
        if (overflowAt !== null && overflowAt < limit) {
          setLimit(overflowAt) // reexecuta este efeito já com as magias redistribuídas
          return
        }
      }
      if (p3 && els.p3Inner) {
        // Muitas magias: primeiro reduz a escala; se ainda não couber, passa para 3 colunas.
        const grid = els.p3Grid
        grid?.removeAttribute('data-cols')
        fitPage(p3, els.p3Inner, 0.62)
        if (grid && contentHeight(els.p3Inner) > els.p3Inner.clientHeight + 0.5) {
          grid.setAttribute('data-cols', '3')
          fitPage(p3, els.p3Inner, 0.38)
        }
      }

      if (!cancelled && run === runRef.current && !readyRef.current) {
        readyRef.current = true
        onReadyRef.current()
      }
    }

    void settle()
    return () => {
      cancelled = true
    }
    // `refs` é estável; o que muda a medida é o conteúdo e a divisão das magias.
  }, [limit, character, docRef])

  const set = (key: string) => (node: HTMLElement | null) => {
    refs.current[key] = node
  }

  return createPortal(
    <div className="xs-root" aria-hidden>
      <div className="xs-doc" data-mode={mode} ref={docRef}>
        {/* ============================ PÁGINA 1 ============================ */}
        <section className="xs-page" ref={set('p1')} data-page="1">
          <div className="xs-inner" ref={set('p1Inner')}>
            <div className={`xs-row xs-identity${character.portrait ? ' has-portrait' : ''}`}>
              {character.portrait ? (
                <img className="xs-portrait" src={character.portrait} alt="" />
              ) : null}
              <section className="xs-box">
                <p className="xs-label">Nome</p>
                <h1 className="xs-name">{character.name || 'Sem nome'}</h1>
                {character.age ? <p className="xs-p xs-muted">{character.age} anos</p> : null}
              </section>
              <section className="xs-box">
                <p className="xs-label">Classe</p>
                {classDef ? (
                  <>
                    <span className="xs-pill" style={{ color: classTint }}>
                      {classDef.name}
                      {classIsWip(classDef.id) ? ' · WIP' : ''}
                    </span>
                    {impulse ? <p className="xs-p xs-muted">Ímpeto: {impulse.name}</p> : null}
                  </>
                ) : (
                  <p className="xs-p xs-muted">Não escolhida</p>
                )}
              </section>
              <section className="xs-box">
                <p className="xs-label">Raça</p>
                {lineageLabel ? (
                  <span className="xs-pill" style={{ color: lineageTone }}>
                    {lineageLabel}
                    {lineage?.wip ? ' · WIP' : ''}
                  </span>
                ) : (
                  <p className="xs-p xs-muted">Não escolhida</p>
                )}
              </section>
            </div>

            <div className="xs-row xs-trio">
              <section className="xs-box">
                <p className="xs-label">Conceito</p>
                <p className="xs-p xs-wrap">{character.concept || '—'}</p>
              </section>
              <section className="xs-box">
                <p className="xs-label">Desejo</p>
                <p className="xs-p xs-wrap">{character.desire || '—'}</p>
              </section>
              <section className="xs-box">
                <p className="xs-label">Ambição</p>
                <p className="xs-p xs-wrap">{character.ambition || '—'}</p>
              </section>
            </div>

            <div className="xs-row xs-attrs">
              {attributes.map((attribute) => (
                <div className="xs-tile" key={attribute.id}>
                  {character.keyAttribute === attribute.id ? (
                    <span className="xs-key" title="Atributo Chave">
                      ★
                    </span>
                  ) : null}
                  <p className="xs-label">{attribute.name}</p>
                  <p className="xs-value">
                    {character.attributes[attribute.id]}
                    <Chips chips={bonusChips(equipped.attributes[attribute.id], { plain: true })} />
                  </p>
                  <Dots value={character.attributes[attribute.id]} max={5} />
                </div>
              ))}
            </div>

            <div className="xs-row xs-derived">
              {DERIVED_ORDER.map((statId) => {
                const stat = byId[statId]
                if (!stat) return null
                return (
                  <div className="xs-tile" key={statId}>
                    <p className="xs-label">{stat.name}</p>
                    <p className="xs-value">
                      {stat.value}
                      <Chips chips={bonusChips(equipped.derived[statId], { plain: true })} />
                    </p>
                    <p className="xs-formula">{stat.formula}</p>
                  </div>
                )
              })}
            </div>

            <section className="xs-box">
              <h2 className="xs-h">Perícias</h2>
              <div className="xs-skills-cols">
                {GROUP_ORDER.map((group) => {
                  const tone = skillGroupColor(group)
                  return (
                    <div key={group}>
                      <p className="xs-sk-group" style={{ color: tone }}>
                        {skillGroups[group]}
                      </p>
                      <ul className="xs-list">
                        {skills
                          .filter((skill) => skill.group === group)
                          .map((skill) => {
                            const value = character.skills[skill.id] ?? 0
                            return (
                              <li
                                key={skill.id}
                                className={`xs-sk${value ? '' : ' is-zero'}`}
                                style={{ borderLeftColor: withAlpha(tone, 0.55) }}
                              >
                                <span className="xs-sk-name">
                                  {skill.name}
                                  <Chips chips={bonusChips(equipped.skills[skill.id])} />
                                </span>
                                <span style={{ color: tone }}>
                                  <Dots value={value} max={5} />
                                </span>
                              </li>
                            )
                          })}
                      </ul>
                    </div>
                  )
                })}
              </div>
            </section>

            <div className="xs-five">
              <section className="xs-box">
                <h2 className="xs-h">Habilidades & Talentos</h2>
                {ability ? (
                  <p
                    className="xs-p xs-ability"
                    style={{
                      borderColor: abilityIndex >= 0 ? coreAbilityTone(abilityIndex) : undefined,
                      backgroundColor:
                        abilityIndex >= 0
                          ? withAlpha(coreAbilityTone(abilityIndex), 0.07)
                          : undefined,
                    }}
                  >
                    <b>{ability.name}.</b> <span className="xs-muted">{ability.description}</span>
                  </p>
                ) : (
                  <p className="xs-p xs-muted">Habilidade central não escolhida.</p>
                )}
                {talent ? (
                  <p className="xs-p">
                    <b>{talent.name}.</b> <span className="xs-muted">{talent.description}</span>
                  </p>
                ) : null}
                {impulse ? (
                  <p className="xs-p">
                    <b>{impulse.name}.</b> <span className="xs-muted">{impulse.description}</span>
                  </p>
                ) : null}
              </section>

              <section className="xs-box">
                <h2 className="xs-h">Vantagens & Desvantagens</h2>
                {character.advantages.length === 0 ? (
                  <p className="xs-p xs-muted">Nenhuma registrada.</p>
                ) : (
                  <ul className="xs-list">
                    {character.advantages.map((item) => {
                      const description = resolveAdvantageDescription(item)
                      return (
                        <li className="xs-item" key={item.id}>
                          <div className="xs-line">
                            <span>{item.name}</span>
                            <span className="xs-tag">
                              {item.kind === 'desvantagem' ? '−' : '+'}
                              {item.points}
                            </span>
                          </div>
                          {description ? (
                            <p className="xs-adv-desc">{description}</p>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>

              <section className="xs-box">
                <h2 className="xs-h">Traços Raciais</h2>
                {traits.length === 0 ? (
                  <p className="xs-p xs-muted">Nenhum traço escolhido.</p>
                ) : (
                  <ul className="xs-list">
                    {traits.map((trait) => (
                      <li className="xs-item" key={trait.id}>
                        <b>{trait.cost < 0 ? '− ' : ''}{trait.name}.</b>{' '}
                        <span className="xs-muted">{trait.description}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="xs-box">
                <h2 className="xs-h">Especializações</h2>
                {character.specializations.length === 0 ? (
                  <p className="xs-p xs-muted">Nenhuma.</p>
                ) : (
                  <ul className="xs-list">
                    {character.specializations.map((specialization) => {
                      const skill = skills.find((item) => item.id === specialization.skillId)
                      const tone = skill ? skillGroupColor(skill.group) : '#5c5044'
                      return (
                        <li className="xs-item" key={specialization.id}>
                          <b>{specialization.name}</b>
                          {skill ? (
                            <span className="xs-tag" style={{ color: tone }}>
                              {' '}
                              · {skill.name}
                            </span>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>

              <section className="xs-box">
                <h2 className="xs-h">Equipamentos</h2>
                <p className="xs-p">
                  <b>Saldo:</b> {formatZg(character.zigs)}
                </p>
                {rd.fisico + rd.magico + rd.geral > 0 ? (
                  <p className="xs-p xs-small">
                    RD {rd.geral} · RDF {rd.fisico} · RDM {rd.magico}
                  </p>
                ) : null}
                {sortedInventory.length === 0 ? (
                  <p className="xs-p xs-muted">Sem equipamento.</p>
                ) : (
                  <ul className="xs-list" style={{ marginTop: '0.4em' }}>
                    {sortedInventory.map((entry) => {
                      const item = itemById(entry.itemId)
                      if (!item) return null
                      const quality = item.qualityable ? QUALITY_SHORT[entry.quality] : undefined
                      return (
                        <li className="xs-line" key={entry.id}>
                          <span>
                            {entry.equipped ? '✓ ' : ''}
                            {item.name}
                            {item.stackable && entry.quantity > 1 ? ` ×${entry.quantity}` : ''}
                          </span>
                          {quality ? <span className="xs-tag">{quality}</span> : null}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            </div>
          </div>
          <PageFoot name={character.name} page={1} total={totalPages} />
        </section>

        {/* ============================ PÁGINA 2 ============================ */}
        <section className="xs-page" ref={set('p2')} data-page="2">
          <div className="xs-inner" ref={set('p2Inner')}>
            <div className="xs-p2-top">
              <section className="xs-box">
                <h2 className="xs-h">Convicções & Pilares</h2>
                {character.convictions.length + character.pillars.length === 0 ? (
                  <p className="xs-p xs-muted">Nenhuma registrada.</p>
                ) : (
                  <ul className="xs-conv">
                    {character.convictions.map((value) => (
                      <li key={`c-${value}`}>{value}</li>
                    ))}
                    {character.pillars.map((value) => (
                      <li key={`p-${value}`} style={{ fontStyle: 'italic' }}>
                        {value}
                      </li>
                    ))}
                  </ul>
                )}
                {character.history ? (
                  <p className="xs-p xs-wrap xs-muted xs-history">{character.history}</p>
                ) : null}
              </section>

              <section className="xs-box xs-hex">
                <h2 className="xs-h" style={{ alignSelf: 'flex-start' }}>
                  Arcanae
                </h2>
                <ArcanaeHexagon innate={character.innateCircle} />
                <p className="xs-p xs-muted" style={{ textAlign: 'center' }}>
                  {circle ? `Círculo Inato: ${circle.name}` : 'Círculo Inato não definido.'}
                </p>
              </section>
            </div>

            <div className="xs-three">
              <section className="xs-box">
                <h2 className="xs-h">Runas Conhecidas</h2>
                {character.knownRunes.length === 0 ? (
                  <p className="xs-p xs-muted">Nenhuma runa registrada.</p>
                ) : (
                  <div>
                    {character.knownRunes.map((id) => {
                      const rune = runeById(id)
                      if (!rune) return null
                      const tone = circleColor(rune.circle) ?? '#5c5044'
                      return (
                        <span
                          className="xs-rune"
                          key={id}
                          style={{ borderColor: withAlpha(tone, 0.6), background: withAlpha(tone, 0.08) }}
                        >
                          {rune.name}
                          <small>{runeCircleLabels[rune.circle]}</small>
                        </span>
                      )
                    })}
                  </div>
                )}
              </section>

              <section className="xs-box">
                <h2 className="xs-h">Anotações</h2>
                <p className="xs-p xs-wrap">{character.notes.trim() || '—'}</p>
              </section>

              <section className="xs-box">
                <h2 className="xs-h">Método de Canalização</h2>
                {method ? (
                  <>
                    <p className="xs-p">
                      <b>{method.name}</b> <span className="xs-tag">· Nível {character.channelingLevel}</span>
                    </p>
                    <p className="xs-p xs-muted">{method.description}</p>
                    <p className="xs-p">
                      <b>Nível 1.</b> <span className="xs-muted">{method.level1}</span>
                    </p>
                    {character.channelingLevel >= 2 ? (
                      <p className="xs-p">
                        <b>Nível 2.</b> <span className="xs-muted">{method.level2}</span>
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="xs-p xs-muted">Nenhum método escolhido.</p>
                )}
              </section>
            </div>

            <section className="xs-box" ref={set('p2Spells')}>
              <h2 className="xs-h">
                Magias{spellCount > 0 ? ` (${spellCount})` : ''}
              </h2>
              {spellCount === 0 ? (
                <p className="xs-p xs-muted">Nenhuma magia criada.</p>
              ) : limit === 0 ? (
                <p className="xs-p xs-muted">As magias continuam na página 3.</p>
              ) : (
                <div className="xs-spell-grid" ref={set('p2SpellGrid')}>
                  {pageTwoSpells.map((spell) => (
                    <ExportSpell key={spell.id} spell={spell} context={context} />
                  ))}
                </div>
              )}
            </section>
          </div>
          <PageFoot name={character.name} page={2} total={totalPages} />
        </section>

        {/* ======================= PÁGINA 3 (se precisar) ======================= */}
        {pageThreeSpells.length > 0 ? (
          <section className="xs-page" ref={set('p3')} data-page="3">
            <div className="xs-inner" ref={set('p3Inner')}>
              <section className="xs-box">
                <h2 className="xs-h">Magias (continuação)</h2>
                <div className="xs-spell-grid" ref={set('p3Grid')}>
                  {pageThreeSpells.map((spell) => (
                    <ExportSpell key={spell.id} spell={spell} context={context} />
                  ))}
                </div>
              </section>
            </div>
            <PageFoot name={character.name} page={3} total={totalPages} />
          </section>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

// ---------------------------------------------------------------------------
// Peças
// ---------------------------------------------------------------------------

function PageFoot({ name, page, total }: { name: string; page: number; total: number }) {
  return (
    <footer className="xs-foot">
      <span>{name || 'Sem nome'} · Amnia</span>
      <span>
        Página {page}/{total}
      </span>
    </footer>
  )
}

function Dots({ value, max }: { value: number; max: number }) {
  return (
    <span className="xs-dots" role="img" aria-label={`${value} de ${max}`}>
      {Array.from({ length: max }, (_, index) => (
        <i key={index} className={index < value ? 'on' : undefined} />
      ))}
    </span>
  )
}

function Chips({ chips }: { chips: BonusChip[] }) {
  return (
    <>
      {chips.map((chip) => (
        <span key={chip.text} className={`xs-chip${chip.negative ? ' is-neg' : ''}`}>
          {chip.text}
        </span>
      ))}
    </>
  )
}

function ExportSpell({ spell, context }: { spell: Spell; context: SpellContext }) {
  const cost = spellCost(spell, context)
  const cx = spellCx(spell, context)
  const circleInfo = spellCircleInfo(spell, context)
  const meta = [
    spell.targets !== 'single' ? `Alvos: ${optionLabel(TARGET_OPTIONS, spell.targets)}` : null,
    spell.duration !== 'instant' ? `Duração: ${optionLabel(DURATION_OPTIONS, spell.duration)}` : null,
    spell.area !== 'none' ? `Área: ${optionLabel(AREA_OPTIONS, spell.area)}` : null,
    spell.range.trim() ? `Alcance: ${spell.range.trim()}` : null,
    spell.targetDescription.trim() ? `Alvo: ${spell.targetDescription.trim()}` : null,
  ].filter(Boolean)

  return (
    <article className="xs-spell">
      <div className="xs-spell-head">
        <h4>{spell.name.trim() || 'Magia sem nome'}</h4>
        <span className="xs-badge">
          {cost.total} PM · Cx {cx.total}
        </span>
      </div>
      {circleInfo.length > 0 || spell.personal ? (
        <p className="xs-small xs-muted">
          {spell.personal ? 'Magia Pessoal · ' : ''}
          {circleInfo
            .map(
              (item) =>
                `${item.name}${item.modifier !== 0 ? ` ${formatModifier(item.modifier)}` : ''}`,
            )
            .join(' · ')}
        </p>
      ) : null}
      <p className="xs-small">
        <b>Runas:</b>{' '}
        {spell.runes.length === 0
          ? 'nenhuma'
          : spell.runes
              .map((rune) => {
                const effective = effectiveRuneLevel(rune)
                const name = runeName(rune.runeId)
                return effective === rune.level
                  ? `${name} ${rune.level}`
                  : `${name} ${rune.level} (→ ${effective})`
              })
              .join(' · ')}
      </p>
      {meta.length > 0 ? <p className="xs-small xs-muted">{meta.join(' · ')}</p> : null}
      {allConditions(spell).length > 0 ? (
        <p className="xs-small xs-muted">
          {spell.runes
            .flatMap((rune) =>
              rune.conditions.map(
                (condition) =>
                  `${CONDITION_LABELS[condition.weight]} (${conditionImpactLabel(condition)})${condition.text.trim() ? ` — ${condition.text.trim()}` : ''} · ${runeName(rune.runeId)}`,
              ),
            )
            .join('; ')}
        </p>
      ) : null}
      {spell.effect.trim() ? <p className="xs-effect">{spell.effect.trim()}</p> : null}
    </article>
  )
}

// ---------------------------------------------------------------------------
// Medição e ajuste de escala
// ---------------------------------------------------------------------------

async function waitForAssets(root: HTMLElement | null) {
  await document.fonts?.ready
  const images = root ? Array.from(root.querySelectorAll('img')) : []
  await Promise.all(images.map((image) => image.decode().catch(() => undefined)))
  // Não usamos requestAnimationFrame: em abas ocultas ele fica pausado e a
  // exportação nunca começaria. Um macrotask basta para o layout assentar.
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

/** Altura real do conteúdo: o fim do último bloco, mesmo que passe da página. */
function contentHeight(inner: HTMLElement): number {
  return Array.from(inner.children).reduce(
    (max, child) => Math.max(max, (child as HTMLElement).offsetTop + (child as HTMLElement).offsetHeight),
    0,
  )
}

/**
 * Acha a MAIOR escala (--fit, entre `min` e 1) em que `fits()` é verdadeiro.
 * Busca binária: o texto quebra de linha de forma não linear, então um único
 * cálculo proporcional sempre erra para menos.
 */
function searchFit(page: HTMLElement, min: number, fits: () => boolean) {
  const apply = (value: number) => page.style.setProperty('--fit', value.toFixed(4))
  apply(1)
  if (fits()) return
  apply(min)
  if (!fits()) return // nem no mínimo cabe; fica no mínimo
  let low = min
  let high = 1
  for (let step = 0; step < 12; step += 1) {
    const mid = (low + high) / 2
    apply(mid)
    if (fits()) low = mid
    else high = mid
  }
  apply(low)
}

/** Reduz --fit até o conteúdo da página caber (sem passar de `min`). */
function fitPage(page: HTMLElement, inner: HTMLElement, min: number) {
  searchFit(page, min, () => contentHeight(inner) <= inner.clientHeight + 0.5)
}

/** Página 2: a parte fixa (tudo antes das magias) precisa caber com um respiro para as magias. */
function fitFixedPart(page: HTMLElement, inner: HTMLElement, spellsBox: HTMLElement) {
  searchFit(page, 0.6, () => {
    const heading = (spellsBox.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0
    return spellsBox.offsetTop + heading + 12 <= inner.clientHeight
  })
}

/** Índice da primeira magia da página 2 que passa do fim da página (ou null se todas cabem). */
function firstOverflowingSpell(inner: HTMLElement, grid: HTMLElement | null | undefined): number | null {
  if (!grid) return null
  const innerBottom = inner.getBoundingClientRect().top + inner.clientHeight
  const cards = Array.from(grid.children) as HTMLElement[]
  for (let index = 0; index < cards.length; index += 1) {
    const card = cards[index]
    if (card && card.getBoundingClientRect().bottom > innerBottom + 0.5) return index
  }
  return null
}
