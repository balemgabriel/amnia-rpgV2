import { derivedStats } from './amnia'
import type { Character } from './character'
import { equipmentModifiers } from './equipment'
import { compile, type FormulaScope } from './formula'

/**
 * Monta o escopo das fórmulas a partir dos atributos do personagem.
 * `atributoChave` vale o atributo escolhido para conjurar (0 se ainda não houver).
 */
export function buildScope(character: Character): FormulaScope {
  const { attributes, keyAttribute } = character
  return {
    forca: attributes.forca,
    destreza: attributes.destreza,
    carisma: attributes.carisma,
    inteligencia: attributes.inteligencia,
    vontade: attributes.vontade,
    atributoChave: keyAttribute ? attributes[keyAttribute] : 0,
  }
}

export interface DerivedValue {
  id: string
  name: string
  formula: string
  /** Valor calculado apenas pela fórmula. */
  base: number
  /** Soma dos modificadores (traços, vantagens, métodos…). */
  modifiers: number
  /** base + modifiers. */
  value: number
  unit?: string
  note?: string
  sources: { source: string; value: number }[]
}

const compiled = new Map<string, (scope: FormulaScope) => number>()

function evaluate(formula: string, scope: FormulaScope): number {
  let fn = compiled.get(formula)
  if (!fn) {
    fn = compile(formula)
    compiled.set(formula, fn)
  }
  return fn(scope)
}

/** Calcula todos os stats derivados da ficha. */
export function computeDerived(character: Character): DerivedValue[] {
  const scope = buildScope(character)
  // Itens equipados somam como modificadores (PM, Limiar, Deslocamento…); desequipar remove.
  const equipped = equipmentModifiers(character.inventory ?? [])

  return derivedStats.map((stat) => {
    const base = evaluate(stat.formula, scope)
    const sources = [...character.modifiers, ...equipped].filter(
      (modifier) => modifier.statId === stat.id,
    )
    const modifiers = sources.reduce((sum, modifier) => sum + modifier.value, 0)

    return {
      id: stat.id,
      name: stat.name,
      formula: stat.formula,
      base,
      modifiers,
      value: base + modifiers,
      unit: stat.unit,
      note: stat.note,
      sources: sources.map(({ source, value }) => ({ source, value })),
    }
  })
}

export function derivedById(character: Character): Record<string, DerivedValue> {
  return Object.fromEntries(computeDerived(character).map((stat) => [stat.id, stat]))
}
