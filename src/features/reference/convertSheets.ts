import {
  advantages as catalogAdvantages,
  classes,
  lineages,
  runes,
  type AdvantageDef,
  type ClassDef,
  type Lineage,
  type Trait,
} from '@/rules/data'
import { skills as skillCatalog } from '@/rules/amnia'
import { lineageTraits } from '@/rules/lineages'
import {
  createEmptyCharacter,
  emptySkills,
  type Advantage,
  type Character,
} from '@/rules/character'
import {
  defaultLevel,
  hasUnlockingCondition,
  isLevelLocked,
  runeById,
} from '@/rules/runes'
import {
  CONDITION_WEIGHTS,
  isExponencializar,
  type ConditionWeight,
  type Spell,
  type SpellCondition,
  type SpellRune,
} from '@/rules/spell'
import type { AttributeId, CircleId } from '@/rules/types'
import type { XpPurchase } from '@/rules/xp'
import rawSheets from './sheets.json'

/**
 * Converte as fichas de referência (Markdown do Notion) em fichas reais do
 * aplicativo.
 *
 * O material original é texto livre: cada ficha tem pequenas diferenças de
 * grafia, abreviações e até valores calculados à mão. A conversão usa um
 * parser tolerante + um pequeno metadado por ficha (classe, linhagem, runa
 * inata, atributo chave…). Tudo o que o app sabe calcular é recalculado pelas
 * regras; o texto que não cabe no schema (habilidades fora do catálogo) vai
 * para `notes`, sem ser perdido.
 */

export interface ReferenceSheet {
  id: string
  name: string
  concept: string
  className: string
  ancestry: string
  markdown: string
}

interface SheetMeta {
  ancestryId: string
  sublineageId: string | null
  classId: string
  classAbilityId: string
  classTalentId: string
  impulseId: string
  innateCircle: CircleId
  keyAttribute: NonNullable<Character['keyAttribute']>
  channelingMethodId: string
  channelingLevel: number
  skillDistributionId: NonNullable<Character['skillDistributionId']>
}

const META: Record<string, SheetMeta> = {
  'balatrino-balatreno': {
    ancestryId: 'saifoni',
    sublineageId: 'snegatnom',
    classId: 'mago',
    classAbilityId: 'invocacao-vinculada',
    classTalentId: 'reserva-de-mana',
    impulseId: 'erudito',
    innateCircle: 'alteracao',
    keyAttribute: 'inteligencia',
    channelingMethodId: 'gatilho',
    channelingLevel: 1,
    skillDistributionId: 'generalista',
  },
  'bell-toph-tah': {
    ancestryId: 'berglavi',
    sublineageId: 'gorvnon',
    classId: 'druida',
    classAbilityId: 'transformacao-bestial',
    classTalentId: 'selvageria-natural',
    impulseId: 'determinado',
    innateCircle: 'reforco',
    keyAttribute: 'vontade',
    channelingMethodId: 'gestual',
    channelingLevel: 2,
    skillDistributionId: 'generalista',
  },
  'fiapon-kabelin': {
    ancestryId: 'orcs',
    sublineageId: null,
    classId: 'guerreiro',
    classAbilityId: 'tecnica-especial',
    classTalentId: 'ataque-de-saque',
    impulseId: 'perfeccionista',
    innateCircle: 'projecao',
    keyAttribute: 'vontade',
    channelingMethodId: 'gestual',
    channelingLevel: 1,
    skillDistributionId: 'especialista',
  },
  'kalango-lukipher': {
    ancestryId: 'lirizatl',
    sublineageId: 'kameyotl',
    classId: 'ladino',
    classAbilityId: 'ladrao-arcano',
    classTalentId: 'nao-original',
    impulseId: 'improvisador',
    innateCircle: 'ilusao',
    keyAttribute: 'carisma',
    channelingMethodId: 'gestual',
    channelingLevel: 1,
    skillDistributionId: 'especialista',
  },
  'lokh-godh': {
    ancestryId: 'golshoy',
    sublineageId: null,
    classId: 'barbaro',
    classAbilityId: 'furia-primal',
    classTalentId: 'golpe-poderoso',
    impulseId: 'sobrevivente',
    innateCircle: 'reforco',
    keyAttribute: 'vontade',
    channelingMethodId: 'gatilho',
    channelingLevel: 1,
    skillDistributionId: 'especialista',
  },
  'o-pulga': {
    ancestryId: 'humanos',
    sublineageId: 'soltianos',
    classId: 'lutador',
    classAbilityId: 'acao-gloriosa',
    classTalentId: 'dramatico',
    impulseId: 'perfeccionista',
    innateCircle: 'reforco',
    keyAttribute: 'vontade',
    channelingMethodId: 'gatilho',
    channelingLevel: 1,
    skillDistributionId: 'generalista',
  },
  'soka-e-hi': {
    ancestryId: 'saifoni',
    sublineageId: 'tserof',
    classId: 'cacador',
    classAbilityId: 'jogo-da-caca',
    classTalentId: 'golpe-final',
    impulseId: 'perfeccionista',
    innateCircle: 'elemento',
    keyAttribute: 'carisma',
    channelingMethodId: 'gestual',
    channelingLevel: 1,
    skillDistributionId: 'especialista',
  },
}

export const referenceSheets = rawSheets as ReferenceSheet[]

