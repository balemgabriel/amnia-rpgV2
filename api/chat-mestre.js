// GERADO por `npm run build:api` a partir de server/vercelEntry.ts. Não edite à mão.

// server/chatMestre.ts
import { createGroq } from "@ai-sdk/groq";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";

// src/lib/amnia/dice.ts
var DIE_FACES = 6;
var MAX_DICE = 30;
var MAX_IMPETO_REROLL = 2;
var IMPETO_REROLL_COST = 1;
function rollDie(random = Math.random) {
  return Math.floor(random() * DIE_FACES) + 1;
}
function clampDiceCount(count) {
  if (!Number.isFinite(count)) return 0;
  return Math.min(MAX_DICE, Math.max(0, Math.trunc(count)));
}
function countSuccesses(dice) {
  let normal = 0;
  let sixes = 0;
  let ones = 0;
  for (const die of dice) {
    if (die === 6) sixes += 1;
    else if (die >= 4) normal += 1;
    if (die === 1) ones += 1;
  }
  const criticalPairs = Math.floor(sixes / 2);
  const criticalFailures = Math.floor(ones / 2);
  const successes = normal + sixes + criticalPairs * 2;
  return { dice: [...dice], successes, criticalPairs, criticalFailures };
}
function rollAmniaDice(count, random = Math.random) {
  const dice = Array.from({ length: clampDiceCount(count) }, () => rollDie(random));
  return countSuccesses(dice);
}
function failedDiceIndices(dice) {
  const indices = [];
  dice.forEach((die, index) => {
    if (die >= 1 && die <= 3) indices.push(index);
  });
  return indices;
}
function resolveAmniaTest(input, random = Math.random) {
  const roll = rollAmniaDice(input.diceCount ?? 0, random);
  const rawEnemyDiceCount = input.enemyDiceCount ?? 0;
  const enemyDiceCount = Math.max(
    0,
    Math.trunc(Number.isFinite(rawEnemyDiceCount) ? rawEnemyDiceCount : 0)
  );
  const enemyRoll = enemyDiceCount > 0 ? rollAmniaDice(enemyDiceCount, random) : null;
  const enemy = enemyRoll ? {
    label: input.enemyLabel?.trim() || "Inimigo",
    ...enemyRoll
  } : void 0;
  const rawDifficulty = input.difficulty ?? 0;
  const difficulty = enemy ? 0 : Math.max(0, Math.trunc(Number.isFinite(rawDifficulty) ? rawDifficulty : 0));
  const targetSuccesses = enemy ? enemy.successes : difficulty;
  const mos = roll.successes - targetSuccesses;
  return {
    ...roll,
    label: input.label,
    ...input.test ? { test: input.test } : {},
    ...input.diceBreakdown ? { diceBreakdown: input.diceBreakdown } : {},
    difficulty,
    ...!enemy && input.difficultyReason ? { difficultyReason: input.difficultyReason } : {},
    targetSuccesses,
    mos,
    success: mos > 0,
    partial: mos === 0,
    failed: mos < 0,
    ...enemy ? { enemy } : {},
    failedIndices: failedDiceIndices(roll.dice)
  };
}
function rerollFailedDice(test, indices, random = Math.random) {
  const allowed = new Set(test.failedIndices);
  const chosen = [];
  for (const raw of indices) {
    const index = Math.trunc(Number.isFinite(raw) ? raw : -1);
    if (allowed.has(index) && !chosen.includes(index)) chosen.push(index);
    if (chosen.length >= MAX_IMPETO_REROLL) break;
  }
  if (chosen.length === 0) return test;
  const dice = [...test.dice];
  const previousValues = chosen.map((index) => dice[index] ?? 0);
  for (const index of chosen) dice[index] = rollDie(random);
  const roll = countSuccesses(dice);
  const mos = roll.successes - test.targetSuccesses;
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
      cost: IMPETO_REROLL_COST
    }
  };
}
function maculaEffectSummary(type, margin) {
  const safeMargin = Math.max(0, Math.trunc(margin));
  const key = type.toLowerCase();
  switch (key) {
    case "reforco":
      return `M\xE1cula de Refor\xE7o: ${safeMargin} de dano e \u22123 dados em rolagens f\xEDsicas at\xE9 o pr\xF3ximo descanso.`;
    case "projecao":
      return `M\xE1cula de Proje\xE7\xE3o: perde ${safeMargin} de \xCDmpeto (se ficar negativo, sofre dano equivalente \xE0 vida) e \u22123 dados em rolagens mentais at\xE9 o pr\xF3ximo descanso.`;
    case "elemental":
      return `M\xE1cula Elemental: explos\xE3o do elemento da magia causando ${safeMargin + 3} de dano.`;
    case "alteracao":
      return `M\xE1cula de Altera\xE7\xE3o: perde ${safeMargin + 3} de Limiar e ${safeMargin} de \xCDmpeto.`;
    case "multiplicacao":
      return `M\xE1cula de Multiplica\xE7\xE3o: perde ${safeMargin + 2} de \xCDmpeto e sofre ${safeMargin + 2} de dano por c\xF3pia.`;
    case "arcana":
    default:
      return `M\xE1cula Arcana: ${safeMargin} de dano e uma marca arcana persistente (narre conforme a Esfera da magia).`;
  }
}
function rollMaculaSave(input, random = Math.random) {
  const test = resolveAmniaTest(
    {
      diceCount: input.diceCount,
      difficulty: Math.max(0, Math.trunc(input.complexity)),
      label: `SAVE contra M\xE1cula (${input.maculaType})`
    },
    random
  );
  const failureMargin = Math.max(0, -test.mos);
  return {
    dice: test.dice,
    successes: test.successes,
    criticalPairs: test.criticalPairs,
    criticalFailures: test.criticalFailures,
    failureMargin,
    failed: test.failed,
    maculaType: input.maculaType,
    effectSummary: test.failed ? maculaEffectSummary(input.maculaType, failureMargin) : "SAVE passou: nenhuma M\xE1cula neste lan\xE7amento."
  };
}

