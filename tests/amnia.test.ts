import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  countSuccesses,
  failedDiceIndices,
  rerollFailedDice,
  resolveAmniaTest,
  rollMaculaSave,
  type RandomSource,
} from '../src/lib/amnia/dice'
import {
  advanceThreatClock,
  applyImpetoReroll,
  applyMaculaEffect,
  calculateEnemyDamage,
  createGameState,
  limiarTone,
  normalizeGameState,
  normalizeSheetSummary,
  spendActionPoints,
  spendMana,
  startTurn,
  suppressMana,
  upsertThreatClock,
} from '../src/lib/amnia/rules'
import { resolveTestPool } from '../src/lib/amnia/testResolver'
import type { ArenaPendingTest, ArenaSheetSummary } from '../src/lib/amnia/types'
import { createEmptyCharacter } from '../src/rules/character'
import { computeDerived } from '../src/rules/derive'

/** Fonte determinística: cada chamada consome o próximo valor da lista. */
function randomFrom(values: number[]): RandomSource {
  const queue = [...values]
  return () => (queue.length > 0 ? (queue.shift() as number) : 0.5)
}

/** Fonte que devolve exatamente os dados pedidos (1–6). */
function diceRandom(dice: number[]): RandomSource {
  return randomFrom(dice.map((die) => (die - 0.5) / 6))
}

const MAX = { pv: 20, pm: 10, limiar: 8, impeto: 3, pa: 4 }

const SHEET: ArenaSheetSummary = {
  id: 'ficha-teste',
  name: 'Nara',
  concept: '',
  className: 'Guerreira',
  ancestry: '',
  keyAttribute: 'destreza',
  attributes: { forca: 2, destreza: 3, carisma: 1, inteligencia: 2, vontade: 1 },
  max: MAX,
  skills: [{ name: 'Armas Brancas', value: 4 }],
  runes: [],
  spells: [],
  impulse: '',
  convictions: [],
  inventory: [],
  notes: '',
}

function pendingTest(dice: number[], difficulty = 0): ArenaPendingTest {
  return {
    ...resolveAmniaTest({ diceCount: dice.length, difficulty, label: 'Teste' }, diceRandom(dice)),
    id: 'test-1',
    createdAt: 1,
  }
}

test('par de 6 vale 4 sucessos no total', () => {
  const result = countSuccesses([6, 6])
  assert.equal(result.successes, 4)
  assert.equal(result.criticalPairs, 1)
})

test('4–6 contam sucesso e 1–3 falham', () => {
  assert.equal(countSuccesses([4, 5, 6]).successes, 3)
  assert.equal(countSuccesses([1, 2, 3]).successes, 0)
})

test('par de 1 registra falha crítica sem subtrair sucessos', () => {
  const result = countSuccesses([1, 1, 4])
  assert.equal(result.criticalFailures, 1)
  assert.equal(result.successes, 1)
})

test('resolveAmniaTest calcula MoS, sucesso, empate e falha', () => {
  const success = resolveAmniaTest(
    { diceCount: 2, difficulty: 2, label: 'ataque' },
    randomFrom([0.99, 0.99]),
  )
  assert.deepEqual(success.dice, [6, 6])
  assert.equal(success.successes, 4)
  assert.equal(success.mos, 2)
  assert.equal(success.success, true)

  const partial = resolveAmniaTest(
    { diceCount: 2, difficulty: 4, label: 'empate' },
    randomFrom([0.99, 0.99]),
  )
  assert.equal(partial.mos, 0)
  assert.equal(partial.partial, true)

  const failed = resolveAmniaTest(
    { diceCount: 2, difficulty: 1, label: 'falha' },
    randomFrom([0, 0.2]),
  )
  assert.equal(failed.successes, 0)
  assert.equal(failed.mos, -1)
  assert.equal(failed.failed, true)
})

