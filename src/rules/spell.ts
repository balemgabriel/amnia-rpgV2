import { z } from 'zod'
import {
  circleOrder,
  circleRelation,
  circleRelationLabels,
  circleRelationRules,
  runeCircleLabels,
} from './amnia'
import type { AttributeId, CircleId, CircleRelation } from './types'
import type { RuneCircleId } from './data/types'
import {
  clampLevelToUnlocked,
  hasUnlockingCondition,
  isLevelLocked,
  runeById,
  runeCircleOf,
  runeName,
} from './runes'

/**
 * Regras do criador de magias.
 *
 * Cada runa da magia carrega o seu nível (= PM pago por aquele efeito) e as
 * suas próprias condições. Níveis 6 e 7 só existem se a PRÓPRIA runa tiver uma
 * condição Severa, Extrema ou Absoluta.
 *
 * O custo de uma magia é a soma dos níveis das runas usadas, mais o
 * modificador de cada Esfera presente (uma vez por Esfera, não por runa),
 * mais alvos/duração/área, menos as condições que dão desconto e a Magia
 * Pessoal. A Complexidade (Cx) vem da tabela do material: cresce com o
 * número de runas e ganha +1 quando a magia usa mais de uma Esfera.
 *
 * Nada aqui conhece React: a interface só consome estes cálculos.
 */

export const MAGIA_PESSOAL_TRAIT_ID = 'magia-pessoal'

// ---------------------------------------------------------------------------
// Condições
// ---------------------------------------------------------------------------

export const CONDITION_WEIGHTS = [
  'leve',
  'moderada',
  'severa',
  'extrema',
  'absoluta',
] as const

export type ConditionWeight = (typeof CONDITION_WEIGHTS)[number]

export const CONDITION_LIMITS: Record<ConditionWeight, number> = {
  leve: 4,
  moderada: 3,
  severa: 2,
  extrema: 2,
  absoluta: 1,
}

export const CONDITION_LABELS: Record<ConditionWeight, string> = {
  leve: 'Leve',
  moderada: 'Moderada',
  severa: 'Severa',
  extrema: 'Extrema',
  absoluta: 'Absoluta',
}

export const CONDITION_SUMMARIES: Record<ConditionWeight, string> = {
  leve: 'Reduz o custo final em −1 PM.',
  moderada: '+1 nível de runa.',
  severa: '+2 níveis de runa ou −2 PM; +1 Cx.',
  extrema: '+3 níveis de runa ou −3 PM; +2 Cx.',
  absoluta: 'Acesso a níveis lendários; −2 Cx ou −4 PM.',
}

export type ConditionMode = 'levels' | 'pm' | 'cx'

// ---------------------------------------------------------------------------
// Modificações extras
// ---------------------------------------------------------------------------

export const spellTargets = ['single', 'three', 'group', 'crowd', 'army'] as const
export type SpellTarget = (typeof spellTargets)[number]

export const spellDurations = ['instant', 'short', 'long', 'permanent'] as const
export type SpellDuration = (typeof spellDurations)[number]

export const spellAreas = ['none', '1', '5', '10', '20'] as const
export type SpellArea = (typeof spellAreas)[number]

export interface SpellOption<T extends string> {
  id: T
  label: string
  cost: number
}

export const TARGET_OPTIONS: SpellOption<SpellTarget>[] = [
  { id: 'single', label: '1 alvo', cost: 0 },
  { id: 'three', label: 'Até 3 alvos', cost: 1 },
  { id: 'group', label: 'Grupo pequeno (até 10)', cost: 2 },
  { id: 'crowd', label: 'Multidão (até 30)', cost: 4 },
  { id: 'army', label: 'Exército', cost: 5 },
]

export const DURATION_OPTIONS: SpellOption<SpellDuration>[] = [
  { id: 'instant', label: 'Instantânea', cost: 0 },
  { id: 'short', label: 'Curta (1 cena / minutos)', cost: 1 },
  { id: 'long', label: 'Longa (horas / 1 dia)', cost: 3 },
  { id: 'permanent', label: 'Permanente', cost: 4 },
]

export const AREA_OPTIONS: SpellOption<SpellArea>[] = [
  { id: 'none', label: 'Sem área', cost: 0 },
  { id: '1', label: '1 espaço/metro adicional', cost: 1 },
  { id: '5', label: '5 espaços/metros', cost: 2 },
  { id: '10', label: '10 espaços/metros', cost: 4 },
  { id: '20', label: '20 espaços/metros', cost: 5 },
]

