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

export const xpPurchaseSchema = z.object({
  id: z.string(),
  /** Id do item na tabela de custos (`xpCosts`). */
  itemId: z.string(),
  /** Nome livre do gasto (ex.: "Perícia: Furtividade"). */
  label: z.string(),
  /** Detalhe do cálculo (ex.: "Nível 2 · 4 × 2"). */
  detail: z.string().default(''),
  cost: z.number().int().min(0),
})

export type XpPurchase = z.infer<typeof xpPurchaseSchema>

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
