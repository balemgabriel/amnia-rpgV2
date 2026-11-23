import {
  ATTRIBUTE_MAX,
  SKILL_MAX,
  attributes,
  channelingMethods,
  circleRelation,
  circleRelationLabels,
  skills,
} from './amnia'
import type { Character } from './character'
import { advantages, classes, runes } from './data'
import type { AttributeId, CircleRelation } from './types'
import {
  createXpPurchase,
  xpCostItem,
  xpItemCost,
  type XpEffect,
  type XpPurchase,
} from './xp'

/**
 * A ponte entre a tabela de XP e a ficha.
 *
 * Comprar um item não é só registrar um recibo: a compra devolve um `patch`
 * com a mudança real no personagem (runa conhecida, atributo, perícia…). O
 * efeito guardado na compra permite desfazê-la depois.
 */

const EXTRA_POINTS = [
  { id: 'pv', label: 'Pontos de Vida' },
  { id: 'pm', label: 'Pontos de Mana' },
  { id: 'impeto', label: 'Ímpeto' },
] as const

const RUNE_ITEM_IDS = ['runa-inata', 'runa-adjacente', 'runa-paralela', 'runa-oposta']
const NO_TARGET_ITEM_IDS = ['tecnica-intermediaria', 'tecnica-avancada']

export interface XpTargetOption {
  id: string
  label: string
  hint?: string
}

export interface XpPurchaseInput {
  itemId: string
  targetId?: string
  level?: number
  label?: string
}

export interface XpPurchaseApplication {
  purchase: XpPurchase
  patch: Partial<Character>
}

/** Relação da runa com o círculo inato — também define o preço em XP. */
export function runeXpRelation(character: Character, runeId: string): CircleRelation | null {
  const rune = runes.find((item) => item.id === runeId)
  if (!rune || !character.innateCircle || rune.circle === 'miscelanea') return null
  return circleRelation(character.innateCircle, rune.circle)
}

function effectiveItemId(character: Character, input: XpPurchaseInput): string {
  if (RUNE_ITEM_IDS.includes(input.itemId)) {
    const relation = runeXpRelation(character, input.targetId ?? '')
    return relation ? `runa-${relation}` : 'runa-adjacente'
  }
  if (input.itemId === 'vantagem') {
    const def = advantages.find((item) => item.id === input.targetId)
    return def?.kind === 'ficha' ? 'ficha-conhecimento' : 'vantagem'
  }
  return input.itemId
}

/** Opções do seletor de alvo, por linha da tabela de XP. */
export function xpPurchaseTargets(itemId: string, character: Character): XpTargetOption[] {
  switch (itemId) {
    case 'atributo':
      return attributes.map((item) => ({ id: item.id, label: item.name }))
    case 'pericia':
    case 'especializacao':
      return skills.map((item) => ({ id: item.id, label: item.name }))
    case 'talento-classe': {
      const classDef = classes.find((item) => item.id === character.classId)
      return classDef
        ? classDef.talents.map((item) => ({ id: item.id, label: item.name, hint: item.requirement }))
        : []
    }
    case 'vantagem':
      return advantages
        .filter((item) => item.kind !== 'ficha')
        .map((item) => ({
          id: item.id,
          label: item.name,
          hint: `${item.kind === 'desvantagem' ? 'Desvantagem' : 'Vantagem'} · ${item.points} pt(s)`,
        }))
    case 'ficha-conhecimento':
      return advantages
        .filter((item) => item.kind === 'ficha')
        .map((item) => ({ id: item.id, label: item.name, hint: `${item.points} pt(s)` }))
    case 'runa-inata':
    case 'runa-adjacente':
    case 'runa-paralela':
    case 'runa-oposta':
      return runes.map((item) => {
        const relation = runeXpRelation(character, item.id)
        return {
          id: item.id,
          label: item.name,
          hint: relation
            ? circleRelationLabels[relation]
            : item.circle === 'miscelanea'
              ? 'Miscelânea'
              : 'Sem círculo inato',
        }
      })
    case 'canalizacao-1':
    case 'canalizacao-2':
      return channelingMethods.map((item) => ({ id: item.id, label: item.name }))
    case 'ponto-extra':
      return EXTRA_POINTS.map((item) => ({ id: item.id, label: item.label }))
    default:
      return []
  }
}

