import type {
  AmniaDicePool,
  AmniaRoll,
  AmniaTestInput,
  AmniaTestResult,
  MaculaSaveInput,
  MaculaSaveResult,
  MaculaType,
} from './types'

/**
 * Rolagens de Amnia (d6 empilhados).
 *
 * Regra do material (docs/amnia-export → "Rolagens & Testes"):
 * - 4 a 6 = 1 sucesso; 1 a 3 = falha.
 * - **Par de 6** = sucesso crítico: o par vale **4 sucessos no total**
 *   (ou seja, +2 sobre os 2 sucessos normais). Ex.: 2d6 [6,6] = 4 sucessos.
 * - Par de 1 = falha crítica (não subtrai sucessos, mas é registrado).
 *
 * As funções recebem a fonte de aleatoriedade por parâmetro para poderem ser
 * testadas sem mock global.
 */

export type RandomSource = () => number

const DIE_FACES = 6
export const MAX_DICE = 30

/** Um ponto de Ímpeto rerrola até 2 dados falhos escolhidos pelo jogador. */
export const MAX_IMPETO_REROLL = 2
export const IMPETO_REROLL_COST = 1

export function rollDie(random: RandomSource = Math.random): number {
  return Math.floor(random() * DIE_FACES) + 1
}

function clampDiceCount(count: number): number {
  if (!Number.isFinite(count)) return 0
  return Math.min(MAX_DICE, Math.max(0, Math.trunc(count)))
}

/** Conta sucessos de dados já rolados, aplicando os pares de 6. */
export function countSuccesses(dice: number[]): AmniaRoll {
  let normal = 0
  let sixes = 0
  let ones = 0

  for (const die of dice) {
    if (die === 6) sixes += 1
    else if (die >= 4) normal += 1
    if (die === 1) ones += 1
  }

  const criticalPairs = Math.floor(sixes / 2)
  const criticalFailures = Math.floor(ones / 2)
  const successes = normal + sixes + criticalPairs * 2

  return { dice: [...dice], successes, criticalPairs, criticalFailures }
}

/** Rola `count` d6 e devolve os dados + sucessos. */
export function rollAmniaDice(count: number, random: RandomSource = Math.random): AmniaRoll {
  const dice = Array.from({ length: clampDiceCount(count) }, () => rollDie(random))
  return countSuccesses(dice)
}

/** Índices (0-based) dos dados que falharam (1–3). */
export function failedDiceIndices(dice: number[]): number[] {
  const indices: number[] = []
  dice.forEach((die, index) => {
    if (die >= 1 && die <= 3) indices.push(index)
  })
  return indices
}

/**
 * Resolve um teste.
 *
 * - Sem pilha inimiga: MoS = sucessos − DIF situacional (padrão 0).
 * - Com pilha inimiga (teste oposto): MoS = sucessos do jogador − sucessos do
 *   Mestre. A DIF é ignorada, como no exemplo "Armas Brancas + Destreza vs
 *   Atletismo + Destreza" do material.
 */
export function resolveAmniaTest(
  input: AmniaTestInput,
  random: RandomSource = Math.random,
): AmniaTestResult {
  const roll = rollAmniaDice(input.diceCount ?? 0, random)

  const rawEnemyDiceCount = input.enemyDiceCount ?? 0
  const enemyDiceCount = Math.max(
    0,
    Math.trunc(Number.isFinite(rawEnemyDiceCount) ? rawEnemyDiceCount : 0),
  )
  const enemyRoll = enemyDiceCount > 0 ? rollAmniaDice(enemyDiceCount, random) : null
  const enemy: AmniaDicePool | undefined = enemyRoll
    ? {
        label: input.enemyLabel?.trim() || 'Inimigo',
        ...enemyRoll,
      }
    : undefined

  const rawDifficulty = input.difficulty ?? 0
  const difficulty = enemy
    ? 0
    : Math.max(0, Math.trunc(Number.isFinite(rawDifficulty) ? rawDifficulty : 0))
  const targetSuccesses = enemy ? enemy.successes : difficulty
  const mos = roll.successes - targetSuccesses

  return {
    ...roll,
    label: input.label,
    ...(input.test ? { test: input.test } : {}),
    ...(input.diceBreakdown ? { diceBreakdown: input.diceBreakdown } : {}),
    difficulty,
    ...(!enemy && input.difficultyReason ? { difficultyReason: input.difficultyReason } : {}),
    targetSuccesses,
    mos,
    success: mos > 0,
    partial: mos === 0,
    failed: mos < 0,
    ...(enemy ? { enemy } : {}),
    failedIndices: failedDiceIndices(roll.dice),
  }
}

