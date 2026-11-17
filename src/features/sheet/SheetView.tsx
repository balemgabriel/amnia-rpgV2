import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArcanaeHexagon } from '@/components/ArcanaeHexagon'
import { DotRating } from '@/components/DotRating'
import { KnownRunes } from './KnownRunes'
import { StarIcon } from '@/components/StarIcon'
import { Badge, Button, Card } from '@/components/ui'
import { cn } from '@/lib/cn'
import { resolveAdvantageDescription } from '@/rules/advantages'
import {
  attributes,
  circles,
  creationBudget,
  impulses,
  skillGroups,
  skills,
  xpCosts,
} from '@/rules/amnia'
import {
  advantagePoints,
  characterSchema,
  creationSpecializations,
  rulesVersion,
  runeAllowance,
  SHEET_VERSION,
  type Character,
} from '@/rules/character'
import { computeDerived } from '@/rules/derive'
import { activeBonuses, bonusChips, type BonusChip } from '@/rules/equipment'
import { classes } from '@/rules/data'
import { ancestryColor, lineageColor, withAlpha } from '@/rules/lineageColors'
import {
  findCaste,
  findLineage,
  findSublineage,
  selectedPathOption,
} from '@/rules/lineages'
import { circleColor } from '@/rules/circleColors'
import { classIsWip, classTone, coreAbilityTone } from '@/rules/classColors'
import { skillGroupColor } from '@/rules/skillColors'
import { spellContext } from '@/rules/spellContext'
import {
  createXpPurchase,
  remainingXp,
  totalXpSpent,
  xpCostItem,
  xpItemCost,
  xpItemNeedsLevel,
  XP_POOL,
} from '@/rules/xp'
import { SpellCard } from '@/features/spells/SpellCard'
import { CharacterPortrait } from './CharacterPortrait'
import { EquipmentSection } from './EquipmentSection'
import { ExportSheet, type ExportMode } from './ExportSheet'
import { captureNodeAsPng, downloadDataUrl, exportSlug } from './capture'
import { getCharacter, saveCharacter } from '@/storage/characters'

const GROUP_ORDER = ['fisica', 'social', 'mental'] as const

/** Stats mostrados no resumo da ficha, na ordem da ficha tradicional. */
const SUMMARY_STATS = [
  'pv',
  'pm',
  'limiar',
  'saveDc',
  'impeto',
  'deslocamentoGrid',
  'deslocamentoMetros',
  'pa',
] as const