export function optionLabel<T extends string>(options: SpellOption<T>[], id: T): string {
  return options.find((option) => option.id === id)?.label ?? id
}

export function optionCost<T extends string>(options: SpellOption<T>[], id: T): number {
  return options.find((option) => option.id === id)?.cost ?? 0
}

/** Formata um modificador com o sinal tipográfico (−). */
export function formatModifier(value: number): string {
  if (value > 0) return `+${value}`
  if (value < 0) return `−${Math.abs(value)}`
  return '0'
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const spellConditionSchema = z.object({
  id: z.string(),
  weight: z.enum([...CONDITION_WEIGHTS]),
  /** Texto da condição, como o jogador a descreveu. */
  text: z.string(),
  /** 'levels' = níveis extras; 'pm' = desconto em PM; 'cx' = −2 Cx (Absoluta). */
  mode: z.enum(['levels', 'pm', 'cx']).optional(),
})

export const spellRuneSchema = z.object({
  /** Id da runa no catálogo (runes.json). Deve estar em `knownRunes` da ficha. */
  runeId: z.string(),
  /** Nível escolhido = PM pago por este efeito; níveis extras de condições não entram no custo. */
  level: z.number().int().min(1).max(7),
  /** Condições vinculadas A ESTA runa (não à magia inteira). */
  conditions: z.array(spellConditionSchema),
})

export const spellSchema = z.object({
  id: z.string(),
  name: z.string(),
  effect: z.string(),

  runes: z.array(spellRuneSchema),

  targets: z.enum([...spellTargets]),
  duration: z.enum([...spellDurations]),
  area: z.enum([...spellAreas]),

  range: z.string(),
  targetDescription: z.string(),

  /** Traço Snegatnom: uma magia por personagem com −3 PM. */
  personal: z.boolean(),

  notes: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export type SpellRune = z.infer<typeof spellRuneSchema>
export type SpellCondition = z.infer<typeof spellConditionSchema>
export type Spell = z.infer<typeof spellSchema>

/** Contexto mínimo da ficha necessário para calcular uma magia. */
export interface SpellContext {
  innateCircle: CircleId | null
  keyAttribute: AttributeId | null
  channelingMethodId: string | null
  channelingLevel: number
  ancestryTraits: string[]
  spells: Spell[]
}

export function emptySpell(now = Date.now()): Spell {
  return {
    id: crypto.randomUUID(),
    name: '',
    effect: '',
    runes: [],
    targets: 'single',
    duration: 'instant',
    area: 'none',
    range: '',
    targetDescription: '',
    personal: false,
    notes: '',
    createdAt: now,
    updatedAt: now,
  }
}

// ---------------------------------------------------------------------------
// Composição
// ---------------------------------------------------------------------------

/** Esferas distintas usadas pela magia, na ordem do hexágono + Miscelânea. */
export function spellCircles(spell: Spell): RuneCircleId[] {
  const used = new Set(spell.runes.map((rune) => runeCircleOf(rune.runeId)))
  const ordered: RuneCircleId[] = [...circleOrder, 'miscelanea']
  return ordered.filter((id) => used.has(id))
}

export interface SpellCircleInfo {
  id: RuneCircleId
  name: string
  relation: CircleRelation | null
  relationLabel: string
  modifier: number
  count: number
}

/**
 * Modificador de custo de cada Esfera da magia. O modificador é aplicado uma
 * vez por Esfera — é assim que as fichas do material registram, por exemplo,
 * "Círculos; Alteração +1, Projeção".
 */
export function spellCircleInfo(spell: Spell, context: SpellContext): SpellCircleInfo[] {
  return spellCircles(spell).map((id) => {
    const count = spell.runes.filter((rune) => runeCircleOf(rune.runeId) === id).length

    if (id === 'miscelanea' || !context.innateCircle) {
      return {
        id,
        name: runeCircleLabels[id],
        relation: null,
        relationLabel: id === 'miscelanea' ? 'Miscelânea' : 'Sem Círculo Inato',
        modifier: 0,
        count,
      }
    }

    const relation = circleRelation(context.innateCircle, id)
    return {
      id,
      name: runeCircleLabels[id],
      relation,
      relationLabel: circleRelationLabels[relation],
      modifier: circleRelationRules[relation].costModifier,
      count,
    }
  })
}

// ---------------------------------------------------------------------------
// Condições
// ---------------------------------------------------------------------------

export function conditionMode(condition: SpellCondition): ConditionMode | null {
  if (condition.weight === 'leve') return null
  if (condition.weight === 'moderada') return 'levels'
  if (condition.weight === 'severa' || condition.weight === 'extrema') {
    return condition.mode === 'pm' ? 'pm' : 'levels'
  }
  // Absoluta: o padrão é o desconto de Complexidade.
  return condition.mode === 'pm' ? 'pm' : 'cx'
}

/** Níveis de runa concedidos pela condição (0 quando ela dá desconto em PM/Cx). */
export function conditionBonusLevels(condition: SpellCondition): number {
  if (conditionMode(condition) !== 'levels') return 0
  if (condition.weight === 'moderada') return 1
  if (condition.weight === 'severa') return 2
  if (condition.weight === 'extrema') return 3
  return 0
}

/** Todas as condições da magia (soma das condições de cada runa). */
export function allConditions(spell: Spell): SpellCondition[] {
  return spell.runes.flatMap((rune) => rune.conditions)
}

/** Bônus de nível que uma runa recebe das SUAS condições. */
export function bonusLevelsForRune(rune: SpellRune): number {
  return rune.conditions.reduce((sum, condition) => sum + conditionBonusLevels(condition), 0)
}

export function effectiveRuneLevel(rune: SpellRune): number {
  return Math.min(7, rune.level + bonusLevelsForRune(rune))
}

/** O nível escolhido desta runa está bloqueado (6–7 sem condição pesada nela)? */
export function isRuneLevelLocked(rune: SpellRune, level: number = rune.level): boolean {
  return isLevelLocked(level, rune.conditions)
}

/** Runas da magia cujo nível escolhido viola a trava de 6–7. */
export function lockedRunes(spell: Spell): SpellRune[] {
  return spell.runes.filter((rune) => isRuneLevelLocked(rune))
}

/** Se a condição pesada saiu, recua o nível para o maior livre. */
export function normalizeRune(rune: SpellRune): SpellRune {
  const level = clampLevelToUnlocked(rune.level, rune.conditions, runeById(rune.runeId))
  return level === rune.level ? rune : { ...rune, level }
}

export function conditionImpactLabel(condition: SpellCondition): string {
  const mode = conditionMode(condition)
  if (condition.weight === 'leve') return '−1 PM'
  if (condition.weight === 'moderada') return '+1 nível de runa'
  if (condition.weight === 'severa') {
    return mode === 'pm' ? '−2 PM · +1 Cx' : '+2 níveis de runa · +1 Cx'
  }
  if (condition.weight === 'extrema') {
    return mode === 'pm' ? '−3 PM · +2 Cx' : '+3 níveis de runa · +2 Cx'
  }
  return mode === 'pm' ? 'Níveis lendários · −4 PM' : 'Níveis lendários · −2 Cx'
}

// ---------------------------------------------------------------------------
// Custo em PM
// ---------------------------------------------------------------------------

export type CostLineKind = 'rune' | 'circle' | 'extra' | 'discount'

export interface CostLine {
  label: string
  value: number
  kind: CostLineKind
}

export interface SpellCostResult {
  total: number
  runeBase: number
  circleMods: number
  extras: number
  discounts: number
  lines: CostLine[]
  circles: SpellCircleInfo[]
}

export function spellCost(spell: Spell, context: SpellContext): SpellCostResult {
  const lines: CostLine[] = []
  let runeBase = 0

  for (const rune of spell.runes) {
    runeBase += rune.level
    lines.push({
      label: `${runeName(rune.runeId)} (nível ${rune.level})`,
      value: rune.level,
      kind: 'rune',
    })
  }

  const circles = spellCircleInfo(spell, context)
  let circleMods = 0
  for (const circle of circles) {
    circleMods += circle.modifier
    lines.push({
      label: `${circle.name} · ${circle.relationLabel}`,
      value: circle.modifier,
      kind: 'circle',
    })
  }

  const targetCost = optionCost(TARGET_OPTIONS, spell.targets)
  const durationCost = optionCost(DURATION_OPTIONS, spell.duration)
  const areaCost = optionCost(AREA_OPTIONS, spell.area)
  const extras = targetCost + durationCost + areaCost

  if (targetCost !== 0) {
    lines.push({
      label: `Alvos: ${optionLabel(TARGET_OPTIONS, spell.targets)}`,
      value: targetCost,
      kind: 'extra',
    })
  }
  if (durationCost !== 0) {
    lines.push({
      label: `Duração: ${optionLabel(DURATION_OPTIONS, spell.duration)}`,
      value: durationCost,
      kind: 'extra',
    })
  }
  if (areaCost !== 0) {
    lines.push({
      label: `Área: ${optionLabel(AREA_OPTIONS, spell.area)}`,
      value: areaCost,
      kind: 'extra',
    })
  }

  let discounts = 0

  const conditions = allConditions(spell)
  const leveCount = conditions.filter((condition) => condition.weight === 'leve').length
  if (leveCount > 0) {
    const value = -leveCount
    discounts += value
    lines.push({
      label: `Condições leves (${leveCount})`,
      value,
      kind: 'discount',
    })
  }

  for (const condition of conditions) {
    if (conditionMode(condition) !== 'pm') continue
    const value =
      condition.weight === 'severa'
        ? -2
        : condition.weight === 'extrema'
          ? -3
          : condition.weight === 'absoluta'
            ? -4
            : 0
    if (value === 0) continue
    discounts += value
    lines.push({
      label: `${CONDITION_LABELS[condition.weight]}: ${
        condition.text.trim() || 'condição'
      }`,
      value,
      kind: 'discount',
    })
  }

  if (spell.personal) {
    discounts -= 3
    lines.push({ label: 'Magia Pessoal', value: -3, kind: 'discount' })
  }

  return {
    total: Math.max(0, runeBase + circleMods + extras + discounts),
    runeBase,
    circleMods,
    extras,
    discounts,
    lines,
    circles,
  }
}

// ---------------------------------------------------------------------------
// Complexidade (Cx)
// ---------------------------------------------------------------------------

export interface CxLine {
  label: string
  value: number
}

export interface SpellCxResult {
  total: number
  base: number
  conditionMod: number
  keyAttributeMod: number
  channelingMod: number
  lines: CxLine[]
}

export function spellCx(spell: Spell, context: SpellContext): SpellCxResult {
  const runeCount = spell.runes.length
  const circleCount = spellCircles(spell).length

  // Tabela do material: 1 runa = 1; 2 runas = 2; 3 runas = 4; 4 runas = 5;
  // 5+ runas = 6. Usar mais de uma Esfera adiciona +1. O teto da tabela é 6.
  const base =
    runeCount === 0 ? 0 : Math.min(6, runeCount + (circleCount > 1 ? 1 : 0))

  const lines: CxLine[] = [
    {
      label:
        runeCount === 0
          ? 'Sem runas'
          : `${runeCount} runa(s)${circleCount > 1 ? ` em ${circleCount} Círculos` : ''}`,
      value: base,
    },
  ]

  let conditionMod = 0
  for (const condition of allConditions(spell)) {
    if (condition.weight === 'severa') {
      conditionMod += 1
      lines.push({ label: 'Condição severa', value: 1 })
    } else if (condition.weight === 'extrema') {
      conditionMod += 2
      lines.push({ label: 'Condição extrema', value: 2 })
    } else if (
      condition.weight === 'absoluta' &&
      conditionMode(condition) === 'cx'
    ) {
      conditionMod -= 2
      lines.push({ label: 'Condição absoluta (−2 Cx)', value: -2 })
    }
  }

  let keyAttributeMod = 0
  if (context.keyAttribute === 'inteligencia') {
    keyAttributeMod = -1
    lines.push({ label: 'Atributo Chave: Inteligência', value: -1 })
  }

  let channelingMod = 0
  if (context.channelingMethodId === 'runico') {
    channelingMod = -1
    lines.push({ label: 'Método Rúnico', value: -1 })
  }

  const total =
    runeCount === 0
      ? 0
      : Math.max(1, base + conditionMod + keyAttributeMod + channelingMod)

  return { total, base, conditionMod, keyAttributeMod, channelingMod, lines }
}

// ---------------------------------------------------------------------------
// Magia Pessoal
// ---------------------------------------------------------------------------

export function characterHasTrait(context: SpellContext, traitId: string): boolean {
  return context.ancestryTraits.includes(traitId)
}

export function personalMagicOwner(
  context: SpellContext,
  exceptSpellId?: string,
): Spell | undefined {
  return context.spells.find(
    (spell) => spell.personal && spell.id !== exceptSpellId,
  )
}

/** O personagem pode marcar ESTA magia como Magia Pessoal? */
export function canUsePersonalMagic(context: SpellContext, spellId?: string): boolean {
  return (
    characterHasTrait(context, MAGIA_PESSOAL_TRAIT_ID) &&
    !personalMagicOwner(context, spellId)
  )
}

// ---------------------------------------------------------------------------
// Avisos
// ---------------------------------------------------------------------------

export interface SpellWarning {
  tone: 'warn' | 'info'
  message: string
}

export interface SpellWarningOptions {
  /** PM por rodada do personagem. */
  pm?: number
  /** Limiar Arcano do personagem. */
  limiar?: number
  /** Runas a que o personagem tem acesso (ids do catálogo). */
  knownRunes?: readonly string[]
}

export function spellWarnings(
  spell: Spell,
  context: SpellContext,
  options: SpellWarningOptions = {},
): SpellWarning[] {
  const warnings: SpellWarning[] = []
  const cost = spellCost(spell, context)
  const cx = spellCx(spell, context)
  const hasPersonalTrait = characterHasTrait(context, MAGIA_PESSOAL_TRAIT_ID)
  const personalOwner = personalMagicOwner(context, spell.id)

  if (spell.runes.length === 0) {
    warnings.push({
      tone: 'warn',
      message: 'Adicione ao menos uma runa para a magia existir.',
    })
  }

  if (!context.innateCircle) {
    warnings.push({
      tone: 'info',
      message:
        'O Círculo Inato não está definido; os modificadores de Esfera não serão aplicados.',
    })
  }

  if (spell.personal && !hasPersonalTrait) {
    warnings.push({
      tone: 'warn',
      message:
        'Magia Pessoal é um traço da linhagem Snegatnom. Este personagem não possui o traço.',
    })
  }

  if (spell.personal && personalOwner) {
    warnings.push({
      tone: 'warn',
      message: `Outra magia já é a Magia Pessoal deste personagem (${
        personalOwner.name.trim() || 'sem nome'
      }).`,
    })
  }

  if (options.pm !== undefined && cost.total > options.pm) {
    warnings.push({
      tone: 'warn',
      message: `Custo de ${cost.total} PM acima dos ${options.pm} PM do personagem.`,
    })
  }

  if (options.limiar !== undefined && cost.total > options.limiar) {
    warnings.push({
      tone: 'warn',
      message: `Custo acima do Limiar (${options.limiar}). Lançar exige um teste de Magia contra Cx ${cx.total} e o dano sofre +2.`,
    })
  }

  for (const rune of spell.runes) {
    const name = runeName(rune.runeId)

    if (options.knownRunes && !options.knownRunes.includes(rune.runeId)) {
      warnings.push({
        tone: 'warn',
        message: `${name} não está entre as runas que este personagem conhece.`,
      })
    }

    if (isRuneLevelLocked(rune)) {
      warnings.push({
        tone: 'warn',
        message: `${name} está no nível ${rune.level}, mas os níveis 6 e 7 exigem uma condição Severa, Extrema ou Absoluta vinculada a esta runa.`,
      })
      continue
    }

    const effective = effectiveRuneLevel(rune)
    if (effective >= 6 && !hasUnlockingCondition(rune.conditions)) {
      warnings.push({
        tone: 'info',
        message: `${name} chega ao nível ${effective} apenas por bônus de condição; para escolher 6 ou 7 direto, a runa precisa de uma condição Severa, Extrema ou Absoluta.`,
      })
    }
  }

  for (const weight of CONDITION_WEIGHTS) {
    const count = allConditions(spell).filter(
      (condition) => condition.weight === weight,
    ).length
    if (count > CONDITION_LIMITS[weight]) {
      warnings.push({
        tone: 'warn',
        message: `Há ${count} condições ${CONDITION_LABELS[weight].toLowerCase()}, mas o limite é ${CONDITION_LIMITS[weight]}.`,
      })
    }
  }

  if (cx.total >= 6) {
    warnings.push({
      tone: 'info',
      message: `Complexidade ${cx.total}: lançar e resistir a Máculas é muito difícil.`,
    })
  }

  return warnings
}
