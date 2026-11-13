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
