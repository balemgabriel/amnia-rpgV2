import { lineages } from './data'
import type { Caste, Lineage, LineageGroup, SubLineage, Trait } from './data/types'

/** Localiza uma ancestralidade pelo id. */
export function findLineage(id?: string | null): Lineage | null {
  if (!id) return null
  return lineages.find((item) => item.id === id) ?? null
}

/** Localiza uma linhagem (sub-ramificação) dentro da ancestralidade. */
export function findSublineage(
  lineage: Lineage | null,
  id?: string | null,
): SubLineage | null {
  if (!lineage || !id) return null
  return lineage.lineages.find((item) => item.id === id) ?? null
}

/** Localiza uma casta dentro da ancestralidade. */
export function findCaste(lineage: Lineage | null, id?: string | null): Caste | null {
  if (!lineage || !id) return null
  return lineage.castes?.find((item) => item.id === id) ?? null
}

/**
 * Todos os traços que uma ancestralidade oferece, incluindo traços raciais,
 * negativos, castas, linhagens e opções de caminho. Usado para calcular
 * orçamento, resolver nomes na ficha e converter fichas prontas.
 */
export function lineageTraits(lineage: Lineage | null): Trait[] {
  if (!lineage) return []
  return [
    ...lineage.lineages.flatMap((item) => item.traits),
    ...(lineage.castes?.flatMap((item) => item.traits) ?? []),
    ...(lineage.path?.options ?? []),
    ...lineage.racialTraits,
    ...lineage.negativeTraits,
  ]
}

/** Traço de uma ancestralidade pelo id, em qualquer uma de suas camadas. */
export function findLineageTrait(lineage: Lineage | null, id: string): Trait | undefined {
  return lineageTraits(lineage).find((trait) => trait.id === id)
}

export interface LineageGroupEntry {
  group: LineageGroup
  lineages: SubLineage[]
}

/**
 * Separa as linhagens em grupos com descrição própria (Kuetz/Tlahkoa,
 * Qatae/Khayat/Rasasa) e deixa as que não pertencem a nenhum grupo à parte.
 */
export function groupedLineages(lineage: Lineage | null): {
  groups: LineageGroupEntry[]
  ungrouped: SubLineage[]
} {
  if (!lineage) return { groups: [], ungrouped: [] }

  const groups = (lineage.lineageGroups ?? []).map((group) => ({
    group,
    lineages: group.sublineageIds
      .map((id) => lineage.lineages.find((item) => item.id === id))
      .filter((item): item is SubLineage => item !== undefined),
  }))

  const groupedIds = new Set(groups.flatMap((entry) => entry.lineages.map((item) => item.id)))
  const ungrouped = lineage.lineages.filter((item) => !groupedIds.has(item.id))

  return { groups, ungrouped }
}

/** Grupo ao qual uma linhagem pertence, se houver. */
export function lineageGroupOf(
  lineage: Lineage | null,
  sublineageId?: string | null,
): LineageGroup | null {
  if (!lineage || !sublineageId) return null
  return (
    lineage.lineageGroups?.find((group) => group.sublineageIds.includes(sublineageId)) ?? null
  )
}

/** Opção do caminho escolhida na ficha, se houver. */
export function selectedPathOption(
  lineage: Lineage | null,
  ancestryTraits: string[],
): Trait | null {
  if (!lineage?.path) return null
  return lineage.path.options.find((option) => ancestryTraits.includes(option.id)) ?? null
}
