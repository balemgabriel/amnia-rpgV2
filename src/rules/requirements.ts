import { attributes, channelingMethods, skills } from './amnia'
import type { Character } from './character'
import { classes } from './data'
import type { AttributeId } from './types'

/**
 * Avaliação dos pré-requisitos de talentos de classe e runas.
 *
 * O material escreve os requisitos em texto livre ("Vontade 2",
 * "Briga ou Tática 3", "Especialização em Adagas", "Requer Arcanismo 4"...).
 * Aqui traduzimos esse texto para checagens sobre a ficha atual.
 *
 * Três resultados possíveis:
 *  - `met`: a ficha cumpre o requisito.
 *  - `unmet`: a ficha não cumpre o requisito; a opção deve ser bloqueada.
 *  - `unknown`: o requisito não pode ser conferido automaticamente (ex.:
 *    "Desvio 3", que é uma ação de combate, ou "4 Níveis em Elemento -
 *    Natureza", que depende do nível de uma runa dentro de uma magia). A opção
 *    continua disponível, com o texto do requisito visível.
 */
export type RequirementStatus = 'met' | 'unmet' | 'unknown'

export interface RequirementCheck {
  /** Texto original do requisito. */
  text: string
  status: RequirementStatus
  /** Explicação curta do resultado (mostrada quando a opção está bloqueada). */
  detail: string
}

/** Normaliza acentos, caixa e espaços para comparar textos do material. */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

// ---------------------------------------------------------------------------
// Índices de nomes usados pelo material
// ---------------------------------------------------------------------------

const attributeByName = new Map<string, AttributeId>()
for (const attribute of attributes) {
  attributeByName.set(normalize(attribute.name), attribute.id)
  attributeByName.set(normalize(attribute.short), attribute.id)
  attributeByName.set(normalize(attribute.id), attribute.id)
}
// Abreviações comuns no material.
for (const [alias, id] of [
  ['for', 'forca'],
  ['des', 'destreza'],
  ['car', 'carisma'],
  ['int', 'inteligencia'],
  ['von', 'vontade'],
] as const) {
  attributeByName.set(alias, id)
}

const skillByName = new Map<string, string>()
for (const skill of skills) {
  skillByName.set(normalize(skill.name), skill.id)
  skillByName.set(normalize(skill.id), skill.id)
}
// Nomes usados no material que não batem exatamente com a lista atual.
skillByName.set('armas a distancia', 'precisao')
skillByName.set('montaria', 'conducao')

/** Nomes de Habilidades Centrais de todas as classes (ex.: "Fúria Primal"). */
const coreAbilityNames = new Map<string, string>()
for (const cls of classes) {
  for (const ability of cls.coreAbilities) {
    coreAbilityNames.set(normalize(ability.name), ability.name)
  }
}

/**
 * Sinônimos de especializações. O material usa nomes mais antigos ou
 * agrupados ("Armas leves", "Armas de Arremesso") que não são exatamente as
 * especializações sugeridas na ficha.
 */
const SPECIALIZATION_ALIASES: Record<string, string[]> = {
  'armas leves': ['adagas', 'clavas', 'armas leves'],
  'armas de arremesso': ['arremesso', 'armas de arremesso'],
  'de arremesso': ['arremesso'],
  'um tipo de armas a distancia': [
    'arcos',
    'bestas',
    'armas de fogo',
    'arremesso',
    'zarabatanas',
    'armas a distancia',
  ],
  'combate com metamorfose': ['briga com metamorfose', 'metamorfose'],
  'armas a distancia': ['arcos', 'bestas', 'armas de fogo', 'arremesso', 'zarabatanas'],
}

function attributeLabel(id: AttributeId): string {
  return attributes.find((attribute) => attribute.id === id)?.name ?? id
}

function skillLabel(id: string): string {
  return skills.find((skill) => skill.id === id)?.name ?? id
}

// ---------------------------------------------------------------------------
// Checagens
// ---------------------------------------------------------------------------

interface ClauseResult {
  status: RequirementStatus
  detail: string
}

