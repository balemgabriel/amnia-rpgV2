import { z } from 'zod'
import { creationBudget, xpCosts } from './amnia'
import type { XpCostDef } from './types'

/**
 * Tabela de experiência.
 *
 * A criação começa com uma pool de 15 XP (`creationBudget.startingXp`). Tudo o
 * que passa do que é gratuito na criação — atributo extra, perícia extra,
 * especialização a mais, runa fora do permitido… — é pago com essa pool. Cada
 * gasto fica registrado na ficha como uma linha da tabela.
 */

export const XP_POOL = creationBudget.startingXp

/**
 * Efeito aplicado na ficha quando a compra é feita. Guardar o valor anterior
 * permite desfazer a compra depois sem deixar atributo/runa órfão.
 */
export const xpEffectSchema = z.object({
  kind: z.enum([
    'atributo',
    'pericia',
    'especializacao',
    'talento',
    'vantagem',
    'runa',
    'canalizacao',
    'ponto-extra',
  ]),
  targetId: z.string(),
  /** Valor anterior do atributo/perícia/nível de canalização. */
  previous: z.number().int().optional(),
  /** Id anterior (talento) ou do registro criado (especialização, vantagem, modificador). */
  recordId: z.string().optional(),
})

export const xpPurchaseSchema = z.object({
  id: z.string(),
  /** Id do item na tabela de custos (`xpCosts`). */
  itemId: z.string(),
  /** Nome livre do gasto (ex.: "Perícia: Furtividade"). */
  label: z.string(),
  /** Detalhe do cálculo (ex.: "Nível 2 · 4 × 2"). */
  detail: z.string().default(''),
  cost: z.number().int().min(0),
  /** Compras antigas (importadas) eram só recibos e não têm efeito. */
  effect: xpEffectSchema.optional(),
})

export type XpPurchase = z.infer<typeof xpPurchaseSchema>
export type XpEffect = z.infer<typeof xpEffectSchema>

export function xpCostItem(itemId: string): XpCostDef | undefined {
  return xpCosts.find((item) => item.id === itemId)
}

/** Custo do item para um nível/quantidade. */
export function xpItemCost(item: XpCostDef | undefined, level = 1): number {
  if (!item) return 0
  if (item.perLevel) return (item.unitCost ?? 0) * Math.max(1, level)
  return item.fixedCost ?? 0
}

export function xpItemNeedsLevel(item: XpCostDef | undefined): boolean {
  return Boolean(item?.perLevel)
}

export function createXpPurchase(
  itemId: string,
  level = 1,
  label?: string,
): XpPurchase | null {
  const item = xpCostItem(itemId)
  if (!item) return null
  const cost = xpItemCost(item, level)
  return {
    id: crypto.randomUUID(),
    itemId,
    label: label?.trim() || item.name,
    detail: item.perLevel ? `Nível ${Math.max(1, level)} · ${item.cost}` : item.cost,
    cost,
  }
}

export function totalXpSpent(purchases: readonly XpPurchase[]): number {
  return purchases.reduce((sum, purchase) => sum + purchase.cost, 0)
}

export function remainingXp(
  purchases: readonly XpPurchase[],
  pool: number = XP_POOL,
): number {
  return pool - totalXpSpent(purchases)
}

/** XP livre: pool inicial + XP recebida em jogo − gasto registrado. */
export function xpAvailable(
  purchases: readonly XpPurchase[],
  earned = 0,
  pool: number = XP_POOL,
): number {
  return remainingXp(purchases, pool + Math.max(0, earned))
}