// src/lib/amnia/rules.ts
var ARENA_STATE_VERSION = 1;
var MAX_LOG_ENTRIES = 30;
var THREAT_KINDS = ["mook", "fraco", "padrao", "elite", "lendario"];
var THREAT_LABELS = {
  mook: "Mook",
  fraco: "Fraco",
  padrao: "Padr\xE3o",
  elite: "Elite / Sobrenatural",
  lendario: "Lend\xE1rio"
};
function threatClockSize(kind) {
  switch (kind) {
    case "mook":
      return 1;
    case "fraco":
      return 4;
    case "padrao":
      return 6;
    case "elite":
      return 8;
    case "lendario":
      return 12;
    default:
      return 6;
  }
}
function isThreatKind(value) {
  return typeof value === "string" && THREAT_KINDS.includes(value);
}
function asRecord(value) {
  return value !== null && typeof value === "object" ? value : {};
}
function asNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function asInt(value, fallback, min, max) {
  return Math.min(max, Math.max(min, Math.trunc(asNumber(value, fallback))));
}
function asString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}
function normalizeResource(value, fallbackMax, roomAboveMax = 0, fallbackCurrent) {
  const record = asRecord(value);
  const max = asInt(record.max, fallbackMax, 0, 99);
  const current = asInt(record.current, fallbackCurrent ?? max, 0, max + roomAboveMax);
  return { current, max };
}
function normalizeClock(value, index) {
  const record = asRecord(value);
  if (Object.keys(record).length === 0) return null;
  const kind = isThreatKind(record.kind) ? record.kind : "padrao";
  const max = asInt(record.max, threatClockSize(kind), 1, 20);
  const notes = typeof record.notes === "string" && record.notes.trim() ? record.notes : void 0;
  return {
    id: asString(record.id) || `clock-${index + 1}`,
    name: asString(record.name) || `Amea\xE7a ${index + 1}`,
    current: asInt(record.current, 0, 0, max),
    max,
    kind,
    resilient: record.resilient === true,
    ...notes ? { notes } : {}
  };
}
function normalizeLog(value) {
  if (!Array.isArray(value)) return [];
  const entries = [];
  for (const raw of value.slice(-MAX_LOG_ENTRIES)) {
    const record = asRecord(raw);
    const label = asString(record.label);
    if (!label) continue;
    entries.push({
      id: asString(record.id) || `log-${entries.length + 1}`,
      at: asInt(record.at, Date.now(), 0, Number.MAX_SAFE_INTEGER),
      kind: asString(record.kind, "evento"),
      label,
      ...typeof record.detail === "string" && record.detail ? { detail: record.detail } : {}
    });
  }
  return entries;
}
function normalizeDice(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((die) => typeof die === "number" && Number.isFinite(die)).map((die) => Math.min(6, Math.max(1, Math.trunc(die)))).slice(0, MAX_DICE);
}
function normalizePendingTest(value) {
  const record = asRecord(value);
  const dice = normalizeDice(record.dice);
  if (dice.length === 0) return void 0;
  const roll = countSuccesses(dice);
  const difficulty = asInt(record.difficulty, 0, 0, 30);
  const enemyRecord = asRecord(record.enemy);
  const enemyDice = normalizeDice(enemyRecord.dice);
  const enemyRoll = enemyDice.length > 0 ? countSuccesses(enemyDice) : null;
  const targetSuccesses = enemyRoll ? enemyRoll.successes : difficulty;
  const mos = roll.successes - targetSuccesses;
  const rerollRecord = asRecord(record.impetoReroll);
  const rerollIndices = Array.isArray(rerollRecord.indices) ? rerollRecord.indices.filter((index) => typeof index === "number" && Number.isFinite(index)).map((index) => Math.trunc(index)).filter((index) => index >= 0 && index < dice.length).slice(0, MAX_IMPETO_REROLL) : [];
  const previousValues = Array.isArray(rerollRecord.previousValues) ? rerollRecord.previousValues.filter((die) => typeof die === "number" && Number.isFinite(die)).map((die) => Math.min(6, Math.max(1, Math.trunc(die)))).slice(0, MAX_IMPETO_REROLL) : [];
  const test = asString(record.test).trim();
  const breakdown = asString(record.diceBreakdown).trim();
  const reason = asString(record.difficultyReason).trim();
  return {
    id: asString(record.id).trim() || `test-${Date.now()}`,
    createdAt: asInt(record.createdAt, Date.now(), 0, Number.MAX_SAFE_INTEGER),
    label: asString(record.label).trim() || test || "Teste",
    ...test ? { test } : {},
    ...breakdown ? { diceBreakdown: breakdown } : {},
    ...roll,
    difficulty: enemyRoll ? 0 : difficulty,
    ...reason && !enemyRoll ? { difficultyReason: reason } : {},
    targetSuccesses,
    mos,
    success: mos > 0,
    partial: mos === 0,
    failed: mos < 0,
    ...enemyRoll ? {
      enemy: {
        label: asString(enemyRecord.label).trim() || "Inimigo",
        ...enemyRoll
      }
    } : {},
    failedIndices: failedDiceIndices(dice),
    ...rerollIndices.length > 0 ? {
      impetoReroll: {
        indices: rerollIndices,
        previousValues,
        cost: IMPETO_REROLL_COST
      }
    } : {}
  };
}
function normalizeGameState(raw, max) {
  const source = asRecord(raw);
  const sourceResources = asRecord(source.resources);
  const resources = {
    pv: normalizeResource(sourceResources.pv, max.pv),
    pm: normalizeResource(sourceResources.pm, max.pm),
    // O Limiar pode passar do máximo (Sobrecarga), então há espaço acima.
    // Sem estado salvo ele começa em zero: a carga sobe ao gastar PM.
    limiar: normalizeResource(sourceResources.limiar, max.limiar, 99, 0),
    impeto: normalizeResource(sourceResources.impeto, max.impeto),
    pa: normalizeResource(sourceResources.pa, max.pa)
  };
  const clocks = [];
  if (Array.isArray(source.clocks)) {
    source.clocks.forEach((entry, index) => {
      const clock = normalizeClock(entry, index);
      if (clock) clocks.push(clock);
    });
  }
  const pendingTest = normalizePendingTest(source.pendingTest);
  return {
    version: ARENA_STATE_VERSION,
    turn: asInt(source.turn, 1, 1, 999),
    resources,
    overloaded: resources.limiar.current > resources.limiar.max,
    suppressed: source.suppressed === true,
    clocks,
    log: normalizeLog(source.log),
    ...pendingTest ? { pendingTest } : {}
  };
}
function clonePendingTest(test) {
  return {
    ...test,
    dice: [...test.dice],
    failedIndices: [...test.failedIndices],
    ...test.enemy ? { enemy: { ...test.enemy, dice: [...test.enemy.dice] } } : {},
    ...test.impetoReroll ? {
      impetoReroll: {
        ...test.impetoReroll,
        indices: [...test.impetoReroll.indices],
        previousValues: [...test.impetoReroll.previousValues]
      }
    } : {}
  };
}
function cloneState(state) {
  return {
    ...state,
    resources: {
      pv: { ...state.resources.pv },
      pm: { ...state.resources.pm },
      limiar: { ...state.resources.limiar },
      impeto: { ...state.resources.impeto },
      pa: { ...state.resources.pa }
    },
    clocks: state.clocks.map((clock) => ({ ...clock })),
    log: [...state.log],
    ...state.pendingTest ? { pendingTest: clonePendingTest(state.pendingTest) } : {}
  };
}
function withLog(state, kind, label, detail) {
  const entry = {
    id: `log-${state.log.length + 1}-${Date.now()}`,
    at: Date.now(),
    kind,
    label,
    ...detail ? { detail } : {}
  };
  return { ...state, log: [...state.log, entry].slice(-MAX_LOG_ENTRIES) };
}
function appendArenaLog(state, kind, label, detail) {
  return withLog(state, kind, label, detail);
}
function applyImpetoReroll(state, indices, random = Math.random) {
  const pending = state.pendingTest;
  if (!pending) {
    return { ok: false, error: "N\xE3o h\xE1 teste pendente para rerrolar. Role um teste primeiro." };
  }
  if (state.resources.impeto.current < IMPETO_REROLL_COST) {
    return { ok: false, error: "\xCDmpeto insuficiente para rerrolar." };
  }
  const allowed = new Set(pending.failedIndices);
  const chosen = [...new Set(indices.map((index) => Math.trunc(index)))].filter((index) => allowed.has(index)).slice(0, MAX_IMPETO_REROLL);
  if (chosen.length === 0) {
    return { ok: false, error: "Escolha ao menos um dado falho para rerrolar." };
  }
  const rerolled = rerollFailedDice(pending, chosen, random);
  const next = cloneState(state);
  next.resources.impeto.current = Math.max(
    0,
    next.resources.impeto.current - IMPETO_REROLL_COST
  );
  next.pendingTest = {
    ...rerolled,
    id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now()
  };
  const previous = rerolled.impetoReroll?.previousValues ?? [];
  const nextValues = chosen.map((index) => rerolled.dice[index] ?? 0);
  const target = rerolled.enemy ? `defesa do Mestre (${rerolled.enemy.successes})` : `DIF ${rerolled.difficulty}`;
  const message = [
    `\xCDmpeto \u22121 (${next.resources.impeto.current}/${next.resources.impeto.max}).`,
    `Dados ${chosen.map((index) => index + 1).join(" e ")}: [${previous.join(", ")}] \u2192 [${nextValues.join(", ")}].`,
    `${rerolled.successes} sucesso(s) vs ${target} (MoS ${rerolled.mos >= 0 ? "+" : ""}${rerolled.mos}).`
  ].join(" ");
  return {
    ok: true,
    state: withLog(next, "impeto", "Rerrolagem de \xCDmpeto", message),
    test: next.pendingTest,
    message
  };
}
function startTurn(state) {
  const next = cloneState(state);
  next.turn = state.turn + 1;
  next.resources.pa.current = next.resources.pa.max;
  next.resources.pm.current = next.resources.pm.max;
  next.suppressed = false;
  next.overloaded = next.resources.limiar.current > next.resources.limiar.max;
  delete next.pendingTest;
  return withLog(next, "turno", `Turno ${next.turn} come\xE7ou`, "PA e PM restaurados.");
}
function spendActionPoints(input) {
  const amount = Math.max(1, Math.trunc(Number.isFinite(input.amount) ? input.amount : 1));
  const available = Math.max(0, Math.trunc(Number.isFinite(input.currentPa) ? input.currentPa : 0));
  const blocked = amount > available;
  const spent = blocked ? 0 : amount;
  const newPa = available - spent;
  const message = blocked ? `${input.actionName || "A\xE7\xE3o"}: PA insuficiente (${available} dispon\xEDvel, ${amount} necess\xE1rio). A a\xE7\xE3o n\xE3o acontece neste turno.` : `${input.actionName || "A\xE7\xE3o"}: gastou ${spent} PA. PA ${available} \u2192 ${newPa}.`;
  return { spent, newPa, blocked, message };
}
function spendMana(input) {
  const amount = Math.max(0, Math.trunc(Number.isFinite(input.amount) ? input.amount : 0));
  const newMana = Math.max(0, Math.trunc(input.currentPlayerMana) - amount);
  const newThreshold = Math.max(0, Math.trunc(input.currentThreshold) + amount);
  const maxThreshold = Math.max(0, Math.trunc(input.maxThreshold));
  const overloaded = newThreshold > maxThreshold;
  const parts = [
    `${input.spellName || "Magia"}: gastou ${amount} PM.`,
    `Mana ${Math.trunc(input.currentPlayerMana)} \u2192 ${newMana}.`,
    `Limiar ${Math.trunc(input.currentThreshold)} \u2192 ${newThreshold}/${maxThreshold}.`
  ];
  if (overloaded) {
    parts.push("SOBRECARGA: o Limiar passou do m\xE1ximo. Lan\xE7ar magia agora exige SAVE contra M\xE1cula.");
  }
  return { newMana, newThreshold, overloaded, message: parts.join(" ") };
}
function suppressMana(state, keyAttributeValue) {
  const next = cloneState(state);
  const cooling = 2 + Math.max(0, Math.trunc(keyAttributeValue));
  const before = next.resources.limiar.current;
  next.resources.limiar.current = Math.max(0, before - cooling);
  next.resources.pm.current = 0;
  next.suppressed = true;
  next.overloaded = next.resources.limiar.current > next.resources.limiar.max;
  return withLog(
    next,
    "supressao",
    "Supress\xE3o Arcana",
    `Limiar ${before} \u2192 ${next.resources.limiar.current} (\u2212${cooling}). Mana cortada at\xE9 o pr\xF3ximo turno.`
  );
}
function calculateEnemyDamage(input) {
  const base = Math.max(0, Math.trunc(Number.isFinite(input.baseWeaponDamage) ? input.baseWeaponDamage : 0));
  const mos = Math.trunc(Number.isFinite(input.mos) ? input.mos : 0);
  const hit = mos > 0;
  if (input.isMook) {
    const damage2 = hit ? 1 : 0;
    return {
      damage: damage2,
      baseWeaponDamage: base,
      effectiveBase: 1,
      mos,
      isMook: true,
      isResilient: input.isResilient,
      note: hit ? "Mook: qualquer ataque com MoS > 0 derruba o inimigo (1 segmento)." : "Mook: o ataque n\xE3o acertou (MoS \u2264 0), nenhum segmento."
    };
  }
  const effectiveBase = input.isResilient ? Math.floor(base / 2) : base;
  const damage = hit ? Math.max(1, effectiveBase + mos) : 0;
  const note = hit ? input.isResilient ? `Resiliente: base ${base} \xF7 2 = ${effectiveBase}, + MoS ${mos} = ${damage} segmento(s).` : `Base ${effectiveBase} + MoS ${mos} = ${damage} segmento(s).` : "Ataque n\xE3o acertou (MoS \u2264 0): nenhum segmento.";
  return {
    damage,
    baseWeaponDamage: base,
    effectiveBase,
    mos,
    isMook: false,
    isResilient: input.isResilient,
    note
  };
}
function advanceThreatClock(input) {
  const max = Math.max(1, Math.trunc(Number.isFinite(input.max) ? input.max : 1));
  const previous = Math.min(max, Math.max(0, Math.trunc(input.current)));
  const delta = Math.trunc(Number.isFinite(input.delta) ? input.delta : 0);
  const current = Math.min(max, Math.max(0, previous + delta));
  return {
    name: input.clockName,
    previous,
    current,
    max,
    completed: current >= max
  };
}
function upsertThreatClock(state, input) {
  const name = input.clockName.trim() || "Amea\xE7a";
  const existing = state.clocks.find(
    (clock) => clock.name.toLowerCase() === name.toLowerCase()
  );
  const result = advanceThreatClock({
    ...input,
    clockName: name,
    current: existing?.current ?? input.current,
    max: existing?.max ?? input.max
  });
  const next = cloneState(state);
  const index = next.clocks.findIndex(
    (clock) => clock.name.toLowerCase() === name.toLowerCase()
  );
  if (index >= 0) {
    const clock = next.clocks[index];
    if (clock) next.clocks[index] = { ...clock, current: result.current };
  } else {
    next.clocks.push({
      id: `clock-${next.clocks.length + 1}`,
      name,
      current: result.current,
      max: result.max,
      kind: "padrao",
      resilient: false
    });
  }
  return {
    state: withLog(
      next,
      "relogio",
      `${name}: ${result.previous} \u2192 ${result.current}/${result.max}`,
      result.completed ? "Rel\xF3gio completo." : void 0
    ),
    result
  };
}
var ATTRIBUTE_IDS = [
  "forca",
  "destreza",
  "carisma",
  "inteligencia",
  "vontade"
];
function damagePv(state, amount) {
  const damage = Math.max(0, Math.trunc(Number.isFinite(amount) ? amount : 0));
  state.resources.pv.current = Math.max(0, state.resources.pv.current - damage);
  return damage;
}
function applyMaculaEffect(state, type, margin) {
  const safeMargin = Math.max(0, Math.trunc(Number.isFinite(margin) ? margin : 0));
  const key = type.trim().toLowerCase();
  const next = cloneState(state);
  let label = `M\xE1cula (${type || "arcana"}) \u2014 margem ${safeMargin}`;
  let detail = "";
  switch (key) {
    case "reforco": {
      const damage = damagePv(next, safeMargin);
      label = "M\xE1cula de Refor\xE7o";
      detail = `${damage} de dano. Debuff f\xEDsico: \u22123 dados em rolagens f\xEDsicas at\xE9 o pr\xF3ximo descanso.`;
      break;
    }
    case "projecao": {
      const available = next.resources.impeto.current;
      const lost = Math.min(available, safeMargin);
      next.resources.impeto.current = available - lost;
      const overflow = safeMargin - lost;
      const damage = damagePv(next, overflow);
      label = "M\xE1cula de Proje\xE7\xE3o";
      detail = `Perdeu ${lost} de \xCDmpeto${damage > 0 ? ` e sofreu ${damage} de dano pelo excedente` : ""}. \u22123 dados em rolagens mentais at\xE9 o pr\xF3ximo descanso.`;
      break;
    }
    case "elemental": {
      const damage = damagePv(next, safeMargin + 3);
      label = "M\xE1cula Elemental";
      detail = `Explos\xE3o elemental causando ${damage} de dano.`;
      break;
    }
    case "alteracao": {
      next.resources.limiar.current = Math.max(0, next.resources.limiar.current - (safeMargin + 3));
      next.resources.impeto.current = Math.max(0, next.resources.impeto.current - safeMargin);
      label = "M\xE1cula de Altera\xE7\xE3o";
      detail = `Perdeu ${safeMargin + 3} de Limiar e ${safeMargin} de \xCDmpeto.`;
      break;
    }
    case "multiplicacao": {
      next.resources.impeto.current = Math.max(0, next.resources.impeto.current - (safeMargin + 2));
      const damage = damagePv(next, safeMargin + 2);
      label = "M\xE1cula de Multiplica\xE7\xE3o";
      detail = `Perdeu ${safeMargin + 2} de \xCDmpeto e sofreu ${damage} de dano por c\xF3pia.`;
      break;
    }
    case "arcana":
    default: {
      const damage = damagePv(next, safeMargin);
      label = "M\xE1cula Arcana";
      detail = `${damage} de dano e uma marca arcana persistente.`;
      break;
    }
  }
  next.overloaded = next.resources.limiar.current > next.resources.limiar.max;
  return withLog(next, "macula", label, detail);
}
function normalizeMaxValues(value) {
  const record = asRecord(value);
  const valueOrZero = (key) => asInt(record[key], 0, 0, 999);
  return {
    pv: valueOrZero("pv"),
    pm: valueOrZero("pm"),
    limiar: valueOrZero("limiar"),
    impeto: valueOrZero("impeto"),
    pa: valueOrZero("pa")
  };
}
function normalizeStringList(value, limit) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean).slice(0, limit);
}
function normalizeSheetSummary(raw) {
  const record = asRecord(raw);
  const attributesRecord = asRecord(record.attributes);
  const attributes = {};
  for (const id of ATTRIBUTE_IDS) {
    attributes[id] = asInt(attributesRecord[id], 0, 0, 99);
  }
  const skills = Array.isArray(record.skills) ? record.skills.map((entry) => {
    const skill = asRecord(entry);
    const name = asString(skill.name).trim();
    if (!name) return null;
    return { name, value: asInt(skill.value, 0, 0, 99) };
  }).filter((skill) => skill !== null).slice(0, 20) : [];
  const runes = Array.isArray(record.runes) ? record.runes.map((entry) => {
    const rune = asRecord(entry);
    const name = asString(rune.name).trim();
    if (!name) return null;
    return { name, circle: asString(rune.circle).trim() };
  }).filter((rune) => rune !== null).slice(0, 40) : [];
  const spells = Array.isArray(record.spells) ? record.spells.map((entry) => {
    const spell = asRecord(entry);
    const name = asString(spell.name).trim();
    if (!name) return null;
    return {
      name,
      cost: asInt(spell.cost, 0, 0, 999),
      summary: asString(spell.summary).trim(),
      effect: asString(spell.effect).trim()
    };
  }).filter(
    (spell) => spell !== null
  ).slice(0, 40) : [];
  const keyAttribute = asString(record.keyAttribute).trim();
  return {
    id: asString(record.id).trim(),
    name: asString(record.name).trim() || "Personagem sem nome",
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
    notes: asString(record.notes).trim()
  };
}