function checkSingleClause(raw: string, character: Character): ClauseResult {
  const clause = normalize(raw)
  const match = /^(.*?)\s+(\d+)$/.exec(clause)
  const name = (match?.[1] ?? clause).trim()
  const threshold = match ? Number(match[2]) : 1

  const attributeId = attributeByName.get(name)
  if (attributeId) {
    const current = character.attributes[attributeId]
    return current >= threshold
      ? { status: 'met', detail: `${attributeLabel(attributeId)} ${current}/${threshold}` }
      : {
          status: 'unmet',
          detail: `${attributeLabel(attributeId)} ${threshold} (atual ${current})`,
        }
  }

  const skillId = skillByName.get(name)
  if (skillId) {
    const current = character.skills[skillId] ?? 0
    const label = skillLabel(skillId)
    return current >= threshold
      ? { status: 'met', detail: `${label} ${current}/${threshold}` }
      : { status: 'unmet', detail: `${label} ${threshold} (atual ${current})` }
  }

  const abilityName = coreAbilityNames.get(name)
  if (abilityName) {
    const selectedClass = classes.find((cls) => cls.id === character.classId)
    const selectedAbility = selectedClass?.coreAbilities.find(
      (ability) => ability.id === character.classAbilityId,
    )
    if (selectedAbility && normalize(selectedAbility.name) === normalize(abilityName)) {
      return { status: 'met', detail: `Habilidade Central: ${abilityName}` }
    }
    return {
      status: 'unmet',
      detail: selectedAbility
        ? `Habilidade Central ${abilityName} (selecionada: ${selectedAbility.name})`
        : `Habilidade Central ${abilityName} (nenhuma selecionada)`,
    }
  }

  return {
    status: 'unknown',
    detail: `"${raw.trim()}" não pode ser conferido automaticamente`,
  }
}

function checkSpecialization(
  text: string,
  normalized: string,
  character: Character,
): RequirementCheck {
  const targetText = normalized.replace(/^especializacao\s+(em\s+)?/, '')
  const options = targetText
    .split(/\s+ou\s+/)
    .map((option) => option.trim())
    .filter(Boolean)

  const found = character.specializations.some((specialization) => {
    const name = normalize(specialization.name)
    return options.some((option) => {
      const targets = SPECIALIZATION_ALIASES[option] ?? [option]
      return targets.some(
        (target) => name === target || name.includes(target) || target.includes(name),
      )
    })
  })

  return found
    ? { text, status: 'met', detail: `Especialização: ${targetText}` }
    : {
        text,
        status: 'unmet',
        detail: `Especialização "${targetText}" não encontrada`,
      }
}

function checkChanneling(
  text: string,
  normalized: string,
  character: Character,
): RequirementCheck {
  const match = /^canalizacao\s+([a-z]+)\s+nivel\s+(\d+)$/.exec(normalized)
  if (!match) {
    return { text, status: 'unknown', detail: 'Método de canalização não reconhecido' }
  }

  const methodName = match[1] ?? ''
  const level = Number(match[2] ?? 1)
  const method = channelingMethods.find((item) => normalize(item.name) === methodName)
  if (!method) {
    return { text, status: 'unknown', detail: `Método "${methodName}" não reconhecido` }
  }

  if (character.channelingMethodId !== method.id) {
    const current = channelingMethods.find((item) => item.id === character.channelingMethodId)
    return {
      text,
      status: 'unmet',
      detail: `Canalização ${method.name} (atual: ${current?.name ?? 'nenhum'})`,
    }
  }

  const purchased = character.xpPurchases.some(
    (purchase) => purchase.itemId === `canalizacao-${level}`,
  )
  if (character.channelingLevel >= level || purchased) {
    return { text, status: 'met', detail: `Canalização ${method.name} nível ${level}` }
  }

  return {
    text,
    status: 'unknown',
    detail: `Canalização ${method.name} nível ${level} (compre o nível 2 na tabela de XP)`,
  }
}

function checkTechnique(
  text: string,
  normalized: string,
  character: Character,
): RequirementCheck {
  const advanced = normalized === 'tecnica avancada'
  const itemId = advanced ? 'tecnica-avancada' : 'tecnica-intermediaria'
  const label = advanced ? 'Técnica Avançada' : 'Técnica Intermediária'
  const purchased = character.xpPurchases.some((purchase) => purchase.itemId === itemId)

  if (purchased) {
    return { text, status: 'met', detail: label }
  }

  return {
    text,
    status: 'unknown',
    detail: `${label} não registrada na tabela de XP`,
  }
}

