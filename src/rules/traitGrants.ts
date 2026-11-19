import { runeCircleLabels, skills } from './amnia'
import type { Character } from './character'
import type { RuneCircleId } from './data'
import { runeName } from './runes'

/**
 * Concessões mecânicas de traços raciais.
 *
 * Alguns traços não só descrevem um efeito: eles entregam especializações
 * e/ou runas de graça. A ficha e o criador usam estes dados para:
 *
 *  - somar especializações gratuitas ao limite da criação;
 *  - somar runas gratuitas ao limite 3 + INT;
 *  - mostrar na carta do traço o que ele concede;
 *  - registrar automaticamente as runas específicas concedidas.
 *
 * Runas condicionais (ex.: fase lunar Minguante) aparecem como aviso, mas não
 * entram no limite porque a ficha ainda não guarda a escolha da condição.
 */

export interface SpecializationGrant {
  /** Quantas especializações o traço concede. */
  count: number
  /** Perícias permitidas; vazio/ausente significa qualquer perícia. */
  skillIds?: readonly string[]
  /** Nomes sugeridos quando a concessão já define a especialização. */
  names?: readonly string[]
  /** Restrição ou observação em texto livre. */
  note?: string
}

export interface RuneGrant {
  /** Quantas runas o traço concede. */
  count: number
  /** Runas específicas entregues automaticamente. */
  runeIds?: readonly string[]
  /** Círculos dos quais o jogador escolhe a runa. */
  circles?: readonly RuneCircleId[]
  /** Restrição ou observação em texto livre. */
  note?: string
  /** A concessão depende de uma escolha ainda não registrada na ficha. */
  conditional?: boolean
}

export interface TraitGrants {
  specializations: readonly SpecializationGrant[]
  runes: readonly RuneGrant[]
}

export interface ActiveSpecializationGrant extends SpecializationGrant {
  traitId: string
}

export interface ActiveRuneGrant extends RuneGrant {
  traitId: string
}

const NO_GRANTS: TraitGrants = { specializations: [], runes: [] }

const TRAIT_GRANTS: Record<string, TraitGrants> = {
  // Humanos
  'conhecimento-vasto': {
    specializations: [{ count: 2 }],
    runes: [],
  },
  'tocado-pela-lua': {
    specializations: [],
    runes: [
      {
        count: 2,
        circles: ['ilusao'],
        note: 'fase Minguante',
        conditional: true,
      },
    ],
  },
  'tocado-pelo-aigaam': {
    specializations: [],
    runes: [
      {
        count: 2,
        circles: ['ilusao'],
        note: 'fase Minguante',
        conditional: true,
      },
    ],
  },

  // Berglavi
  'artesao-nato': {
    specializations: [
      { count: 1, skillIds: ['oficios'], note: 'para um tipo de item' },
    ],
    runes: [],
  },
  'sentido-de-tremor': {
    specializations: [],
    runes: [{ count: 1, runeIds: ['elemento-terra'] }],
  },

  // Golshoy
  'erudicao-do-nomade': {
    specializations: [
      { count: 2, skillIds: ['sobrevivencia', 'erudicao'], note: 'uma em cada' },
    ],
    runes: [],
  },
  'caminho-tempestade': {
    specializations: [{ count: 1, skillIds: ['arcanismo'], names: ['Raio'] }],
    runes: [{ count: 1, runeIds: ['elemento-raio'] }],
  },
  'caminho-nevasca': {
    specializations: [{ count: 1, skillIds: ['arcanismo'], names: ['Gelo'] }],
    runes: [{ count: 1, runeIds: ['elemento-gelo'] }],
  },
  'caminho-terremoto': {
    specializations: [{ count: 1, skillIds: ['arcanismo'], names: ['Terra'] }],
    runes: [{ count: 1, runeIds: ['elemento-terra'] }],
  },
  'caminho-enchente': {
    specializations: [{ count: 1, skillIds: ['arcanismo'], names: ['Água'] }],
    runes: [{ count: 1, runeIds: ['elemento-agua'] }],
  },
  'caminho-queimada': {
    specializations: [{ count: 1, skillIds: ['arcanismo'], names: ['Fogo'] }],
    runes: [{ count: 1, runeIds: ['elemento-fogo'] }],
  },

  // Corvianos
  'conexao-funebre': {
    specializations: [],
    runes: [{ count: 1, runeIds: ['projecao-alma'] }],
  },
  dualidade: {
    specializations: [
      {
        count: 1,
        skillIds: ['investigacao', 'percepcao', 'persuasao', 'introspeccao'],
        note: 'Kalik: Investigação ou Percepção; Kadin: Persuasão ou Introspecção',
      },
    ],
    runes: [],
  },

  // Skaraeb
  'sangue-das-profundezas': {
    specializations: [{ count: 1, skillIds: ['fortitude'] }],
    runes: [],
  },
  'construtor-instintivo': {
    specializations: [{ count: 1, skillIds: ['oficios'] }],
    runes: [],
  },
  'armas-naturais': {
    specializations: [
      { count: 1, skillIds: ['briga'], names: ['Armas Naturais'] },
    ],
    runes: [],
  },

  // Lirizatl
  'mestre-da-camuflagem': {
    specializations: [],
    runes: [{ count: 1, runeIds: ['ilusao-camaleao'] }],
  },
  'aprendiz-do-pantano': {
    specializations: [
      { count: 3, note: 'de sua escolha, exceto combate direto' },
    ],
    runes: [],
  },

  // Orcs
  'coracao-do-intensificador': {
    specializations: [],
    runes: [{ count: 1, circles: ['reforco'], note: 'à escolha' }],
  },

  // Troll
  'maldicao-de-uchitell': {
    specializations: [{ count: 1, note: 'voltada à sua obsessão' }],
    runes: [],
  },
}

