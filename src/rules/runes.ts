import { runes, type RuneCircleId, type RuneDef } from './data'

/**
 * Regras de runas, separadas em dois momentos:
 *
 *  1. ACESSO (criação do personagem): o jogador escolhe QUAIS runas conhece.
 *     É só uma lista de ids (`knownRunes`), sem nível.
 *  2. NÍVEL (criação de magias): ao jogar uma runa numa magia, o nível
 *     escolhido é quanto PM aquele efeito custa. Níveis 6 e 7 só destravam
 *     com uma condição Severa, Extrema ou Absoluta vinculada À PRÓPRIA runa.
 *
 * Nada aqui conhece React nem zod.
 */

export const RUNE_LEVELS = [1, 2, 3, 4, 5, 6, 7] as const

/** Maior nível liberado sem condição. */
export const FREE_LEVEL_MAX = 5

/** Pesos de condição que destravam os níveis 6 e 7. */
export const UNLOCK_WEIGHTS = ['severa', 'extrema', 'absoluta'] as const

const byId = new Map<string, RuneDef>(runes.map((rune) => [rune.id, rune]))

export function runeById(id: string): RuneDef | undefined {
  return byId.get(id)
}

export function runeName(id: string): string {
  return byId.get(id)?.name ?? id
}

/** Esfera da runa; ids fora do catálogo caem em Miscelânea (sem modificador). */
export function runeCircleOf(id: string): RuneCircleId {
  return byId.get(id)?.circle ?? 'miscelanea'
}

/** Procura o id do catálogo por id antigo ou, em último caso, pelo nome. */
export function resolveRuneId(sourceId: unknown, name: unknown): string | null {
  if (typeof sourceId === 'string' && byId.has(sourceId)) return sourceId
  if (typeof name === 'string') {
    const wanted = name.trim().toLowerCase()
    const match = runes.find((rune) => rune.name.trim().toLowerCase() === wanted)
    if (match) return match.id
  }
  return null
}

// ---------------------------------------------------------------------------
// Acesso (tela 1)
// ---------------------------------------------------------------------------

/**
 * Alterna o acesso a uma runa. Devolve a MESMA lista (mesma referência)
 * quando nada muda, para o chamador poder ignorar a atualização.
 *
 * - Runa já conhecida: sempre pode ser removida.
 * - Runa nova: só entra se houver espaço (limite 3 + INT) e se existir no catálogo.
 */
export function toggleKnownRune(
  known: readonly string[],
  runeId: string,
  allowance: number,
): string[] {
  if (known.includes(runeId)) return known.filter((id) => id !== runeId)
  if (!byId.has(runeId)) return known as string[]
  if (known.length >= allowance) return known as string[]
  return [...known, runeId]
}

// ---------------------------------------------------------------------------
// Nível e trava (tela 2)
// ---------------------------------------------------------------------------

/** A runa tem efeito cadastrado neste nível? (algumas começam no 2, 3 ou 4) */
export function isLevelDefined(rune: RuneDef | undefined, level: number): boolean {
  if (!rune) return true
  return rune.levels.some((item) => item.level === level)
}

export function levelEffect(rune: RuneDef | undefined, level: number): string | undefined {
  return rune?.levels.find((item) => item.level === level)?.effect
}

/** Existe condição Severa, Extrema ou Absoluta NESTA lista de condições? */
export function hasUnlockingCondition(conditions: readonly { weight: string }[]): boolean {
  return conditions.some((condition) =>
    (UNLOCK_WEIGHTS as readonly string[]).includes(condition.weight),
  )
}

/** Níveis 6 e 7 ficam bloqueados enquanto a runa não tiver condição pesada. */
export function isLevelLocked(
  level: number,
  conditions: readonly { weight: string }[],
): boolean {
  return level > FREE_LEVEL_MAX && !hasUnlockingCondition(conditions)
}

/** Menor nível com efeito cadastrado dentre os livres (padrão ao jogar a runa). */
export function defaultLevel(rune: RuneDef | undefined): number {
  const free = RUNE_LEVELS.filter(
    (level) => level <= FREE_LEVEL_MAX && isLevelDefined(rune, level),
  )
  return free[0] ?? 1
}

/**
 * Se o nível ficou bloqueado (a condição pesada foi removida), recua para o
 * maior nível livre que a runa tem.
 */
export function clampLevelToUnlocked(
  level: number,
  conditions: readonly { weight: string }[],
  rune: RuneDef | undefined,
): number {
  if (!isLevelLocked(level, conditions)) return level
  const free = RUNE_LEVELS.filter(
    (item) => item <= FREE_LEVEL_MAX && isLevelDefined(rune, item),
  )
  return free[free.length - 1] ?? FREE_LEVEL_MAX
}
