import { MAX_DICE } from './dice'
import type { AmniaAttributeId, ArenaSheetSummary } from './types'

/**
 * Monta a pilha de dados de um teste a partir do que o Mestre pediu.
 *
 * No material, um teste rola d6 iguais aos pontos de uma perícia **ou**
 * atributo; testes combinados somam os dois (ex.: "Armas Brancas + Destreza").
 * O Mestre descreve o teste em linguagem natural e o servidor resolve os
 * valores na ficha — a IA não calcula a pilha.
 */

const ATTRIBUTE_ALIASES: Record<string, AmniaAttributeId> = {
  forca: 'forca',
  for: 'forca',
  destreza: 'destreza',
  des: 'destreza',
  carisma: 'carisma',
  car: 'carisma',
  inteligencia: 'inteligencia',
  int: 'inteligencia',
  vontade: 'vontade',
  von: 'vontade',
}

export const ATTRIBUTE_LABELS: Record<AmniaAttributeId, string> = {
  forca: 'Força',
  destreza: 'Destreza',
  carisma: 'Carisma',
  inteligencia: 'Inteligência',
  vontade: 'Vontade',
}

export interface ResolvedTestPool {
  diceCount: number
  skill?: { name: string; value: number }
  attribute?: { id: AmniaAttributeId; name: string; value: number }
  /** Texto curto para o card e para o log, ex.: "Armas Brancas 4 + Destreza 3 = 7d6". */
  breakdown: string
  source: 'manual' | 'sheet' | 'fallback'
}

/** Normaliza para comparar nomes sem acento, caixa ou espaços extras. */
export function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Separa "Armas Brancas + Destreza" ou "Vontade vs medo" em partes. */
function splitTokens(value: string): string[] {
  return value
    .split(/[+,/|()]|\bvs\b|\bversus\b|\bcontra\b|\be\b/gi)
    .map((token) => token.trim())
    .filter(Boolean)
}

function findSkill(sheet: ArenaSheetSummary, token: string): { name: string; value: number } | undefined {
  const key = normalizeKey(token)
  if (!key) return undefined

  const exact = sheet.skills.find((skill) => normalizeKey(skill.name) === key)
  if (exact) return exact

  return sheet.skills.find((skill) => {
    const name = normalizeKey(skill.name)
    return name.includes(key) || key.includes(name)
  })
}

function findAttribute(token: string): AmniaAttributeId | undefined {
  return ATTRIBUTE_ALIASES[normalizeKey(token)]
}

function clampDice(count: number): number {
  return Math.min(MAX_DICE, Math.max(0, Math.trunc(Number.isFinite(count) ? count : 0)))
}

export function resolveTestPool(
  sheet: ArenaSheetSummary,
  input: { diceCount?: number; skill?: string; attribute?: string; test?: string },
): ResolvedTestPool {
  // Um valor explícito do Mestre (ex.: −2 por repetição) tem prioridade.
  if (typeof input.diceCount === 'number' && Number.isFinite(input.diceCount)) {
    const count = clampDice(input.diceCount)
    return {
      diceCount: count,
      breakdown: `${count}d6 (definido pelo Mestre)`,
      source: 'manual',
    }
  }

  const tokens = [input.attribute, input.skill, input.test]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .flatMap(splitTokens)

  let skill = input.skill ? findSkill(sheet, input.skill) : undefined
  if (!skill) {
    for (const token of tokens) {
      skill = findSkill(sheet, token)
      if (skill) break
    }
  }

  let attributeId = input.attribute ? findAttribute(input.attribute) : undefined
  if (!attributeId) {
    for (const token of tokens) {
      attributeId = findAttribute(token)
      if (attributeId) break
    }
  }

  const attribute = attributeId
    ? {
        id: attributeId,
        name: ATTRIBUTE_LABELS[attributeId],
        value: sheet.attributes[attributeId] ?? 0,
      }
    : undefined

  const skillValue = skill?.value ?? 0
  const attributeValue = attribute?.value ?? 0
  let diceCount = skillValue + attributeValue

  if (diceCount <= 0) {
    // Nada reconhecido: usa o atributo chave como base mínima, em vez de
    // inventar uma pilha arbitrária.
    const keyId = sheet.keyAttribute as AmniaAttributeId | null
    const keyValue = keyId ? (sheet.attributes[keyId] ?? 0) : 0
    const fallback = clampDice(Math.max(1, keyValue || 3))
    return {
      diceCount: fallback,
      ...(attribute ? { attribute } : {}),
      breakdown: `${fallback}d6 (sem perícia reconhecida; base do atributo chave)`,
      source: 'fallback',
    }
  }

  diceCount = clampDice(diceCount)
  const parts: string[] = []
  if (skill) parts.push(`${skill.name} ${skill.value}`)
  if (attribute) parts.push(`${attribute.name} ${attribute.value}`)

  return {
    diceCount,
    ...(skill ? { skill } : {}),
    ...(attribute ? { attribute } : {}),
    breakdown: `${parts.join(' + ')} = ${diceCount}d6`,
    source: 'sheet',
  }
}
