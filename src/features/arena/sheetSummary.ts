import type { ArenaMaxValues, ArenaSheetSummary } from '@/lib/amnia/types'
import { impulses, runeCircleLabels, skills } from '@/rules/amnia'
import type { Character } from '@/rules/character'
import { classes } from '@/rules/data'
import { computeDerived } from '@/rules/derive'
import { itemById } from '@/rules/equipment'
import { findCaste, findLineage, findSublineage, selectedPathOption } from '@/rules/lineages'
import { runeById } from '@/rules/runes'
import { spellCost, spellRuneSummary } from '@/rules/spell'
import { spellContext } from '@/rules/spellContext'

/** Máximos derivados da ficha (mesmas fórmulas da ficha completa). */
export function arenaMaxValues(character: Character): ArenaMaxValues {
  const derived = computeDerived(character)
  const value = (id: string) => derived.find((stat) => stat.id === id)?.value ?? 0

  return {
    pv: value('pv'),
    pm: value('pm'),
    limiar: value('limiar'),
    impeto: value('impeto'),
    pa: value('pa'),
  }
}

function circleLabel(circle: string | undefined): string {
  if (!circle) return ''
  return runeCircleLabels[circle as keyof typeof runeCircleLabels] ?? circle
}

/**
 * Converte a ficha completa no resumo que o Mestre recebe.
 *
 * Reutiliza o motor existente (`computeDerived`, `spellCost`, catálogos de
 * classe/linhagem/runas) em vez de recalcular regras na Arena.
 */
export function buildSheetSummary(character: Character): ArenaSheetSummary {
  const lineage = findLineage(character.ancestryId)
  const caste = findCaste(lineage, character.casteId)
  const sublineage = findSublineage(lineage, character.sublineageId)
  const pathOption = selectedPathOption(lineage, character.ancestryTraits)
  const classDef = classes.find((item) => item.id === character.classId)
  const impulse = impulses.find((item) => item.id === character.impulseId)

  const ancestry = lineage
    ? [
        lineage.name,
        ...(caste ? [caste.name] : []),
        ...(sublineage ? [sublineage.name] : []),
        ...(pathOption ? [pathOption.name] : []),
      ].join(' · ')
    : ''

  const trainedSkills = Object.entries(character.skills)
    .map(([id, value]) => ({
      name: skills.find((skill) => skill.id === id)?.name ?? id,
      value,
    }))
    .filter((skill) => skill.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  const knownRunes = character.knownRunes
    .map((runeId) => runeById(runeId))
    .filter((rune): rune is NonNullable<typeof rune> => Boolean(rune))
    .map((rune) => ({ name: rune.name, circle: circleLabel(rune.circle) }))

  const context = spellContext(character)
  const spells = character.spells.map((spell) => ({
    name: spell.name,
    cost: spellCost(spell, context).total,
    summary: spell.runes.map((rune) => spellRuneSummary(spell, rune)).join(' · '),
    effect: spell.effect,
  }))

  const inventory = character.inventory.map((entry) => {
    const item = itemById(entry.itemId)
    const quantity = entry.quantity > 1 ? ` ×${entry.quantity}` : ''
    return `${item?.name ?? entry.itemId}${quantity}${entry.equipped ? ' (equipado)' : ''}`
  })

  return {
    id: character.id,
    name: character.name,
    concept: character.concept,
    className: classDef?.name ?? '',
    ancestry,
    keyAttribute: character.keyAttribute,
    attributes: { ...character.attributes },
    max: arenaMaxValues(character),
    skills: trainedSkills,
    runes: knownRunes,
    spells,
    impulse: impulse ? `${impulse.name} — ${impulse.description}` : '',
    convictions: character.convictions,
    inventory,
    notes: character.notes,
  }
}
