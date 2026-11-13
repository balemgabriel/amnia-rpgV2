import { z } from 'zod'
import {
  AMNIA_RULES_VERSION,
  ATTRIBUTE_MAX,
  ATTRIBUTE_MIN,
  KEY_ATTRIBUTES,
  SKILL_MAX,
  SKILL_MIN,
  circleOrder,
  skills,
} from './amnia'
import { spellSchema } from './spell'
import type { AttributeId } from './types'

/** Versão do formato da ficha. Sobe quando o schema abaixo mudar. */
export const SHEET_VERSION = 2

const attributeValue = z.number().int().min(ATTRIBUTE_MIN).max(ATTRIBUTE_MAX)
const skillValue = z.number().int().min(SKILL_MIN).max(SKILL_MAX)

export const attributesSchema = z.object({
  forca: attributeValue,
  destreza: attributeValue,
  carisma: attributeValue,
  inteligencia: attributeValue,
  vontade: attributeValue,
})

export const modifierSchema = z.object({
  /** Id do stat derivado afetado (ex.: "limiar", "pv"). */
  statId: z.string(),
  value: z.number().int(),
  /** De onde vem o modificador (traço, vantagem, método de canalização…). */
  source: z.string(),
})

export const advantageSchema = z.object({
  id: z.string(),
  /** Id do item no catálogo de dados (advantages.json), quando vier de lá. */
  sourceId: z.string().optional(),
  name: z.string(),
  kind: z.enum(['vantagem', 'desvantagem']),
  points: z.number().int().min(1),
})

export const specializationSchema = z.object({
  id: z.string(),
  skillId: z.string(),
  name: z.string(),
})

export const runeSchema = z.object({
  id: z.string(),
  /** Id da runa no catálogo (runes.json), quando vier de lá. */
  sourceId: z.string().optional(),
  name: z.string(),
  circle: z.enum([...circleOrder, 'miscelanea']),
  level: z.number().int().min(1).max(7),
})

export const characterSchema = z.object({
  id: z.string(),
  name: z.string(),
  concept: z.string(),
  age: z.string(),
  appearance: z.string(),
  history: z.string(),
  /** Foto do personagem como data URL (opcional, guardada no próprio dispositivo). */
  portrait: z.string().default(''),

  // Etapa 1 — Conceito e Essência
  ancestryId: z.string().nullable(),
  sublineageId: z.string().nullable(),
  ancestryTraits: z.array(z.string()),
  negativeTraits: z.array(z.string()),
  desire: z.string(),
  ambition: z.string(),
  convictions: z.array(z.string()).max(3),
  pillars: z.array(z.string()).max(3),

  // Etapa 2 — Atributos
  attributes: attributesSchema,
  keyAttribute: z.enum([...KEY_ATTRIBUTES]).nullable(),

  // Etapa 3 — Círculo & Runas
  innateCircle: z.enum([...circleOrder]).nullable(),
  runes: z.array(runeSchema),
  channelingMethodId: z.string().nullable(),
  channelingLevel: z.number().int().min(1).max(2),

  // Magias — criadas depois da ficha, sem limite de quantidade
  spells: z.array(spellSchema).default([]),

  // Etapa 4 — Classe & Ímpeto
  classId: z.string().nullable(),
  classAbilityId: z.string().nullable(),
  classTalentId: z.string().nullable(),
  impulseId: z.string().nullable(),

  // Etapa 5 — Perícias
  skillDistributionId: z.enum(['especialista', 'pau-pra-toda-obra', 'generalista']).nullable(),
  skills: z.record(z.string(), skillValue),
  specializations: z.array(specializationSchema),

  // Etapa 6 — Vantagens, Desvantagens e Fichas
  advantages: z.array(advantageSchema),

  // Etapa 8 — Detalhes finais
  zigs: z.number().int().min(0),
  notes: z.string(),

  /** Modificadores aplicados sobre os stats derivados. */
  modifiers: z.array(modifierSchema),

  createdAt: z.number(),
  updatedAt: z.number(),
})

export type Character = z.infer<typeof characterSchema>
export type Attributes = z.infer<typeof attributesSchema>
export type Advantage = z.infer<typeof advantageSchema>
export type Modifier = z.infer<typeof modifierSchema>

export function emptySkills(): Record<string, number> {
  return Object.fromEntries(skills.map((skill) => [skill.id, 0]))
}