/** Concessões declaradas para um traço (ou lista vazia). */
export function traitGrants(traitId: string): TraitGrants {
  return TRAIT_GRANTS[traitId] ?? NO_GRANTS
}

/** Concessões de especialização dos traços selecionados. */
export function specializationGrants(
  traitIds: readonly string[],
): ActiveSpecializationGrant[] {
  return traitIds.flatMap((traitId) =>
    traitGrants(traitId).specializations.map((grant) => ({ ...grant, traitId })),
  )
}

/** Concessões de runa dos traços selecionados. */
export function runeGrants(traitIds: readonly string[]): ActiveRuneGrant[] {
  return traitIds.flatMap((traitId) =>
    traitGrants(traitId).runes.map((grant) => ({ ...grant, traitId })),
  )
}

/** Total de especializações gratuitas concedidas pelos traços. */
export function traitSpecializationSlots(traitIds: readonly string[]): number {
  return specializationGrants(traitIds).reduce((sum, grant) => sum + grant.count, 0)
}

/** Total de runas gratuitas concedidas pelos traços (ignora condicionais). */
export function traitRuneSlots(traitIds: readonly string[]): number {
  return runeGrants(traitIds)
    .filter((grant) => !grant.conditional)
    .reduce((sum, grant) => sum + grant.count, 0)
}

/** Runas específicas que os traços entregam automaticamente. */
export function traitGrantedRuneIds(traitIds: readonly string[]): string[] {
  const ids = new Set<string>()
  for (const grant of runeGrants(traitIds)) {
    if (grant.conditional) continue
    for (const runeId of grant.runeIds ?? []) ids.add(runeId)
  }
  return [...ids]
}

function skillNames(ids: readonly string[] | undefined): string[] {
  return (ids ?? []).map((id) => skills.find((skill) => skill.id === id)?.name ?? id)
}

/** Texto curto de uma concessão de especialização. */
export function specializationGrantLabel(grant: SpecializationGrant): string {
  const names = skillNames(grant.skillIds)
  let label: string

  if (grant.count === 1) {
    if (grant.names?.length && names.length === 1) {
      label = `+1 especialização em ${names[0]} (${grant.names.join(', ')})`
    } else if (names.length === 1) {
      label = `+1 especialização em ${names[0]}`
    } else if (names.length > 1) {
      label = `+1 especialização (${names.join(' ou ')})`
    } else {
      label = '+1 especialização'
    }
  } else {
    const suffix = names.length > 0 ? ` (${names.join(', ')})` : ''
    label = `+${grant.count} especializações${suffix}`
  }

  return grant.note ? `${label} — ${grant.note}` : label
}

/** Texto curto de uma concessão de runa. */
export function runeGrantLabel(grant: RuneGrant): string {
  const countLabel = grant.count === 1 ? '1 runa' : `${grant.count} runas`
  let label: string

  if (grant.runeIds?.length) {
    label = `+${countLabel}: ${grant.runeIds.map(runeName).join(', ')}`
  } else if (grant.circles?.length) {
    const circles = grant.circles.map((circle) => runeCircleLabels[circle]).join(' ou ')
    label = `+${countLabel} de ${circles}`
  } else {
    label = `+${countLabel}`
  }

  if (grant.note) label += ` (${grant.note})`
  if (grant.conditional) label += ' — condicional'
  return label
}

/** Todas as concessões de um traço, já formatadas para exibição. */
export function traitGrantNotes(traitId: string): string[] {
  const grants = traitGrants(traitId)
  return [
    ...grants.specializations.map(specializationGrantLabel),
    ...grants.runes.map(runeGrantLabel),
  ]
}

/**
 * Sincroniza `knownRunes` com as runas específicas concedidas pelos traços.
 *
 *  - toda runa específica concedida entra em `knownRunes`;
 *  - ela também entra em `autoGrantedRunes` e fica travada enquanto o traço
 *    existir (o jogador não consegue desmarcá-la);
 *  - ao remover o traço, só saem as runas registradas em `autoGrantedRunes`.
 *
 * Função pura: devolve o mesmo objeto quando nada muda.
 */
export function reconcileTraitRunes(character: Character): Character {
  const traitIds = [...character.ancestryTraits, ...character.negativeTraits]
  const granted = traitGrantedRuneIds(traitIds)
  const grantedSet = new Set(granted)
  const previousAuto = character.autoGrantedRunes ?? []
  const removed = new Set(previousAuto.filter((id) => !grantedSet.has(id)))
  const keptKnown = character.knownRunes.filter((id) => !removed.has(id))
  const newlyAdded = granted.filter((id) => !keptKnown.includes(id))
  const knownRunes = [...keptKnown, ...newlyAdded]
  // Mesmo que o jogador já conhecesse a runa antes do traço, ela passa a ser
  // automática: assim o limite nunca vira uma escolha livre por acidente.
  const autoGrantedRunes = knownRunes.filter((id) => grantedSet.has(id))

  const unchanged =
    removed.size === 0 &&
    newlyAdded.length === 0 &&
    autoGrantedRunes.length === previousAuto.length &&
    autoGrantedRunes.every((id, index) => id === previousAuto[index])
  if (unchanged) return character

  return { ...character, knownRunes, autoGrantedRunes }
}
