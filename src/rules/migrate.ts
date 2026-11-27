import { resolveRuneId } from './runes'

/**
 * Migra fichas salvas no formato antigo (sheetVersion ≤ 2) para o atual.
 *
 * Antes:
 *   - character.runes = [{ id, sourceId, name, circle, level }]   (acesso + nível misturados)
 *   - spell.runes     = [{ id, sourceId, name, circle, level }]
 *   - spell.conditions = [{ id, weight, description, mode, targetRuneId }]
 *
 * Agora:
 *   - character.knownRunes = ["reforco-forca", ...]                (só acesso)
 *   - spell.runes = [{ runeId, level, conditions: [{ id, weight, text, mode }] }]
 *
 * É idempotente: dados já no formato novo passam sem alteração.
 * Zero dependências de zod/React; roda antes da validação.
 *
 * Também troca os ids provisórios dos traços negativos ("lorem") pelos ids
 * finais, usando a ancestralidade da ficha para desambiguá-los.
 */

type Obj = Record<string, unknown>

const isObj = (value: unknown): value is Obj =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Ids provisórios que apareceram no material antes da revisão dos traços. */
const LEGACY_NEGATIVE_TRAIT_IDS: Record<string, Record<string, string>> = {
  orcs: { lorem: 'choque-de-fe' },
  troll: { lorem: 'pesado', 'lorem-2': 'regua-alta' },
}

function migrateNegativeTraitIds(raw: Obj): void {
  const ancestryId = typeof raw.ancestryId === 'string' ? raw.ancestryId : ''
  const remap = LEGACY_NEGATIVE_TRAIT_IDS[ancestryId]
  if (!remap || !Array.isArray(raw.negativeTraits)) return
  raw.negativeTraits = raw.negativeTraits.map((id) =>
    typeof id === 'string' ? (remap[id] ?? id) : id,
  )
}

function clampLevel(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 1
  return Math.min(7, Math.max(1, n))
}

function migrateCondition(raw: Obj): Obj {
  const text =
    typeof raw.text === 'string'
      ? raw.text
      : typeof raw.description === 'string'
        ? raw.description
        : ''
  const condition: Obj = {
    id: typeof raw.id === 'string' ? raw.id : crypto.randomUUID(),
    weight: raw.weight,
    text,
  }
  if (raw.mode !== undefined) condition.mode = raw.mode
  return condition
}

export function migrateSpell(raw: unknown): unknown {
  if (!isObj(raw)) return raw

  const oldRunes = Array.isArray(raw.runes) ? raw.runes : []
  const oldConditions = Array.isArray(raw.conditions) ? raw.conditions : []

  const runes: {
    runeId: string
    level: number
    conditions: Obj[]
    targetRuneId: string | null
  }[] = []
  /** id antigo da runa dentro da magia → posição na lista nova. */
  const positions = new Map<string, number>()

  for (const item of oldRunes) {
    if (!isObj(item)) continue
    const runeId =
      typeof item.runeId === 'string' ? item.runeId : resolveRuneId(item.sourceId, item.name)
    if (!runeId) continue

    let index = runes.findIndex((rune) => rune.runeId === runeId)
    if (index === -1) {
      runes.push({
        runeId,
        level: clampLevel(item.level),
        conditions: Array.isArray(item.conditions)
          ? item.conditions.filter(isObj).map(migrateCondition)
          : [],
        targetRuneId: typeof item.targetRuneId === 'string' ? item.targetRuneId : null,
      })
      index = runes.length - 1
    }
    if (typeof item.id === 'string') positions.set(item.id, index)
  }

  // A alvo de Exponencializar pode ter sido gravada como id de instância
  // (formato antigo) ou como id do catálogo (formato novo).
  for (const rune of runes) {
    if (!rune.targetRuneId) continue
    const mapped = positions.get(rune.targetRuneId)
    if (mapped !== undefined) {
      rune.targetRuneId = runes[mapped]?.runeId ?? null
    } else if (!runes.some((item) => item.runeId === rune.targetRuneId)) {
      rune.targetRuneId = null
    }
  }

  // Condições que viviam na magia inteira passam a morar numa runa:
  // a runa-alvo, quando havia; senão (bônus geral) a primeira runa da magia.
  for (const item of oldConditions) {
    if (!isObj(item)) continue
    const target =
      typeof item.targetRuneId === 'string' ? positions.get(item.targetRuneId) : undefined
    const rune = runes[target ?? 0]
    if (!rune) continue
    rune.conditions.push(migrateCondition(item))
  }

  const next: Obj = { ...raw }
  delete next.conditions
  next.runes = runes
  return next
}

export function migrateCharacterData(raw: unknown): unknown {
  if (!isObj(raw)) return raw

  const next: Obj = { ...raw }

  migrateNegativeTraitIds(next)

  if (!Array.isArray(next.knownRunes)) {
    const ids: string[] = []
    if (Array.isArray(raw.runes)) {
      for (const item of raw.runes) {
        if (!isObj(item)) continue
        const id = resolveRuneId(item.sourceId, item.name)
        if (id && !ids.includes(id)) ids.push(id)
      }
    }
    next.knownRunes = ids
  }
  delete next.runes

  if (Array.isArray(next.spells)) next.spells = next.spells.map(migrateSpell)

  return next
}
