import { useEffect, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { ArcanaeHexagon } from '@/components/ArcanaeHexagon'
import { DotRating } from '@/components/DotRating'
import { RuneCard } from '@/components/RuneCard'
import { StarIcon } from '@/components/StarIcon'
import { Badge, Button, Card } from '@/components/ui'
import { attributes, circles, impulses, skillGroups, skills } from '@/rules/amnia'
import {
  characterSchema,
  rulesVersion,
  SHEET_VERSION,
  type Character,
} from '@/rules/character'
import { computeDerived } from '@/rules/derive'
import { classes, lineages } from '@/rules/data'
import { runeById } from '@/rules/runes'
import { ancestryColor, lineageColor, withAlpha } from '@/rules/lineageColors'
import { circleColor } from '@/rules/circleColors'
import { skillGroupColor } from '@/rules/skillColors'
import { spellContext } from '@/rules/spellContext'
import { SpellCard } from '@/features/spells/SpellCard'
import { CharacterPortrait } from './CharacterPortrait'
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
}: {
  id: string
  onBack: () => void
  onOpenSpell: (spellId?: string) => void
}) {
  const [character, setCharacter] = useState<Character | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const sheetRef = useRef<HTMLElement>(null)

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

  async function exportPng() {
    if (!sheetRef.current || exporting) return
    setExporting(true)
    try {
      const dataUrl = await toPng(sheetRef.current, {
        pixelRatio: 2,
        backgroundColor: '#f3ece0',
        cacheBust: true,
      })
      const link = document.createElement('a')
      const slug = (character?.name ?? 'ficha')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase()
      link.download = `${slug || 'ficha'}-amnia.png`
      link.href = dataUrl
      link.click()
    } catch {
      window.alert('Não foi possível gerar a imagem da ficha.')
    } finally {
      setExporting(false)
    }
  }

  async function setPortrait(portrait: string) {
    if (!character) return
    const now = Date.now()
    const updated: Character = { ...character, portrait, updatedAt: now }
    setCharacter(updated)
    try {
      await saveCharacter({
        id: updated.id,
        name: updated.name,
        rulesVersion,
        sheetVersion: SHEET_VERSION,
        data: updated,
      })
    } catch {
      window.alert('Não foi possível salvar a foto no dispositivo.')
    }
  }

  async function deleteSpell(spellId: string, name: string) {    if (!character) return
    if (!window.confirm(`Excluir a magia "${name.trim() || 'sem nome'}"?`)) return
    const now = Date.now()
    const updated: Character = {
      ...character,
      spells: character.spells.filter((spell) => spell.id !== spellId),
      updatedAt: now,
    }
    await saveCharacter({
      id: updated.id,
      name: updated.name,
      rulesVersion,
      sheetVersion: SHEET_VERSION,
      data: updated,
    })
    setCharacter(updated)
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
  const byId = Object.fromEntries(derived.map((stat) => [stat.id, stat]))
  const lineage = lineages.find((item) => item.id === character.ancestryId)
  const sublineage = lineage?.lineages.find((item) => item.id === character.sublineageId)
  const classDef = classes.find((item) => item.id === character.classId)
  const ability = classDef?.coreAbilities.find((item) => item.id === character.classAbilityId)
  const talent = classDef?.talents.find((item) => item.id === character.classTalentId)
  const impulse = impulses.find((item) => item.id === character.impulseId)
  const circle = circles.find((item) => item.id === character.innateCircle)
  const magicContext = spellContext(character)

  const lineageLabel = lineage
    ? sublineage
      ? `${lineage.name} — ${sublineage.name}`
      : lineage.name
    : null
  const lineageTone =
    lineageColor(character.sublineageId) ?? ancestryColor(character.ancestryId) ?? null

  return (
    <div className="min-h-screen">
      <header className="no-print border-b border-ink/10">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-4">
          <Button variant="quiet" onClick={onBack} className="px-2">
            ← Fichas
          </Button>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              onClick={() => window.print()}
              className="text-xs"
              title="Abrir a caixa de impressão do navegador."
            >
              Imprimir
            </Button>
            <Button
              variant="ghost"
              onClick={() => window.print()}
              className="text-xs"
              title="Abrir a impressão e escolher “Salvar como PDF”."
            >
              PDF
            </Button>
            <Button
              variant="ghost"
              onClick={exportPng}
              disabled={exporting}
              className="text-xs"
              title="Baixar a ficha como imagem PNG."
            >
              {exporting ? 'Gerando…' : 'PNG'}
            </Button>
          </div>
        </div>
      </header>

      <main ref={sheetRef} className="mx-auto max-w-4xl space-y-6 px-6 py-8">
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
            {classDef ? <Badge tone="gold">{classDef.name}</Badge> : null}
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
              <p className="font-display text-2xl leading-tight tabular-nums">
                {character.attributes[attribute.id]}
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
                <p className="font-display text-3xl leading-tight tabular-nums">{stat.value}</p>
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
            </p>
            {character.knownRunes.length === 0 ? (
              <p className="text-sm text-ink-soft">Nenhuma runa registrada.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {character.knownRunes.map((runeId) => {
                  const def = runeById(runeId)
                  if (!def) return null
                  return <RuneCard key={runeId} rune={def} className="print-avoid-break" />
                })}
              </div>
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
          <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
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
                          <span className={character.skills[skill.id] ? undefined : 'text-ink-soft'}>
                            {skill.name}
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
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <h2 className="mb-2 font-display text-xl tracking-wide">Habilidade & Talento</h2>
            {ability ? (
              <p className="text-sm">
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
            {character.advantages.length === 0 ? (
              <p className="text-sm text-ink-soft">Nenhuma registrada.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {character.advantages.map((item) => (
                  <li key={item.id} className="flex items-baseline justify-between gap-2">
                    <span>{item.name}</span>
                    <span className="text-xs text-ink-soft">
                      {item.kind === 'desvantagem' ? '−' : '+'}
                      {item.points}
                    </span>
                  </li>
                ))}
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
      </main>
    </div>
  )
}