/** Nível sugerido ao trocar o alvo (atributo/perícia = próximo nível). */
export function xpSuggestedLevel(itemId: string, targetId: string, character: Character): number {
  if (itemId === 'atributo') {
    const current = character.attributes[targetId as AttributeId] ?? 0
    return Math.min(ATTRIBUTE_MAX, current + 1)
  }
  if (itemId === 'pericia') {
    return Math.min(SKILL_MAX, (character.skills[targetId] ?? 0) + 1)
  }
  if (itemId === 'vantagem' || itemId === 'ficha-conhecimento') {
    return Math.max(1, advantages.find((item) => item.id === targetId)?.points ?? 1)
  }
  return 1
}

/** Verdadeiro custo da compra para este alvo (runas e fichas têm preço dinâmico). */
export function xpCostFor(character: Character, input: XpPurchaseInput): number {
  const itemId = effectiveItemId(character, input)
  const level = Math.max(
    1,
    input.level ?? xpSuggestedLevel(itemId, input.targetId ?? '', character),
  )
  return xpItemCost(xpCostItem(itemId), level)
}

/**
 * Cria a compra e o patch que aplica o efeito no personagem.
 * Retorna `null` quando o alvo é inválido ou a compra não faz sentido
 * (atributo no máximo, runa já conhecida, talento repetido…).
 */
