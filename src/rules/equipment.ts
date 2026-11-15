import equipmentJson from './data/equipment.json'
import type { InventoryItem } from './inventory'
import type { AttributeId } from './types'

/**
 * Equipamentos: catálogo (extraído do Notion), preço, qualidade, modificadores,
 * encantamentos, RD e bônus de itens equipados.
 *
 * Nada aqui conhece React nem zod. A moeda é sempre exibida como "Zg".
 */

export const CURRENCY = 'Zg'

export function formatZg(value: number): string {
  return `${value} ${CURRENCY}`
}

// ---------------------------------------------------------------------------
// Tipos do catálogo
// ---------------------------------------------------------------------------

export type ItemCategory =
  | 'arma-corpo'
  | 'arma-distancia'
  | 'municao'
  | 'armadura'
  | 'equipamento'
  | 'acessorio'
  | 'pocao'
  | 'misc'
  | 'aliado'
  | 'companheiro'

export const categoryOrder: ItemCategory[] = [
  'arma-corpo',
  'arma-distancia',
  'municao',
  'armadura',
  'equipamento',
  'acessorio',
  'pocao',
  'misc',
  'aliado',
  'companheiro',
]

export const categoryLabels: Record<ItemCategory, string> = {
  'arma-corpo': 'Armas Corpo a Corpo',
  'arma-distancia': 'Armas à Distância',
  municao: 'Munições',
  armadura: 'Armaduras',
  equipamento: 'Equipamento',
  acessorio: 'Acessórios',
  pocao: 'Poções',
  misc: 'Itens Miscelâneos',
  aliado: 'Aliados',
  companheiro: 'Companheiros',
}

export type QualityId = 'comum' | 'boa' | 'obra-prima' | 'lendaria'
export type ModKind = 'arma' | 'armadura' | 'equipamento'
export type EnchantKind = 'arma' | 'armadura' | 'equipamento' | 'acessorio'
export type EffectUnit = 'd6' | 'flat' | 'sucesso'

export interface QualityDef {
  id: QualityId
  name: string
  /** 0 a 3: o "+N" da qualidade. */
  level: number
  /** Custo EXTRA em Zg sobre o preço base (já é o total, não soma com o anterior). */
  extraCost: number
  /** Slots de Modificação. */
  slots: number
  description: string
}

export type EffectTarget =
  | { kind: 'attribute'; id: AttributeId }
  | { kind: 'skill'; ids: string[] }
  | { kind: 'derived'; id: string }
  | { kind: 'rd'; type: 'fisico' | 'magico' | 'geral' | 'tipo' }
  | { kind: 'test'; label: string }

export interface ItemEffect {
  target: EffectTarget
  amount: number
  unit?: EffectUnit
  /** Itens: soma +N da qualidade (padrão: sim, se o bônus for positivo). */
  scales?: boolean
  /** Bônus situacional (ex.: "para escalar"). */
  condition?: string
  /** Chave em `choices` quando o jogador precisa escolher (perícia, tipo de dano). */
  choice?: string
}

export interface ModDef {
  id: string
  name: string
  description: string
  effects?: ItemEffect[]
  /** Reduz em 1 as desvantagens do próprio item nestes alvos (Ajustada). */
  offsets?: { kind: 'attribute' | 'skill'; id: string }[]
}

export interface EnchantDef {
  id: string
  name: string
  description: string
  effects?: ItemEffect[]
}

export interface ItemDef {
  id: string
  name: string
  category: ItemCategory
  /** Preço em Zg (por dia, para aliados). */
  price: number
  /** Preço "a partir de" (500+, 1000+). */
  priceFrom?: boolean
  perDay?: boolean
  description: string
  stats?: string
  qualityable?: boolean
  modKinds?: ModKind[]
  weaponSkill?: string
  /** Mods que o item já contém, como "arma:perfurante". Não gastam slot. */
  builtinMods?: string[]
  /** RD Máximo do item (padrão 3). Com 0, a RD nunca aumenta. */
  rdMax?: number
  effects?: ItemEffect[]
  equippable?: boolean
  stackable?: boolean
}

