/**
 * Tipos dos dados extraídos do Notion (src/rules/data/*.json).
 * Os JSONs são gerados a partir do material oficial em docs/amnia-export.
 */

export type LineageGroupId = 'humanoide' | 'nao-humano' | 'ogroide'

export interface Trait {
  id: string
  name: string
  cost: number
  /** Presente quando o traço tem custo variável (ex.: 1 a 3 pontos). */
  costMax?: number
  description: string
}

export interface SubLineage {
  id: string
  name: string
  traits: Trait[]
}

export interface Lineage {
  id: string
  name: string
  /** Linhagem ainda em construção no material (sem descrição, traços ou ramificações). */
  wip?: boolean
  group: LineageGroupId
  description: string
  lineages: SubLineage[]
  racialTraits: Trait[]
  negativeTraits: Trait[]
}

export interface ClassAbility {
  id: string
  name: string
  description: string
}

export interface ClassTalent {
  id: string
  name: string
  description: string
  requirement: string
}

export interface ClassDef {
  id: string
  name: string
  description: string
  coreAbilities: ClassAbility[]
  talents: ClassTalent[]
}

export type AdvantageKind = 'vantagem' | 'desvantagem' | 'ficha'

export interface AdvantageDef {
  id: string
  name: string
  kind: AdvantageKind
  points: number
  pointsMax?: number
  category: string
  description: string
}

export type RuneCircleId =
  | 'reforco'
  | 'elemento'
  | 'multiplicacao'
  | 'ilusao'
  | 'projecao'
  | 'alteracao'
  /** Runas que não pertencem a uma única Esfera (Cura, Sorte, Vida…). */
  | 'miscelanea'

export interface RuneLevel {
  /** 1 a 7. 6 e 7 são lendários/míticos. */
  level: number
  effect: string
}

export interface RuneDef {
  id: string
  name: string
  circle: RuneCircleId
  /** Ex.: "Requer Técnica Intermediária", "Requer Arcanismo 4". */
  requirement?: string
  description: string
  /** Nem toda runa tem todos os níveis: algumas começam no 2, 3 ou 4. */
  levels: RuneLevel[]
}
