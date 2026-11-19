import {
  countSuccesses,
  failedDiceIndices,
  IMPETO_REROLL_COST,
  MAX_DICE,
  MAX_IMPETO_REROLL,
  rerollFailedDice,
  type RandomSource,
} from './dice'
import type {
  AdvanceClockInput,
  AdvanceClockResult,
  AmniaAttributeId,
  ArenaGameState,
  ArenaLogEntry,
  ArenaMaxValues,
  ArenaPendingTest,
  ArenaResourceValue,
  ArenaResources,
  ArenaSheetSummary,
  ArenaThreatClock,
  EnemyDamageInput,
  EnemyDamageResult,
  SpendActionPointsInput,
  SpendActionPointsResult,
  SpendManaInput,
  SpendManaResult,
  ThreatKind,
} from './types'

/**
 * Regras de mesa da Arena.
 *
 * Tudo aqui é função pura (ou recebe e devolve uma cópia do estado): o mesmo
 * código roda no navegador e no servidor da API. A IA nunca calcula nada — ela
 * só chama as ferramentas que usam estas funções.
 */

export const ARENA_STATE_VERSION = 1 as const
const MAX_LOG_ENTRIES = 30

export const THREAT_KINDS: ThreatKind[] = ['mook', 'fraco', 'padrao', 'elite', 'lendario']

export const THREAT_LABELS: Record<ThreatKind, string> = {
  mook: 'Mook',
  fraco: 'Fraco',
  padrao: 'Padrão',
  elite: 'Elite / Sobrenatural',
  lendario: 'Lendário',
}

/** Segmentos de Relógio de Ameaça por classificação. */
export function threatClockSize(kind: ThreatKind): number {
  switch (kind) {
    case 'mook':
      return 1
    case 'fraco':
      return 4
    case 'padrao':
      return 6
    case 'elite':
      return 8
    case 'lendario':
      return 12
    default:
      return 6
  }
}

export function isThreatKind(value: unknown): value is ThreatKind {
  return typeof value === 'string' && (THREAT_KINDS as string[]).includes(value)
}

// ---------------------------------------------------------
// Estado inicial / normalização
// ---------------------------------------------------------