/** Converte uma ficha de referência em uma ficha válida do app. */
export function convertReferenceSheet(sheet: ReferenceSheet): Character {
  const meta = META[sheet.id]
  if (!meta) throw new Error(`Sem metadados para a ficha de referência "${sheet.id}".`)

  const markdown = sheet.markdown.replace(/\r\n/g, '\n')
  const character = createEmptyCharacter()
  const now = Date.now()

  character.id = referenceRecordId(sheet.id)
  character.createdAt = now
  character.updatedAt = now

  character.name = headingValue(markdown, 'NOME') || sheet.name
  character.concept = headingValue(markdown, 'CONCEITO') || sheet.concept
  character.desire = headingValue(markdown, 'DESEJO')
  character.ambition = headingValue(markdown, 'AMBIÇÃO')

  character.ancestryId = meta.ancestryId
  character.sublineageId = meta.sublineageId
  character.attributes = parseAttributes(markdown)
  const parsedKeyAttribute = parseKeyAttribute(markdown)
  character.keyAttribute =
    parsedKeyAttribute === 'carisma' ||
    parsedKeyAttribute === 'inteligencia' ||
    parsedKeyAttribute === 'vontade'
      ? parsedKeyAttribute
      : meta.keyAttribute

  character.innateCircle = meta.innateCircle
  character.knownRunes = parseKnownRunes(markdown, meta.innateCircle)
  character.channelingMethodId = meta.channelingMethodId
  character.channelingLevel = meta.channelingLevel
  character.modifiers =
    meta.channelingMethodId === 'gatilho'
      ? [{ statId: 'limiar', value: 2, source: 'Método de Canalização: Gatilho' }]
      : []

  character.classId = meta.classId
  character.classAbilityId = meta.classAbilityId
  character.classTalentId = meta.classTalentId
  character.impulseId = meta.impulseId

  const parsedSkills = parseSkills(markdown)
  character.skillDistributionId = meta.skillDistributionId
  character.skills = parsedSkills.skills
  character.specializations = parsedSkills.specializations

  const parsedTraits = parseTraits(markdown, meta)
  character.ancestryTraits = parsedTraits.positive
  character.negativeTraits = parsedTraits.negative

  character.advantages = parseAdvantages(markdown)
  character.convictions = parseConvictions(markdown)
  character.history = parseHistory(markdown)
  character.spells = parseSpells(markdown, meta.innateCircle)
  character.xpPurchases = parseXp(markdown)
  character.notes = buildNotes(markdown, meta, parsedTraits.unmatched)

  return character
}

export function convertReferenceSheets(): Character[] {
  return referenceSheets.map(convertReferenceSheet)
}

/** Id determinístico: o registro e o `data.id` precisam ser iguais para editar. */
export function referenceRecordId(sheetId: string): string {
  return `ready-${sheetId}`
}

// ---------------------------------------------------------------------------
// Texto / seções
// ---------------------------------------------------------------------------

function linesOf(markdown: string): string[] {
  return markdown.replace(/\r\n/g, '\n').split('\n')
}

/** Texto de uma seção de nível 1/2, até o próximo título de nível 1/2. */
function sectionText(markdown: string, heading: RegExp): string {
  const lines = linesOf(markdown)
  const start = lines.findIndex((line) => heading.test(line))
  if (start < 0) return ''

  const out: string[] = []
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    if (/^#{1,2}\s+/.test(line)) break
    out.push(line)
  }
  return out.join('\n')
}

