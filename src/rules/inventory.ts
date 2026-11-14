import { z } from 'zod'

/**
 * Um item do inventário da ficha. Guarda só o que o jogador escolheu; nome,
 * preço e efeitos vêm do catálogo (data/equipment.json) pelo `itemId`.
 */
export const inventoryItemSchema = z.object({
  id: z.string(),
  /** Id do item no catálogo de equipamentos. */
  itemId: z.string(),
  /** Só itens empilháveis (poções, munições, kits) passam de 1. */
  quantity: z.number().int().min(1).default(1),
  quality: z.enum(['comum', 'boa', 'obra-prima', 'lendaria']).default('comum'),
  /** Armas: o bônus de qualidade vira +Nd6 na perícia OU +N de dano. */
  qualityBonus: z.enum(['dice', 'damage']).default('dice'),
  /** Modificadores comprados, como "armadura:pesada" (os que já vêm no item não entram aqui). */
  mods: z.array(z.string()).default([]),
  /** Ids de encantamentos aplicados. */
  enchants: z.array(z.string()).default([]),
  /** Escolhas do jogador (ex.: perícia do Gibão, tipo de dano do Revestimento). */
  choices: z.record(z.string(), z.string()).default({}),
  equipped: z.boolean().default(false),
  /** Total pago em Zg, para poder devolver o item. */
  paid: z.number().min(0).default(0),
  /** Aliados: dias de salário já pagos. */
  days: z.number().int().min(1).optional(),
})

export type InventoryItem = z.infer<typeof inventoryItemSchema>