/**
 * Rerrola até 2 dados falhos escolhidos pelo jogador (1 ponto de Ímpeto).
 *
 * A pilha do inimigo NÃO é rerrolada: o Mestre mantém a defesa original. Os
 * índices inválidos/repetidos são ignorados; se nenhum sobrar, o teste volta
 * inalterado.
 */
export function rerollFailedDice(
  test: AmniaTestResult,
  indices: number[],
  random: RandomSource = Math.random,
): AmniaTestResult {
  const allowed = new Set(test.failedIndices)
  const chosen: number[] = []
  for (const raw of indices) {
    const index = Math.trunc(Number.isFinite(raw) ? raw : -1)
    if (allowed.has(index) && !chosen.includes(index)) chosen.push(index)
    if (chosen.length >= MAX_IMPETO_REROLL) break
  }
  if (chosen.length === 0) return test

  const dice = [...test.dice]
  const previousValues = chosen.map((index) => dice[index] ?? 0)
  for (const index of chosen) dice[index] = rollDie(random)

  const roll = countSuccesses(dice)
  const mos = roll.successes - test.targetSuccesses

  return {
    ...test,
    ...roll,
    mos,
    success: mos > 0,
    partial: mos === 0,
    failed: mos < 0,
    failedIndices: failedDiceIndices(dice),
    impetoReroll: {
      indices: chosen,
      previousValues,
      cost: IMPETO_REROLL_COST,
    },
  }
}

/** Texto do efeito de cada Mácula para a margem de falha do SAVE. */
export function maculaEffectSummary(type: string, margin: number): string {
  const safeMargin = Math.max(0, Math.trunc(margin))
  const key = type.toLowerCase() as MaculaType

  switch (key) {
    case 'reforco':
      return `Mácula de Reforço: ${safeMargin} de dano e −3 dados em rolagens físicas até o próximo descanso.`
    case 'projecao':
      return `Mácula de Projeção: perde ${safeMargin} de Ímpeto (se ficar negativo, sofre dano equivalente à vida) e −3 dados em rolagens mentais até o próximo descanso.`
    case 'elemental':
      return `Mácula Elemental: explosão do elemento da magia causando ${safeMargin + 3} de dano.`
    case 'alteracao':
      return `Mácula de Alteração: perde ${safeMargin + 3} de Limiar e ${safeMargin} de Ímpeto.`
    case 'multiplicacao':
      return `Mácula de Multiplicação: perde ${safeMargin + 2} de Ímpeto e sofre ${safeMargin + 2} de dano por cópia.`
    case 'arcana':
    default:
      return `Mácula Arcana: ${safeMargin} de dano e uma marca arcana persistente (narre conforme a Esfera da magia).`
  }
}

/**
 * SAVE contra Mácula: dificuldade = Complexidade da magia lançada em
 * Sobrecarga. A margem de falha é `complexity − successes` (0 se passou).
 */
export function rollMaculaSave(
  input: MaculaSaveInput,
  random: RandomSource = Math.random,
): MaculaSaveResult {
  const test = resolveAmniaTest(
    {
      diceCount: input.diceCount,
      difficulty: Math.max(0, Math.trunc(input.complexity)),
      label: `SAVE contra Mácula (${input.maculaType})`,
    },
    random,
  )

  const failureMargin = Math.max(0, -test.mos)

  return {
    dice: test.dice,
    successes: test.successes,
    criticalPairs: test.criticalPairs,
    criticalFailures: test.criticalFailures,
    failureMargin,
    failed: test.failed,
    maculaType: input.maculaType,
    effectSummary: test.failed
      ? maculaEffectSummary(input.maculaType, failureMargin)
      : 'SAVE passou: nenhuma Mácula neste lançamento.',
  }
}
