import { createGameState, normalizeGameState } from '@/lib/amnia/rules'
import type { ArenaGameState, ArenaMaxValues } from '@/lib/amnia/types'

/**
 * Estado da mesa por personagem.
 *
 * A ficha em si continua em `amnia_ficha_atual`; aqui fica só o que a sessão
 * mudou (PV, PM, Limiar, relógios, turno). Um mesmo dispositivo pode ter várias
 * fichas, então o registro é indexado pelo id do personagem.
 */
export const ARENA_STATE_KEY = 'amnia_arena_estado'

type ArenaStateStore = Record<string, ArenaGameState>

function readStore(): ArenaStateStore {
  try {
    const raw = window.localStorage.getItem(ARENA_STATE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    return parsed !== null && typeof parsed === 'object' ? (parsed as ArenaStateStore) : {}
  } catch {
    return {}
  }
}

export function readArenaState(characterId: string, max: ArenaMaxValues): ArenaGameState {
  const store = readStore()
  const saved = store[characterId]
  // Primeira visita: começa com PV/PM/Ímpeto/PA cheios e Limiar zerado.
  if (!saved) return createGameState(max)
  return normalizeGameState(saved, max)
}

export function writeArenaState(characterId: string, state: ArenaGameState): void {
  try {
    const store = readStore()
    store[characterId] = state
    window.localStorage.setItem(ARENA_STATE_KEY, JSON.stringify(store))
  } catch {
    // Quota cheia ou modo privado: a mesa continua funcionando em memória.
  }
}

export function clearArenaState(characterId: string): void {
  try {
    const store = readStore()
    delete store[characterId]
    window.localStorage.setItem(ARENA_STATE_KEY, JSON.stringify(store))
  } catch {
    // Sem persistência: o estado em memória ainda pode ser reiniciado.
  }
}
