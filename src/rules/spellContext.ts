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

/**
 * Contexto sem personagem, usado pela Oficina de Magias.
 *
 * Sem Círculo Inato, atributo chave ou método de canalização, o custo e a
 * Complexidade mostrados são a BASE da magia. Os modificadores do personagem
 * entram quando a magia é aberta/adicionada numa ficha.
 */
export function workshopSpellContext(): SpellContext {
  return {
    innateCircle: null,
    keyAttribute: null,
    channelingMethodId: null,
    channelingLevel: 0,
    ancestryTraits: [],
    spells: [],
  }
}
