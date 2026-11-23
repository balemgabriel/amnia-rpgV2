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
import { codexArticleColor, codexHeadingColor } from '../src/features/codex/codexColors'
import { createEmptyCharacter } from '../src/rules/character'
import { computeDerived } from '../src/rules/derive'
import { lineagePalette } from '../src/rules/lineageColors'
import {
  createXpPurchase,
  totalXpSpent,
  xpAvailable,
  xpItemCost,
  XP_POOL,
} from '../src/rules/xp'
import {
  applyXpPurchase,
  revertXpPurchase,
  runeXpRelation,
  xpCostFor,
} from '../src/rules/xpPurchase'
import {
  reconcileTraitRunes,
  runeGrantLabel,
  runeGrants,
  specializationGrantLabel,
  specializationGrants,
  traitGrantNotes,
  traitGrantedRuneIds,
  traitRuneSlots,
  traitSpecializationSlots,
} from '../src/rules/traitGrants'

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

test('Conhecimento Vasto concede 2 especializações', () => {
  assert.equal(traitSpecializationSlots(['conhecimento-vasto']), 2)
  assert.equal(traitRuneSlots(['conhecimento-vasto']), 0)
  assert.equal(traitGrantNotes('conhecimento-vasto')[0], '+2 especializações')
})

test('traços com especialização restrita informam a perícia', () => {
  const [grant] = specializationGrants(['artesao-nato'])
  assert.equal(grant?.count, 1)
  assert.equal(specializationGrantLabel(grant!), '+1 especialização em Ofícios — para um tipo de item')
})

test('Caminho da Vida concede runa e especialização do elemento', () => {
  const [spec] = specializationGrants(['caminho-tempestade'])
  assert.equal(specializationGrantLabel(spec!), '+1 especialização em Arcanismo (Raio)')
  assert.deepEqual(traitGrantedRuneIds(['caminho-tempestade']), ['elemento-raio'])
  assert.equal(traitRuneSlots(['caminho-tempestade']), 1)
})

test('runas específicas e de escolha entram no limite; condicionais não', () => {
  assert.deepEqual(traitGrantedRuneIds(['sentido-de-tremor']), ['elemento-terra'])
  assert.equal(traitRuneSlots(['sentido-de-tremor']), 1)

  const [choice] = runeGrants(['coracao-do-intensificador'])
  assert.equal(choice?.circles?.[0], 'reforco')
  assert.equal(traitRuneSlots(['coracao-do-intensificador']), 1)
  assert.deepEqual(traitGrantedRuneIds(['coracao-do-intensificador']), [])

  assert.equal(traitRuneSlots(['tocado-pela-lua']), 0)
  assert.match(traitGrantNotes('tocado-pela-lua')[0] ?? '', /condicional/)
})

test('runa concedida é exibida com o nome do catálogo', () => {
  const [grant] = runeGrants(['mestre-da-camuflagem'])
  assert.equal(grant?.runeIds?.[0], 'ilusao-camaleao')
  assert.match(runeGrantLabel(grant!), /Camaleão/)
})

test('reconcileTraitRunes adiciona a runa concedida e a marca como automática', () => {
  const character = createEmptyCharacter()
  character.knownRunes = ['reforco-forca']
  character.ancestryTraits = ['sentido-de-tremor']

  const next = reconcileTraitRunes(character)
  assert.deepEqual(next.knownRunes, ['reforco-forca', 'elemento-terra'])
  assert.deepEqual(next.autoGrantedRunes, ['elemento-terra'])
  // Idempotente: rodar de novo devolve o mesmo objeto.
  assert.equal(reconcileTraitRunes(next), next)
})

test('reconcileTraitRunes remove só a runa automática ao tirar o traço', () => {
  const character = createEmptyCharacter()
  character.knownRunes = ['reforco-forca', 'elemento-terra', 'ilusao-camaleao']
  character.ancestryTraits = ['sentido-de-tremor', 'mestre-da-camuflagem']

  const withTraits = reconcileTraitRunes(character)
  assert.deepEqual(withTraits.autoGrantedRunes, ['elemento-terra', 'ilusao-camaleao'])

  const withoutTraits = reconcileTraitRunes({ ...withTraits, ancestryTraits: [] })
  assert.deepEqual(withoutTraits.knownRunes, ['reforco-forca'])
  assert.deepEqual(withoutTraits.autoGrantedRunes, [])
})