export function createGameState(max: ArenaMaxValues): ArenaGameState {
  const resources: ArenaResources = {
    pv: { current: max.pv, max: max.pv },
    pm: { current: max.pm, max: max.pm },
    // A carga arcana começa em zero: o Limiar sobe ao gastar PM.
    limiar: { current: 0, max: max.limiar },
    impeto: { current: max.impeto, max: max.impeto },
    pa: { current: max.pa, max: max.pa },
  }

  return {
    version: ARENA_STATE_VERSION,
    turn: 1,
    resources,
    overloaded: false,
    suppressed: false,
    clocks: [],
    log: [],
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asInt(value: unknown, fallback: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(asNumber(value, fallback))))
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function normalizeResource(
  value: unknown,
  fallbackMax: number,
  roomAboveMax = 0,
  /** Valor usado quando `current` está ausente; por padrão, o máximo. */
  fallbackCurrent?: number,
): ArenaResourceValue {
  const record = asRecord(value)
  const max = asInt(record.max, fallbackMax, 0, 99)
  const current = asInt(record.current, fallbackCurrent ?? max, 0, max + roomAboveMax)
  return { current, max }
}

function normalizeClock(value: unknown, index: number): ArenaThreatClock | null {
  const record = asRecord(value)
  if (Object.keys(record).length === 0) return null

  const kind = isThreatKind(record.kind) ? record.kind : 'padrao'
  const max = asInt(record.max, threatClockSize(kind), 1, 20)
  const notes = typeof record.notes === 'string' && record.notes.trim() ? record.notes : undefined

  return {
    id: asString(record.id) || `clock-${index + 1}`,
    name: asString(record.name) || `Ameaça ${index + 1}`,
    current: asInt(record.current, 0, 0, max),
    max,
    kind,
    resilient: record.resilient === true,
    ...(notes ? { notes } : {}),
  }
}

function normalizeLog(value: unknown): ArenaLogEntry[] {
  if (!Array.isArray(value)) return []

  const entries: ArenaLogEntry[] = []
  for (const raw of value.slice(-MAX_LOG_ENTRIES)) {
    const record = asRecord(raw)
    const label = asString(record.label)
    if (!label) continue
    entries.push({
      id: asString(record.id) || `log-${entries.length + 1}`,
      at: asInt(record.at, Date.now(), 0, Number.MAX_SAFE_INTEGER),
      kind: asString(record.kind, 'evento'),
      label,
      ...(typeof record.detail === 'string' && record.detail ? { detail: record.detail } : {}),
    })
  }
  return entries
}

function normalizeDice(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((die): die is number => typeof die === 'number' && Number.isFinite(die))
    .map((die) => Math.min(6, Math.max(1, Math.trunc(die))))
    .slice(0, MAX_DICE)
}

/**
 * Reconstrói o teste pendente a partir do que veio do navegador.
 *
 * Sucessos e MoS são recalculados dos dados (o servidor não confia em números
 * salvos) e a pilha do inimigo é preservada intacta.
 */
function normalizePendingTest(value: unknown): ArenaPendingTest | undefined {
  const record = asRecord(value)
  const dice = normalizeDice(record.dice)
  if (dice.length === 0) return undefined

  const roll = countSuccesses(dice)
  const difficulty = asInt(record.difficulty, 0, 0, 30)
  const enemyRecord = asRecord(record.enemy)
  const enemyDice = normalizeDice(enemyRecord.dice)
  const enemyRoll = enemyDice.length > 0 ? countSuccesses(enemyDice) : null
  const targetSuccesses = enemyRoll ? enemyRoll.successes : difficulty
  const mos = roll.successes - targetSuccesses

  const rerollRecord = asRecord(record.impetoReroll)
  const rerollIndices = Array.isArray(rerollRecord.indices)
    ? rerollRecord.indices
        .filter((index): index is number => typeof index === 'number' && Number.isFinite(index))
        .map((index) => Math.trunc(index))
        .filter((index) => index >= 0 && index < dice.length)
        .slice(0, MAX_IMPETO_REROLL)
    : []
  const previousValues = Array.isArray(rerollRecord.previousValues)
    ? rerollRecord.previousValues
        .filter((die): die is number => typeof die === 'number' && Number.isFinite(die))
        .map((die) => Math.min(6, Math.max(1, Math.trunc(die))))
        .slice(0, MAX_IMPETO_REROLL)
    : []

  const test = asString(record.test).trim()
  const breakdown = asString(record.diceBreakdown).trim()
  const reason = asString(record.difficultyReason).trim()

  return {
    id: asString(record.id).trim() || `test-${Date.now()}`,
    createdAt: asInt(record.createdAt, Date.now(), 0, Number.MAX_SAFE_INTEGER),
    label: asString(record.label).trim() || test || 'Teste',
    ...(test ? { test } : {}),
    ...(breakdown ? { diceBreakdown: breakdown } : {}),
    ...roll,
    difficulty: enemyRoll ? 0 : difficulty,
    ...(reason && !enemyRoll ? { difficultyReason: reason } : {}),
    targetSuccesses,
    mos,
    success: mos > 0,
    partial: mos === 0,
    failed: mos < 0,
    ...(enemyRoll
      ? {
          enemy: {
            label: asString(enemyRecord.label).trim() || 'Inimigo',
            ...enemyRoll,
          },
        }
      : {}),
    failedIndices: failedDiceIndices(dice),
    ...(rerollIndices.length > 0
      ? {
          impetoReroll: {
            indices: rerollIndices,
            previousValues,
            cost: IMPETO_REROLL_COST,
          },
        }
      : {}),
  }
}

/**
 * Lê um estado salvo no navegador (ou enviado pelo cliente) e devolve um estado
 * sempre válido. Campos ausentes/inválidos voltam ao padrão da ficha.
 */
export function normalizeGameState(raw: unknown, max: ArenaMaxValues): ArenaGameState {
  const source = asRecord(raw)
  const sourceResources = asRecord(source.resources)

  const resources: ArenaResources = {
    pv: normalizeResource(sourceResources.pv, max.pv),
    pm: normalizeResource(sourceResources.pm, max.pm),
    // O Limiar pode passar do máximo (Sobrecarga), então há espaço acima.
    // Sem estado salvo ele começa em zero: a carga sobe ao gastar PM.
    limiar: normalizeResource(sourceResources.limiar, max.limiar, 99, 0),
    impeto: normalizeResource(sourceResources.impeto, max.impeto),
    pa: normalizeResource(sourceResources.pa, max.pa),
  }

  const clocks: ArenaThreatClock[] = []
  if (Array.isArray(source.clocks)) {
    source.clocks.forEach((entry, index) => {
      const clock = normalizeClock(entry, index)
      if (clock) clocks.push(clock)
    })
  }

  const pendingTest = normalizePendingTest(source.pendingTest)

  return {
    version: ARENA_STATE_VERSION,
    turn: asInt(source.turn, 1, 1, 999),
    resources,
    overloaded: resources.limiar.current > resources.limiar.max,
    suppressed: source.suppressed === true,
    clocks,
    log: normalizeLog(source.log),
    ...(pendingTest ? { pendingTest } : {}),
  }
}

function clonePendingTest(test: ArenaPendingTest): ArenaPendingTest {
  return {
    ...test,
    dice: [...test.dice],
    failedIndices: [...test.failedIndices],
    ...(test.enemy ? { enemy: { ...test.enemy, dice: [...test.enemy.dice] } } : {}),
    ...(test.impetoReroll
      ? {
          impetoReroll: {
            ...test.impetoReroll,
            indices: [...test.impetoReroll.indices],
            previousValues: [...test.impetoReroll.previousValues],
          },
        }
      : {}),
  }
}

function cloneState(state: ArenaGameState): ArenaGameState {
  return {
    ...state,
    resources: {
      pv: { ...state.resources.pv },
      pm: { ...state.resources.pm },
      limiar: { ...state.resources.limiar },
      impeto: { ...state.resources.impeto },
      pa: { ...state.resources.pa },
    },
    clocks: state.clocks.map((clock) => ({ ...clock })),
    log: [...state.log],
    ...(state.pendingTest ? { pendingTest: clonePendingTest(state.pendingTest) } : {}),
  }
}

function withLog(
  state: ArenaGameState,
  kind: string,
  label: string,
  detail?: string,
): ArenaGameState {
  const entry: ArenaLogEntry = {
    id: `log-${state.log.length + 1}-${Date.now()}`,
    at: Date.now(),
    kind,
    label,
    ...(detail ? { detail } : {}),
  }
  return { ...state, log: [...state.log, entry].slice(-MAX_LOG_ENTRIES) }
}

// ---------------------------------------------------------
// Recursos
// ---------------------------------------------------------

export type ResourceId = keyof ArenaResources

/** Registra um evento no log da mesa (usado pelas ferramentas do Mestre). */
export function appendArenaLog(
  state: ArenaGameState,
  kind: string,
  label: string,
  detail?: string,
): ArenaGameState {
  return withLog(state, kind, label, detail)
}

export type ImpetoRerollOutcome =
  | { ok: true; state: ArenaGameState; test: ArenaPendingTest; message: string }
  | { ok: false; error: string }

/**
 * Aplica a rerrolagem de Ímpeto escolhida pelo jogador.
 *
 * Regra do material: 1 ponto de Ímpeto rerrola até 2 dados falhos. O jogador
 * escolhe quais; a pilha do inimigo (dados do Mestre) não muda.
 */
export function applyImpetoReroll(
  state: ArenaGameState,
  indices: number[],
  random: RandomSource = Math.random,
): ImpetoRerollOutcome {
  const pending = state.pendingTest
  if (!pending) {
    return { ok: false, error: 'Não há teste pendente para rerrolar. Role um teste primeiro.' }
  }
  if (state.resources.impeto.current < IMPETO_REROLL_COST) {
    return { ok: false, error: 'Ímpeto insuficiente para rerrolar.' }
  }

  const allowed = new Set(pending.failedIndices)
  const chosen = [...new Set(indices.map((index) => Math.trunc(index)))]
    .filter((index) => allowed.has(index))
    .slice(0, MAX_IMPETO_REROLL)

  if (chosen.length === 0) {
    return { ok: false, error: 'Escolha ao menos um dado falho para rerrolar.' }
  }

  const rerolled = rerollFailedDice(pending, chosen, random)
  const next = cloneState(state)
  next.resources.impeto.current = Math.max(
    0,
    next.resources.impeto.current - IMPETO_REROLL_COST,
  )
  next.pendingTest = {
    ...rerolled,
    id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
  }

  const previous = rerolled.impetoReroll?.previousValues ?? []
  const nextValues = chosen.map((index) => rerolled.dice[index] ?? 0)
  const target = rerolled.enemy
    ? `defesa do Mestre (${rerolled.enemy.successes})`
    : `DIF ${rerolled.difficulty}`
  const message = [
    `Ímpeto −1 (${next.resources.impeto.current}/${next.resources.impeto.max}).`,
    `Dados ${chosen.map((index) => index + 1).join(' e ')}: [${previous.join(', ')}] → [${nextValues.join(', ')}].`,
    `${rerolled.successes} sucesso(s) vs ${target} (MoS ${rerolled.mos >= 0 ? '+' : ''}${rerolled.mos}).`,
  ].join(' ')

  return {
    ok: true,
    state: withLog(next, 'impeto', 'Rerrolagem de Ímpeto', message),
    test: next.pendingTest,
    message,
  }
}

/** Ajusta um recurso sem criar débito (PA/PM nunca ficam negativos). */
export function changeResource(
  state: ArenaGameState,
  id: ResourceId,
  delta: number,
): ArenaGameState {
  const next = cloneState(state)
  const resource = next.resources[id]
  const room = id === 'limiar' ? 99 : 0
  resource.current = Math.min(
    resource.max + room,
    Math.max(0, resource.current + Math.trunc(Number.isFinite(delta) ? delta : 0)),
  )
  next.overloaded = next.resources.limiar.current > next.resources.limiar.max
  return next
}

/**
 * Início de turno: PA e PM voltam ao máximo. O Limiar NÃO reseta e a
 * supressão termina (a mana volta a fluir).
 */
export function startTurn(state: ArenaGameState): ArenaGameState {
  const next = cloneState(state)
  next.turn = state.turn + 1
  next.resources.pa.current = next.resources.pa.max
  next.resources.pm.current = next.resources.pm.max
  next.suppressed = false
  next.overloaded = next.resources.limiar.current > next.resources.limiar.max
  // O teste pendente pertence ao turno que terminou.
  delete next.pendingTest
  return withLog(next, 'turno', `Turno ${next.turn} começou`, 'PA e PM restaurados.')
}

/**
 * Gasta PA de uma ação declarada pelo jogador.
 *
 * O Mestre chama esta ferramenta ANTES de rolar/narrar a ação. Sem PA
 * suficiente a ação é bloqueada (nada é gasto e o teste não acontece).
 */
export function spendActionPoints(input: SpendActionPointsInput): SpendActionPointsResult {
  const amount = Math.max(1, Math.trunc(Number.isFinite(input.amount) ? input.amount : 1))
  const available = Math.max(0, Math.trunc(Number.isFinite(input.currentPa) ? input.currentPa : 0))
  const blocked = amount > available
  const spent = blocked ? 0 : amount
  const newPa = available - spent

  const message = blocked
    ? `${input.actionName || 'Ação'}: PA insuficiente (${available} disponível, ${amount} necessário). A ação não acontece neste turno.`
    : `${input.actionName || 'Ação'}: gastou ${spent} PA. PA ${available} → ${newPa}.`

  return { spent, newPa, blocked, message }
}

/** Custo em PM de uma magia e o Limiar que ela adiciona. */
export function spendMana(input: SpendManaInput): SpendManaResult {
  const amount = Math.max(0, Math.trunc(Number.isFinite(input.amount) ? input.amount : 0))
  const newMana = Math.max(0, Math.trunc(input.currentPlayerMana) - amount)
  const newThreshold = Math.max(0, Math.trunc(input.currentThreshold) + amount)
  const maxThreshold = Math.max(0, Math.trunc(input.maxThreshold))
  const overloaded = newThreshold > maxThreshold

  const parts = [
    `${input.spellName || 'Magia'}: gastou ${amount} PM.`,
    `Mana ${Math.trunc(input.currentPlayerMana)} → ${newMana}.`,
    `Limiar ${Math.trunc(input.currentThreshold)} → ${newThreshold}/${maxThreshold}.`,
  ]
  if (overloaded) {
    parts.push('SOBRECARGA: o Limiar passou do máximo. Lançar magia agora exige SAVE contra Mácula.')
  }

  return { newMana, newThreshold, overloaded, message: parts.join(' ') }
}

/**
 * Ação de Supressão: resfria o Limiar em `2 + atributo chave`, zera a mana
 * disponível e impede magia até o próximo turno.
 */
export function suppressMana(state: ArenaGameState, keyAttributeValue: number): ArenaGameState {
  const next = cloneState(state)
  const cooling = 2 + Math.max(0, Math.trunc(keyAttributeValue))
  const before = next.resources.limiar.current
  next.resources.limiar.current = Math.max(0, before - cooling)
  next.resources.pm.current = 0
  next.suppressed = true
  next.overloaded = next.resources.limiar.current > next.resources.limiar.max

  return withLog(
    next,
    'supressao',
    'Supressão Arcana',
    `Limiar ${before} → ${next.resources.limiar.current} (−${cooling}). Mana cortada até o próximo turno.`,
  )
}

// ---------------------------------------------------------
// Inimigos e Relógios de Ameaça
// ---------------------------------------------------------

/**
 * Dano em segmentos contra um inimigo significativo.
 *
 * - Mook: qualquer ataque com MoS > 0 derruba (1 segmento).
 * - Resiliente: só a base da arma é dividida; a MoS entra inteira.
 * - Acerto bem-sucedido sempre causa ao menos 1 segmento.
 */
export function calculateEnemyDamage(input: EnemyDamageInput): EnemyDamageResult {
  const base = Math.max(0, Math.trunc(Number.isFinite(input.baseWeaponDamage) ? input.baseWeaponDamage : 0))
  const mos = Math.trunc(Number.isFinite(input.mos) ? input.mos : 0)
  const hit = mos > 0

  if (input.isMook) {
    const damage = hit ? 1 : 0
    return {
      damage,
      baseWeaponDamage: base,
      effectiveBase: 1,
      mos,
      isMook: true,
      isResilient: input.isResilient,
      note: hit
        ? 'Mook: qualquer ataque com MoS > 0 derruba o inimigo (1 segmento).'
        : 'Mook: o ataque não acertou (MoS ≤ 0), nenhum segmento.',
    }
  }

  const effectiveBase = input.isResilient ? Math.floor(base / 2) : base
  const damage = hit ? Math.max(1, effectiveBase + mos) : 0

  const note = hit
    ? input.isResilient
      ? `Resiliente: base ${base} ÷ 2 = ${effectiveBase}, + MoS ${mos} = ${damage} segmento(s).`
      : `Base ${effectiveBase} + MoS ${mos} = ${damage} segmento(s).`
    : 'Ataque não acertou (MoS ≤ 0): nenhum segmento.'

  return {
    damage,
    baseWeaponDamage: base,
    effectiveBase,
    mos,
    isMook: false,
    isResilient: input.isResilient,
    note,
  }
}

/** Aplica dano a um relógio já existente. */
export function applyEnemyClockDamage(
  clock: ArenaThreatClock,
  damage: number,
): ArenaThreatClock {
  const amount = Math.max(0, Math.trunc(Number.isFinite(damage) ? damage : 0))
  return {
    ...clock,
    current: Math.min(clock.max, Math.max(0, clock.current + amount)),
  }
}

export function advanceThreatClock(input: AdvanceClockInput): AdvanceClockResult {
  const max = Math.max(1, Math.trunc(Number.isFinite(input.max) ? input.max : 1))
  const previous = Math.min(max, Math.max(0, Math.trunc(input.current)))
  const delta = Math.trunc(Number.isFinite(input.delta) ? input.delta : 0)
  const current = Math.min(max, Math.max(0, previous + delta))

  return {
    name: input.clockName,
    previous,
    current,
    max,
    completed: current >= max,
  }
}

/**
 * Aplica `advance_threat_clock` no estado: cria o relógio se ele ainda não
 * existe (primeiro ataque a um inimigo novo) e persiste o avanço.
 */
export function upsertThreatClock(
  state: ArenaGameState,
  input: AdvanceClockInput,
): { state: ArenaGameState; result: AdvanceClockResult } {
  const name = input.clockName.trim() || 'Ameaça'
  const existing = state.clocks.find(
    (clock) => clock.name.toLowerCase() === name.toLowerCase(),
  )

  const result = advanceThreatClock({
    ...input,
    clockName: name,
    current: existing?.current ?? input.current,
    max: existing?.max ?? input.max,
  })

  const next = cloneState(state)
  const index = next.clocks.findIndex(
    (clock) => clock.name.toLowerCase() === name.toLowerCase(),
  )

  if (index >= 0) {
    const clock = next.clocks[index]
    if (clock) next.clocks[index] = { ...clock, current: result.current }
  } else {
    next.clocks.push({
      id: `clock-${next.clocks.length + 1}`,
      name,
      current: result.current,
      max: result.max,
      kind: 'padrao',
      resilient: false,
    })
  }

  return {
    state: withLog(
      next,
      'relogio',
      `${name}: ${result.previous} → ${result.current}/${result.max}`,
      result.completed ? 'Relógio completo.' : undefined,
    ),
    result,
  }
}

// ---------------------------------------------------------
// Mácula
// ---------------------------------------------------------

const ATTRIBUTE_IDS: AmniaAttributeId[] = [
  'forca',
  'destreza',
  'carisma',
  'inteligencia',
  'vontade',
]

function damagePv(state: ArenaGameState, amount: number): number {
  const damage = Math.max(0, Math.trunc(Number.isFinite(amount) ? amount : 0))
  state.resources.pv.current = Math.max(0, state.resources.pv.current - damage)
  return damage
}

/**
 * Aplica a consequência de uma Mácula ao estado da mesa.
 *
 * A Mácula de Reforço é a única obrigatória no MVP (dano igual à margem de
 * falha + debuff físico); as demais seguem a tabela do material e são
 * registradas no log para o Mestre narrar. Função pura: devolve uma cópia.
 */
export function applyMaculaEffect(
  state: ArenaGameState,
  type: string,
  margin: number,
): ArenaGameState {
  const safeMargin = Math.max(0, Math.trunc(Number.isFinite(margin) ? margin : 0))
  const key = type.trim().toLowerCase()
  const next = cloneState(state)

  let label = `Mácula (${type || 'arcana'}) — margem ${safeMargin}`
  let detail = ''

  switch (key) {
    case 'reforco': {
      const damage = damagePv(next, safeMargin)
      label = 'Mácula de Reforço'
      detail = `${damage} de dano. Debuff físico: −3 dados em rolagens físicas até o próximo descanso.`
      break
    }
    case 'projecao': {
      const available = next.resources.impeto.current
      const lost = Math.min(available, safeMargin)
      next.resources.impeto.current = available - lost
      const overflow = safeMargin - lost
      const damage = damagePv(next, overflow)
      label = 'Mácula de Projeção'
      detail = `Perdeu ${lost} de Ímpeto${
        damage > 0 ? ` e sofreu ${damage} de dano pelo excedente` : ''
      }. −3 dados em rolagens mentais até o próximo descanso.`
      break
    }
    case 'elemental': {
      const damage = damagePv(next, safeMargin + 3)
      label = 'Mácula Elemental'
      detail = `Explosão elemental causando ${damage} de dano.`
      break
    }
    case 'alteracao': {
      next.resources.limiar.current = Math.max(0, next.resources.limiar.current - (safeMargin + 3))
      next.resources.impeto.current = Math.max(0, next.resources.impeto.current - safeMargin)
      label = 'Mácula de Alteração'
      detail = `Perdeu ${safeMargin + 3} de Limiar e ${safeMargin} de Ímpeto.`
      break
    }
    case 'multiplicacao': {
      next.resources.impeto.current = Math.max(0, next.resources.impeto.current - (safeMargin + 2))
      const damage = damagePv(next, safeMargin + 2)
      label = 'Mácula de Multiplicação'
      detail = `Perdeu ${safeMargin + 2} de Ímpeto e sofreu ${damage} de dano por cópia.`
      break
    }
    case 'arcana':
    default: {
      const damage = damagePv(next, safeMargin)
      label = 'Mácula Arcana'
      detail = `${damage} de dano e uma marca arcana persistente.`
      break
    }
  }

  next.overloaded = next.resources.limiar.current > next.resources.limiar.max
  return withLog(next, 'macula', label, detail)
}

// ---------------------------------------------------------
// Limiar
// ---------------------------------------------------------

export type LimiarTone = 'safe' | 'warn' | 'overload'

/** Faixa visual do Limiar: seguro, perto do limite ou em Sobrecarga. */
export function limiarTone(current: number, max: number): LimiarTone {
  if (current > max) return 'overload'
  if (max > 0 && current >= max * 0.75) return 'warn'
  return 'safe'
}

// ---------------------------------------------------------
// Resumo da ficha (sanitização do lado do servidor)
// ---------------------------------------------------------

function normalizeMaxValues(value: unknown): ArenaMaxValues {
  const record = asRecord(value)
  const valueOrZero = (key: keyof ArenaMaxValues) =>
    asInt(record[key], 0, 0, 999)

  return {
    pv: valueOrZero('pv'),
    pm: valueOrZero('pm'),
    limiar: valueOrZero('limiar'),
    impeto: valueOrZero('impeto'),
    pa: valueOrZero('pa'),
  }
}

function normalizeStringList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, limit)
}