test('SAVE de Mácula usa a Complexidade e devolve a margem de falha', () => {
  const result = rollMaculaSave(
    { diceCount: 2, complexity: 2, maculaType: 'reforco' },
    randomFrom([0, 0.2]),
  )
  assert.equal(result.failed, true)
  assert.equal(result.failureMargin, 2)
  assert.match(result.effectSummary, /2 de dano/)
})

test('dano de inimigo: mook, resiliente, base e mínimo de 1 segmento', () => {
  assert.equal(
    calculateEnemyDamage({ baseWeaponDamage: 6, mos: 1, isResilient: false, isMook: true }).damage,
    1,
  )
  assert.equal(
    calculateEnemyDamage({ baseWeaponDamage: 6, mos: 0, isResilient: false, isMook: true }).damage,
    0,
  )
  assert.equal(
    calculateEnemyDamage({ baseWeaponDamage: 6, mos: 2, isResilient: true, isMook: false }).damage,
    5,
  )
  assert.equal(
    calculateEnemyDamage({ baseWeaponDamage: 6, mos: 2, isResilient: false, isMook: false }).damage,
    8,
  )
  assert.equal(
    calculateEnemyDamage({ baseWeaponDamage: 0, mos: 1, isResilient: false, isMook: false }).damage,
    1,
  )
  assert.equal(
    calculateEnemyDamage({ baseWeaponDamage: 6, mos: -1, isResilient: false, isMook: false }).damage,
    0,
  )
})

test('spendMana sobe o Limiar na mesma quantidade e marca Sobrecarga', () => {
  const safe = spendMana({
    amount: 3,
    spellName: 'Lança de Gelo',
    currentPlayerMana: 10,
    currentThreshold: 4,
    maxThreshold: 8,
  })
  assert.equal(safe.newMana, 7)
  assert.equal(safe.newThreshold, 7)
  assert.equal(safe.overloaded, false)

  const overloaded = spendMana({
    amount: 6,
    spellName: 'Tempestade',
    currentPlayerMana: 10,
    currentThreshold: 4,
    maxThreshold: 8,
  })
  assert.equal(overloaded.newThreshold, 10)
  assert.equal(overloaded.overloaded, true)
  assert.match(overloaded.message, /SOBRECARGA/)
})

test('relógio de ameaça avança, recua e completa', () => {
  const advanced = advanceThreatClock({ clockName: 'Bando', current: 4, max: 6, delta: 3 })
  assert.equal(advanced.current, 6)
  assert.equal(advanced.completed, true)

  const reduced = advanceThreatClock({ clockName: 'Bando', current: 2, max: 6, delta: -10 })
  assert.equal(reduced.current, 0)
})

test('upsertThreatClock cria o relógio e depois atualiza o mesmo', () => {
  const base = createGameState(MAX)
  const first = upsertThreatClock(base, {
    clockName: 'Bandido',
    current: 0,
    max: 6,
    delta: 2,
  })
  assert.equal(first.state.clocks.length, 1)
  assert.equal(first.state.clocks[0]?.current, 2)

  const second = upsertThreatClock(first.state, {
    clockName: 'bandido',
    current: 0,
    max: 6,
    delta: 3,
  })
  assert.equal(second.state.clocks.length, 1)
  assert.equal(second.state.clocks[0]?.current, 5)
})

test('normalizeGameState preserva a Sobrecarga do Limiar e limita recursos', () => {
  const state = normalizeGameState(
    {
      resources: {
        pv: { current: 999, max: 20 },
        pm: { current: -5, max: 10 },
        limiar: { current: 12, max: 8 },
      },
      clocks: [{ name: 'Sombra', current: 9, max: 6, kind: 'elite', resilient: true }],
    },
    MAX,
  )

  assert.equal(state.resources.pv.current, 20)
  assert.equal(state.resources.pm.current, 0)
  assert.equal(state.resources.limiar.current, 12)
  assert.equal(state.overloaded, true)
  assert.equal(state.clocks[0]?.current, 6)
  assert.equal(state.clocks[0]?.resilient, true)
})

