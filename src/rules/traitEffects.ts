export interface TraitModifier {
  statId: string
  value: number
  source: string
}

/**
 * Efeitos mecânicos fixos de traços raciais/negativos que alteram stats
 * derivados. A descrição do traço continua sendo a fonte narrativa; aqui
 * ficam apenas os ajustes que a ficha precisa somar automaticamente.
 */
const TRAIT_MODIFIERS: Record<string, TraitModifier[]> = {
  'forca-acima-de-tudo': [
    { statId: 'limiar', value: -4, source: 'Traço racial: Força acima de tudo' },
  ],
}

/** Modificadores de stats derivados concedidos pelos traços selecionados. */
export function traitModifiers(traitIds: readonly string[]): TraitModifier[] {
  return traitIds.flatMap((id) => TRAIT_MODIFIERS[id] ?? [])
}