export function SheetView({
  id,
  onBack,
  onOpenSpell,
  backLabel = '← Fichas',
}: {
  id: string
  onBack: () => void
  onOpenSpell: (spellId?: string) => void
  /** Texto do botão de voltar (fichas prontas voltam para a própria página). */
  backLabel?: string
}) {
  const [character, setCharacter] = useState<Character | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** Exportação em andamento: o layout A4 (ExportSheet) é montado só enquanto exporta. */
  const [exportMode, setExportMode] = useState<ExportMode | null>(null)
  const exporting = exportMode !== null
  const [xpItemId, setXpItemId] = useState('pericia')
  const [xpLevel, setXpLevel] = useState(1)
  const [xpLabel, setXpLabel] = useState('')
  const exportDocRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    getCharacter(id)
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
        setCharacter(parsed.data)
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar a ficha.')
      })
    return () => {
      active = false
    }
  }, [id])

  /** PDF gera um arquivo A4 direto; PNG baixa uma imagem longa. */
  function startExport(mode: ExportMode) {
    if (exportMode) return
    setExportMode(mode)
  }

  /**
   * O ExportSheet já mediu e paginou as páginas. Agora capturamos cada página
   * A4 como imagem e montamos o PDF com jsPDF — sem depender da caixa de
   * impressão do navegador (que pode variar de margens e de tamanho).
   */
  async function handleExportReady() {
    const doc = exportDocRef.current
    if (!doc || !character) {
      setExportMode(null)
      return
    }

    const slug = exportSlug(character.name)
    try {
      if (exportMode === 'png') {
        const dataUrl = await captureNodeAsPng(doc)
        downloadDataUrl(dataUrl, `${slug}-amnia.png`)
        return
      }

      const pages = Array.from(doc.querySelectorAll<HTMLElement>('.xs-page'))
      if (pages.length === 0) throw new Error('Nenhuma página para exportar.')

      // jsPDF só é baixado quando o usuário pede PDF (mantém o app leve).
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
      for (const [index, page] of pages.entries()) {
        const dataUrl = await captureNodeAsPng(page)
        if (index > 0) pdf.addPage('a4', 'portrait')
        // A página da ficha tem 296 mm; esticamos 1 mm para preencher o A4 inteiro.
        pdf.addImage(dataUrl, 'PNG', 0, 0, 210, 297, undefined, 'FAST')
      }
      pdf.save(`${slug}-amnia.pdf`)
    } catch {
      window.alert(
        exportMode === 'png'
          ? 'Não foi possível gerar a imagem da ficha.'
          : 'Não foi possível gerar o PDF da ficha.',
      )
    } finally {
      setExportMode(null)
    }
  }

  async function persist(updated: Character) {
    const next: Character = { ...updated, updatedAt: Date.now() }
    setCharacter(next)
    try {
      await saveCharacter({
        id: next.id,
        name: next.name,
        rulesVersion,
        sheetVersion: SHEET_VERSION,
        data: next,
      })
    } catch {
      window.alert('Não foi possível salvar as mudanças no dispositivo.')
    }
  }

  async function setPortrait(portrait: string) {
    if (!character) return
    await persist({ ...character, portrait })
  }

  async function deleteSpell(spellId: string, name: string) {
    if (!character) return
    if (!window.confirm(`Excluir a magia "${name.trim() || 'sem nome'}"?`)) return
    await persist({
      ...character,
      spells: character.spells.filter((spell) => spell.id !== spellId),
    })
  }

  async function addXpPurchase() {
    if (!character) return
    const purchase = createXpPurchase(xpItemId, xpLevel, xpLabel)
    if (!purchase) return
    await persist({
      ...character,
      xpPurchases: [...character.xpPurchases, purchase],
    })
    setXpLabel('')
    setXpLevel(1)
  }

  async function removeXpPurchase(purchaseId: string) {
    if (!character) return
    await persist({
      ...character,
      xpPurchases: character.xpPurchases.filter((purchase) => purchase.id !== purchaseId),
    })
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm text-accent">{error}</p>
        <div className="mt-4">
          <Button variant="ghost" onClick={onBack}>
            ← Voltar
          </Button>
        </div>
      </div>
    )
  }

  if (!character) {
    return <p className="px-6 py-16 text-sm text-ink-soft">Carregando ficha…</p>
  }

  const derived = computeDerived(character)
  // Bônus de itens equipados: aparecem ao lado do valor e somem ao desequipar.
  const equipped = activeBonuses(character.inventory)
  const byId = Object.fromEntries(derived.map((stat) => [stat.id, stat]))
  const lineage = findLineage(character.ancestryId)
  const sublineage = findSublineage(lineage, character.sublineageId)
  const caste = findCaste(lineage, character.casteId)
  const pathOption = selectedPathOption(lineage, character.ancestryTraits)
  const classDef = classes.find((item) => item.id === character.classId)
  const ability = classDef?.coreAbilities.find((item) => item.id === character.classAbilityId)
  const abilityIndex =
    classDef?.coreAbilities.findIndex((item) => item.id === character.classAbilityId) ?? -1
  const abilityTone = abilityIndex >= 0 ? coreAbilityTone(abilityIndex) : null
  const talent = classDef?.talents.find((item) => item.id === character.classTalentId)
  const impulse = impulses.find((item) => item.id === character.impulseId)
  const circle = circles.find((item) => item.id === character.innateCircle)
  const magicContext = spellContext(character)

  const xpSpent = totalXpSpent(character.xpPurchases)
  const xpRemaining = remainingXp(character.xpPurchases)
  const xpItem = xpCostItem(xpItemId)
  const xpPreview = xpItemCost(xpItem, xpLevel)

  const runeLimit = runeAllowance(character.attributes.inteligencia)
  const extraRunes = Math.max(0, character.knownRunes.length - runeLimit)
  const freeSpecializations = creationSpecializations(character.skills)
  const extraSpecializations = Math.max(0, character.specializations.length - freeSpecializations)
  const advantageSummary = advantagePoints(character.advantages)
  const extraAdvantages = Math.max(
    0,
    advantageSummary.total - creationBudget.advantagePoints,
  )

  const lineageLabel = lineage
    ? [
        lineage.name,
        ...(caste ? [caste.name] : []),
        ...(sublineage ? [sublineage.name] : []),
        ...(pathOption ? [`${lineage.path?.name ?? 'Caminho'}: ${pathOption.name}`] : []),
      ].join(' — ')
    : null
  const lineageTone =
    lineageColor(character.sublineageId) ?? ancestryColor(character.ancestryId) ?? null

  return (
    <div className="min-h-screen">
      <header className="no-print border-b border-ink/10">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-4">
          <Button variant="quiet" onClick={onBack} className="px-2">
            {backLabel}
          </Button>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              onClick={() => startExport('pdf')}
              disabled={exporting}
              className="text-xs"
              title="Baixar a ficha em PDF (A4, até 3 páginas)."
            >
              {exportMode === 'pdf' ? 'Gerando…' : 'PDF'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => startExport('png')}
              disabled={exporting}
              className="text-xs"
              title="Baixar a ficha como uma imagem PNG longa."
            >
              {exportMode === 'png' ? 'Gerando…' : 'PNG'}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <section className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-4xl leading-tight tracking-wide">
              {character.name || 'Sem nome'}
            </h1>
            <p className="mt-1 text-ink-soft">
              {[character.concept, character.age ? `${character.age} anos` : '']
                .filter(Boolean)
                .join(' · ')}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
            {lineageLabel ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                style={
                  lineageTone
                    ? {
                        borderColor: withAlpha(lineageTone, 0.4),
                        backgroundColor: withAlpha(lineageTone, 0.12),
                        color: lineageTone,
                      }
                    : undefined
                }
              >
                <span
                  aria-hidden
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: lineageTone ?? 'currentColor' }}
                />
                {lineageLabel}
                {lineage?.wip ? ' · WIP' : ''}
              </span>
            ) : null}
            {classDef ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                style={
                  classTone(classDef.id)
                    ? {
                        borderColor: withAlpha(classTone(classDef.id)!, 0.45),
                        backgroundColor: withAlpha(classTone(classDef.id)!, 0.1),
                        color: classTone(classDef.id)!,
                      }
                    : undefined
                }
              >
                <span
                  aria-hidden
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: classTone(classDef.id) ?? 'currentColor' }}
                />
                {classDef.name}
                {classIsWip(classDef.id) ? ' · WIP' : ''}
              </span>
            ) : null}
            {circle ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                style={
                  circleColor(circle.id)
                    ? {
                        borderColor: withAlpha(circleColor(circle.id)!, 0.55),
                        backgroundColor: withAlpha(circleColor(circle.id)!, 0.1),
                        color: circleColor(circle.id)!,
                      }
                    : undefined
                }
              >
                <span
                  aria-hidden
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: circleColor(circle.id) ?? 'currentColor' }}
                />
                Círculo: {circle.name}
              </span>
            ) : null}
            {character.keyAttribute ? (
              <Badge>
                Chave:{' '}
                {attributes.find((attribute) => attribute.id === character.keyAttribute)?.short}
              </Badge>
            ) : null}
          </div>
          </div>
          <CharacterPortrait
            name={character.name}
            portrait={character.portrait}
            onSelect={(portrait) => void setPortrait(portrait)}
          />
        </section>

        <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {attributes.map((attribute) => (
            <div
              key={attribute.id}
              className="print-avoid-break relative rounded-lg border border-ink/10 bg-white/45 px-3 py-2.5 text-center"
            >
              {character.keyAttribute === attribute.id ? (
                <StarIcon
                  className="absolute right-2 top-2 text-gold"
                  label="Atributo Chave"
                />
              ) : null}
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
                {attribute.short}
              </p>
              <p className="flex items-baseline justify-center gap-1.5 font-display text-2xl leading-tight tabular-nums">
                {character.attributes[attribute.id]}
                <BonusChips chips={bonusChips(equipped.attributes[attribute.id], { plain: true })} />
              </p>
              <div className="mt-1 flex justify-center">
                <DotRating
                  label={attribute.name}
                  value={character.attributes[attribute.id]}
                  max={5}
                  size="sm"
                />
              </div>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {SUMMARY_STATS.map((statId) => {
            const stat = byId[statId]
            if (!stat) return null
            return (
              <div
                key={statId}
                className="print-avoid-break rounded-lg border border-ink/10 bg-white/45 p-3"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
                  {stat.name}
                </p>
                <p className="flex items-baseline gap-1.5 font-display text-3xl leading-tight tabular-nums">
                  {stat.value}
                  <BonusChips chips={bonusChips(equipped.derived[statId], { plain: true })} />
                </p>
                <p className="font-mono text-[10px] text-ink-soft">{stat.formula}</p>
              </div>
            )
          })}
        </section>

        <div className="grid gap-6">
          <Card className="print-avoid-break">
            <h2 className="mb-2 font-display text-xl tracking-wide">Arcanae</h2>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,20rem)_1fr] sm:items-center">
              <ArcanaeHexagon innate={character.innateCircle} />
              <div>
                {circle ? (
                  <>
                    <p className="font-display text-lg tracking-wide">{circle.name}</p>
                    <p className="text-sm leading-snug text-ink-soft">{circle.description}</p>
                  </>
                ) : (
                  <p className="text-sm text-ink-soft">Círculo Inato não definido.</p>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="mb-1 font-display text-xl tracking-wide">Runas Conhecidas</h2>
            <p className="mb-3 text-xs text-ink-soft">
              Acesso às runas; o nível de cada uma é escolhido em cada magia.
              {extraRunes > 0 ? (
                <>
                  {' '}
                  <XpLink>
                    {extraRunes} além das {runeLimit} gratuitas
                  </XpLink>
                </>
              ) : null}
            </p>
            {character.knownRunes.length === 0 ? (
              <p className="text-sm text-ink-soft">Nenhuma runa registrada.</p>
            ) : (
              <>
                <KnownRunes runeIds={character.knownRunes} />
                <p className="mt-2 text-[11px] text-ink-soft">
                  Clique numa runa para ver os níveis de 1 a 7.
                </p>
              </>
            )}
          </Card>
        </div>

        <Card className="print-avoid-break">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-xl tracking-wide">Magias</h2>
              <p className="text-xs text-ink-soft">
                {character.spells.length === 0
                  ? 'Nenhuma magia criada ainda.'
                  : `${character.spells.length} magia(s) registrada(s).`}
              </p>
            </div>
            <Button variant="ghost" className="no-print text-xs" onClick={() => onOpenSpell()}>
              + Nova magia
            </Button>
          </div>

          {character.spells.length === 0 ? (
            <p className="text-sm text-ink-soft">
              Use o criador de magias para montar efeitos com as runas que o personagem conhece.
              O custo em PM e a Complexidade são calculados automaticamente.
            </p>
          ) : (
            <div className="space-y-3">
              {character.spells.map((spell) => (
                <SpellCard
                  key={spell.id}
                  spell={spell}
                  context={magicContext}
                  onEdit={() => onOpenSpell(spell.id)}
                  onDelete={() => void deleteSpell(spell.id, spell.name)}
                />
              ))}
            </div>
          )}
        </Card>

        <Card className="print-avoid-break">
          <h2 className="mb-3 font-display text-xl tracking-wide">Perícias</h2>
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
            {GROUP_ORDER.map((group) => {
              const tone = skillGroupColor(group)
              return (
                <div key={group}>
                  <p
                    className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    style={{ color: tone }}
                  >
                    <span
                      aria-hidden
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: tone }}
                    />
                    {skillGroups[group]}
                  </p>
                  <ul className="space-y-1">
                    {skills
                      .filter((skill) => skill.group === group)
                      .map((skill) => (
                        <li
                          key={skill.id}
                          className="flex items-center justify-between gap-2 border-l-2 py-0.5 pl-2 text-sm"
                          style={{ borderLeftColor: withAlpha(tone, 0.5) }}
                        >
                          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <span className={character.skills[skill.id] ? undefined : 'text-ink-soft'}>
                              {skill.name}
                            </span>
                            <BonusChips chips={bonusChips(equipped.skills[skill.id])} />
                          </span>
                          <DotRating
                            label={skill.name}
                            value={character.skills[skill.id] ?? 0}
                            max={5}
                            size="sm"
                          />
                        </li>
                      ))}
                  </ul>
                </div>
              )
            })}
          </div>

          {character.specializations.length > 0 ? (
            <div className="mt-4 border-t border-ink/8 pt-3">
              <p className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
                Especializações
                {extraSpecializations > 0 ? (
                  <XpLink>
                    {extraSpecializations} além das {freeSpecializations} gratuitas
                  </XpLink>
                ) : null}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {character.specializations.map((specialization) => {
                  const skill = skills.find((item) => item.id === specialization.skillId)
                  const tone = skill ? skillGroupColor(skill.group) : null
                  return (
                    <span
                      key={specialization.id}
                      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs"
                      style={
                        tone
                          ? {
                              borderColor: withAlpha(tone, 0.4),
                              backgroundColor: withAlpha(tone, 0.08),
                            }
                          : undefined
                      }
                    >
                      <span
                        aria-hidden
                        className="size-1.5 rounded-full"
                        style={{ backgroundColor: tone ?? 'currentColor' }}
                      />
                      {specialization.name}
                      {skill ? (
                        <span className="text-[10px] uppercase tracking-wide text-ink-soft">
                          {skill.name}
                        </span>
                      ) : null}
                    </span>
                  )
                })}
              </div>
            </div>
          ) : null}
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <h2 className="mb-2 font-display text-xl tracking-wide">Habilidade & Talento</h2>
            {ability ? (
              <p
                className="rounded-lg border p-3 text-sm"
                style={{
                  borderColor: abilityTone ?? undefined,
                  backgroundColor: abilityTone ? withAlpha(abilityTone, 0.06) : undefined,
                }}
              >
                <strong>{ability.name}.</strong>{' '}
                <span className="text-ink-soft">{ability.description}</span>
              </p>
            ) : (
              <p className="text-sm text-ink-soft">Habilidade central não escolhida.</p>
            )}
            {talent ? (
              <p className="mt-2 text-sm">
                <strong>{talent.name}.</strong>{' '}
                <span className="text-ink-soft">{talent.description}</span>
              </p>
            ) : null}
            {impulse ? (
              <p className="mt-3 border-t border-ink/8 pt-3 text-sm">
                <strong>{impulse.name}.</strong>{' '}
                <span className="text-ink-soft">{impulse.description}</span>
              </p>
            ) : null}
          </Card>

          <Card>
            <h2 className="mb-2 font-display text-xl tracking-wide">Vantagens</h2>
            {extraAdvantages > 0 ? (
              <p className="mb-2 text-xs text-ink-soft">
                <XpLink>
                  {extraAdvantages} ponto(s) além dos {creationBudget.advantagePoints} da criação
                </XpLink>
              </p>
            ) : null}
            {character.advantages.length === 0 ? (
              <p className="text-sm text-ink-soft">Nenhuma registrada.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {character.advantages.map((item) => {
                  const description = resolveAdvantageDescription(item)
                  return (
                    <li key={item.id}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span>{item.name}</span>
                        <span className="text-xs text-ink-soft">
                          {item.kind === 'desvantagem' ? '−' : '+'}
                          {item.points}
                        </span>
                      </div>
                      {description ? (
                        <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
                          {description}
                        </p>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>

        <Card>
          <h2 className="mb-2 font-display text-xl tracking-wide">Convicções & Pilares</h2>
          <ul className="list-inside list-disc text-sm text-ink-soft">
            {character.convictions.map((value) => (
              <li key={value}>{value}</li>
            ))}
            {character.pillars.map((value) => (
              <li key={value} className="italic">
                {value}
              </li>
            ))}
          </ul>
          {character.history ? (
            <p className="mt-3 whitespace-pre-line border-t border-ink/8 pt-3 text-sm leading-relaxed text-ink-soft">
              {character.history}
            </p>
          ) : null}
        </Card>

        {character.notes.trim() ? (
          <Card>
            <h2 className="mb-2 font-display text-xl tracking-wide">Anotações</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">
              {character.notes}
            </p>
          </Card>
        ) : null}

        <Card id="experiencia" className="print-avoid-break scroll-mt-24">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-display text-xl tracking-wide">Experiência</h2>
              <p className="text-xs text-ink-soft">
                Pool inicial de {XP_POOL} XP. Registre aqui o que passar do gratuito na criação
                (atributo, perícia, especialização, runa, talento…).
              </p>
            </div>
            <div className="flex items-baseline gap-2">
              <Badge tone={xpRemaining < 0 ? 'warn' : 'ok'}>
                {xpRemaining} XP restante(s)
              </Badge>
              <span className="text-xs tabular-nums text-ink-soft">gastos: {xpSpent}</span>
            </div>
          </div>

          {character.xpPurchases.length === 0 ? (
            <p className="text-sm text-ink-soft">Nenhum gasto de XP registrado ainda.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-ink/15 text-left text-[10px] uppercase tracking-[0.14em] text-ink-soft">
                  <th className="py-1.5 font-semibold">Gasto</th>
                  <th className="py-1.5 font-semibold">Cálculo</th>
                  <th className="py-1.5 text-right font-semibold">XP</th>
                  <th className="no-print w-8" />
                </tr>
              </thead>
              <tbody>
                {character.xpPurchases.map((purchase) => (
                  <tr key={purchase.id} className="border-b border-ink/8">
                    <td className="py-1.5">{purchase.label}</td>
                    <td className="py-1.5 text-xs text-ink-soft">{purchase.detail}</td>
                    <td className="py-1.5 text-right tabular-nums">{purchase.cost}</td>
                    <td className="no-print py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => void removeXpPurchase(purchase.id)}
                        className="text-xs text-ink-soft transition hover:text-accent"
                      >
                        remover
                      </button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td
                    colSpan={2}
                    className="pt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft"
                  >
                    Total gasto
                  </td>
                  <td className="pt-2 text-right font-semibold tabular-nums">{xpSpent}</td>
                  <td className="no-print" />
                </tr>
              </tbody>
            </table>
          )}

          <div className="no-print mt-4 rounded-lg border border-ink/10 bg-ink/[0.03] p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
              Adicionar gasto
            </p>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_5.5rem_minmax(0,1fr)_auto]">
              <select
                value={xpItemId}
                onChange={(event) => {
                  setXpItemId(event.target.value)
                  setXpLevel(1)
                }}
                aria-label="Item da tabela de experiência"
                className="h-[34px] w-full rounded-md border border-ink/15 bg-parchment/70 px-2 text-sm"
              >
                {xpCosts.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.cost}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={xpLevel}
                disabled={!xpItemNeedsLevel(xpItem)}
                onChange={(event) => setXpLevel(Math.max(1, Number(event.target.value) || 1))}
                aria-label="Nível ou quantidade"
                title={
                  xpItemNeedsLevel(xpItem)
                    ? 'Nível atual / quantidade'
                    : 'Este item tem custo fixo'
                }
                className="h-[34px] w-full rounded-md border border-ink/15 bg-parchment/70 px-2 text-sm tabular-nums disabled:opacity-40"
              />
              <input
                value={xpLabel}
                onChange={(event) => setXpLabel(event.target.value)}
                placeholder="Detalhe (ex.: Perícia Furtividade)"
                className="h-[34px] w-full rounded-md border border-ink/15 bg-parchment/70 px-2 text-sm"
              />
              <Button
                type="button"
                onClick={() => void addXpPurchase()}
                className="h-[34px] px-3 text-xs"
              >
                + {xpPreview} XP
              </Button>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-ink-soft">
              Use a coluna de nível para itens com custo variável; para os de custo fixo, basta
              adicionar.
            </p>
          </div>

          <div className="mt-4 border-t border-ink/8 pt-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
              Tabela de custos
            </p>
            <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {xpCosts.map((item) => (
                <li
                  key={item.id}
                  className="flex items-baseline justify-between gap-3 border-b border-ink/8 pb-1"
                >
                  <span>{item.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-ink-soft">{item.cost}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <EquipmentSection character={character} onChange={persist} />
      </main>

      {exportMode ? (
        <ExportSheet
          key={exportMode}
          character={character}
          mode={exportMode}
          docRef={exportDocRef}
          onReady={() => void handleExportReady()}
        />
      ) : null}
    </div>
  )
}

/** Bônus (ou penalidades) de itens equipados, ao lado do valor que eles alteram. */
function BonusChips({ chips }: { chips: BonusChip[] }) {
  return (
    <>
      {chips.map((chip) => (
        <span
          key={chip.text}
          title={chip.title}
          aria-label={`Item equipado: ${chip.text}`}
          className={cn(
            'inline-flex items-center rounded-full px-1.5 py-px font-sans text-[10px] font-semibold leading-tight tabular-nums',
            chip.negative ? 'bg-accent/12 text-accent' : 'bg-emerald-700/12 text-emerald-800',
          )}
        >
          {chip.text}
        </span>
      ))}
    </>
  )
}

/** Atalho para a tabela de experiência no fim da ficha. */
function XpLink({ children }: { children: ReactNode }) {
  return (
    <a
      href="#experiencia"
      className="no-print inline-flex items-center gap-1 rounded-full border border-gold/50 bg-gold/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink transition hover:bg-gold/25"
      title="Ver e registrar na tabela de experiência, no fim da ficha."
    >
      <span aria-hidden>+</span> XP · {children}
    </a>
  )
}
