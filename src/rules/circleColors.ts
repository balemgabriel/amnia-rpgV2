import type { CircleId } from './types'

/** Esferas do hexágono + Miscelânea (fora do hexágono). */
export type CircleColorId = CircleId | 'miscelanea'

/**
 * Cores de outline das Esferas, definidas pelo usuário.
 * Usadas nos vértices do hexágono, nos seletores de Esfera e nas runas.
 */
export const circlePalette: Record<CircleColorId, string> = {
  reforco: '#9A1717',
  projecao: '#284620',
  ilusao: '#792F91',
  elemento: '#B6461D',
  alteracao: '#175D9A',
  multiplicacao: '#D09217',
  miscelanea: '#4E4E56',
}

/** Cor de uma Esfera (aceita também 'miscelanea'); `null` se desconhecida. */
export function circleColor(id?: string | null): string | null {
  if (!id) return null
  return (circlePalette as Record<string, string>)[id] ?? null
}