function propagateTrailingThreshold(parts: string[]): string[] {
  // "Furtividade e Arcanismo 3" / "Int ou Von 2": o número final vale para as
  // duas pontas. Já "Ofícios 2 e Sobrevivência" mantém o 1 implícito na
  // segunda, porque o número está na primeira.
  const withThresholds = [...parts]
  const last = withThresholds[withThresholds.length - 1] ?? ''
  const lastNumber = /(?:^|\s)(\d+)$/.exec(last)?.[1]
  if (lastNumber) {
    for (let index = 0; index < withThresholds.length - 1; index += 1) {
      const part = withThresholds[index] ?? ''
      if (!/\s\d+$/.test(part)) withThresholds[index] = `${part} ${lastNumber}`
    }
  }
  return withThresholds
}

function combineAnd(text: string, parts: string[], character: Character): RequirementCheck {
  const results = propagateTrailingThreshold(parts).map((part) =>
    checkSingleClause(part, character),
  )
  const unmet = results.filter((result) => result.status === 'unmet')
  if (unmet.length > 0) {
    return { text, status: 'unmet', detail: unmet.map((result) => result.detail).join(' e ') }
  }

  const unknown = results.filter((result) => result.status === 'unknown')
  if (unknown.length > 0) {
    return { text, status: 'unknown', detail: unknown.map((result) => result.detail).join(' e ') }
  }

  return { text, status: 'met', detail: results.map((result) => result.detail).join(' e ') }
}

function combineOr(text: string, parts: string[], character: Character): RequirementCheck {
  const results = propagateTrailingThreshold(parts).map((part) =>
    checkSingleClause(part, character),
  )
  const met = results.filter((result) => result.status === 'met')
  if (met.length > 0) {
    return { text, status: 'met', detail: met.map((result) => result.detail).join(' ou ') }
  }

  const unknown = results.filter((result) => result.status === 'unknown')
  if (unknown.length > 0) {
    return { text, status: 'unknown', detail: unknown.map((result) => result.detail).join(' ou ') }
  }

  return { text, status: 'unmet', detail: results.map((result) => result.detail).join(' ou ') }
}

/**
 * Confere um requisito em texto livre contra a ficha atual.
 *
 * Requisitos vazios são considerados cumpridos. Requisitos que o app não
 * consegue mapear para um dado da ficha voltam como `unknown` e NÃO devem
 * bloquear a opção.
 */
export function checkRequirement(
  requirement: string | null | undefined,
  character: Character,
): RequirementCheck {
  const text = requirement?.trim() ?? ''
  if (!text) return { text: '', status: 'met', detail: '' }

  const normalized = normalize(text).replace(/^requer\s+/, '')

  if (normalized.startsWith('especializacao')) {
    return checkSpecialization(text, normalized, character)
  }

  if (normalized === 'circulo elemental inato') {
    const ok = character.innateCircle === 'elemento'
    return {
      text,
      status: ok ? 'met' : 'unmet',
      detail: ok
        ? 'Círculo Inato: Elemento'
        : `Círculo Inato Elemento (atual: ${character.innateCircle ?? 'nenhum'})`,
    }
  }

  // "4 Níveis em Elemento - Natureza": depende do nível da runa nas magias.
  if (normalized.includes('niveis em elemento')) {
    return {
      text,
      status: 'unknown',
      detail: 'Depende do nível da runa Elemento - Natureza nas magias',
    }
  }

  if (normalized.startsWith('canalizacao')) {
    return checkChanneling(text, normalized, character)
  }

  if (normalized === 'tecnica intermediaria' || normalized === 'tecnica avancada') {
    return checkTechnique(text, normalized, character)
  }

  // "Desvio" é uma ação/manobra, não uma perícia da ficha.
  if (normalized.startsWith('desvio ')) {
    return {
      text,
      status: 'unknown',
      detail: 'Desvio é uma ação de combate; confira manualmente',
    }
  }

  if (coreAbilityNames.has(normalized)) {
    const result = checkSingleClause(normalized, character)
    return { text, status: result.status, detail: result.detail }
  }

  const orParts = normalized.split(/\s+ou\s+/)
  if (orParts.length > 1) return combineOr(text, orParts, character)

  const andParts = normalized.split(/\s+e\s+/)
  if (andParts.length > 1) return combineAnd(text, andParts, character)

  const result = checkSingleClause(normalized, character)
  return { text, status: result.status, detail: result.detail }
}

/** Atalho para saber se a opção deve ficar bloqueada. */
export function isRequirementUnmet(
  requirement: string | null | undefined,
  character: Character,
): boolean {
  return checkRequirement(requirement, character).status === 'unmet'
}