// src/lib/amnia/testResolver.ts
var ATTRIBUTE_ALIASES = {
  forca: "forca",
  for: "forca",
  destreza: "destreza",
  des: "destreza",
  carisma: "carisma",
  car: "carisma",
  inteligencia: "inteligencia",
  int: "inteligencia",
  vontade: "vontade",
  von: "vontade"
};
var ATTRIBUTE_LABELS = {
  forca: "For\xE7a",
  destreza: "Destreza",
  carisma: "Carisma",
  inteligencia: "Intelig\xEAncia",
  vontade: "Vontade"
};
function normalizeKey(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
function splitTokens(value) {
  return value.split(/[+,/|()]|\bvs\b|\bversus\b|\bcontra\b|\be\b/gi).map((token) => token.trim()).filter(Boolean);
}
function findSkill(sheet, token) {
  const key = normalizeKey(token);
  if (!key) return void 0;
  const exact = sheet.skills.find((skill) => normalizeKey(skill.name) === key);
  if (exact) return exact;
  return sheet.skills.find((skill) => {
    const name = normalizeKey(skill.name);
    return name.includes(key) || key.includes(name);
  });
}
function findAttribute(token) {
  return ATTRIBUTE_ALIASES[normalizeKey(token)];
}
function clampDice(count) {
  return Math.min(MAX_DICE, Math.max(0, Math.trunc(Number.isFinite(count) ? count : 0)));
}
function resolveTestPool(sheet, input) {
  if (typeof input.diceCount === "number" && Number.isFinite(input.diceCount)) {
    const count = clampDice(input.diceCount);
    return {
      diceCount: count,
      breakdown: `${count}d6 (definido pelo Mestre)`,
      source: "manual"
    };
  }
  const tokens = [input.attribute, input.skill, input.test].filter((value) => typeof value === "string" && value.trim().length > 0).flatMap(splitTokens);
  let skill = input.skill ? findSkill(sheet, input.skill) : void 0;
  if (!skill) {
    for (const token of tokens) {
      skill = findSkill(sheet, token);
      if (skill) break;
    }
  }
  let attributeId = input.attribute ? findAttribute(input.attribute) : void 0;
  if (!attributeId) {
    for (const token of tokens) {
      attributeId = findAttribute(token);
      if (attributeId) break;
    }
  }
  const attribute = attributeId ? {
    id: attributeId,
    name: ATTRIBUTE_LABELS[attributeId],
    value: sheet.attributes[attributeId] ?? 0
  } : void 0;
  const skillValue = skill?.value ?? 0;
  const attributeValue = attribute?.value ?? 0;
  let diceCount = skillValue + attributeValue;
  if (diceCount <= 0) {
    const keyId = sheet.keyAttribute;
    const keyValue = keyId ? sheet.attributes[keyId] ?? 0 : 0;
    const fallback = clampDice(Math.max(1, keyValue || 3));
    return {
      diceCount: fallback,
      ...attribute ? { attribute } : {},
      breakdown: `${fallback}d6 (sem per\xEDcia reconhecida; base do atributo chave)`,
      source: "fallback"
    };
  }
  diceCount = clampDice(diceCount);
  const parts = [];
  if (skill) parts.push(`${skill.name} ${skill.value}`);
  if (attribute) parts.push(`${attribute.name} ${attribute.value}`);
  return {
    diceCount,
    ...skill ? { skill } : {},
    ...attribute ? { attribute } : {},
    breakdown: `${parts.join(" + ")} = ${diceCount}d6`,
    source: "sheet"
  };
}

// src/lib/amnia/prompt.ts
var ATTRIBUTE_LABELS2 = {
  forca: "FOR",
  destreza: "DES",
  carisma: "CAR",
  inteligencia: "INT",
  vontade: "VON"
};
function sheetBlock(sheet) {
  const attributes = Object.entries(sheet.attributes).map(([id, value]) => `${ATTRIBUTE_LABELS2[id] ?? id} ${value}`).join(" \xB7 ");
  const skills = sheet.skills.length > 0 ? sheet.skills.map((skill) => `${skill.name} ${skill.value}`).join(", ") : "nenhuma per\xEDcia treinada";
  const runes = sheet.runes.length > 0 ? sheet.runes.map((rune) => `${rune.name} (${rune.circle})`).join(", ") : "nenhuma runa conhecida";
  const spells = sheet.spells.length > 0 ? sheet.spells.map((spell) => `"${spell.name}" (${spell.cost} PM) \u2014 ${spell.summary}. ${spell.effect}`).join("\n  ") : "nenhuma magia preparada";
  const inventory = sheet.inventory.length > 0 ? sheet.inventory.join(", ") : "sem equipamento registrado";
  return [
    `Nome: ${sheet.name || "Sem nome"}`,
    `Conceito: ${sheet.concept || "\u2014"}`,
    `Classe: ${sheet.className || "\u2014"}`,
    `Ancestralidade: ${sheet.ancestry || "\u2014"}`,
    `Atributo chave: ${sheet.keyAttribute ?? "\u2014"}`,
    `Atributos: ${attributes}`,
    `M\xE1ximos: PV ${sheet.max.pv} \xB7 PM ${sheet.max.pm} \xB7 Limiar ${sheet.max.limiar} \xB7 \xCDmpeto ${sheet.max.impeto} \xB7 PA ${sheet.max.pa}`,
    `Per\xEDcias: ${skills}`,
    `Runas conhecidas: ${runes}`,
    `Magias preparadas:
  ${spells}`,
    `\xCDmpeto: ${sheet.impulse || "\u2014"}`,
    `Convic\xE7\xF5es: ${sheet.convictions.length > 0 ? sheet.convictions.join(" | ") : "\u2014"}`,
    `Equipamento: ${inventory}`,
    sheet.notes ? `Anota\xE7\xF5es da ficha: ${sheet.notes}` : ""
  ].filter(Boolean).join("\n");
}
function stateBlock(state) {
  const { pv, pm, limiar, impeto, pa } = state.resources;
  const clocks = state.clocks.length > 0 ? state.clocks.map(
    (clock) => `${clock.name} [${THREAT_LABELS[clock.kind]}] ${clock.current}/${clock.max}${clock.resilient ? " (resiliente)" : ""}${clock.notes ? ` \u2014 ${clock.notes}` : ""}`
  ).join("\n  ") : "nenhum rel\xF3gio ativo";
  const log = state.log.length > 0 ? state.log.slice(-6).map((entry) => `- ${entry.label}${entry.detail ? ` (${entry.detail})` : ""}`).join("\n") : "- sem eventos recentes";
  const pending = state.pendingTest;
  const pendingBlock = pending ? [
    `Teste pendente: ${pending.test || pending.label}`,
    `Jogador [${pending.dice.join(", ")}] = ${pending.successes} sucesso(s)${pending.enemy ? ` \xB7 Mestre (${pending.enemy.label}) [${pending.enemy.dice.join(", ")}] = ${pending.enemy.successes} sucesso(s)` : ` \xB7 DIF ${pending.difficulty}`} \xB7 MoS ${pending.mos >= 0 ? "+" : ""}${pending.mos}`,
    `Dados falhos do jogador (\xEDndices 0-based): ${pending.failedIndices.length > 0 ? pending.failedIndices.join(", ") : "nenhum"}`
  ].join("\n") : "Nenhum teste pendente.";
  return [
    `Turno: ${state.turn}`,
    `PV ${pv.current}/${pv.max} \xB7 PM ${pm.current}/${pm.max} \xB7 Limiar ${limiar.current}/${limiar.max} \xB7 \xCDmpeto ${impeto.current}/${impeto.max} \xB7 PA ${pa.current}/${pa.max}`,
    `Sobrecarga: ${state.overloaded ? "SIM" : "n\xE3o"} \xB7 Supress\xE3o ativa: ${state.suppressed ? "SIM" : "n\xE3o"}`,
    `Rel\xF3gios de amea\xE7a:
  ${clocks}`,
    `Eventos recentes:
${log}`,
    pendingBlock
  ].join("\n");
}
function buildArenaSystemPrompt(sheet, state, extraNote) {
  const resolvedEvent = extraNote?.trim() ? `

## Evento j\xE1 resolvido pelo motor
${extraNote.trim()}
Narre este resultado usando exatamente os n\xFAmeros acima. N\xE3o role novamente, n\xE3o gaste PA e n\xE3o invente dados.` : "";
  return `Voc\xEA \xE9 o Mestre de RPG de Amnia.
Narre em portugu\xEAs brasileiro, com tom sombrio, t\xE1tico, cinematogr\xE1fico e claro.

Voc\xEA N\xC3O \xE9 o motor de regras. Voc\xEA \xE9 o narrador.
Todas as rolagens, danos, gastos de PM, PA, Sobrecarga, M\xE1culas e rel\xF3gios devem ser calculados pelas ferramentas dispon\xEDveis.
Nunca invente resultados de dados. Nunca diga que rolou dados sem ter usado uma ferramenta.
Nunca altere PV, PM, Limiar, \xCDmpeto, PA ou Rel\xF3gios "por conta pr\xF3pria": use as ferramentas.

## Regras principais
- Jogadores t\xEAm 4 PA por turno. Rea\xE7\xF5es usam o PA restante do turno anterior.
- TODA a\xE7\xE3o declarada que custa PA (atacar, mover, manobrar, lan\xE7ar magia, ajudar) \u2192 chame \`spend_action_points\` ANTES de rolar ou narrar. Sem PA suficiente a a\xE7\xE3o \xE9 bloqueada e o teste n\xE3o acontece. N\xE3o cobre PA duas vezes pela mesma a\xE7\xE3o.
- A\xE7\xF5es repetidas (ex.: atacar de novo) sofrem \u22122 dados por repeti\xE7\xE3o.
- Testes usam d6 empilhados: 4\u20136 = 1 sucesso, 1\u20133 = falha. Par de 6 = 4 sucessos no total (cr\xEDtico). Par de 1 = falha cr\xEDtica.
- Monte o teste como o material pede: per\xEDcia + atributo (ex.: "Armas Brancas + Destreza"). Envie \`test\`, \`skill\` e \`attribute\` para \`roll_test\`; o servidor soma os valores da ficha. N\xE3o calcule a pilha de cabe\xE7a.
- Ataque/defesa oposto: o defensor rola a pilha dele. Envie \`enemyDiceCount\` e \`enemyLabel\`; a MoS \xE9 sucessos do jogador \u2212 sucessos do Mestre. N\xC3O use DIF em teste oposto.
- Sem ficha de inimigo, use uma pilha coerente com a amea\xE7a: mook 2, fraco 3, padr\xE3o 4, elite 5, lend\xE1rio 6.
- DIF \xE9 situacional e normalmente 0. S\xF3 use DIF quando a fic\xE7\xE3o imp\xF5e resist\xEAncia passiva (escurid\xE3o, chuva, terreno, pressa, ferimento). Escala: 1 dif\xEDcil, 2 muito dif\xEDcil, 3 extremo. NUNCA use DIF 2 por padr\xE3o; a dificuldade principal vem da margem (MoS) e das consequ\xEAncias.
- Margem de Sucesso (MoS) = sucessos \u2212 alvo (DIF ou defesa do inimigo). MoS < 0 falha; MoS = 0 empate/sucesso parcial; MoS > 0 sucesso. Narre consequ\xEAncias proporcionais \xE0 margem.
- \xCDmpeto: 1 ponto rerrola at\xE9 2 dados falhos ESCOLHIDOS PELO JOGADOR. Quando um teste falhar e houver \xCDmpeto, mostre os dados falhos e pergunte quais ele quer rerrolar. A interface oferece a sele\xE7\xE3o; se o jogador pedir por texto, use \`reroll_with_impeto\` com os \xEDndices 0-based do teste pendente. Nunca escolha os dados por ele.
- Inimigos significativos N\xC3O usam PV: usam Rel\xF3gios de Amea\xE7a (segmentos).
  Mook = 1 (cai com qualquer acerto), Fraco = 4, Padr\xE3o = 6, Elite/Sobrenatural = 8, Lend\xE1rio = 10\u201312.
- Inimigo resiliente: apenas a base da arma \xE9 dividida pela metade; a MoS permanece inteira.
- Todo ataque bem-sucedido causa no m\xEDnimo 1 segmento.
- PM gasto aumenta o Limiar na mesma quantidade. O Limiar N\xC3O reseta no come\xE7o do turno.
- Limiar acima do m\xE1ximo = Sobrecarga. Lan\xE7ar magia em Sobrecarga exige SAVE (Ocultismo/Arcanismo + VON) com dificuldade igual \xE0 Complexidade da magia; falha gera M\xE1cula.
- M\xE1cula de Refor\xE7o: dano igual \xE0 margem de falha + debuff f\xEDsico. As demais M\xE1culas seguem o tipo retornado pela ferramenta.
- Supress\xE3o: resfria o Limiar em 2 + atributo chave, corta a mana e impede magia at\xE9 o pr\xF3ximo turno.
- Encerrar turno restaura PA e PM, encerra a Supress\xE3o e limpa o teste pendente. O Limiar N\xC3O reseta.

## Uso obrigat\xF3rio das ferramentas
- A\xE7\xE3o declarada \u2192 \`spend_action_points\` (custo em PA; padr\xE3o 1) antes de tudo.
- Qualquer teste, ataque, defesa ou per\xEDcia \u2192 \`roll_test\` ANTES de narrar o resultado.
- Dano contra inimigo \u2192 \`calculate_enemy_damage\` e depois \`advance_threat_clock\` para o rel\xF3gio do alvo.
- Gasto de PM / magia \u2192 \`spend_mana\` ANTES de narrar (e \`roll_macula_save\` se houver Sobrecarga).
- Rerrolagem de \xCDmpeto pedida pelo jogador \u2192 \`reroll_with_impeto\`, somente depois de ele escolher os dados falhos.
- Jogador declara que encerra o turno \u2192 \`end_turn\`. Jogador declara Supress\xE3o \u2192 \`enter_suppression\`.
- Se a mensagem j\xE1 traz um "Evento j\xE1 resolvido pelo motor" de turno ou Supress\xE3o, N\xC3O chame a ferramenta de novo: apenas narre o resultado.
- Rel\xF3gio de amea\xE7a que avan\xE7a ou recua \u2192 \`advance_threat_clock\`.
- Use os n\xFAmeros REAIS retornados pelas ferramentas. Cite dados, sucessos, MoS e segmentos na narra\xE7\xE3o quando relevante.
- Na interface, os dados do jogador aparecem com contorno verde e os do Mestre/inimigo com contorno vermelho. Use os resultados exatos das ferramentas.

## Regra de ferro
Se a sua resposta menciona um n\xFAmero de regra (dados, sucessos, MoS, dano, PM, Limiar, \xCDmpeto, PA ou segmentos de rel\xF3gio), esse n\xFAmero S\xD3 pode vir do resultado de uma ferramenta chamada nesta mesma resposta. Sem ferramenta, n\xE3o narre o n\xFAmero e n\xE3o diga que o recurso mudou. Em especial: toda magia come\xE7a com \`spend_mana\`, mesmo que o custo pare\xE7a \xF3bvio, e toda a\xE7\xE3o declarada come\xE7a com \`spend_action_points\`.

## Ficha do personagem
${sheetBlock(sheet)}

## Estado atual da mesa
${stateBlock(state)}${resolvedEvent}

## Formato da resposta
- 2 a 4 par\xE1grafos curtos.
- Termine perguntando o que o jogador faz.
- Se houver risco mec\xE2nico importante (Sobrecarga, M\xE1cula, morte, rel\xF3gio completo), destaque de forma clara.`;
}

// server/chatMestre.ts
var MISSING_KEY_ERROR = "Groq API key ausente. Configure GROQ_API_KEY.";
var DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
var messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(8e3)
});
var requestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(60),
  fichaPersonagem: z.unknown(),
  gameState: z.unknown().optional(),
  /** Rerrolagem de Ímpeto escolhida na interface (dados falhos, 0-based). */
  impetoReroll: z.object({
    indices: z.array(z.number().int().min(0).max(29)).min(1).max(2)
  }).optional(),
  /**
   * Ação de mesa disparada por botão (Encerrar turno / Supressão). O motor
   * aplica o efeito ANTES de chamar o modelo; a narração só descreve o que já
   * aconteceu. `id` é um nonce local para diferenciar cliques.
   */
  tableAction: z.object({
    type: z.enum(["end_turn", "suppress"]),
    id: z.number().int().optional()
  }).optional()
});
var MAX_HISTORY = 24;
function nextTestId() {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
function buildTools(sheet, getState, setState, keyAttributeValue, guard) {
  return {
    spend_action_points: tool({
      description: "OBRIGAT\xD3RIO quando o jogador declara uma a\xE7\xE3o que custa PA (atacar, mover, manobrar, lan\xE7ar magia, ajudar, reagir). Gasta o PA ANTES de rolar ou narrar. Sem PA suficiente a a\xE7\xE3o \xE9 bloqueada e o teste n\xE3o acontece. Custo padr\xE3o 1. N\xE3o cobre PA duas vezes pela mesma a\xE7\xE3o.",
      inputSchema: z.object({
        amount: z.number().int().min(1).max(4).describe("Custo em PA da a\xE7\xE3o (normalmente 1)."),
        actionName: z.string().min(1).max(120).describe('A\xE7\xE3o declarada, ex.: "atacar o bandido".')
      }),
      execute: async (input) => {
        const state = getState();
        const result = spendActionPoints({
          amount: input.amount,
          actionName: input.actionName,
          currentPa: state.resources.pa.current
        });
        const next = {
          ...state,
          resources: {
            ...state.resources,
            pa: { ...state.resources.pa, current: result.newPa }
          }
        };
        setState(
          appendArenaLog(
            next,
            "acao",
            `${input.actionName}: ${result.blocked ? "bloqueada por falta de PA" : `\u2212${result.spent} PA`}`,
            result.message
          )
        );
        return result;
      }
    }),
    roll_test: tool({
      description: "Rola um teste de Amnia com d6 empilhados e calcula sucessos, alvo e Margem de Sucesso (MoS). Use SEMPRE antes de narrar qualquer ataque, defesa, per\xEDcia ou resist\xEAncia. Monte o teste como o Mestre pediu (per\xEDcia + atributo): envie test/skill/attribute e o servidor soma os valores da ficha. Em ataques/defesas opostos, envie tamb\xE9m enemyDiceCount/enemyLabel: a MoS vira sucessos do jogador \u2212 sucessos do Mestre e a DIF \xE9 ignorada. Nunca invente dados.",
      inputSchema: z.object({
        test: z.string().min(1).max(160).describe('Teste pedido, ex.: "Armas brancas + Destreza" ou "Vontade vs medo".'),
        skill: z.string().max(80).optional().describe('Per\xEDcia usada, ex.: "Armas brancas".'),
        attribute: z.enum(["forca", "destreza", "carisma", "inteligencia", "vontade"]).optional().describe('Atributo usado, ex.: "destreza".'),
        diceCount: z.number().int().min(0).max(30).optional().describe(
          "S\xF3 para modificadores expl\xEDcitos (ex.: \u22122 por repeti\xE7\xE3o). Se omitido, o servidor soma per\xEDcia + atributo da ficha."
        ),
        difficulty: z.number().int().min(0).max(30).optional().describe(
          "DIF situacional. Padr\xE3o 0. S\xF3 use quando a fic\xE7\xE3o imp\xF5e resist\xEAncia passiva; ignorada em teste oposto."
        ),
        difficultyReason: z.string().max(160).optional().describe('Por que a DIF \xE9 essa (ex.: "escurid\xE3o total").'),
        enemyDiceCount: z.number().int().min(0).max(30).optional().describe("Pilha de defesa do inimigo (dados do Mestre) em um teste oposto."),
        enemyLabel: z.string().max(120).optional().describe('Quem est\xE1 defendendo, ex.: "Bandido \u2014 Atletismo + Destreza".')
      }),
      execute: async (input) => {
        const pool = resolveTestPool(sheet, input);
        const result = resolveAmniaTest({
          diceCount: pool.diceCount,
          difficulty: input.difficulty ?? 0,
          difficultyReason: input.difficultyReason,
          label: input.test,
          test: input.test,
          diceBreakdown: pool.breakdown,
          enemyDiceCount: input.enemyDiceCount,
          enemyLabel: input.enemyLabel
        });
        const pending = {
          ...result,
          id: nextTestId(),
          createdAt: Date.now()
        };
        const targetDetail = result.enemy ? `Mestre (${result.enemy.label}) [${result.enemy.dice.join(", ")}] = ${result.enemy.successes}` : `DIF ${result.difficulty}${result.difficultyReason ? ` (${result.difficultyReason})` : ""}`;
        let next = appendArenaLog(
          getState(),
          "rolagem",
          `${result.label}: ${result.successes} sucesso(s) vs ${result.targetSuccesses} (MoS ${result.mos >= 0 ? "+" : ""}${result.mos})`,
          `${pool.breakdown} \xB7 Jogador [${result.dice.join(", ")}] = ${result.successes} \xB7 ${targetDetail}${result.criticalPairs > 0 ? " \xB7 cr\xEDtico (par de 6)" : ""}${result.criticalFailures > 0 ? " \xB7 falha cr\xEDtica (par de 1)" : ""}`
        );
        next = { ...next, pendingTest: pending };
        setState(next);
        return { ...result, testId: pending.id };
      }
    }),
    reroll_with_impeto: tool({
      description: "Rerrola at\xE9 2 dados falhos do \xFAltimo teste usando 1 ponto de \xCDmpeto. Use SOMENTE depois que o jogador escolher quais dados falhos rerrolar. Os \xEDndices s\xE3o 0-based conforme o teste pendente no estado da mesa. Nunca escolha os dados pelo jogador.",
      inputSchema: z.object({
        indices: z.array(z.number().int().min(0).max(29)).min(1).max(2).describe("\xCDndices 0-based dos dados falhos escolhidos pelo jogador.")
      }),
      execute: async (input) => {
        const outcome = applyImpetoReroll(getState(), input.indices);
        if (!outcome.ok) return { error: outcome.error };
        setState(outcome.state);
        return {
          ...outcome.test,
          testId: outcome.test.id,
          message: outcome.message
        };
      }
    }),
    calculate_enemy_damage: tool({
      description: "Calcula quantos segmentos de Rel\xF3gio de Amea\xE7a um ataque bem-sucedido causa. Mook cai com qualquer MoS > 0; inimigo resiliente divide apenas a base da arma; todo acerto causa no m\xEDnimo 1 segmento. Use depois de roll_test e antes de advance_threat_clock.",
      inputSchema: z.object({
        baseWeaponDamage: z.number().int().min(0).max(99).describe("Dano base da arma, em segmentos."),
        mos: z.number().int().describe("Margem de Sucesso retornada por roll_test."),
        isResilient: z.boolean().describe("O inimigo \xE9 resiliente?"),
        isMook: z.boolean().describe("O inimigo \xE9 um mook (cai com qualquer acerto)?"),
        targetName: z.string().max(120).optional().describe("Nome do alvo, para o log da mesa.")
      }),
      execute: async (input) => {
        const result = calculateEnemyDamage({
          baseWeaponDamage: input.baseWeaponDamage,
          mos: input.mos,
          isResilient: input.isResilient,
          isMook: input.isMook
        });
        const target = input.targetName?.trim() || "inimigo";
        setState(
          appendArenaLog(
            getState(),
            "dano",
            `Dano contra ${target}: ${result.damage} segmento(s)`,
            result.note
          )
        );
        return result;
      }
    }),
    spend_mana: tool({
      description: "OBRIGAT\xD3RIO ao lan\xE7ar qualquer magia. Calcula o gasto de PM, sobe o Limiar na mesma quantidade e atualiza a mesa. Nunca narre PM ou Limiar sem chamar esta ferramenta. Se o Limiar passar do m\xE1ximo, chame roll_macula_save em seguida. Se a Supress\xE3o estiver ativa, a magia \xE9 bloqueada.",
      inputSchema: z.object({
        amount: z.number().int().min(0).max(99).describe("Custo em PM da magia."),
        spellName: z.string().min(1).max(160).describe("Nome da magia lan\xE7ada.")
      }),
      execute: async (input) => {
        const state = getState();
        if (state.suppressed) {
          const blocked = {
            newMana: state.resources.pm.current,
            newThreshold: state.resources.limiar.current,
            overloaded: state.overloaded,
            message: `Supress\xE3o ativa: ${input.spellName} n\xE3o pode ser lan\xE7ada at\xE9 o pr\xF3ximo turno. Nenhum PM foi gasto.`
          };
          setState(
            appendArenaLog(state, "magia", `${input.spellName} bloqueada pela Supress\xE3o`)
          );
          return blocked;
        }
        const result = spendMana({
          amount: input.amount,
          spellName: input.spellName,
          // O estado da mesa é a fonte da verdade: o modelo não envia números
          // de PM/Limiar, só o custo da magia.
          currentPlayerMana: state.resources.pm.current,
          currentThreshold: state.resources.limiar.current,
          maxThreshold: state.resources.limiar.max
        });
        setState(
          appendArenaLog(
            {
              ...state,
              resources: {
                ...state.resources,
                pm: { ...state.resources.pm, current: result.newMana },
                limiar: { ...state.resources.limiar, current: result.newThreshold }
              },
              overloaded: result.overloaded
            },
            "magia",
            `${input.spellName}: \u2212${input.amount} PM`,
            result.message
          )
        );
        return result;
      }
    }),
    roll_macula_save: tool({
      description: "Rola o SAVE contra M\xE1cula quando uma magia \xE9 lan\xE7ada em Sobrecarga. Dificuldade = Complexidade da magia. Em caso de falha, aplica o efeito da M\xE1cula (dano, \xCDmpeto, Limiar) no estado da mesa.",
      inputSchema: z.object({
        diceCount: z.number().int().min(0).max(30).describe("Dados do SAVE (arcanismo/ocultismo + vontade)."),
        complexity: z.number().int().min(0).max(30).describe("Complexidade da magia lan\xE7ada."),
        maculaType: z.enum(["reforco", "projecao", "elemental", "alteracao", "multiplicacao", "arcana"]).describe("Tipo de M\xE1cula conforme a Esfera da magia.")
      }),
      execute: async (input) => {
        const result = rollMaculaSave(input);
        let state = appendArenaLog(
          getState(),
          "macula-save",
          `SAVE contra M\xE1cula: ${result.successes} sucesso(s) vs DIF ${input.complexity}`,
          result.failed ? `Falhou por ${result.failureMargin}.` : "Passou: nenhuma M\xE1cula."
        );
        if (result.failed) {
          state = applyMaculaEffect(state, input.maculaType, result.failureMargin);
        }
        setState(state);
        return result;
      }
    }),
    advance_threat_clock: tool({
      description: "Avan\xE7a ou reduz um Rel\xF3gio de Amea\xE7a (segmentos). Cria o rel\xF3gio se ainda n\xE3o existir. Use depois de calculate_enemy_damage para aplicar o dano ao alvo, ou para rel\xF3gios de tens\xE3o da cena.",
      inputSchema: z.object({
        clockName: z.string().min(1).max(120).describe("Nome do rel\xF3gio ou do inimigo."),
        current: z.number().int().min(0).max(20).describe("Segmentos atuais informados."),
        max: z.number().int().min(1).max(20).describe("Total de segmentos do rel\xF3gio."),
        delta: z.number().int().min(-20).max(20).describe("Quanto avan\xE7ar (positivo) ou recuar (negativo)."),
        clockKind: z.enum(["mook", "fraco", "padrao", "elite", "lendario"]).optional().describe("Classifica\xE7\xE3o do inimigo, usada ao criar o rel\xF3gio."),
        resilient: z.boolean().optional().describe("O inimigo \xE9 resiliente?")
      }),
      execute: async (input) => {
        const { state, result } = upsertThreatClock(getState(), {
          clockName: input.clockName,
          current: input.current,
          max: input.max,
          delta: input.delta
        });
        let next = state;
        const clock = next.clocks.find(
          (entry) => entry.name.toLowerCase() === result.name.toLowerCase()
        );
        if (clock) {
          next = {
            ...next,
            clocks: next.clocks.map(
              (entry) => entry.id === clock.id ? {
                ...entry,
                kind: input.clockKind && isThreatKind(input.clockKind) ? input.clockKind : entry.kind,
                resilient: input.resilient ?? entry.resilient
              } : entry
            )
          };
        }
        setState(next);
        return result;
      }
    }),
    end_turn: tool({
      description: "Encerra o turno do jogador: restaura PA e PM, encerra a Supress\xE3o e limpa o teste pendente. Use SOMENTE quando o jogador declarar que encerra o turno (ou clicar no bot\xE3o). Nunca encerre o turno por conta pr\xF3pria.",
      inputSchema: z.object({}),
      execute: async () => {
        if (guard.end_turn) {
          return {
            applied: false,
            alreadyApplied: true,
            message: "O turno j\xE1 foi encerrado pelo motor nesta mensagem. Narre apenas a transi\xE7\xE3o e devolva a palavra ao jogador."
          };
        }
        const before = getState();
        const next = startTurn(before);
        guard.end_turn = true;
        setState(next);
        return {
          applied: true,
          turn: next.turn,
          pa: next.resources.pa.current,
          pm: next.resources.pm.current,
          suppressed: next.suppressed,
          message: `Turno ${before.turn} \u2192 ${next.turn}. PA e PM restaurados; Supress\xE3o encerrada.`
        };
      }
    }),
    enter_suppression: tool({
      description: "Entra em Supress\xE3o Arcana: resfria o Limiar em 2 + atributo chave, corta a mana e bloqueia magias at\xE9 o pr\xF3ximo turno. Use SOMENTE quando o jogador declarar Supress\xE3o (ou clicar no bot\xE3o). Se a Supress\xE3o j\xE1 estiver ativa, n\xE3o aplique de novo.",
      inputSchema: z.object({}),
      execute: async () => {
        if (guard.suppress) {
          return {
            applied: false,
            alreadyApplied: true,
            message: "A Supress\xE3o j\xE1 foi aplicada pelo motor nesta mensagem. Narre apenas o resfriamento e devolva a palavra ao jogador."
          };
        }
        const state = getState();
        if (state.suppressed) {
          guard.suppress = true;
          return {
            applied: false,
            suppressed: true,
            message: "Supress\xE3o j\xE1 est\xE1 ativa: a mana s\xF3 volta no pr\xF3ximo turno. Nada foi alterado."
          };
        }
        const next = suppressMana(state, keyAttributeValue);
        const cooling = 2 + keyAttributeValue;
        guard.suppress = true;
        setState(next);
        return {
          applied: true,
          cooling,
          limiar: next.resources.limiar.current,
          pm: next.resources.pm.current,
          suppressed: next.suppressed,
          message: `Supress\xE3o ativa: Limiar \u2212${cooling} (agora ${next.resources.limiar.current}), mana cortada at\xE9 o pr\xF3ximo turno.`
        };
      }
    })
  };
}
async function handleChatMestre(payload, options = {}) {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    return { status: 500, body: { error: MISSING_KEY_ERROR } };
  }
  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      status: 400,
      body: { error: "Requisi\xE7\xE3o inv\xE1lida: envie messages, fichaPersonagem e gameState." }
    };
  }
  const sheet = normalizeSheetSummary(parsed.data.fichaPersonagem);
  let gameState = normalizeGameState(parsed.data.gameState, sheet.max);
  const keyAttributeValue = sheet.keyAttribute ? Math.max(
    0,
    Math.trunc(sheet.attributes[sheet.keyAttribute] ?? 0)
  ) : 0;
  let rerollView = null;
  let rerollNote;
  if (parsed.data.impetoReroll) {
    const outcome = applyImpetoReroll(gameState, parsed.data.impetoReroll.indices);
    if (!outcome.ok) {
      return { status: 400, body: { error: outcome.error } };
    }
    gameState = outcome.state;
    rerollNote = outcome.message;
    rerollView = {
      toolName: "reroll_with_impeto",
      input: { indices: parsed.data.impetoReroll.indices },
      output: {
        ...outcome.test,
        testId: outcome.test.id,
        message: outcome.message
      }
    };
  }
  const guard = {
    end_turn: false,
    suppress: false
  };
  let tableActionView = null;
  let tableActionNote;
  const requestedAction = parsed.data.tableAction;
  if (requestedAction) {
    const actionInput = { type: requestedAction.type, id: requestedAction.id };
    if (requestedAction.type === "end_turn") {
      const before = gameState;
      const next = startTurn(before);
      gameState = next;
      guard.end_turn = true;
      tableActionNote = `O jogador encerrou o turno. O motor j\xE1 aplicou: turno ${before.turn} \u2192 ${next.turn}, PA ${before.resources.pa.current} \u2192 ${next.resources.pa.current}, PM ${before.resources.pm.current} \u2192 ${next.resources.pm.current}, Supress\xE3o encerrada. Narre a transi\xE7\xE3o em 1\u20132 frases e devolva a palavra ao jogador. N\xC3O chame end_turn de novo.`;
      tableActionView = {
        toolName: "end_turn",
        input: actionInput,
        output: {
          applied: true,
          turn: next.turn,
          pa: next.resources.pa.current,
          pm: next.resources.pm.current,
          suppressed: next.suppressed,
          message: `Turno ${before.turn} \u2192 ${next.turn}. PA e PM restaurados; Supress\xE3o encerrada.`
        }
      };
    } else if (gameState.suppressed) {
      guard.suppress = true;
      tableActionNote = "O jogador tentou entrar em Supress\xE3o, mas ela j\xE1 estava ativa. O motor n\xE3o alterou nada. Narre brevemente que a Supress\xE3o continua e que a mana s\xF3 volta no pr\xF3ximo turno. N\xC3O chame enter_suppression.";
      tableActionView = {
        toolName: "enter_suppression",
        input: actionInput,
        output: {
          applied: false,
          suppressed: true,
          message: "Supress\xE3o j\xE1 estava ativa: nada mudou."
        }
      };
    } else {
      const before = gameState;
      const next = suppressMana(before, keyAttributeValue);
      const cooling = 2 + keyAttributeValue;
      gameState = next;
      guard.suppress = true;
      tableActionNote = `O jogador entrou em Supress\xE3o Arcana. O motor j\xE1 aplicou: Limiar ${before.resources.limiar.current} \u2192 ${next.resources.limiar.current} (\u2212${cooling}), PM ${before.resources.pm.current} \u2192 0, magias bloqueadas at\xE9 o pr\xF3ximo turno. Narre brevemente o resfriamento e a mana cortada. N\xC3O chame enter_suppression de novo.`;
      tableActionView = {
        toolName: "enter_suppression",
        input: actionInput,
        output: {
          applied: true,
          cooling,
          limiar: next.resources.limiar.current,
          pm: next.resources.pm.current,
          suppressed: next.suppressed,
          message: `Supress\xE3o ativa: Limiar \u2212${cooling} (agora ${next.resources.limiar.current}), mana cortada at\xE9 o pr\xF3ximo turno.`
        }
      };
    }
  }
  const resolvedNote = [rerollNote, tableActionNote].filter(Boolean).join("\n\n") || void 0;
  const messages = parsed.data.messages.slice(-MAX_HISTORY).map((message) => ({ role: message.role, content: message.content }));
  const modelId = process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
  try {
    const groq = createGroq({ apiKey });
    const tools = buildTools(
      sheet,
      () => gameState,
      (next) => {
        gameState = next;
      },
      keyAttributeValue,
      guard
    );
    const result = await generateText({
      model: groq(modelId),
      system: buildArenaSystemPrompt(sheet, gameState, resolvedNote),
      messages,
      tools,
      stopWhen: stepCountIs(6),
      temperature: 0.7,
      maxOutputTokens: 700,
      // O plano gratuito do Groq tem TPM baixo: uma nova tentativa cobre a
      // janela de 1 minuto sem deixar o jogador esperando demais. Em serverless
      // (Vercel) o tempo máximo da função é curto, então fica só uma.
      maxRetries: process.env.VERCEL ? 1 : 2,
      abortSignal: options.signal
    });
    const toolResults = [
      ...rerollView ? [rerollView] : [],
      ...tableActionView ? [tableActionView] : [],
      ...result.toolResults.map((entry) => ({
        toolName: entry.toolName,
        input: entry.input,
        output: entry.output
      }))
    ];
    const reply = result.text.trim() || "O Mestre observa em sil\xEAncio por um instante, como se pesasse cada palavra antes de responder. O que voc\xEA faz?";
    return {
      status: 200,
      body: {
        reply,
        toolResults,
        gameState,
        model: modelId
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "erro desconhecido";
    const rateLimited = /rate limit|429|too many requests/i.test(message);
    const hint = rateLimited ? `Limite de uso do Groq atingido (modelo ${modelId}). O plano gratuito permite poucas chamadas por minuto: aguarde cerca de 20 segundos e tente novamente.` : /does not exist|do not have access/i.test(message) ? `${message} Verifique GROQ_MODEL (modelo configurado: ${modelId}).` : message;
    return {
      status: rateLimited ? 429 : 502,
      body: { error: `Falha ao consultar o Groq: ${hint}` }
    };
  }
}

// server/http.ts
var MAX_BODY_BYTES = 2 * 1024 * 1024;
async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      throw new Error("Corpo da requisi\xE7\xE3o grande demais.");
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  const text = Buffer.concat(chunks).toString("utf8").trim();
  return text ? JSON.parse(text) : {};
}
function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(body);
}

