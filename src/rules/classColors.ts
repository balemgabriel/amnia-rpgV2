/**
 * Cores das classes, usadas como outline na escolha de classe e no cabeçalho
 * da ficha. A cor indica a família da classe:
 *
 *   Combate .... vermelho (Guerreiro, Bárbaro, Lutador)
 *   Arte ....... laranja  (Bardo, Artesão)
 *   Selvagem ... verde    (Caçador, Ginete, Ladino, Druida)
 *   Arcano ..... azul     (Mago, Feiticeiro)
 *   WIP ........ cinza    (Clérigo, Ocultista, Alquimista, Artista)
 */
export const classPalette = {
  combate: '#B91C1C',
  arte: '#B6461D',
  selvagem: '#15803D',
  arcano: '#1E3A8A',
  wip: '#6B7280',
} as const

const CLASS_FAMILY: Record<string, keyof typeof classPalette> = {
  guerreiro: 'combate',
  barbaro: 'combate',
  lutador: 'combate',

  bardo: 'arte',
  artesao: 'arte',

  cacador: 'selvagem',
  ginete: 'selvagem',
  ladino: 'selvagem',
  druida: 'selvagem',

  mago: 'arcano',
  feiticeiro: 'arcano',

  clerigo: 'wip',
  ocultista: 'wip',
  alquimista: 'wip',
  artista: 'wip',
}

/** Classes ainda em construção no material. */
const WIP_CLASSES = new Set(['clerigo', 'ocultista', 'alquimista', 'artista'])

export function classTone(id?: string | null): string | null {
  if (!id) return null
  const family = CLASS_FAMILY[id]
  return family ? classPalette[family] : null
}

export function classIsWip(id?: string | null): boolean {
  return id ? WIP_CLASSES.has(id) : false
}

/**
 * Cores das habilidades centrais: cada opção recebe um outline próprio para
 * não se confundir com as outras, mesmo dentro da mesma classe.
 */
export const coreAbilityPalette = [
  '#9A1717',
  '#B6461D',
  '#D09217',
  '#284620',
  '#175D9A',
  '#792F91',
] as const

export function coreAbilityTone(index: number): string {
  return coreAbilityPalette[index % coreAbilityPalette.length] ?? coreAbilityPalette[0]
}
