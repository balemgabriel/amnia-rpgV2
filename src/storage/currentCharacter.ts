import { characterSchema, type Character } from '@/rules/character'

/**
 * Ficha "ativa" para a Arena de Amnia.
 *
 * A ficha continua morando no IndexedDB (`characters`); aqui guardamos apenas
 * uma cópia leve no localStorage para a Arena conseguir abrir sem consultar o
 * banco. É o mesmo personagem, no mesmo dispositivo — nada vai para servidor.
 */
export const CURRENT_CHARACTER_KEY = 'amnia_ficha_atual'

/** Marca que a ficha atual foi criada só para visualizar o design da Arena. */
export const CURRENT_CHARACTER_DEMO_KEY = 'amnia_ficha_atual_demo'

export interface CurrentCharacter {
  character: Character
  demo: boolean
}

/**
 * Publica a ficha aberta/salva como a ficha atual da Arena.
 * Falhas de quota (foto grande, modo privado) não podem quebrar o salvamento
 * principal, que já aconteceu no IndexedDB.
 */
export function publishCurrentCharacter(
  character: Character,
  options: { demo?: boolean } = {},
): void {
  function write(value: Character): boolean {
    try {
      window.localStorage.setItem(CURRENT_CHARACTER_KEY, JSON.stringify(value))
      return true
    } catch {
      return false
    }
  }

  // Retrato em data URL pode estourar a quota do localStorage. A Arena não
  // precisa da foto para funcionar, então tentamos de novo sem ela.
  if (!write(character) && character.portrait) {
    if (!write({ ...character, portrait: '' })) return
  } else if (!window.localStorage.getItem(CURRENT_CHARACTER_KEY)) {
    return
  }

  try {
    if (options.demo) {
      window.localStorage.setItem(CURRENT_CHARACTER_DEMO_KEY, '1')
    } else {
      window.localStorage.removeItem(CURRENT_CHARACTER_DEMO_KEY)
    }
  } catch {
    // A ficha já foi publicada; a marca de demonstração é só um detalhe visual.
  }
}

/** Lê e valida a ficha atual. Formato antigo é migrado pelo próprio schema. */
export function readCurrentCharacter(): CurrentCharacter | null {
  try {
    const raw = window.localStorage.getItem(CURRENT_CHARACTER_KEY)
    if (!raw) return null
    const parsed = characterSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return null
    return {
      character: parsed.data,
      demo: window.localStorage.getItem(CURRENT_CHARACTER_DEMO_KEY) === '1',
    }
  } catch {
    return null
  }
}