/** Valor de um `### RÓTULO; valor` (ou o primeiro parágrafo abaixo dele). */
function headingValue(markdown: string, label: string): string {
  const lines = linesOf(markdown)
  const pattern = new RegExp(`^###\\s+${label}\\s*[;:]\\s*(.*)$`, 'i')

  for (let index = 0; index < lines.length; index += 1) {
    const match = (lines[index] ?? '').match(pattern)
    if (!match) continue

    const direct = (match[1] ?? '').trim()
    if (direct) return direct

    for (let next = index + 1; next < lines.length; next += 1) {
      const line = (lines[next] ?? '').trim()
      if (!line) continue
      if (/^#{1,6}\s+/.test(line) || /^-{3,}$/.test(line)) break
      return line
    }
    return ''
  }
  return ''
}

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function normalize(value: string): string {
  return fold(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function splitTopLevel(value: string, separators: readonly string[]): string[] {
  const out: string[] = []
  let depth = 0
  let current = ''

  for (const char of value) {
    if (char === '(') depth += 1
    if (char === ')') depth = Math.max(0, depth - 1)
    if (depth === 0 && separators.includes(char)) {
      out.push(current)
      current = ''
      continue
    }
    current += char
  }
  out.push(current)
  return out.map((item) => item.trim()).filter(Boolean)
}

function stripMarkdown(value: string): string {
  return value
    .replace(/\*\*/g, '')
    .replace(/\*([^*]+)\*/g, '$1')
    .trim()
}

// ---------------------------------------------------------------------------
// Atributos
// ---------------------------------------------------------------------------

const ATTRIBUTE_NAMES: Record<string, AttributeId> = {
  forca: 'forca',
  destreza: 'destreza',
  carisma: 'carisma',
  inteligencia: 'inteligencia',
  vontade: 'vontade',
}

function parseAttributes(markdown: string): Character['attributes'] {
  const section = sectionText(markdown, /^#\s+ATRIBUTOS/i)
  const attributes = { forca: 1, destreza: 1, carisma: 1, inteligencia: 1, vontade: 1 }

  for (const line of linesOf(section)) {
    const match = line.match(/^###\s+([A-Za-zÀ-ÿ]+)\s*[-–]\s*(\d+)/)
    if (!match) continue
    const id = ATTRIBUTE_NAMES[fold(match[1] ?? '')]
    if (id) attributes[id] = Number(match[2])
  }
  return attributes
}

function parseKeyAttribute(markdown: string): AttributeId | null {
  const section = sectionText(markdown, /^#\s+ATRIBUTOS/i)
  let current: AttributeId | null = null

  for (const line of linesOf(section)) {
    const heading = line.match(/^###\s+([A-Za-zÀ-ÿ]+)\s*[-–]/)
    if (heading) {
      current = ATTRIBUTE_NAMES[fold(heading[1] ?? '')] ?? current
      continue
    }
    if (current && /\[\s*x\s*\]/i.test(line) && /atributo chave/i.test(line)) {
      return current
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Perícias
// ---------------------------------------------------------------------------

const SKILL_ALIASES: Record<string, string> = {
  luta: 'briga',
  instrospeccao: 'introspeccao',
  introspeccao: 'introspeccao',
}

const SPECIALIZATION_ALIASES: Record<string, string> = {
  desarmado: 'Combate desarmado',
  agarroes: 'Agarrões',
  'armas de arremesso': 'Arremesso',
  'briga com metamorfose': 'Briga com Metamorfose',
  rituais: 'Rituais',
  'identificar runas': 'Identificar runas',
  firulas: 'Fírulas',
}

const skillIdsByName = new Map<string, string>()
for (const skill of skillCatalog) skillIdsByName.set(normalize(skill.name), skill.id)

function skillIdOf(name: string): string | null {
  const key = normalize(name)
  return SKILL_ALIASES[key] ?? skillIdsByName.get(key) ?? null
}

function specializationName(value: string): string {
  const cleaned = stripMarkdown(value)
    .trim()
    .replace(/^especializa[cç][aã]o\s*[-–:]?\s*/i, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[.,;:]+$/, '')
    .trim()
  return SPECIALIZATION_ALIASES[normalize(cleaned)] ?? cleaned
}

function parseSkills(markdown: string): {
  skills: Record<string, number>
  specializations: Character['specializations']
} {
  const skills = emptySkills()
  const specializations: Character['specializations'] = []
  const seen = new Set<string>()

  function addSpecialization(skillId: string, rawName: string) {
    const name = specializationName(rawName)
    if (!name) return
    const key = `${skillId}|${normalize(name)}`
    if (seen.has(key)) return
    seen.add(key)
    specializations.push({ id: crypto.randomUUID(), skillId, name })
  }

  const section = sectionText(markdown, /^##\s+Per[ií]cias/i)

  for (const rawLine of linesOf(section)) {
    const line = rawLine.trim()
    if (!line || /^-{3,}$/.test(line)) continue

    const match = line.match(/^(\d)\s*[-–]?\s*(.+)$/)
    if (!match) continue

    const level = Number(match[1])
    const list = match[2] ?? ''

    for (const item of splitTopLevel(list, [','])) {
      const cleaned = item.replace(/[.]+$/, '').trim()
      if (!cleaned) continue

      const base = cleaned.split('(')[0]?.replace(/\s*[-–]\s*$/, '').trim() ?? ''
      const skillId = skillIdOf(base)
      if (!skillId) continue

      skills[skillId] = level

      for (const paren of cleaned.matchAll(/\(([^)]*)\)/g)) {
        for (const spec of splitTopLevel(paren[1] ?? '', [','])) {
          addSpecialization(skillId, spec)
        }
      }
    }
  }

  const specSection = sectionText(markdown, /^##\s+Especializa[cç][oõ]es/i)

  for (const rawLine of linesOf(specSection)) {
    const line = rawLine.trim().replace(/^[-*]\s*/, '')
    if (!line || /^-{3,}$/.test(line)) continue

    for (const item of splitTopLevel(line, [','])) {
      const cleaned = item.trim()
      if (!cleaned) continue

      const dash = cleaned.match(/^([^(–-]+?)\s*[-–]\s*(.+)$/)
      if (dash) {
        const skillId = skillIdOf(dash[1] ?? '')
        if (skillId) addSpecialization(skillId, dash[2] ?? '')
        continue
      }

      const paren = cleaned.match(/^([^(]+)\(([^)]*)\)$/)
      if (paren) {
        const skillId = skillIdOf(paren[1] ?? '')
        if (!skillId) continue
        for (const spec of splitTopLevel(paren[2] ?? '', [','])) {
          addSpecialization(skillId, spec)
        }
      }
    }
  }

  return { skills, specializations }
}

// ---------------------------------------------------------------------------
// Runas conhecidas
// ---------------------------------------------------------------------------

const RUNE_ALIASES: Record<string, string> = {
  ocultacao: 'ilusao-ocultar',
  sacrificio: 'reforco-sacrificio',
  repeticao: 'multiplicacao-repeticao',
  exponencializar: 'multiplicacao-exponencializar',
  elementia: 'elemento-elementia',
  camaleao: 'ilusao-camaleao',
  sonora: 'ilusao-sonora',
  espaco: 'alteracao-espaco',
  criacao: 'alteracao-criacao',
  condensar: 'projecao-condensar',
  focal: 'projecao-focal',
  alma: 'projecao-alma',
  aura: 'projecao-aura',
  externalizar: 'projecao-externalizar',
  forca: 'reforco-forca',
  resistencia: 'reforco-resistencia',
  velocidade: 'reforco-velocidade',
  potencia: 'reforco-potencia',
  peso: 'alteracao-peso',
  envelopar: 'alteracao-envelopar',
  natureza: 'elemento-natureza',
  terra: 'elemento-terra',
  fogo: 'elemento-fogo',
  raio: 'elemento-raio',
  metamorfose: 'miscelanea-metamorfose',
  cura: 'miscelanea-cura',
  ocultar: 'ilusao-ocultar',
}

function findRuneId(name: string, innateCircle: CircleId, hint = ''): string | null {
  const key = normalize(name)
  const candidates = runes.filter((rune) => normalize(rune.name) === key)

  if (candidates.length === 0) {
    const alias = RUNE_ALIASES[key]
    return alias && runes.some((rune) => rune.id === alias) ? alias : null
  }
  if (candidates.length === 1) return candidates[0]?.id ?? null

  const hinted = candidates.find(
    (rune) => hint.includes(rune.circle) || hint.includes(rune.circle.slice(0, 4)),
  )
  if (hinted) return hinted.id

  const innate = candidates.find((rune) => rune.circle === innateCircle)
  return innate?.id ?? candidates[0]?.id ?? null
}

function parseKnownRunes(markdown: string, innateCircle: CircleId): string[] {
  const section = sectionText(markdown, /^##\s+Runas\s+Conhecidas/i)
  const text = section.replace(/\n+/g, ' ').trim()
  if (!text) return []

  const result: string[] = []

  for (const rawItem of splitTopLevel(text, [','])) {
    let item = rawItem.replace(/[.]+$/, '').trim()
    if (!item) continue

    item = item
      .replace(/[-–]\s*\d+\s*xp/gi, '')
      .replace(/\(\s*[-–]?\s*\d+\s*xp\s*\)/gi, '')
      .trim()

    let hint = ''
    const paren = item.match(/\(([^)]*)\)/)
    if (paren) {
      hint = fold(paren[1] ?? '')
      item = item.replace(/\([^)]*\)/g, '').trim()
    }

    // "Elemento - Terra" / "Reforço - Força": a primeira palavra é a Esfera.
    const dash = item.match(/^(.+?)\s*[-–]\s*(.+)$/)
    if (dash) {
      const prefix = fold(dash[1] ?? '')
      const circlePrefixes = [
        'elemento',
        'reforco',
        'alteracao',
        'ilusao',
        'projecao',
        'multiplicacao',
        'miscelanea',
        'misc',
      ]
      if (circlePrefixes.some((prefixName) => prefix.includes(prefixName))) {
        item = (dash[2] ?? '').trim()
      }
    }

    item = item.replace(/^[-–\s]+|[-–\s]+$/g, '').trim()
    if (!item) continue

    const runeId = findRuneId(item, innateCircle, hint)
    if (runeId && !result.includes(runeId)) result.push(runeId)
  }

  return result
}

// ---------------------------------------------------------------------------
// Traços raciais
// ---------------------------------------------------------------------------

const TRAIT_ALIASES: Record<string, string> = {
  'sentido do tremor': 'sentido-de-tremor',
  'fortitude belgravi': 'fortitude-berglavi',
  'perna curta': 'perna-curta',
  'coracao da forja': 'coracao-da-forja',
  'magia pessoal': 'magia-pessoal',
  'agilidade elfica': 'agilidade-elfica',
  'visao elfica': 'visao-elfica',
  fragil: 'fragil',
  'coracao do intensificador': 'coracao-do-intensificador',
  'guerreiro nato': 'guerreiro-nato',
  'teimosia ogro': 'teimosia-de-ogro',
  'forca acima de tudo': 'forca-acima-de-tudo',
  'sangue do pantano': 'sangue-do-pantano',
  'humor inabalavel': 'humor-inabalavel',
  'mestre da camuflagem': 'mestre-da-camuflagem',
  'parede ambulante': 'parede-ambulante',
  'corpo gigante': 'corpo-gigante',
  'saude de gigante': 'saude-de-gigante',
  'passos pesados': 'passos-pesados',
  'impeto solar': 'impeto-solar',
  resiliencia: 'resiliencia',
  'conhecimento vasto': 'conhecimento-vasto',
  'falta de confianca': 'falta-de-confianca',
  'odio de eniahc': 'odio-de-eniahc',
  'vida isolada': 'vida-isolada',
}

function traitNameOf(line: string): string {
  let text = stripMarkdown(line.replace(/^\s*[-*]\s*/, ''))

  text = text.replace(/^\(\s*[+-]?\s*\d+\s*\)\s*[-–]?\s*/, '')
  text = text.replace(/^[+-]?\d+\s*[-–]?\s*/, '')
  text = text.replace(/^[-–]\s*/, '')

  let name = text.split(/[:;,]| [-–] /)[0] ?? text
  name = name.replace(/\s*[+-]\d+.*$/, '')
  return name.replace(/[.,;:]+$/, '').trim()
}

function parseTraits(
  markdown: string,
  meta: SheetMeta,
): { positive: string[]; negative: string[]; unmatched: string[] } {
  const lineage: Lineage | undefined = lineages.find((item) => item.id === meta.ancestryId)
  const allTraits: Trait[] = lineageTraits(lineage ?? null)

  const byName = new Map<string, Trait>()
  for (const trait of allTraits) byName.set(normalize(trait.name), trait)
  for (const [alias, id] of Object.entries(TRAIT_ALIASES)) {
    const trait = allTraits.find((item) => item.id === id)
    if (trait) byName.set(alias, trait)
  }

  const positive: string[] = []
  const negative: string[] = []
  const unmatched: string[] = []
  const section = sectionText(markdown, /^##\s+Tra[cç]os\s+Raciais/i)

  for (const rawLine of linesOf(section)) {
    const line = rawLine.trim()
    if (!line || /^-{3,}$/.test(line) || /^[-*]$/.test(line)) continue

    // Golshoy: "Caminho da Vida: Queimada, Runa de fogo" resolve para a opção
    // do caminho pelo nome do fenômeno.
    const pathOption = lineage?.path?.options.find((option) =>
      normalize(line).includes(normalize(option.name)),
    )
    if (pathOption) {
      if (!positive.includes(pathOption.id)) positive.push(pathOption.id)
      continue
    }

    const name = traitNameOf(line)
    if (!name) continue

    const trait = byName.get(normalize(name))
    if (!trait) {
      unmatched.push(stripMarkdown(line.replace(/^\s*[-*]\s*/, '')))
      continue
    }

    if (trait.cost < 0) {
      if (!negative.includes(trait.id)) negative.push(trait.id)
    } else if (!positive.includes(trait.id)) {
      positive.push(trait.id)
    }
  }

  return { positive, negative, unmatched }
}

// ---------------------------------------------------------------------------
// Vantagens & desvantagens
// ---------------------------------------------------------------------------

const ADVANTAGE_ALIASES: Record<string, string> = {
  'fama regional': 'fama',
  fama: 'fama',
  contato: 'contato',
  'refugio movel': 'refugio-movel',
  'dependencia elemental': 'dependencia-ambiental-elemento',
}

function resolveAdvantage(name: string, circles: number): AdvantageDef | undefined {
  const key = normalize(name)
  const alias = ADVANTAGE_ALIASES[key]

  if (alias === 'fama' || alias === 'contato') {
    const base = alias
    const suffix = Math.max(1, Math.min(base === 'fama' ? 5 : 3, circles))
    return catalogAdvantages.find((item) => item.id === `${base}-${suffix}`)
  }
  if (alias) {
    const found = catalogAdvantages.find((item) => item.id === alias)
    if (found) return found
  }

  const exact = catalogAdvantages.filter((item) => normalize(item.name) === key)
  if (exact.length === 0) return undefined

  if (circles > 0 && exact.length > 1) {
    const base = exact[0]?.id.replace(/-\d+$/, '') ?? ''
    const byPoints = catalogAdvantages.find((item) => item.id === `${base}-${circles}`)
    if (byPoints) return byPoints
  }

  return exact[0]
}

function parseAdvantageLine(
  rawLine: string,
): { name: string; circles: number; text: string } | null {
  const text = stripMarkdown(rawLine.replace(/^\s*[-*]\s*/, ''))
  const circles = (text.match(/○/g) ?? []).length
  if (circles === 0) return null

  const withoutCircles = text.replace(/○/g, ' ').replace(/\s+/g, ' ').trim()
  const beforeColon = withoutCircles.split(/[:;]/)[0] ?? ''
  let candidate = beforeColon
    .replace(/^[-–—,.\s]+|[-–—,.\s]+$/g, '')
    .replace(/^[+-]?\d+\s*[-–]?\s*/, '')
    .split(',')[0]
    ?.trim() ?? ''

  if (!candidate || /^[\d\s+-]*$/.test(candidate)) {
    const afterColon = withoutCircles.split(/[:;]/).slice(1).join(' ').trim()
    candidate = afterColon.split(/[.,;]/)[0]?.trim() ?? ''
  }

  if (!candidate || /mestre reconhecido/i.test(withoutCircles)) {
    candidate = 'Fama regional'
  }

  return { name: candidate, circles, text: withoutCircles }
}

function parseAdvantages(markdown: string): Advantage[] {
  const result: Advantage[] = []
  const seen = new Set<string>()
  const sections = [
    sectionText(markdown, /^##\s+Vantagens/i),
    sectionText(markdown, /^##\s+Habilidades\s*&\s*Talentos/i),
  ]

  for (const section of sections) {
    for (const rawLine of linesOf(section)) {
      const parsed = parseAdvantageLine(rawLine)
      if (!parsed) continue

      const def = resolveAdvantage(parsed.name, parsed.circles)
      if (!def) continue

      const key = `${def.id}|${parsed.circles}`
      if (seen.has(key)) continue
      seen.add(key)

      result.push({
        id: crypto.randomUUID(),
        sourceId: def.id,
        name: def.name,
        kind: def.kind === 'desvantagem' ? 'desvantagem' : 'vantagem',
        points: Math.max(1, parsed.circles || def.points),
        description: def.description,
      })
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Convicções, pilares e histórico
// ---------------------------------------------------------------------------

function parseConvictions(markdown: string): string[] {
  const section = sectionText(markdown, /^##\s+Convic[cç][oõ]es/i)
  const values: string[] = []

  for (const rawLine of linesOf(section)) {
    const line = stripMarkdown(rawLine.replace(/^\s*[-*]\s*/, '')).trim()
    if (!line || /^-{3,}$/.test(line)) continue
    values.push(line)
    if (values.length === 3) break
  }
  return values
}

function parseHistory(markdown: string): string {
  const section = sectionText(markdown, /^#{1,2}\s+Hist[oó]ria/i)
  return linesOf(section)
    .map((line) => stripMarkdown(line.replace(/^\s*[-*]\s*/, '')).trim())
    .filter(Boolean)
    .join('\n\n')
}

// ---------------------------------------------------------------------------
// XP
// ---------------------------------------------------------------------------

function makeXpPurchase(cost: number, label: string): XpPurchase {
  const key = normalize(label)
  let itemId = 'runa-inata'

  if (key.includes('talento')) itemId = 'talento-classe'
  else if (key.includes('runa') || key.includes('ocult')) {
    itemId =
      cost === 9
        ? 'runa-oposta'
        : cost === 8
          ? 'runa-paralela'
          : cost === 7
            ? 'runa-adjacente'
            : 'runa-inata'
  } else if (key.includes('canaliza')) {
    itemId = cost >= 8 ? 'canalizacao-2' : 'canalizacao-1'
  } else if (key.includes('pericia')) itemId = 'pericia'
  else if (key.includes('atributo')) itemId = 'atributo'
  else if (key.includes('especializa')) itemId = 'especializacao'
  else if (cost === 6) itemId = 'talento-classe'
  else if (cost === 7) itemId = 'runa-adjacente'
  else if (cost === 3) itemId = 'especializacao'
  else if (cost === 4) itemId = 'ponto-extra'

  return {
    id: crypto.randomUUID(),
    itemId,
    label: label.trim() || 'Gasto de XP',
    detail: `${cost} XP`,
    cost,
  }
}

function parseXp(markdown: string): XpPurchase[] {
  const experienceLine = linesOf(markdown).find((line) => /EXPERI[ÊE]NCIA/i.test(line))

  if (experienceLine) {
    const purchases: XpPurchase[] = []
    for (const match of experienceLine.matchAll(
      /[-–]\s*(\d+)\s*xp\s*(?:\(([^)]*)\))?/gi,
    )) {
      const cost = Number(match[1])
      const label = (match[2] ?? '').trim()
      purchases.push(makeXpPurchase(cost, label))
    }
    if (purchases.length > 0) return purchases
  }

  const purchases: XpPurchase[] = []
  const runeSection = sectionText(markdown, /^##\s+Runas\s+Conhecidas/i)

  for (const item of splitTopLevel(runeSection.replace(/\n+/g, ' '), [','])) {
    const tag = item.match(/(?:[-–]\s*(\d+)\s*xp|\(\s*[-–]?\s*(\d+)\s*xp\s*\))/i)
    if (!tag) continue

    const cost = Number(tag[1] ?? tag[2])
    const name = item
      .replace(/\([^)]*\)/g, '')
      .replace(/[-–]\s*\d+\s*xp/gi, '')
      .replace(/[.,;]/g, '')
      .trim()

    purchases.push(makeXpPurchase(cost, `Runa: ${name}`))
  }

  return purchases
}

// ---------------------------------------------------------------------------
// Magias
// ---------------------------------------------------------------------------

const RUNE_TOKEN =
  /([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’\-]*(?:\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’\-]*)*)\s*(\d+)?\s*(?:\(\s*([+-]?\s*\d+(?:\s*[+-]\s*\d+)*)\s*\))?/g

function isPlaceholderSpell(block: string): boolean {
  const first = stripMarkdown(
    (block.split('\n')[0] ?? '').replace(/^#{1,6}\s*/, '').replace(/^[-*]\s*/, ''),
  ).trim()
  return /^Magia\s+\d+\s*[-–]/i.test(first) && /Custo\s*PM/i.test(block)
}

function spellNameOf(block: string): string {
  const firstLine = block.split('\n')[0] ?? ''
  let name = stripMarkdown(firstLine.replace(/^#{1,6}\s*/, '').replace(/^[-*]\s*/, '')).trim()

  const costIndex = name.search(/\s*[-–—,]?\s*(?:Custo\s*)?\d+\s*(?:PM|Cx)/i)
  if (costIndex > 0) name = name.slice(0, costIndex)

  name = name.replace(/^Técnica Especial\s*[-–]\s*/i, '')
  name = name.replace(/[-–—,;\s]+$/, '').trim()
  return name || 'Magia'
}

function spellEffectOf(block: string): string {
  const lines = linesOf(block)
  const start = lines.findIndex((line) => /Efeitos?\s*[:;]/i.test(line))
  if (start < 0) return ''

  const first = (lines[start] ?? '').replace(/^.*?Efeitos?\s*[:;]\s*/i, '').trim()
  const rest = lines
    .slice(start + 1)
    .map((line) => stripMarkdown(line.replace(/^\s*[-*]\s*/, '')).trim())
    .filter((line) => line && !/^-{3,}$/.test(line))

  return stripMarkdown([first, ...rest].join(' ').replace(/\s+/g, ' ')).trim()
}

function spellDurationOf(block: string): Spell['duration'] {
  const line = linesOf(block).find((item) => /Dura[cç][aã]o\s*[;:]/i.test(item))
  if (!line) return 'instant'

  const text = fold(line.split(/[;:]/).slice(1).join(':')).trim()
  if (!text || /^-?$/.test(text) || text.includes('instant')) return 'instant'
  if (text.includes('permanent')) return 'permanent'
  if (text.includes('hora') || text.includes('dia')) return 'long'
  return 'short'
}

function spellTargetsOf(block: string): {
  targets: Spell['targets']
  targetDescription: string
} {
  const line = linesOf(block).find((item) => /Alvos?\s*[;:]/i.test(item))
  if (!line) return { targets: 'single', targetDescription: '' }

  const text = stripMarkdown(line.replace(/^.*?Alvos?\s*[;:]\s*/i, '')).trim()
  if (!text || /^-+$/.test(text)) return { targets: 'single', targetDescription: '' }
  if (/multid|v[aá]rios|v[aá]rias|grupo/i.test(text)) {
    return { targets: 'group', targetDescription: text }
  }
  if (/3\s*alvos|tr[eê]s\s*alvos/i.test(text)) {
    return { targets: 'three', targetDescription: text }
  }
  return { targets: 'single', targetDescription: text }
}

function spellCirclesHint(block: string): string {
  const line = linesOf(block).find((item) => /C[ií]rculos?\s*[;:]/i.test(item))
  return fold(line ?? '')
}

function parseSpellRunes(block: string, innateCircle: CircleId): SpellRune[] {
  const line = linesOf(block).find((item) => /Runas?\s*[:;]/i.test(item))
  if (!line) return []

  const text = (line.replace(/^.*?Runas?\s*[:;]\s*/i, '').split('=')[0] ?? '').trim()
  if (!text) return []

  const hint = spellCirclesHint(block)
  const result: SpellRune[] = []

  for (const match of text.matchAll(RUNE_TOKEN)) {
    const name = (match[1] ?? '').trim()
    if (!name) continue

    const runeId = findRuneId(name, innateCircle, hint)
    if (!runeId) continue

    // "7 (3+4)" = efeito total 7, sendo 3 pagos e 4 vindos de condições.
    // O nível que conta no custo é o primeiro número do parêntese.
    const basePlusBonus = match[3]?.match(/^(\d+)\s*\+\s*(\d+)$/)
    const explicitLevel = match[2] ? Number(match[2]) : undefined
    const rune = runeById(runeId)
    const candidate = basePlusBonus ? Number(basePlusBonus[1]) : explicitLevel
    const level =
      candidate && candidate >= 1 && candidate <= 7 ? candidate : defaultLevel(rune)

    result.push({ runeId, level, conditions: [], targetRuneId: null })
  }

  return result
}

function lineMentionsRune(line: string, runeId: string): boolean {
  const rune = runeById(runeId)
  if (!rune) return false

  const key = normalize(line)
  if (key.includes(normalize(rune.name))) return true
  if (runeId === 'ilusao-ocultar' && key.includes('ocultacao')) return true
  return false
}

function spellConditionsOf(block: string, runes: SpellRune[]): SpellCondition[] {
  const lines = linesOf(block)
  const effectIndex = lines.findIndex((line) => /Efeitos?\s*[:;]/i.test(line))
  const conditionLines = effectIndex >= 0 ? lines.slice(0, effectIndex) : lines
  const conditions: SpellCondition[] = []

  for (const rawLine of conditionLines) {
    const line = rawLine.trim()
    if (!line) continue

    const match = line.match(
      /\b(Leve|Moderada|Severa|Extrema|Absoluta)\b\s*([+-]\s*\d+)?\s*(PM|N[íi]vel|N[íi]veis)?/i,
    )
    if (!match) continue

    const weight = fold(match[1] ?? '') as ConditionWeight
    if (!CONDITION_WEIGHTS.includes(weight)) continue

    const hasPmDiscount = /[-–]\s*\d+\s*PM/i.test(line) || /\bPM\b/i.test(match[3] ?? '')
    const mode =
      weight === 'severa' || weight === 'extrema'
        ? hasPmDiscount
          ? 'pm'
          : 'levels'
        : weight === 'absoluta'
          ? hasPmDiscount
            ? 'pm'
            : 'cx'
          : weight === 'moderada'
            ? 'levels'
            : undefined

    let text = line
      .replace(/^\s*[-*]\s*/, '')
      .replace(
        /^.*?\b(?:Leve|Moderada|Severa|Extrema|Absoluta)\b\s*[:;,]?\s*[+-]?\s*\d*\s*(?:PM|N[íi]vel|N[íi]veis)?\s*[:;,]?\s*/i,
        '',
      )
      .trim()

    for (const rune of runes) {
      const runeName = runeById(rune.runeId)?.name
      if (!runeName) continue
      const pattern = new RegExp(`^${escapeRegExp(runeName)}\\s*[:;,]?\\s*`, 'i')
      text = text.replace(pattern, '')
    }

    conditions.push({
      id: crypto.randomUUID(),
      weight,
      text: stripMarkdown(text) || 'Condição',
      ...(mode ? { mode } : {}),
    })

    const exponential = runes.find((rune) => isExponencializar(rune.runeId))
    const owner =
      exponential ??
      runes.find((rune) => lineMentionsRune(line, rune.runeId)) ??
      runes[0]
    if (owner) owner.conditions.push(conditions[conditions.length - 1] as SpellCondition)
  }

  return conditions
}

/**
 * Níveis 6 e 7 exigem uma condição Severa/Extrema/Absoluta vinculada À PRÓPRIA
 * runa.
 *
 * Em algumas fichas a condição pesada aparece no bloco da magia sem citar a
 * runa (ex.: "Severa +2 nível: …"). Nesse caso o parser a vincula à primeira
 * runa; se outra runa foi escrita em nível 6–7, a condição é justamente a que
 * destravou esse nível. Movemos a condição (em vez de copiar, o que contaria
 * Cx duas vezes) para a runa que precisa dela.
 */
function ensureHeavyConditionsForHighLevels(runes: SpellRune[]): void {
  for (const rune of runes) {
    if (!isLevelLocked(rune.level, rune.conditions)) continue

    const donor = runes.find(
      (item) =>
        item !== rune &&
        !isLevelLocked(item.level, item.conditions) &&
        hasUnlockingCondition(item.conditions),
    )
    const heavy = donor?.conditions.find((condition) =>
      hasUnlockingCondition([condition]),
    )

    if (donor && heavy) {
      donor.conditions = donor.conditions.filter(
        (condition) => condition.id !== heavy.id,
      )
      rune.conditions.push(heavy)
      continue
    }

    // Sem doador: todas as condições pesadas já pertencem a runas de nível
    // alto. Cada runa 6–7 precisa da sua, então copiamos uma delas.
    const source = runes
      .flatMap((item) => item.conditions)
      .find((condition) => hasUnlockingCondition([condition]))
    if (source) rune.conditions.push({ ...source, id: crypto.randomUUID() })
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parseSpellBlock(block: string, innateCircle: CircleId): Spell | null {
  // Alguns rótulos vêm em **negrito** ("**Runas**: …"). Normalizar antes de
  // interpretar evita que o markdown quebre a leitura de campos e efeitos.
  const clean = block.replace(/\*\*/g, '').replace(/\*/g, '')

  if (isPlaceholderSpell(clean)) return null

  const runes = parseSpellRunes(clean, innateCircle)
  if (runes.length === 0) return null

  spellConditionsOf(clean, runes)

  // Exponencializar suprime o circuito: só ela e uma runa alvo permanecem.
  // As condições pertencem a ela (é ela que concentra a mana e libera a alvo).
  const exponential = runes.find((rune) => isExponencializar(rune.runeId))
  if (exponential) {
    const target = runes.find((rune) => !isExponencializar(rune.runeId))
    exponential.targetRuneId = target?.runeId ?? null
    const kept = runes.filter((rune) => rune === exponential || rune === target)
    runes.length = 0
    runes.push(...kept)
  }

  ensureHeavyConditionsForHighLevels(runes)

  const costMatch = clean.match(/(?:Custo\s*)?(\d+)\s*PM/i)
  const cxMatch = clean.match(/Cx\s*(\d+)/i)
  const originalCost = costMatch?.[1] ?? '?'
  const originalCx = cxMatch?.[1] ?? '?'
  const { targets, targetDescription } = spellTargetsOf(clean)
  const now = Date.now()

  return {
    id: crypto.randomUUID(),
    name: spellNameOf(clean),
    effect: spellEffectOf(clean),
    runes,
    targets,
    duration: spellDurationOf(clean),
    area: 'none',
    range: '',
    targetDescription,
    personal: /Magia\s+Pessoal/i.test(clean),
    notes: `Custo original: ${originalCost} PM · Cx ${originalCx}`,
    createdAt: now,
    updatedAt: now,
  }
}

function parseSpells(markdown: string, innateCircle: CircleId): Spell[] {
  const section = sectionText(markdown, /^#{1,3}\s+Magias\s*$/i)
  if (!section) return []

  const blocks: string[] = []
  let current: string[] | null = null

  for (const line of linesOf(section)) {
    if (/^###\s+/.test(line) || /^-\s+/.test(line)) {
      if (current) blocks.push(current.join('\n'))
      current = [line]
      continue
    }
    if (current) current.push(line)
  }
  if (current) blocks.push(current.join('\n'))

  return blocks
    .map((block) => parseSpellBlock(block, innateCircle))
    .filter((spell): spell is Spell => spell !== null)
}

// ---------------------------------------------------------------------------
// Notas
// ---------------------------------------------------------------------------

function classDefOf(meta: SheetMeta): ClassDef | undefined {
  return classes.find((item) => item.id === meta.classId)
}

function parseUnmatchedAbilities(markdown: string, meta: SheetMeta): string[] {
  const section = sectionText(markdown, /^##\s+Habilidades\s*&\s*Talentos/i)
  const classDef = classDefOf(meta)
  const matched = new Set<string>()

  const abilityName = classDef?.coreAbilities.find(
    (ability) => ability.id === meta.classAbilityId,
  )?.name
  const talentName = classDef?.talents.find((talent) => talent.id === meta.classTalentId)?.name
  if (abilityName) matched.add(normalize(abilityName))
  if (talentName) matched.add(normalize(talentName))

  const entries: string[] = []
  let current: string[] | null = null

  function flush() {
    if (!current) return
    const text = stripMarkdown(current.join(' ').replace(/\s+/g, ' ')).trim()
    if (text) entries.push(text)
    current = null
  }

  for (const rawLine of linesOf(section)) {
    const line = rawLine.trim()
    if (!line || /^-{3,}$/.test(line)) {
      flush()
      continue
    }

    if (/^[-*]\s+/.test(rawLine) && !/^\s{2,}/.test(rawLine)) {
      flush()
      current = [line.replace(/^[-*]\s+/, '')]
    } else if (current) {
      current.push(line)
    } else {
      current = [line]
    }
  }
  flush()

  return entries.filter((entry) => {
    const name = stripMarkdown(entry).split(/[:;]| [-–] /)[0]?.trim() ?? ''
    if (matched.has(normalize(name))) return false
    if (/○/.test(entry)) return false
    return true
  })
}

function buildNotes(markdown: string, meta: SheetMeta, unmatchedTraits: string[]): string {
  const parts: string[] = [
    'Ficha convertida do material original. Os valores derivados são recalculados pelas regras do app.',
  ]

  const abilities = parseUnmatchedAbilities(markdown, meta)
  if (abilities.length > 0) {
    parts.push('Habilidades & Talentos (texto original):')
    for (const ability of abilities) parts.push(`- ${ability}`)
  }

  if (unmatchedTraits.length > 0) {
    parts.push('Traços não mapeados:')
    for (const trait of unmatchedTraits) parts.push(`- ${trait}`)
  }

  const hands = sectionText(markdown, /^##\s+Valor das M[ãa]os/i)
  if (hands.trim()) {
    parts.push('Valor das Mãos jogáveis:')
    parts.push(hands.trim())
  }

  return parts.join('\n')
}