test('normalizeGameState começa com o Limiar zerado quando não há estado salvo', () => {
  const state = normalizeGameState(undefined, MAX)

  assert.equal(state.resources.pv.current, MAX.pv)
  assert.equal(state.resources.pm.current, MAX.pm)
  assert.equal(state.resources.limiar.current, 0)
  assert.equal(state.overloaded, false)
  assert.deepEqual(state.clocks, [])
})

test('limiarTone separa seguro, perto do limite e sobrecarga', () => {
  assert.equal(limiarTone(4, 8), 'safe')
  assert.equal(limiarTone(6, 8), 'warn')
  assert.equal(limiarTone(9, 8), 'overload')
})

test('applyMaculaEffect de Reforço causa dano igual à margem', () => {
  const base = createGameState(MAX)
  const next = applyMaculaEffect(base, 'reforco', 3)
  assert.equal(next.resources.pv.current, 17)
  assert.equal(next.log.at(-1)?.label, 'Mácula de Reforço')
  assert.match(next.log.at(-1)?.detail ?? '', /3 de dano/)
})

test('normalizeSheetSummary devolve padrões seguros para payload incompleto', () => {
  const sheet = normalizeSheetSummary({
    name: '  ',
    attributes: { forca: 3, destreza: 'x' },
    skills: [{ name: 'Armas Brancas', value: 4 }, { value: 2 }],
    spells: [{ name: 'Lança', cost: '2' }],
  })

  assert.equal(sheet.name, 'Personagem sem nome')
  assert.equal(sheet.attributes.forca, 3)
  assert.equal(sheet.attributes.destreza, 0)
  assert.equal(sheet.skills.length, 1)
  assert.equal(sheet.spells[0]?.cost, 0)
  assert.equal(sheet.max.pv, 0)
})

test('DIF é situacional: ausente vale 0 e não há DIF fixa', () => {
  const noDifficulty = resolveAmniaTest(
    { diceCount: 1, label: 'sem resistência' },
    diceRandom([5]),
  )
  assert.equal(noDifficulty.difficulty, 0)
  assert.equal(noDifficulty.targetSuccesses, 0)
  assert.equal(noDifficulty.mos, 1)

  const hard = resolveAmniaTest(
    { diceCount: 1, difficulty: 2, difficultyReason: 'escuridão total', label: 'na escuridão' },
    diceRandom([5]),
  )
  assert.equal(hard.difficulty, 2)
  assert.equal(hard.targetSuccesses, 2)
  assert.equal(hard.difficultyReason, 'escuridão total')
  assert.equal(hard.mos, -1)
})

test('teste oposto usa a pilha do Mestre e ignora a DIF', () => {
  const opposed = resolveAmniaTest(
    {
      diceCount: 2,
      difficulty: 5,
      enemyDiceCount: 3,
      enemyLabel: 'Bandido — Atletismo + Destreza',
      label: 'Ataque oposto',
    },
    diceRandom([4, 4, 5, 5, 5]),
  )

  assert.deepEqual(opposed.dice, [4, 4])
  assert.equal(opposed.successes, 2)
  assert.equal(opposed.difficulty, 0)
  assert.equal(opposed.targetSuccesses, 3)
  assert.equal(opposed.enemy?.label, 'Bandido — Atletismo + Destreza')
  assert.deepEqual(opposed.enemy?.dice, [5, 5, 5])
  assert.equal(opposed.enemy?.successes, 3)
  assert.equal(opposed.mos, -1)
  assert.equal(opposed.failed, true)
})

test('failedDiceIndices encontra apenas 1–3', () => {
  assert.deepEqual(failedDiceIndices([1, 4, 2, 6, 3]), [0, 2, 4])
  assert.deepEqual(failedDiceIndices([4, 5, 6]), [])
})