export function applyXpPurchase(
  character: Character,
  input: XpPurchaseInput,
): XpPurchaseApplication | null {
  const itemId = effectiveItemId(character, input)
  const item = xpCostItem(itemId)
  if (!item) return null

  const targetId = input.targetId?.trim() ?? ''
  if (!NO_TARGET_ITEM_IDS.includes(itemId) && !targetId) return null

  const level = Math.max(1, input.level ?? xpSuggestedLevel(itemId, targetId, character))
  let patch: Partial<Character> = {}
  let effect: XpEffect | undefined
  let label = input.label?.trim() ?? ''

  switch (itemId) {
    case 'atributo': {
      const current = character.attributes[targetId as AttributeId]
      const name = attributes.find((entry) => entry.id === targetId)?.name ?? targetId
      if (current === undefined || level <= current || level > ATTRIBUTE_MAX) return null
      patch = { attributes: { ...character.attributes, [targetId]: level } }
      label ||= `${name}: ${current} → ${level}`
      effect = { kind: 'atributo', targetId, previous: current }
      break
    }
    case 'pericia': {
      const current = character.skills[targetId] ?? 0
      const name = skills.find((entry) => entry.id === targetId)?.name ?? targetId
      if (level <= current || level > SKILL_MAX) return null
      patch = { skills: { ...character.skills, [targetId]: level } }
      label ||= `${name}: ${current} → ${level}`
      effect = { kind: 'pericia', targetId, previous: current }
      break
    }
    case 'especializacao': {
      const skill = skills.find((entry) => entry.id === targetId)
      if (!skill) return null
      const name = label || skill.name
      const id = crypto.randomUUID()
      patch = {
        specializations: [...character.specializations, { id, skillId: targetId, name }],
      }
      label = `Especialização · ${name}`
      effect = { kind: 'especializacao', targetId, recordId: id }
      break
    }
    case 'talento-classe': {
      const classDef = classes.find((entry) => entry.id === character.classId)
      const talent = classDef?.talents.find((entry) => entry.id === targetId)
      if (!talent || character.classTalentId === targetId) return null
      patch = { classTalentId: targetId }
      label ||= talent.name
      effect = { kind: 'talento', targetId, recordId: character.classTalentId ?? '' }
      break
    }
    case 'vantagem':
    case 'ficha-conhecimento': {
      const def = advantages.find((entry) => entry.id === targetId)
      if (!def || character.advantages.some((entry) => entry.sourceId === targetId)) return null
      const id = crypto.randomUUID()
      patch = {
        advantages: [
          ...character.advantages,
          {
            id,
            sourceId: def.id,
            name: def.name,
            kind: def.kind === 'desvantagem' ? 'desvantagem' : 'vantagem',
            points: level,
            description: def.description,
          },
        ],
      }
      label ||= def.name
      effect = { kind: 'vantagem', targetId, recordId: id }
      break
    }
    case 'runa-inata':
    case 'runa-adjacente':
    case 'runa-paralela':
    case 'runa-oposta': {
      const rune = runes.find((entry) => entry.id === targetId)
      if (!rune || character.knownRunes.includes(targetId)) return null
      const relation = runeXpRelation(character, targetId)
      patch = { knownRunes: [...character.knownRunes, targetId] }
      label ||= `${rune.name} · ${
        relation
          ? circleRelationLabels[relation]
          : rune.circle === 'miscelanea'
            ? 'Miscelânea'
            : 'Sem círculo inato'
      }`
      effect = { kind: 'runa', targetId }
      break
    }
    case 'canalizacao-1':
    case 'canalizacao-2': {
      const method = channelingMethods.find((entry) => entry.id === targetId)
      if (!method) return null
      const wanted = itemId === 'canalizacao-2' ? 2 : 1
      if (character.channelingLevel >= wanted && character.channelingMethodId === targetId) {
        return null
      }
      patch = {
        channelingMethodId: targetId,
        channelingLevel: Math.max(character.channelingLevel, wanted),
      }
      label ||= `${method.name} · Nível ${wanted}`
      effect = {
        kind: 'canalizacao',
        targetId,
        previous: character.channelingLevel,
        recordId: character.channelingMethodId ?? '',
      }
      break
    }
    case 'ponto-extra': {
      const point = EXTRA_POINTS.find((entry) => entry.id === targetId)
      if (!point) return null
      const used = character.modifiers.filter(
        (entry) => entry.statId === targetId && entry.source.startsWith('XP:'),
      ).length
      if (used >= 3) return null
      const id = crypto.randomUUID()
      patch = {
        modifiers: [...character.modifiers, { statId: targetId, value: 1, source: `XP:${id}` }],
      }
      label ||= `+1 ${point.label}`
      effect = { kind: 'ponto-extra', targetId, recordId: id }
      break
    }
    default:
      label ||= item.name
      break
  }

  const purchase = createXpPurchase(itemId, level, label)
  if (!purchase) return null
  return { purchase: { ...purchase, effect }, patch }
}

/** Desfaz o efeito de uma compra ao remover a linha da tabela. */
export function revertXpPurchase(character: Character, purchase: XpPurchase): Partial<Character> {
  const effect = purchase.effect
  if (!effect) return {}

  switch (effect.kind) {
    case 'atributo':
      return effect.previous === undefined
        ? {}
        : { attributes: { ...character.attributes, [effect.targetId]: effect.previous } }
    case 'pericia':
      return { skills: { ...character.skills, [effect.targetId]: effect.previous ?? 0 } }
    case 'especializacao':
      return {
        specializations: character.specializations.filter((item) => item.id !== effect.recordId),
      }
    case 'talento':
      return { classTalentId: effect.recordId || null }
    case 'vantagem':
      return { advantages: character.advantages.filter((item) => item.id !== effect.recordId) }
    case 'runa':
      return {
        knownRunes: character.knownRunes.filter(
          (id) => id !== effect.targetId || character.autoGrantedRunes.includes(id),
        ),
      }
    case 'canalizacao':
      return {
        channelingLevel: effect.previous ?? 1,
        channelingMethodId: effect.recordId || null,
      }
    case 'ponto-extra':
      return { modifiers: character.modifiers.filter((item) => item.source !== effect.recordId) }
  }
}