interface EquipmentData {
  currency: string
  craftDc: string
  rdMaxDefault: number
  ammoRule: { costZg: number; units: number }
  qualities: QualityDef[]
  modifiers: Record<ModKind, { label: string; cost: number; mods: ModDef[] }>
  enchantCosts: Record<EnchantKind, number>
  enchantments: EnchantDef[]
  items: ItemDef[]
}

export const equipment = equipmentJson as unknown as EquipmentData

const itemsById = new Map(equipment.items.map((item) => [item.id, item]))
const enchantsById = new Map(equipment.enchantments.map((enchant) => [enchant.id, enchant]))

export function itemById(id: string): ItemDef | undefined {
  return itemsById.get(id)
}

export function enchantById(id: string): EnchantDef | undefined {
  return enchantsById.get(id)
}

export function qualityById(id: string): QualityDef {
  // O catálogo sempre traz ao menos uma qualidade (o TS não sabe disso por
  // causa de `noUncheckedIndexedAccess`).
  return (
    equipment.qualities.find((quality) => quality.id === id) ??
    (equipment.qualities[0] as QualityDef)
  )
}

// ---------------------------------------------------------------------------
// Configuração de um item (qualidade + mods + encantamentos)
// ---------------------------------------------------------------------------

export interface ItemConfig {
  quality: QualityId
  qualityBonus: 'dice' | 'damage'
  /** Chaves "tipo:id" dos modificadores comprados. */
  mods: string[]
  enchants: string[]
  choices: Record<string, string>
}

export function emptyConfig(): ItemConfig {
  return { quality: 'comum', qualityBonus: 'dice', mods: [], enchants: [], choices: {} }
}

export function configFromInventory(entry: InventoryItem): ItemConfig {
  return {
    quality: entry.quality,
    qualityBonus: entry.qualityBonus,
    mods: [...entry.mods],
    enchants: [...entry.enchants],
    choices: { ...entry.choices },
  }
}

// ---------------------------------------------------------------------------
// Modificadores
// ---------------------------------------------------------------------------

export function modKey(kind: ModKind, id: string): string {
  return `${kind}:${id}`
}

export function modByKey(key: string): { kind: ModKind; def: ModDef } | undefined {
  const [kind, id] = key.split(':') as [ModKind, string]
  const def = equipment.modifiers[kind]?.mods.find((mod) => mod.id === id)
  return def ? { kind, def } : undefined
}

export function modCost(key: string): number {
  const found = modByKey(key)
  return found ? equipment.modifiers[found.kind].cost : 0
}

/** O modificador aumenta RD? (Revestimento, Pesada) */
export function modAddsRd(def: ModDef): boolean {
  return (def.effects ?? []).some((effect) => effect.target.kind === 'rd')
}

export function itemRdMax(item: ItemDef): number {
  return item.rdMax ?? equipment.rdMaxDefault
}

/** Todos os mods que o item pode receber (menos os que ele já contém). */
export function availableMods(item: ItemDef): { key: string; kind: ModKind; def: ModDef; cost: number }[] {
  if (!item.qualityable) return []
  const builtin = new Set(item.builtinMods ?? [])
  const list: { key: string; kind: ModKind; def: ModDef; cost: number }[] = []
  for (const kind of item.modKinds ?? []) {
    const group = equipment.modifiers[kind]
    for (const def of group.mods) {
      const key = modKey(kind, def.id)
      if (!builtin.has(key)) list.push({ key, kind, def, cost: group.cost })
    }
  }
  return list
}

export function slotsAllowed(cfg: ItemConfig): number {
  return qualityById(cfg.quality).slots
}

export type Availability = { ok: true } | { ok: false; reason: string }

