import type { Advantage } from './character'
import { advantages } from './data'
import type { AdvantageDef } from './data'

/**
 * Antecedentes são comprados em pontos (1–5) e não têm um item separado para
 * cada nível na ficha: o jogador escolhe Refúgio ○○, Fama ○○○ etc. O catálogo
 * guarda um item por nível (`refugio-1`…`refugio-5`); aqui agrupamos esses
 * itens para a interface de compra.
 */

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export interface AntecedentGroup {
  /** Id base estável (ex.: "refugio", "fama"). */
  baseId: string
  name: string
  category: string
  /** Níveis 1–5, em ordem crescente de pontos. */
  levels: AdvantageDef[]
}

function buildAntecedents(): AntecedentGroup[] {
  const groups = new Map<string, AdvantageDef[]>()

  for (const def of advantages) {
    if (def.kind !== 'ficha') continue
    const key = normalize(def.name)
    const list = groups.get(key) ?? []
    list.push(def)
    groups.set(key, list)
  }

  return [...groups.values()]
    .map((entries) => {
      const levels = [...entries].sort((a, b) => a.points - b.points)
      const first = levels[0]
      if (!first) return null
      return {
        baseId: first.id.replace(/-\d+$/, ''),
        name: first.name,
        category: first.category,
        levels,
      }
    })
    .filter((group): group is AntecedentGroup => group !== null)
    .sort((a, b) => a.category.localeCompare(b.category, 'pt-BR'))
}

export const antecedents: AntecedentGroup[] = buildAntecedents()

const byName = new Map(antecedents.map((group) => [normalize(group.name), group]))
const byBaseId = new Map(antecedents.map((group) => [group.baseId, group]))
const byLevelId = new Map(
  antecedents.flatMap((group) => group.levels.map((level) => [level.id, group] as const)),
)

/** Encontra o grupo de antecedente pelo nome, id base ou id de um nível. */
export function findAntecedentGroup(value: string): AntecedentGroup | undefined {
  return (
    byName.get(normalize(value)) ??
    byBaseId.get(value) ??
    byLevelId.get(value)
  )
}

/** Nível do antecedente para uma quantidade de pontos (1 até o máximo do grupo). */
export function findAntecedentLevel(group: AntecedentGroup, points: number): AdvantageDef {
  const clamped = Math.min(Math.max(1, points), antecedentMaxPoints(group))
  return (
    group.levels.find((level) => level.points === clamped) ??
    group.levels[group.levels.length - 1] ??
    group.levels[0]!
  )
}

/** Maior nível disponível no catálogo (Contato, por exemplo, vai só até 3). */
export function antecedentMaxPoints(group: AntecedentGroup): number {
  return group.levels[group.levels.length - 1]?.points ?? 5
}

/** Monta o registro da ficha para um antecedente comprado com N pontos. */
export function buildAntecedentAdvantage(
  group: AntecedentGroup,
  points: number,
): Omit<Advantage, 'id'> {
  const level = findAntecedentLevel(group, points)
  return {
    sourceId: level.id,
    name: group.name,
    kind: 'vantagem',
    points: level.points,
    description: level.description,
  }
}

/** Grupo de antecedente ao qual uma vantagem da ficha pertence, se houver. */
export function antecedentGroupOf(advantage: Advantage): AntecedentGroup | undefined {
  return findAntecedentGroup(advantage.sourceId ?? advantage.name)
}

/**
 * Explicação da vantagem/desvantagem. Usa o texto guardado na ficha e, para
 * fichas antigas (ou prontas convertidas antes do campo existir), recorre ao
 * catálogo pelo `sourceId`.
 */
export function resolveAdvantageDescription(advantage: Advantage): string {
  if (advantage.description.trim()) return advantage.description

  const def = advantage.sourceId
    ? advantages.find((item) => item.id === advantage.sourceId)
    : undefined
  return def?.description ?? ''
}
