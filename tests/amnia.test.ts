import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  countSuccesses,
  resolveAmniaTest,
  rollMaculaSave,
  type RandomSource,
} from '../src/lib/amnia/dice'
import {
  advanceThreatClock,
  applyMaculaEffect,
  calculateEnemyDamage,
  createGameState,
  limiarTone,
  normalizeGameState,
  normalizeSheetSummary,
  spendMana,
  upsertThreatClock,
} from '../src/lib/amnia/rules'

/** Fonte determinística: cada chamada consome o próximo valor da lista. */
function randomFrom(values: number[]): RandomSource {
  const queue = [...values]
  return () => (queue.length > 0 ? (queue.shift() as number) : 0.5)
}

const MAX = { pv: 20, pm: 10, limiar: 8, impeto: 3, pa: 4 }

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
