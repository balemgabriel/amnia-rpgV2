/**
 * Modelo declarativo do sistema Amnia v2.
 *
 * Nada aqui conhece React. Estes tipos descrevem o "livro de regras" como dados,
 * para que a interface seja gerada a partir deles em vez de ter regras escritas
 * à mão em cada componente.
 */

export type AttributeId = 'forca' | 'destreza' | 'carisma' | 'inteligencia' | 'vontade'

export type SkillId = string

export type SkillGroup = 'fisica' | 'social' | 'mental'

/** As seis Esferas (Spherae) da Arcanae. */
export type CircleId =
  | 'reforco'
  | 'elemento'
  | 'multiplicacao'
  | 'ilusao'
  | 'projecao'
  | 'alteracao'

export interface AttributeDef {
  id: AttributeId
  name: string
  /** Abreviação usada nas fórmulas e na ficha. */
  short: string
  description: string
}

export interface SkillDef {
  id: SkillId
  name: string
  group: SkillGroup
  description: string
  /** Especializações sugeridas pelo livro. */
  specializations: string[]
}

/**
 * Uma distribuição de criação de perícias: quantas perícias em cada nível.
 * Ex.: `{ 3: 3, 2: 5, 1: 7 }` = três perícias em 3, cinco em 2, sete em 1.
 */
export type SkillDistribution = Record<number, number>

export interface SkillDistributionDef {
  id: 'especialista' | 'pau-pra-toda-obra' | 'generalista'
  name: string
  description: string
  levels: SkillDistribution
}

export interface CircleDef {
  id: CircleId
  name: string
  description: string
  examples: string
}

/** Relação entre a Esfera inata e a Esfera de uma runa. */
export type CircleRelation = 'inata' | 'adjacente' | 'paralela' | 'oposta'

export interface CircleRelationRule {
  relation: CircleRelation
  /** Modificador no custo da runa, em PM. */
  costModifier: number
  label: string
}

export interface DerivedStatDef {
  id: string
  name: string
  /** Fórmula legível, exibida na ficha e avaliada pelo motor. */
  formula: string
  unit?: string
  /** Texto de apoio mostrado na interface. */
  note?: string
}

export interface ImpulseDef {
  id: string
  name: string
  archetype: string
  description: string
}

export interface ChannelingMethodDef {
  id: string
  name: string
  description: string
  level1: string
  level2: string
}

/** Custo em XP da tabela de progressão. */
export interface XpCostDef {
  id: string
  name: string
  cost: string
  note?: string
  /** Custo numérico fixo (quando não cresce com o nível). */
  fixedCost?: number
  /** Custo por nível atual/quantidade. */
  unitCost?: number
  /** O custo depende do nível atual/quantidade informada. */
  perLevel?: boolean
}

export interface CreationBudget {
  ancestryPoints: number
  startingXp: number
  advantagePoints: number
  /** Mínimo de pontos que DEVEM ser gastos em desvantagens. */
  minDisadvantagePoints: number
  baseRunes: number
  freeSpecializations: number
  actionPoints: number
}