test('runa escolhida antes do traço passa a ser automática e sai com o traço', () => {
  const character = createEmptyCharacter()
  character.knownRunes = ['elemento-terra']
  character.ancestryTraits = ['sentido-de-tremor']

  const next = reconcileTraitRunes(character)
  assert.deepEqual(next.knownRunes, ['elemento-terra'])
  assert.deepEqual(next.autoGrantedRunes, ['elemento-terra'])

  const withoutTrait = reconcileTraitRunes({ ...next, ancestryTraits: [] })
  assert.deepEqual(withoutTrait.knownRunes, [])
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

// ---------------------------------------------------------------------------
// XP: tabela de custos e compras aplicadas à ficha
// ---------------------------------------------------------------------------

test('tabela de XP cobra por nível ou valor fixo', () => {
  assert.equal(xpItemCost({ id: 'x', name: 'X', cost: '', unitCost: 5, perLevel: true }, 3), 15)
  assert.equal(xpItemCost({ id: 'x', name: 'X', cost: '', fixedCost: 9 }), 9)

  const purchase = createXpPurchase('pericia', 2, 'Furtividade')
  assert.equal(purchase?.cost, 8)
  assert.match(purchase?.detail ?? '', /Nível 2/)
  assert.equal(createXpPurchase('inexistente'), null)
})

test('XP disponível soma a XP recebida e subtrai a gasta', () => {
  const compras = [createXpPurchase('runa-inata', 1, 'Runa')!]
  assert.equal(XP_POOL, 15)
  assert.equal(totalXpSpent(compras), 6)
  assert.equal(xpAvailable(compras), 9)
  assert.equal(xpAvailable(compras, 5), 14)
})

test('relação da runa com o círculo inato define o preço em XP', () => {
  const character = createEmptyCharacter()
  character.innateCircle = 'reforco'

  assert.equal(runeXpRelation(character, 'reforco-forca'), 'inata')
  assert.equal(runeXpRelation(character, 'elemento-agua'), 'adjacente')
  assert.equal(runeXpRelation(character, 'alteracao-criacao'), 'paralela')
  assert.equal(runeXpRelation(character, 'projecao-alma'), 'oposta')
  assert.equal(runeXpRelation(character, 'miscelanea-cura'), null)

  assert.equal(xpCostFor(character, { itemId: 'runa-inata', targetId: 'reforco-forca' }), 6)
  assert.equal(xpCostFor(character, { itemId: 'runa-paralela', targetId: 'alteracao-criacao' }), 8)
  assert.equal(xpCostFor(character, { itemId: 'runa-inata', targetId: 'miscelanea-cura' }), 7)
})

test('comprar uma runa com XP adiciona a runa; remover desfaz', () => {
  const character = createEmptyCharacter()
  character.innateCircle = 'reforco'

  const aplicada = applyXpPurchase(character, {
    itemId: 'runa-paralela',
    targetId: 'alteracao-criacao',
  })
  assert.ok(aplicada)
  assert.equal(aplicada.purchase.cost, 8)
  assert.deepEqual(aplicada.patch.knownRunes, [...character.knownRunes, 'alteracao-criacao'])
  assert.deepEqual(aplicada.purchase.effect, { kind: 'runa', targetId: 'alteracao-criacao' })

  const comprada = {
    ...character,
    ...aplicada.patch,
    xpPurchases: [aplicada.purchase],
  }
  assert.deepEqual(revertXpPurchase(comprada, aplicada.purchase).knownRunes, [])

  // Runa concedida por traço não sai quando a compra é removida.
  comprada.autoGrantedRunes = ['alteracao-criacao']
  assert.deepEqual(revertXpPurchase(comprada, aplicada.purchase).knownRunes, ['alteracao-criacao'])

  // Não vende a mesma runa duas vezes.
  assert.equal(applyXpPurchase(comprada, { itemId: 'runa-paralela', targetId: 'alteracao-criacao' }), null)
})

test('compras de atributo e perícia alteram os valores e podem ser desfeitas', () => {
  const character = createEmptyCharacter()

  const atributo = applyXpPurchase(character, { itemId: 'atributo', targetId: 'forca', level: 2 })
  assert.ok(atributo)
  assert.equal(atributo.purchase.cost, 10)
  assert.equal(atributo.patch.attributes?.forca, 2)
  const comAtributo = { ...character, ...atributo.patch }
  assert.equal(revertXpPurchase(comAtributo, atributo.purchase).attributes?.forca, 1)

  const pericia = applyXpPurchase(character, { itemId: 'pericia', targetId: 'furtividade', level: 3 })
  assert.ok(pericia)
  assert.equal(pericia.purchase.cost, 12)
  assert.equal(pericia.patch.skills?.furtividade, 3)
  const comPericia = { ...character, ...pericia.patch }
  assert.equal(revertXpPurchase(comPericia, pericia.purchase).skills?.furtividade, 0)
})

test('compras de vantagem e canalização criam/atualizam registros revertíveis', () => {
  const character = createEmptyCharacter()

  const vantagem = applyXpPurchase(character, {
    itemId: 'vantagem',
    targetId: 'poliglota',
    level: 2,
  })
  assert.ok(vantagem)
  assert.equal(vantagem.purchase.cost, 6)
  const novaVantagem = vantagem.patch.advantages?.[0]
  assert.equal(novaVantagem?.sourceId, 'poliglota')
  const comVantagem = { ...character, ...vantagem.patch }
  assert.deepEqual(revertXpPurchase(comVantagem, vantagem.purchase).advantages, [])

  const canalizacao = applyXpPurchase(character, {
    itemId: 'canalizacao-2',
    targetId: 'gestual',
  })
  assert.ok(canalizacao)
  assert.equal(canalizacao.purchase.cost, 8)
  assert.equal(canalizacao.patch.channelingLevel, 2)
  assert.equal(canalizacao.patch.channelingMethodId, 'gestual')
  const comCanalizacao = { ...character, ...canalizacao.patch }
  assert.equal(revertXpPurchase(comCanalizacao, canalizacao.purchase).channelingLevel, 1)
})

// ---------------------------------------------------------------------------
// Codex: cores de ancestralidade/linhagem nos outlines das raças
// ---------------------------------------------------------------------------

test('Codex usa a cor da ancestralidade nos artigos de raça', () => {
  assert.equal(codexArticleColor('racas-humanos'), lineagePalette.azulEscuro)
  assert.equal(codexArticleColor('racas-orcs'), lineagePalette.verde)
  assert.equal(codexArticleColor('racas-lirizatl'), lineagePalette.laranja)
  assert.equal(codexArticleColor('racas-shrumakara-wip'), lineagePalette.laranja)
  assert.equal(codexArticleColor('racas-linhagens-racas'), null)
  assert.equal(codexArticleColor('regras-regras-pericias'), null)
})

test('Codex colore os headings de linhagens, castas e grupos como a criação', () => {
  assert.equal(codexHeadingColor('racas-humanos', '☀️Soltianos'), lineagePalette.laranja)
  assert.equal(codexHeadingColor('racas-humanos', '**Asdaw**'), lineagePalette.vermelho)
  assert.equal(codexHeadingColor('racas-humanos', '# Traços Raciais'), lineagePalette.azulEscuro)

  assert.equal(codexHeadingColor('racas-orcs', 'Ghullen'), lineagePalette.roxo)
  assert.equal(codexHeadingColor('racas-skaraeb', '🛠️Trabalhador'), lineagePalette.laranja)
  assert.equal(codexHeadingColor('racas-lirizatl', '# Linhagem Kuetz'), lineagePalette.azulEsverdeado)
  assert.equal(codexHeadingColor('racas-skaraeb', '## **Khayat**'), lineagePalette.ciano)
  assert.equal(codexHeadingColor('racas-troll', '### **Forghum ( Ferreiros )**'), lineagePalette.laranja)
  assert.equal(codexHeadingColor('regras-regras-pericias', 'Ações'), null)
})