/** Dá para adicionar este mod (ainda não escolhido) com a configuração atual? */
export function modAvailability(item: ItemDef, cfg: ItemConfig, key: string): Availability {
  const found = modByKey(key)
  if (!found) return { ok: false, reason: 'Modificador desconhecido.' }
  if ((item.builtinMods ?? []).includes(key)) return { ok: false, reason: 'O item já contém este modificador.' }
  if (!availableMods(item).some((mod) => mod.key === key)) {
    return { ok: false, reason: 'Este item não aceita este tipo de modificador.' }
  }
  if (modAddsRd(found.def) && itemRdMax(item) === 0) {
    return { ok: false, reason: 'RD Máximo 0: a RD deste item não pode ser aumentada.' }
  }
  if (!cfg.mods.includes(key) && cfg.mods.length >= slotsAllowed(cfg)) {
    return { ok: false, reason: 'Sem slots de modificação livres. Suba a qualidade para ganhar mais.' }
  }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Encantamentos
// ---------------------------------------------------------------------------

export function enchantKind(item: ItemDef): EnchantKind | null {
  switch (item.category) {
    case 'arma-corpo':
    case 'arma-distancia':
      return 'arma'
    case 'armadura':
      return 'armadura'
    case 'equipamento':
      return 'equipamento'
    case 'acessorio':
      return 'acessorio'
    default:
      return null
  }
}

export function enchantCost(item: ItemDef): number {
  const kind = enchantKind(item)
  return kind ? equipment.enchantCosts[kind] : 0
}

// ---------------------------------------------------------------------------
// Preço
// ---------------------------------------------------------------------------

export interface PriceLine {
  label: string
  amount: number
}

export function priceLines(item: ItemDef, cfg: ItemConfig): PriceLine[] {
  const lines: PriceLine[] = [{ label: 'Preço base', amount: item.price }]
  if (!item.qualityable) return lines

  const quality = qualityById(cfg.quality)
  if (quality.extraCost > 0) lines.push({ label: quality.name, amount: quality.extraCost })
  for (const key of cfg.mods) {
    const found = modByKey(key)
    if (found) lines.push({ label: `Mod ${found.def.name}`, amount: modCost(key) })
  }
  for (const id of cfg.enchants) {
    const enchant = enchantById(id)
    if (enchant) lines.push({ label: `Encantamento ${enchant.name}`, amount: enchantCost(item) })
  }
  return lines
}

export function unitPrice(item: ItemDef, cfg: ItemConfig): number {
  return priceLines(item, cfg).reduce((sum, line) => sum + line.amount, 0)
}

/** DC base para criar ou modificar o item: 2 + (valor em Zg ÷ 50, arredondado para baixo). */
export function craftDc(price: number): number {
  return 2 + Math.floor(price / 50)
}

/** Munições: cada 5 Zg equivalem a 3 unidades. */
export function ammoUnits(price: number): number {
  const { costZg, units } = equipment.ammoRule
  return Math.floor((price / costZg) * units)
}

/** Valor total de uma compra. */
export function orderTotal(item: ItemDef, cfg: ItemConfig, quantity = 1, days = 1): number {
  if (item.perDay) return item.price * Math.max(1, days)
  if (item.qualityable) return unitPrice(item, cfg)
  return item.price * Math.max(1, quantity)
}

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

export function validateConfig(item: ItemDef, cfg: ItemConfig): string[] {
  const errors: string[] = []
  if (!item.qualityable) {
    if (cfg.quality !== 'comum' || cfg.mods.length > 0 || cfg.enchants.length > 0) {
      errors.push('Este item não aceita qualidade, modificadores nem encantamentos.')
    }
    return errors
  }

  const seen = new Set<string>()
  for (const key of cfg.mods) {
    if (seen.has(key)) {
      errors.push('Modificador repetido.')
      continue
    }
    seen.add(key)
    const found = modByKey(key)
    const name = found?.def.name ?? key
    // Para esta checagem o próprio mod já está na lista; só os motivos de bloqueio fixos contam.
    const fixed = modAvailability(item, { ...cfg, mods: cfg.mods.filter((other) => other !== key) }, key)
    if (!fixed.ok && !fixed.reason.startsWith('Sem slots')) errors.push(`${name}: ${fixed.reason}`)
  }
  if (cfg.mods.length > slotsAllowed(cfg)) {
    errors.push(
      `${qualityById(cfg.quality).name} permite ${slotsAllowed(cfg)} modificador(es); há ${cfg.mods.length}.`,
    )
  }

  const enchants = new Set<string>()
  for (const id of cfg.enchants) {
    if (!enchantById(id)) errors.push(`Encantamento desconhecido: ${id}.`)
    else if (enchants.has(id)) errors.push('Não é possível ter encantamentos repetidos no mesmo item.')
    enchants.add(id)
  }
  return errors
}

// ---------------------------------------------------------------------------
// Escolhas pedidas por efeitos (perícia do Gibão, tipo de dano do Revestimento…)
// ---------------------------------------------------------------------------

export interface ChoiceSpec {
  key: string
  kind: 'skill' | 'text'
  label: string
  /** Perícias aceitas; 'all' = qualquer uma. */
  skillIds?: string[] | 'all'
}

function configEffects(item: ItemDef, cfg: { mods: string[] }): ItemEffect[] {
  const effects = [...(item.effects ?? [])]
  for (const key of [...(item.builtinMods ?? []), ...cfg.mods]) {
    effects.push(...(modByKey(key)?.def.effects ?? []))
  }
  return effects
}

export function choiceSpecs(item: ItemDef, cfg: { mods: string[] }): ChoiceSpec[] {
  const specs = new Map<string, ChoiceSpec>()
  for (const effect of configEffects(item, cfg)) {
    if (!effect.choice || specs.has(effect.choice)) continue
    if (effect.target.kind === 'skill') {
      const all = effect.target.ids.includes('*')
      specs.set(effect.choice, {
        key: effect.choice,
        kind: 'skill',
        label: 'Perícia',
        skillIds: all ? 'all' : effect.target.ids,
      })
    } else if (effect.target.kind === 'rd') {
      specs.set(effect.choice, { key: effect.choice, kind: 'text', label: 'Tipo de dano' })
    }
  }
  return [...specs.values()]
}

// ---------------------------------------------------------------------------
// Bônus de itens equipados
// ---------------------------------------------------------------------------

export type BonusTarget =
  | { kind: 'attribute'; id: AttributeId }
  | { kind: 'skill'; id: string }
  | { kind: 'derived'; id: string }
  | { kind: 'rd'; type: 'fisico' | 'magico' | 'geral' | 'tipo'; label?: string }
  | { kind: 'test'; label: string }

export interface Bonus {
  target: BonusTarget
  amount: number
  unit: EffectUnit
  /** Nome do item. */
  source: string
  /** O que gerou o bônus: o próprio item, a qualidade, um mod ou um encantamento. */
  origin: string
  condition?: string
}

export interface ItemBonuses {
  bonuses: Bonus[]
  /** Escolhas ainda pendentes (efeito não aplicado até escolher). */
  pending: string[]
  notes: string[]
}

type InventoryLike = Pick<
  InventoryItem,
  'itemId' | 'quality' | 'qualityBonus' | 'mods' | 'enchants' | 'choices'
>

function defaultUnit(target: EffectTarget): EffectUnit {
  return target.kind === 'skill' || target.kind === 'test' ? 'd6' : 'flat'
}

/** Bônus de UM item (como se estivesse equipado), com qualidade, mods e encantamentos. */
export function itemBonuses(entry: InventoryLike): ItemBonuses {
  const result: ItemBonuses = { bonuses: [], pending: [], notes: [] }
  const item = itemById(entry.itemId)
  if (!item) return result

  const level = item.qualityable ? qualityById(entry.quality).level : 0
  const rdMax = itemRdMax(item)
  const source = item.name

  interface RdAcc {
    type: 'fisico' | 'magico' | 'geral' | 'tipo'
    label?: string
    condition?: string
    base: number
    increase: number
    origin: string
  }
  const rdAcc = new Map<string, RdAcc>()

  function add(effect: ItemEffect, origin: string, mode: 'item' | 'mod' | 'enchant') {
    const scales =
      mode === 'item' ? effect.scales !== false && effect.amount > 0 : effect.scales === true
    const amount = effect.amount + (scales ? level : 0)
    const unit = effect.unit ?? defaultUnit(effect.target)
    const target = effect.target

    if (target.kind === 'rd') {
      let label: string | undefined
      if (target.type === 'tipo') {
        label = effect.choice ? entry.choices[effect.choice]?.trim() : undefined
        if (!label) {
          result.pending.push(`${source}: informe o tipo de dano (${origin}).`)
          return
        }
      }
      const key = `${target.type}|${label ?? ''}|${effect.condition ?? ''}`
      const acc =
        rdAcc.get(key) ??
        ({ type: target.type, label, condition: effect.condition, base: 0, increase: 0, origin } as RdAcc)
      if (mode === 'item') {
        acc.base += effect.amount
        if (scales) acc.increase += level
      } else {
        acc.increase += effect.amount
      }
      rdAcc.set(key, acc)
      return
    }

    if (target.kind === 'skill') {
      const wildcard = target.ids.includes('*')
      if (effect.choice) {
        const chosen = entry.choices[effect.choice]
        if (!chosen || (!wildcard && !target.ids.includes(chosen))) {
          result.pending.push(`${source}: escolha a perícia (${origin}).`)
          return
        }
        result.bonuses.push({
          target: { kind: 'skill', id: chosen },
          amount,
          unit,
          source,
          origin,
          condition: effect.condition,
        })
        return
      }
      for (const id of target.ids) {
        result.bonuses.push({ target: { kind: 'skill', id }, amount, unit, source, origin, condition: effect.condition })
      }
      return
    }

    result.bonuses.push({ target, amount, unit, source, origin, condition: effect.condition })
  }

  for (const effect of item.effects ?? []) add(effect, item.name, 'item')

  const modKeys = [...(item.builtinMods ?? []), ...entry.mods]
  for (const key of modKeys) {
    const found = modByKey(key)
    if (!found) continue
    for (const effect of found.def.effects ?? []) add(effect, `Mod ${found.def.name}`, 'mod')
  }
  for (const id of entry.enchants) {
    const enchant = enchantById(id)
    if (!enchant) continue
    for (const effect of enchant.effects ?? []) add(effect, `Encantamento ${enchant.name}`, 'enchant')
  }

  // RD: soma base + aumentos (qualidade e mods), travada pelo RD Máximo do item.
  for (const acc of rdAcc.values()) {
    const total = rdMax === 0 ? acc.base : Math.min(acc.base + acc.increase, Math.max(rdMax, acc.base))
    if (rdMax > 0 && acc.base + acc.increase > total) {
      result.notes.push(`${source}: RD limitada ao máximo de ${rdMax}.`)
    }
    if (total === 0) continue
    result.bonuses.push({
      target: { kind: 'rd', type: acc.type, label: acc.label },
      amount: total,
      unit: 'flat',
      source,
      origin: acc.origin,
      condition: acc.condition,
    })
  }

  // Ajustada & cia.: reduzem em 1 as desvantagens do próprio item.
  for (const key of modKeys) {
    const found = modByKey(key)
    for (const offset of found?.def.offsets ?? []) {
      const net = result.bonuses
        .filter((bonus) =>
          offset.kind === 'attribute'
            ? bonus.target.kind === 'attribute' && bonus.target.id === offset.id
            : bonus.target.kind === 'skill' && bonus.target.id === offset.id,
        )
        .reduce((sum, bonus) => sum + Math.min(0, bonus.amount), 0)
      if (net < 0) {
        result.bonuses.push({
          target:
            offset.kind === 'attribute'
              ? { kind: 'attribute', id: offset.id as AttributeId }
              : { kind: 'skill', id: offset.id },
          amount: Math.min(1, -net),
          unit: offset.kind === 'skill' ? 'd6' : 'flat',
          source,
          origin: `Mod ${found?.def.name}`,
        })
      }
    }
  }

  // Qualidade de armas: +Nd6 na perícia relacionada OU +N de dano.
  if (item.weaponSkill && level > 0) {
    if (entry.qualityBonus === 'damage') {
      result.bonuses.push({
        target: { kind: 'test', label: `Dano de ${item.name}` },
        amount: level,
        unit: 'flat',
        source,
        origin: qualityById(entry.quality).name,
      })
    } else {
      result.bonuses.push({
        target: { kind: 'skill', id: item.weaponSkill },
        amount: level,
        unit: 'd6',
        source,
        origin: qualityById(entry.quality).name,
      })
    }
  }

  return result
}

export interface RdSummary {
  fisico: number
  magico: number
  geral: number
  tipos: { label: string; amount: number; source: string }[]
  condicionais: { label: string; amount: number; condition: string; source: string }[]
}

export interface ActiveBonuses {
  attributes: Record<string, Bonus[]>
  skills: Record<string, Bonus[]>
  derived: Record<string, Bonus[]>
  tests: Bonus[]
  rd: RdSummary
  pending: { item: string; message: string }[]
  notes: string[]
}

export function isEquippable(entry: Pick<InventoryItem, 'itemId'>): boolean {
  return itemById(entry.itemId)?.equippable === true
}

/** Soma os bônus de tudo que está equipado. */
export function activeBonuses(inventory: readonly InventoryItem[]): ActiveBonuses {
  const active: ActiveBonuses = {
    attributes: {},
    skills: {},
    derived: {},
    tests: [],
    rd: { fisico: 0, magico: 0, geral: 0, tipos: [], condicionais: [] },
    pending: [],
    notes: [],
  }

  for (const entry of inventory) {
    if (!entry.equipped || !isEquippable(entry)) continue
    const { bonuses, pending, notes } = itemBonuses(entry)
    active.notes.push(...notes)
    for (const message of pending) active.pending.push({ item: itemById(entry.itemId)?.name ?? '', message })

    for (const bonus of bonuses) {
      const target = bonus.target
      switch (target.kind) {
        case 'attribute':
          ;(active.attributes[target.id] ??= []).push(bonus)
          break
        case 'skill':
          ;(active.skills[target.id] ??= []).push(bonus)
          break
        case 'derived':
          ;(active.derived[target.id] ??= []).push(bonus)
          break
        case 'test':
          active.tests.push(bonus)
          break
        case 'rd': {
          if (bonus.condition) {
            active.rd.condicionais.push({
              label: rdLabel(target.type, target.label),
              amount: bonus.amount,
              condition: bonus.condition,
              source: bonus.source,
            })
          } else if (target.type === 'tipo') {
            active.rd.tipos.push({ label: target.label ?? 'Tipo', amount: bonus.amount, source: bonus.source })
          } else {
            active.rd[target.type] += bonus.amount
          }
          break
        }
      }
    }
  }
  return active
}

export function rdLabel(type: 'fisico' | 'magico' | 'geral' | 'tipo', label?: string): string {
  if (type === 'fisico') return 'RDF'
  if (type === 'magico') return 'RDM'
  if (type === 'tipo') return `RD (${label ?? 'tipo'})`
  return 'RD'
}

/** Modificadores de stats derivados vindos do equipamento (PM, Limiar, Deslocamento…). */
export function equipmentModifiers(
  inventory: readonly InventoryItem[],
): { statId: string; value: number; source: string }[] {
  const active = activeBonuses(inventory)
  const list: { statId: string; value: number; source: string }[] = []
  for (const [statId, bonuses] of Object.entries(active.derived)) {
    for (const bonus of bonuses) {
      list.push({
        statId,
        value: bonus.amount,
        source: `Equipado: ${bonus.source}${bonus.origin !== bonus.source ? ` (${bonus.origin})` : ''}`,
      })
    }
  }
  return list
}

// ---------------------------------------------------------------------------
// Exibição de bônus
// ---------------------------------------------------------------------------

export interface BonusChip {
  text: string
  negative: boolean
  title: string
}

function signed(value: number): string {
  return value < 0 ? `−${Math.abs(value)}` : `+${value}`
}

function unitText(unit: EffectUnit, amount: number): string {
  if (unit === 'd6') return `${signed(amount)}d6`
  if (unit === 'sucesso') return `${signed(amount)} ${Math.abs(amount) === 1 ? 'sucesso' : 'sucessos'}`
  return signed(amount)
}

/** Chips "+1d6", "+1", "−2"… agrupados por unidade, com a origem no título. */
export function bonusChips(list: readonly Bonus[] | undefined, options: { plain?: boolean } = {}): BonusChip[] {
  if (!list || list.length === 0) return []
  const groups = new Map<EffectUnit, Bonus[]>()
  for (const bonus of list) {
    const unit = options.plain ? 'flat' : bonus.unit
    groups.set(unit, [...(groups.get(unit) ?? []), bonus])
  }
  const chips: BonusChip[] = []
  for (const [unit, bonuses] of groups) {
    const total = bonuses.reduce((sum, bonus) => sum + bonus.amount, 0)
    if (total === 0) continue
    chips.push({
      text: unitText(unit, total),
      negative: total < 0,
      title: bonuses
        .map(
          (bonus) =>
            `${bonus.source}${bonus.origin !== bonus.source ? ` — ${bonus.origin}` : ''}: ${unitText(bonus.unit, bonus.amount)}${bonus.condition ? ` (${bonus.condition})` : ''}`,
        )
        .join('\n'),
    })
  }
  return chips
}

/** Texto curto do efeito de um bônus, para listas. */
export function describeBonus(
  bonus: Bonus,
  names: {
    skill: (id: string) => string
    attribute: (id: string) => string
    derived: (id: string) => string
  },
): string {
  const target = bonus.target
  let where: string
  switch (target.kind) {
    case 'attribute':
      where = names.attribute(target.id)
      break
    case 'skill':
      where = names.skill(target.id)
      break
    case 'derived':
      where = names.derived(target.id)
      break
    case 'rd':
      where = rdLabel(target.type, target.label)
      break
    default:
      where = target.label
  }
  const value = target.kind === 'rd' ? signed(bonus.amount) : unitText(bonus.unit, bonus.amount)
  return `${value} ${where}${bonus.condition ? ` (${bonus.condition})` : ''}`
}

// ---------------------------------------------------------------------------
// Transações (puras: recebem o saldo e o inventário, devolvem os novos)
// ---------------------------------------------------------------------------

export type TxResult =
  | { ok: true; zigs: number; inventory: InventoryItem[]; spent: number }
  | { ok: false; reason: string }

export interface PurchaseOrder {
  /** Id novo para a entrada do inventário (gerado pelo chamador). */
  id: string
  itemId: string
  config: ItemConfig
  quantity?: number
  days?: number
}

export function purchaseItem(
  zigs: number,
  inventory: readonly InventoryItem[],
  order: PurchaseOrder,
): TxResult {
  const item = itemById(order.itemId)
  if (!item) return { ok: false, reason: 'Item não encontrado no catálogo.' }

  const config = item.qualityable ? order.config : emptyConfig()
  const errors = validateConfig(item, config)
  if (errors.length > 0) return { ok: false, reason: errors[0] ?? 'Configuração inválida.' }

  const quantity = Math.max(1, Math.floor(order.quantity ?? 1))
  const days = Math.max(1, Math.floor(order.days ?? 1))
  const total = orderTotal(item, config, quantity, days)
  if (total > zigs) return { ok: false, reason: `Faltam ${total - zigs} ${CURRENCY}.` }

  if (item.stackable) {
    const existing = inventory.find((entry) => entry.itemId === item.id)
    if (existing) {
      return {
        ok: true,
        zigs: zigs - total,
        spent: total,
        inventory: inventory.map((entry) =>
          entry.id === existing.id
            ? { ...entry, quantity: entry.quantity + quantity, paid: entry.paid + total }
            : entry,
        ),
      }
    }
  }

  const entry: InventoryItem = {
    id: order.id,
    itemId: item.id,
    quantity: item.stackable ? quantity : 1,
    quality: config.quality,
    qualityBonus: config.qualityBonus,
    mods: [...config.mods],
    enchants: [...config.enchants],
    choices: { ...config.choices },
    equipped: false,
    paid: total,
    ...(item.perDay ? { days } : {}),
  }
  return { ok: true, zigs: zigs - total, spent: total, inventory: [...inventory, entry] }
}

/** Melhorar um item que você já tem: paga só a diferença. Não dá para rebaixar nem remover. */
export function upgradeItem(
  zigs: number,
  inventory: readonly InventoryItem[],
  entryId: string,
  config: ItemConfig,
): TxResult {
  const entry = inventory.find((candidate) => candidate.id === entryId)
  const item = entry ? itemById(entry.itemId) : undefined
  if (!entry || !item || !item.qualityable) return { ok: false, reason: 'Este item não pode ser melhorado.' }

  const errors = validateConfig(item, config)
  if (errors.length > 0) return { ok: false, reason: errors[0] ?? 'Configuração inválida.' }

  if (qualityById(config.quality).level < qualityById(entry.quality).level) {
    return { ok: false, reason: 'Não é possível rebaixar a qualidade.' }
  }
  if (!entry.mods.every((key) => config.mods.includes(key))) {
    return { ok: false, reason: 'Não é possível remover modificadores já aplicados.' }
  }
  if (!entry.enchants.every((id) => config.enchants.includes(id))) {
    return { ok: false, reason: 'Não é possível remover encantamentos já aplicados.' }
  }

  const diff = unitPrice(item, config) - unitPrice(item, configFromInventory(entry))
  if (diff > zigs) return { ok: false, reason: `Faltam ${diff - zigs} ${CURRENCY}.` }

  return {
    ok: true,
    zigs: zigs - diff,
    spent: diff,
    inventory: inventory.map((candidate) =>
      candidate.id === entryId
        ? {
            ...candidate,
            quality: config.quality,
            qualityBonus: config.qualityBonus,
            mods: [...config.mods],
            enchants: [...config.enchants],
            choices: { ...config.choices },
            paid: candidate.paid + diff,
          }
        : candidate,
    ),
  }
}

/** Devolve o item e reembolsa o que foi pago. Aliados contratados não têm reembolso. */
export function refundItem(
  zigs: number,
  inventory: readonly InventoryItem[],
  entryId: string,
): { zigs: number; inventory: InventoryItem[]; refunded: number } {
  const entry = inventory.find((candidate) => candidate.id === entryId)
  if (!entry) return { zigs, inventory: [...inventory], refunded: 0 }
  const refunded = itemById(entry.itemId)?.perDay ? 0 : entry.paid
  return {
    zigs: zigs + refunded,
    inventory: inventory.filter((candidate) => candidate.id !== entryId),
    refunded,
  }
}

export function toggleEquipped(inventory: readonly InventoryItem[], entryId: string): InventoryItem[] {
  return inventory.map((entry) =>
    entry.id === entryId && isEquippable(entry) ? { ...entry, equipped: !entry.equipped } : entry,
  )
}

/** Gasta 1 unidade de um item empilhável (poção, munição…). Sem reembolso. */
export function consumeOne(inventory: readonly InventoryItem[], entryId: string): InventoryItem[] {
  return inventory.flatMap((entry) => {
    if (entry.id !== entryId) return [entry]
    if (!itemById(entry.itemId)?.stackable) return [entry]
    const unitPaid = entry.paid / entry.quantity
    return entry.quantity <= 1
      ? []
      : [{ ...entry, quantity: entry.quantity - 1, paid: Math.round((entry.paid - unitPaid) * 100) / 100 }]
  })
}

export function setChoice(
  inventory: readonly InventoryItem[],
  entryId: string,
  key: string,
  value: string,
): InventoryItem[] {
  return inventory.map((entry) =>
    entry.id === entryId ? { ...entry, choices: { ...entry.choices, [key]: value } } : entry,
  )
}
