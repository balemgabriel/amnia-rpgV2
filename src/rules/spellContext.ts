import type { Character } from './character'
import type { SpellContext } from './spell'

/** Monta o contexto que o motor de magias precisa a partir da ficha salva. */
export function spellContext(character: Character): SpellContext {
  return {
    innateCircle: character.innateCircle,
    keyAttribute: character.keyAttribute,
    channelingMethodId: character.channelingMethodId,
    channelingLevel: character.channelingLevel,
    ancestryTraits: character.ancestryTraits,
    spells: character.spells,
  }
}

/** Maior nível conhecido de cada runa (chave: sourceId ?? nome). */
export function ownedMaxLevels(character: Character): Record<string, number> {
  const map: Record<string, number> = {}
  for (const rune of character.runes) {
    const key = rune.sourceId ?? rune.name
    map[key] = Math.max(map[key] ?? 0, rune.level)
  }
  return map
}