// server/vercelEntry.ts
async function handler(req, res) {
  if (req.method === "GET") {
    sendJson(res, 200, {
      ok: true,
      hasGroqKey: Boolean(process.env.GROQ_API_KEY?.trim()),
      model: process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL
    });
    return;
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    sendJson(res, 405, { error: "M\xE9todo n\xE3o permitido. Use POST." });
    return;
  }
  const controller = new AbortController();
  const abortIfDisconnected = () => {
    if (!res.writableEnded) controller.abort();
  };
  res.on("close", abortIfDisconnected);
  try {
    let payload = req.body;
    if (typeof payload === "string") {
      payload = payload.trim() ? JSON.parse(payload) : {};
    } else if (payload === void 0 || payload === null) {
      payload = await readJsonBody(req);
    }
    const result = await handleChatMestre(payload, { signal: controller.signal });
    if (!res.writableEnded && !res.destroyed) sendJson(res, result.status, result.body);
  } catch (error) {
    if (res.writableEnded || res.destroyed) return;
    const message = error instanceof Error ? error.message : "erro desconhecido";
    const badRequest = error instanceof SyntaxError;
    sendJson(res, badRequest ? 400 : 500, {
      error: badRequest ? `JSON inv\xE1lido na requisi\xE7\xE3o: ${message}` : `Falha interna na API do Mestre: ${message}`
    });
  } finally {
    res.off("close", abortIfDisconnected);
  }
}
export {
  handler as default
};
