// GERADO por `npm run build:api` a partir de server/vercelEntry.ts. Não edite à mão.

// server/chatMestre.ts
import { createGroq } from "@ai-sdk/groq";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";

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
  return {
    version: ARENA_STATE_VERSION,
    turn: asInt(source.turn, 1, 1, 999),
    resources,
    overloaded: resources.limiar.current > resources.limiar.max,
    suppressed: source.suppressed === true,
    clocks,
    log: normalizeLog(source.log)
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
    log: [...state.log]
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

// src/lib/amnia/dice.ts
var DIE_FACES = 6;
var MAX_DICE = 30;
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
function resolveAmniaTest(input, random = Math.random) {
  const difficulty = Math.max(0, Math.trunc(Number.isFinite(input.difficulty) ? input.difficulty : 0));
  const roll = rollAmniaDice(input.diceCount, random);
  const mos = roll.successes - difficulty;
  return {
    ...roll,
    difficulty,
    mos,
    success: mos > 0,
    partial: mos === 0,
    failed: mos < 0,
    label: input.label
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

// src/lib/amnia/prompt.ts
var ATTRIBUTE_LABELS = {
  forca: "FOR",
  destreza: "DES",
  carisma: "CAR",
  inteligencia: "INT",
  vontade: "VON"
};
function sheetBlock(sheet) {
  const attributes = Object.entries(sheet.attributes).map(([id, value]) => `${ATTRIBUTE_LABELS[id] ?? id} ${value}`).join(" \xB7 ");
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
  return [
    `Turno: ${state.turn}`,
    `PV ${pv.current}/${pv.max} \xB7 PM ${pm.current}/${pm.max} \xB7 Limiar ${limiar.current}/${limiar.max} \xB7 \xCDmpeto ${impeto.current}/${impeto.max} \xB7 PA ${pa.current}/${pa.max}`,
    `Sobrecarga: ${state.overloaded ? "SIM" : "n\xE3o"} \xB7 Supress\xE3o ativa: ${state.suppressed ? "SIM" : "n\xE3o"}`,
    `Rel\xF3gios de amea\xE7a:
  ${clocks}`,
    `Eventos recentes:
${log}`
  ].join("\n");
}
function buildArenaSystemPrompt(sheet, state) {
  return `Voc\xEA \xE9 o Mestre de RPG de Amnia.
Narre em portugu\xEAs brasileiro, com tom sombrio, t\xE1tico, cinematogr\xE1fico e claro.

Voc\xEA N\xC3O \xE9 o motor de regras. Voc\xEA \xE9 o narrador.
Todas as rolagens, danos, gastos de PM, Sobrecarga, M\xE1culas e rel\xF3gios devem ser calculados pelas ferramentas dispon\xEDveis.
Nunca invente resultados de dados. Nunca diga que rolou dados sem ter usado uma ferramenta.
Nunca altere PV, PM, Limiar, \xCDmpeto, PA ou Rel\xF3gios "por conta pr\xF3pria": use as ferramentas.

## Regras principais
- Jogadores t\xEAm 4 PA por turno. Rea\xE7\xF5es usam o PA restante do turno anterior.
- A\xE7\xF5es repetidas (ex.: atacar de novo) sofrem \u22122 dados por repeti\xE7\xE3o.
- Testes usam d6 empilhados: 4\u20136 = 1 sucesso, 1\u20133 = falha. Par de 6 = 4 sucessos no total (cr\xEDtico). Par de 1 = falha cr\xEDtica.
- Margem de Sucesso (MoS) = sucessos \u2212 dificuldade. MoS < 0 falha; MoS = 0 empate/sucesso parcial; MoS > 0 sucesso.
- Inimigos significativos N\xC3O usam PV: usam Rel\xF3gios de Amea\xE7a (segmentos).
  Mook = 1 (cai com qualquer acerto), Fraco = 4, Padr\xE3o = 6, Elite/Sobrenatural = 8, Lend\xE1rio = 10\u201312.
- Inimigo resiliente: apenas a base da arma \xE9 dividida pela metade; a MoS permanece inteira.
- Todo ataque bem-sucedido causa no m\xEDnimo 1 segmento.
- PM gasto aumenta o Limiar na mesma quantidade. O Limiar N\xC3O reseta no come\xE7o do turno.
- Limiar acima do m\xE1ximo = Sobrecarga. Lan\xE7ar magia em Sobrecarga exige SAVE (Ocultismo/Arcanismo + VON) com dificuldade igual \xE0 Complexidade da magia; falha gera M\xE1cula.
- M\xE1cula de Refor\xE7o: dano igual \xE0 margem de falha + debuff f\xEDsico. As demais M\xE1culas seguem o tipo retornado pela ferramenta.
- Supress\xE3o: resfria o Limiar em 2 + atributo chave, corta a mana e impede magia at\xE9 o pr\xF3ximo turno.
- Se uma rolagem falhar e o jogador tiver \xCDmpeto, pergunte se ele quer gastar \xCDmpeto para rerrolar antes de consolidar a consequ\xEAncia final.

## Uso obrigat\xF3rio das ferramentas
- Qualquer teste, ataque, defesa ou per\xEDcia \u2192 \`roll_test\` ANTES de narrar o resultado.
- Dano contra inimigo \u2192 \`calculate_enemy_damage\` e depois \`advance_threat_clock\` para o rel\xF3gio do alvo.
- Gasto de PM / magia \u2192 \`spend_mana\` ANTES de narrar (e \`roll_macula_save\` se houver Sobrecarga).
- Rel\xF3gio de amea\xE7a que avan\xE7a ou recua \u2192 \`advance_threat_clock\`.
- Use os n\xFAmeros REAIS retornados pelas ferramentas. Cite dados, sucessos, MoS e segmentos na narra\xE7\xE3o quando relevante.

## Regra de ferro
Se a sua resposta menciona um n\xFAmero de regra (dados, sucessos, MoS, dano, PM, Limiar, \xCDmpeto, PA ou segmentos de rel\xF3gio), esse n\xFAmero S\xD3 pode vir do resultado de uma ferramenta chamada nesta mesma resposta. Sem ferramenta, n\xE3o narre o n\xFAmero e n\xE3o diga que o recurso mudou. Em especial: toda magia come\xE7a com \`spend_mana\`, mesmo que o custo pare\xE7a \xF3bvio.

## Ficha do personagem
${sheetBlock(sheet)}

## Estado atual da mesa
${stateBlock(state)}

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
  gameState: z.unknown().optional()
});
var MAX_HISTORY = 24;
function buildTools(getState, setState) {
  return {
    roll_test: tool({
      description: "Rola um teste de Amnia com d6 empilhados e calcula sucessos, dificuldade e Margem de Sucesso (MoS). Use SEMPRE antes de narrar qualquer ataque, defesa, per\xEDcia ou resist\xEAncia. Nunca invente dados.",
      inputSchema: z.object({
        diceCount: z.number().int().min(0).max(30).describe("Quantidade de d6 a rolar."),
        difficulty: z.number().int().min(0).max(30).describe("Dificuldade do teste em sucessos."),
        label: z.string().min(1).max(160).describe("O que est\xE1 sendo testado (ex.: ataque de espada).")
      }),
      execute: async (input) => {
        const result = resolveAmniaTest(input);
        setState(
          appendArenaLog(
            getState(),
            "rolagem",
            `${result.label}: ${result.successes} sucesso(s) vs DIF ${result.difficulty} (MoS ${result.mos})`,
            `Dados: [${result.dice.join(", ")}]${result.criticalPairs > 0 ? " \xB7 cr\xEDtico (par de 6)" : ""}${result.criticalFailures > 0 ? " \xB7 falha cr\xEDtica (par de 1)" : ""}`
          )
        );
        return result;
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
  const messages = parsed.data.messages.slice(-MAX_HISTORY).map((message) => ({ role: message.role, content: message.content }));
  const modelId = process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
  try {
    const groq = createGroq({ apiKey });
    const tools = buildTools(
      () => gameState,
      (next) => {
        gameState = next;
      }
    );
    const result = await generateText({
      model: groq(modelId),
      system: buildArenaSystemPrompt(sheet, gameState),
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
    const toolResults = result.toolResults.map((entry) => ({
      toolName: entry.toolName,
      input: entry.input,
      output: entry.output
    }));
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