export function createEmptyCharacter(now = Date.now()): Character {
  return {
    id: crypto.randomUUID(),
    name: '',
    concept: '',
    age: '',
    appearance: '',
    history: '',
    portrait: '',

    ancestryId: null,
    sublineageId: null,
    ancestryTraits: [],
    negativeTraits: [],
    desire: '',
    ambition: '',
    convictions: [],
    pillars: [],

    attributes: { forca: 1, destreza: 1, carisma: 1, inteligencia: 1, vontade: 1 },
    keyAttribute: null,

    innateCircle: null,
    runes: [],
    channelingMethodId: null,
    channelingLevel: 1,

    spells: [],

    classId: null,
    classAbilityId: null,
    classTalentId: null,
    impulseId: null,

    skillDistributionId: null,
    skills: emptySkills(),
    specializations: [],

    advantages: [],

    zigs: 30,
    notes: '',

    modifiers: [],

    createdAt: now,
    updatedAt: now,
  }
}

export const rulesVersion = AMNIA_RULES_VERSION

// ---------------------------------------------------------------------------
// Validação das etapas
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean
  message?: string
}

/** A criação exige exatamente os valores 3, 2, 2, 1, 1. */
export function validateAttributeDistribution(attributes: Attributes): ValidationResult {
  const values = Object.values(attributes).sort((a, b) => b - a)
  const expected = [3, 2, 2, 1, 1]
  const valid = values.every((value, index) => value === expected[index])
  return valid
    ? { valid: true }
    : { valid: false, message: 'Distribua exatamente 3, 2, 2, 1 e 1 entre os cinco atributos.' }
}

export function totalAttributePoints(attributes: Attributes): number {
  return Object.values(attributes).reduce((sum, value) => sum + value, 0)
}

export function countSkillLevels(skills: Record<string, number>): Record<number, number> {
  const counts: Record<number, number> = {}
  for (const value of Object.values(skills)) {
    if (value > 0) counts[value] = (counts[value] ?? 0) + 1
  }
  return counts
}

/** Confere se as perícias gastas cabem na distribuição escolhida. */
export function validateSkillDistribution(
  skills: Record<string, number>,
  distributionLevels: Record<number, number>,
): ValidationResult {
  const counts = countSkillLevels(skills)

  for (const [levelRaw, used] of Object.entries(counts)) {
    const level = Number(levelRaw)
    const allowed = distributionLevels[level] ?? 0
    if (used > allowed) {
      return {
        valid: false,
        message: `Você usou ${used} perícias em ${level}, mas a distribuição permite ${allowed}.`,
      }
    }
  }

  for (const [levelRaw, allowed] of Object.entries(distributionLevels)) {
    const level = Number(levelRaw)
    const used = counts[level] ?? 0
    if (used < allowed) {
      return {
        valid: false,
        message: `Faltam ${allowed - used} perícia(s) em ${level}.`,
      }
    }
  }

  return { valid: true }
}

export function advantagePoints(advantages: Advantage[]): {
  total: number
  vantagens: number
  desvantagens: number
} {
  let vantagens = 0
  let desvantagens = 0
  for (const advantage of advantages) {
    if (advantage.kind === 'vantagem') vantagens += advantage.points
    else desvantagens += advantage.points
  }
  return { total: vantagens + desvantagens, vantagens, desvantagens }
}

export function validateAdvantages(
  advantages: Advantage[],
  budget: number,
  minDisadvantage: number,
): ValidationResult {
  const { total, desvantagens } = advantagePoints(advantages)
  if (total > budget) {
    return { valid: false, message: `Você gastou ${total} de ${budget} pontos.` }
  }
  if (desvantagens < minDisadvantage) {
    return {
      valid: false,
      message: `É obrigatório gastar ao menos ${minDisadvantage} pontos em desvantagens (atual: ${desvantagens}).`,
    }
  }
  if (total < budget) {
    return { valid: false, message: `Faltam ${budget - total} ponto(s) para distribuir.` }
  }
  return { valid: true }
}

/** Quantidade de runas que o personagem recebe na criação: 3 + INT. */
export function runeAllowance(intelligence: number): number {
  return 3 + intelligence
}

/**
 * Especializações gratuitas na criação: 1 base, +1 se houver pontos em
 * Ofícios, Erudição ou Arcanismo.
 */
export function creationSpecializations(skills: Record<string, number>): number {
  const bonusSkills = ['oficios', 'erudicao', 'arcanismo']
  const hasBonus = bonusSkills.some((id) => (skills[id] ?? 0) > 0)
  return 1 + (hasBonus ? 1 : 0)
}

export function attributeLabel(id: AttributeId): string {
  return id
}