test('rerollFailedDice rerrola até 2 dados falhos escolhidos e mantém a defesa', () => {
  const base = resolveAmniaTest(
    {
      diceCount: 3,
      difficulty: 1,
      label: 'Ataque',
      enemyDiceCount: 2,
      enemyLabel: 'Defensor',
    },
    diceRandom([1, 2, 5, 4, 4]),
  )
  const enemyBefore = base.enemy ? [...base.enemy.dice] : []

  const rerolled = rerollFailedDice(base, [0, 1, 2], diceRandom([6, 4]))

  // O índice 2 não falhou: só 0 e 1 são rerrolados.
  assert.deepEqual(rerolled.dice, [6, 4, 5])
  assert.equal(rerolled.successes, 3)
  assert.equal(rerolled.mos, 1)
  assert.equal(rerolled.success, true)
  assert.deepEqual(rerolled.impetoReroll?.indices, [0, 1])
  assert.deepEqual(rerolled.impetoReroll?.previousValues, [1, 2])
  assert.equal(rerolled.impetoReroll?.cost, 1)
  assert.deepEqual(rerolled.enemy?.dice, enemyBefore)
  assert.equal(rerolled.enemy?.successes, base.enemy?.successes)
})

test('rerollFailedDice ignora seleção vazia ou inválida', () => {
  const base = pendingTest([1, 2, 5])
  const unchanged = rerollFailedDice(base, [2, 9, -1], diceRandom([6]))
  assert.deepEqual(unchanged.dice, [1, 2, 5])
  assert.equal(unchanged.impetoReroll, undefined)
})

test('applyImpetoReroll gasta 1 Ímpeto e abre um novo teste pendente', () => {
  const state = {
    ...createGameState(MAX),
    pendingTest: pendingTest([1, 2, 5]),
  }

  const outcome = applyImpetoReroll(state, [0, 1], diceRandom([6, 4]))
  assert.equal(outcome.ok, true)
  if (!outcome.ok) return

  assert.equal(outcome.state.resources.impeto.current, MAX.impeto - 1)
  assert.equal(outcome.state.pendingTest?.id === 'test-1', false)
  assert.deepEqual(outcome.state.pendingTest?.dice, [6, 4, 5])
  assert.equal(outcome.state.pendingTest?.mos, 3)
  assert.deepEqual(outcome.state.pendingTest?.impetoReroll?.indices, [0, 1])
  assert.match(outcome.message, /Ímpeto −1/)
  assert.match(outcome.message, /\[1, 2\] → \[6, 4\]/)
})

test('applyImpetoReroll bloqueia sem teste pendente, sem Ímpeto ou sem dado falho', () => {
  const noPending = applyImpetoReroll(createGameState(MAX), [0])
  assert.equal(noPending.ok, false)

  const state = { ...createGameState(MAX), pendingTest: pendingTest([1, 2, 5]) }
  const noImpeto = {
    ...state,
    resources: { ...state.resources, impeto: { current: 0, max: MAX.impeto } },
  }
  assert.equal(applyImpetoReroll(noImpeto, [0]).ok, false)

  const notFailed = applyImpetoReroll(state, [2])
  assert.equal(notFailed.ok, false)
})

test('spendActionPoints gasta PA e bloqueia a ação sem saldo', () => {
  const ok = spendActionPoints({ amount: 1, actionName: 'Atacar o bandido', currentPa: 4 })
  assert.equal(ok.blocked, false)
  assert.equal(ok.spent, 1)
  assert.equal(ok.newPa, 3)
  assert.match(ok.message, /gastou 1 PA/)

  const blocked = spendActionPoints({ amount: 2, actionName: 'Manobra', currentPa: 1 })
  assert.equal(blocked.blocked, true)
  assert.equal(blocked.spent, 0)
  assert.equal(blocked.newPa, 1)
  assert.match(blocked.message, /PA insuficiente/)
})

