/**
 * Tipos da Arena de Amnia.
 *
 * Este arquivo é intencionalmente livre de imports: as mesmas estruturas são
 * usadas pelo app (React) e pelo servidor da API (`server/`), então ele não
 * pode depender de `@/...`, React ou do schema da ficha.
 */

export type AmniaAttributeId =
  | 'forca'
  | 'destreza'
  | 'carisma'
  | 'inteligencia'
  | 'vontade'

/** Resultado bruto de uma rolagem de d6 empilhados. */
export interface AmniaRoll {
  dice: number[]
  successes: number
  /** Quantos pares de 6 saíram (cada par vale 4 sucessos no total). */
  criticalPairs: number
  /** Quantos pares de 1 saíram (falha crítica). */
  criticalFailures: number
}

/** Pilha de dados de um lado de um teste oposto (jogador ou Mestre/inimigo). */
export interface AmniaDicePool {
  label: string
  dice: number[]
  successes: number
  criticalPairs: number
  criticalFailures: number
}

export interface AmniaTestInput {
  /** Quantidade de dados; se omitida, o servidor calcula por perícia + atributo. */
  diceCount?: number
  /**
   * DIF situacional. Padrão 0: a dificuldade principal vem da margem de
   * sucesso e da defesa ativa. Ignorada quando há pilha do inimigo.
   */
  difficulty?: number
  difficultyReason?: string
  label: string
  /** Teste pedido pelo Mestre, ex.: "Armas brancas + Destreza". */
  test?: string
  /** Decomposição da pilha, ex.: "Armas Brancas 4 + Destreza 3 = 7d6". */
  diceBreakdown?: string
  /** Pilha de defesa do inimigo (dados do Mestre). */
  enemyDiceCount?: number
  enemyLabel?: string
}

/** Rerrolagem de Ímpeto já aplicada a um teste. */
export interface AmniaImpetoReroll {
  /** Índices 0-based dos dados rerrolados. */
  indices: number[]
  /** Valores anteriores dos dados rerrolados. */
  previousValues: number[]
  cost: number
}

export interface AmniaTestResult extends AmniaRoll {
  label: string
  /** Teste pedido, ex.: "Armas brancas + Destreza". */
  test?: string
  /** Decomposição da pilha de dados. */
  diceBreakdown?: string
  /** DIF situacional efetiva (0 em testes opostos). */
  difficulty: number
  difficultyReason?: string
  /** Sucessos a superar: DIF ou sucessos da pilha do inimigo. */
  targetSuccesses: number
  /** Margem de Sucesso: successes − targetSuccesses. */
  mos: number
  /** MoS > 0. */
  success: boolean
  /** MoS === 0. */
  partial: boolean
  /** MoS < 0. */
  failed: boolean
  /** Dados do Mestre/inimigo, quando o teste é oposto. */
  enemy?: AmniaDicePool
  /** Índices 0-based dos dados que falharam (1–3). */
  failedIndices: number[]
  /** Última rerrolagem de Ímpeto aplicada. */
  impetoReroll?: AmniaImpetoReroll
}

export type MaculaType =
  | 'reforco'
  | 'projecao'
  | 'elemental'
  | 'alteracao'
  | 'multiplicacao'
  | 'arcana'

export interface MaculaSaveInput {
  diceCount: number
  complexity: number
  maculaType: string
}

export interface MaculaSaveResult extends AmniaRoll {
  failureMargin: number
  failed: boolean
  maculaType: string
  effectSummary: string
}

export interface SpendManaInput {
  amount: number
  spellName: string
  currentPlayerMana: number
  currentThreshold: number
  maxThreshold: number
}

export interface SpendManaResult {
  newMana: number
  newThreshold: number
  overloaded: boolean
  message: string
}

export interface EnemyDamageInput {
  baseWeaponDamage: number
  mos: number
  isResilient: boolean
  isMook: boolean
}

export interface EnemyDamageResult {
  damage: number
  baseWeaponDamage: number
  effectiveBase: number
  mos: number
  isMook: boolean
  isResilient: boolean
  note: string
}

export interface AdvanceClockInput {
  clockName: string
  current: number
  max: number
  delta: number
}

export interface AdvanceClockResult {
  name: string
  previous: number
  current: number
  max: number
  completed: boolean
}

export interface SpendActionPointsInput {
  amount: number
  actionName: string
  currentPa: number
}

export interface SpendActionPointsResult {
  /** PA realmente gastos (0 se a ação foi bloqueada). */
  spent: number
  newPa: number
  /** true quando não havia PA suficiente; a ação não acontece. */
  blocked: boolean
  message: string
}

/** Tamanho sugerido de um Relógio de Ameaça por classificação. */
export type ThreatKind = 'mook' | 'fraco' | 'padrao' | 'elite' | 'lendario'

export interface ArenaResourceValue {
  current: number
  max: number
}

export interface ArenaResources {
  pv: ArenaResourceValue
  pm: ArenaResourceValue
  limiar: ArenaResourceValue
  impeto: ArenaResourceValue
  pa: ArenaResourceValue
}

export interface ArenaThreatClock {
  id: string
  name: string
  current: number
  max: number
  kind: ThreatKind
  resilient: boolean
  notes?: string
}

export interface ArenaLogEntry {
  id: string
  at: number
  kind: string
  label: string
  detail?: string
}

/** Último teste aberto, usado para a rerrolagem de Ímpeto escolhida pelo jogador. */
export interface ArenaPendingTest extends AmniaTestResult {
  id: string
  createdAt: number
}

export interface ArenaGameState {
  version: 1
  turn: number
  resources: ArenaResources
  /** Limiar atual acima do máximo. */
  overloaded: boolean
  /** Ação de supressão ativa até o próximo turno. */
  suppressed: boolean
  clocks: ArenaThreatClock[]
  log: ArenaLogEntry[]
  /** Teste recém-rolado que ainda aceita rerrolagem de Ímpeto. */
  pendingTest?: ArenaPendingTest
}

/** Valores máximos derivados da ficha (mesmas fórmulas da ficha completa). */
export interface ArenaMaxValues {
  pv: number
  pm: number
  limiar: number
  impeto: number
  pa: number
}

/**
 * Resumo da ficha enviado ao servidor e usado no system prompt.
 *
 * O servidor nunca recebe a ficha inteira: só o que o Mestre precisa narrar
 * (identidade, atributos, recursos, runas, magias e equipamento).
 */
export interface ArenaSheetSummary {
  id: string
  name: string
  concept: string
  className: string
  ancestry: string
  keyAttribute: string | null
  attributes: Record<AmniaAttributeId, number>
  max: ArenaMaxValues
  skills: { name: string; value: number }[]
  runes: { name: string; circle: string }[]
  spells: { name: string; cost: number; summary: string; effect: string }[]
  impulse: string
  convictions: string[]
  inventory: string[]
  notes: string
}

export interface ArenaChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ArenaToolResultView {
  toolName: string
  input: unknown
  output: unknown
}

export interface ArenaChatResponse {
  reply: string
  toolResults: ArenaToolResultView[]
  gameState: ArenaGameState
  model: string
}

/** Ações de mesa disparadas por botões (não pela narração). */
export type ArenaTableActionType = 'end_turn' | 'suppress'

export interface ArenaTableActionRequest {
  type: ArenaTableActionType
  /** Nonce local para o chat distinguir cliques repetidos. */
  id: number
}
