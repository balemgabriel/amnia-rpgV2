import type { SkillGroup } from './types'

/**
 * Cor de cada grupo de perícias, usada como outline para separar visualmente
 * Físicas, Sociais e Mentais — inclusive na escolha de especializações.
 *
 *   Físicas → vermelho
 *   Sociais → verde
 *   Mentais → azul
 */
export const skillGroupPalette: Record<SkillGroup, string> = {
  fisica: '#B91C1C',
  social: '#15803D',
  mental: '#1E3A8A',
}

export function skillGroupColor(group: SkillGroup): string {
  return skillGroupPalette[group]
}