test('startTurn restaura PA/PM e descarta o teste pendente', () => {
  const state = {
    ...createGameState(MAX),
    pendingTest: pendingTest([1, 2, 5]),
  }
  state.resources.pa.current = 0
  state.resources.pm.current = 0

  const next = startTurn(state)
  assert.equal(next.resources.pa.current, MAX.pa)
  assert.equal(next.resources.pm.current, MAX.pm)
  assert.equal(next.pendingTest, undefined)
  assert.equal(next.turn, 2)
})

test('suppressMana resfria o Limiar, corta a mana e o próximo turno encerra a Supressão', () => {
  const state = createGameState(MAX)
  state.resources.limiar.current = 7
  state.resources.pm.current = 6

  const suppressed = suppressMana(state, 3)
  assert.equal(suppressed.resources.limiar.current, 2)
  assert.equal(suppressed.resources.pm.current, 0)
  assert.equal(suppressed.suppressed, true)
  assert.equal(suppressed.overloaded, false)

  const next = startTurn(suppressed)
  assert.equal(next.suppressed, false)
  assert.equal(next.resources.pm.current, MAX.pm)
  // O Limiar não reseta no começo do turno.
  assert.equal(next.resources.limiar.current, 2)
})

test('normalizeGameState recalcula o teste pendente e preserva a pilha inimiga', () => {
  const normalized = normalizeGameState(
    {
      pendingTest: {
        id: 't9',
        createdAt: 5,
        label: 'Ataque',
        test: 'Armas Brancas + Destreza',
        dice: [1, 2, 5],
        successes: 99,
        mos: 99,
        difficulty: 2,
        enemy: { label: 'Sombra', dice: [4, 4, 4], successes: 99 },
      },
    },
    MAX,
  )

  assert.equal(normalized.pendingTest?.id, 't9')
  assert.equal(normalized.pendingTest?.successes, 1)
  assert.equal(normalized.pendingTest?.targetSuccesses, 3)
  assert.equal(normalized.pendingTest?.mos, -2)
  assert.equal(normalized.pendingTest?.difficulty, 0)
  assert.deepEqual(normalized.pendingTest?.failedIndices, [0, 1])
  assert.deepEqual(normalized.pendingTest?.enemy?.dice, [4, 4, 4])

  const solo = normalizeGameState(
    { pendingTest: { dice: [5, 5], difficulty: 1 } },
    MAX,
  )
  assert.equal(solo.pendingTest?.targetSuccesses, 1)
  assert.equal(solo.pendingTest?.mos, 1)
})

test('resolveTestPool soma perícia + atributo descritos pelo Mestre', () => {
  const combined = resolveTestPool(SHEET, { test: 'Armas Brancas + Destreza' })
  assert.equal(combined.diceCount, 7)
  assert.equal(combined.source, 'sheet')
  assert.equal(combined.skill?.name, 'Armas Brancas')
  assert.equal(combined.attribute?.id, 'destreza')
  assert.match(combined.breakdown, /Armas Brancas 4 \+ Destreza 3 = 7d6/)

  const explicit = resolveTestPool(SHEET, { skill: 'armas brancas', attribute: 'destreza' })
  assert.equal(explicit.diceCount, 7)

  const manual = resolveTestPool(SHEET, { diceCount: 2, test: 'com −2 por repetição' })
  assert.equal(manual.diceCount, 2)
  assert.equal(manual.source, 'manual')

  const fallback = resolveTestPool(SHEET, { test: 'Perícia inexistente' })
  assert.equal(fallback.diceCount, 3)
  assert.equal(fallback.source, 'fallback')
})

test('traço racial Força acima de tudo reduz o Limiar em 4', () => {
  const character = createEmptyCharacter()
  character.ancestryId = 'orcs'
  character.negativeTraits = ['forca-acima-de-tudo']

  const limiar = computeDerived(character).find((stat) => stat.id === 'limiar')
  assert.equal(limiar?.modifiers, -4)
  assert.equal(limiar?.value, (limiar?.base ?? 0) - 4)
  assert.deepEqual(
    limiar?.sources.map((source) => source.source),
    ['Traço racial: Força acima de tudo'],
  )
})