/**
 * Garante que o resumo de ficha recebido do cliente tem o formato esperado.
 *
 * O servidor nunca confia no payload: campos ausentes viram padrões seguros e
 * listas são truncadas. Isso evita quebrar o prompt com uma ficha antiga.
 */
export function normalizeSheetSummary(raw: unknown): ArenaSheetSummary {
  const record = asRecord(raw)
  const attributesRecord = asRecord(record.attributes)

  const attributes = {} as Record<AmniaAttributeId, number>
  for (const id of ATTRIBUTE_IDS) {
    attributes[id] = asInt(attributesRecord[id], 0, 0, 99)
  }

  const skills = Array.isArray(record.skills)
    ? record.skills
        .map((entry) => {
          const skill = asRecord(entry)
          const name = asString(skill.name).trim()
          if (!name) return null
          return { name, value: asInt(skill.value, 0, 0, 99) }
        })
        .filter((skill): skill is { name: string; value: number } => skill !== null)
        .slice(0, 20)
    : []

  const runes = Array.isArray(record.runes)
    ? record.runes
        .map((entry) => {
          const rune = asRecord(entry)
          const name = asString(rune.name).trim()
          if (!name) return null
          return { name, circle: asString(rune.circle).trim() }
        })
        .filter((rune): rune is { name: string; circle: string } => rune !== null)
        .slice(0, 40)
    : []

  const spells = Array.isArray(record.spells)
    ? record.spells
        .map((entry) => {
          const spell = asRecord(entry)
          const name = asString(spell.name).trim()
          if (!name) return null
          return {
            name,
            cost: asInt(spell.cost, 0, 0, 999),
            summary: asString(spell.summary).trim(),
            effect: asString(spell.effect).trim(),
          }
        })
        .filter(
          (spell): spell is { name: string; cost: number; summary: string; effect: string } =>
            spell !== null,
        )
        .slice(0, 40)
    : []

  const keyAttribute = asString(record.keyAttribute).trim()

  return {
    id: asString(record.id).trim(),
    name: asString(record.name).trim() || 'Personagem sem nome',
    concept: asString(record.concept).trim(),
    className: asString(record.className).trim(),
    ancestry: asString(record.ancestry).trim(),
    keyAttribute: keyAttribute || null,
    attributes,
    max: normalizeMaxValues(record.max),
    skills,
    runes,
    spells,
    impulse: asString(record.impulse).trim(),
    convictions: normalizeStringList(record.convictions, 3),
    inventory: normalizeStringList(record.inventory, 40),
    notes: asString(record.notes).trim(),
  }
}
