import { THREAT_LABELS } from './rules'
import type { ArenaGameState, ArenaSheetSummary } from './types'

/**
 * System prompt do Mestre de Amnia.
 *
 * O texto das regras vem do material do jogo (docs/amnia-export). O Mestre
 * narra; quem rola dados, calcula dano e move recursos são as ferramentas.
 */

const ATTRIBUTE_LABELS: Record<string, string> = {
  forca: 'FOR',
  destreza: 'DES',
  carisma: 'CAR',
  inteligencia: 'INT',
  vontade: 'VON',
}

function sheetBlock(sheet: ArenaSheetSummary): string {
  const attributes = Object.entries(sheet.attributes)
    .map(([id, value]) => `${ATTRIBUTE_LABELS[id] ?? id} ${value}`)
    .join(' · ')

  const skills =
    sheet.skills.length > 0
      ? sheet.skills.map((skill) => `${skill.name} ${skill.value}`).join(', ')
      : 'nenhuma perícia treinada'

  const runes =
    sheet.runes.length > 0
      ? sheet.runes.map((rune) => `${rune.name} (${rune.circle})`).join(', ')
      : 'nenhuma runa conhecida'

  const spells =
    sheet.spells.length > 0
      ? sheet.spells
          .map((spell) => `"${spell.name}" (${spell.cost} PM) — ${spell.summary}. ${spell.effect}`)
          .join('\n  ')
      : 'nenhuma magia preparada'

  const inventory =
    sheet.inventory.length > 0 ? sheet.inventory.join(', ') : 'sem equipamento registrado'

  return [
    `Nome: ${sheet.name || 'Sem nome'}`,
    `Conceito: ${sheet.concept || '—'}`,
    `Classe: ${sheet.className || '—'}`,
    `Ancestralidade: ${sheet.ancestry || '—'}`,
    `Atributo chave: ${sheet.keyAttribute ?? '—'}`,
    `Atributos: ${attributes}`,
    `Máximos: PV ${sheet.max.pv} · PM ${sheet.max.pm} · Limiar ${sheet.max.limiar} · Ímpeto ${sheet.max.impeto} · PA ${sheet.max.pa}`,
    `Perícias: ${skills}`,
    `Runas conhecidas: ${runes}`,
    `Magias preparadas:\n  ${spells}`,
    `Ímpeto: ${sheet.impulse || '—'}`,
    `Convicções: ${sheet.convictions.length > 0 ? sheet.convictions.join(' | ') : '—'}`,
    `Equipamento: ${inventory}`,
    sheet.notes ? `Anotações da ficha: ${sheet.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function stateBlock(state: ArenaGameState): string {
  const { pv, pm, limiar, impeto, pa } = state.resources
  const clocks =
    state.clocks.length > 0
      ? state.clocks
          .map(
            (clock) =>
              `${clock.name} [${THREAT_LABELS[clock.kind]}] ${clock.current}/${clock.max}${clock.resilient ? ' (resiliente)' : ''}${clock.notes ? ` — ${clock.notes}` : ''}`,
          )
          .join('\n  ')
      : 'nenhum relógio ativo'

  const log =
    state.log.length > 0
      ? state.log
          .slice(-6)
          .map((entry) => `- ${entry.label}${entry.detail ? ` (${entry.detail})` : ''}`)
          .join('\n')
      : '- sem eventos recentes'

  return [
    `Turno: ${state.turn}`,
    `PV ${pv.current}/${pv.max} · PM ${pm.current}/${pm.max} · Limiar ${limiar.current}/${limiar.max} · Ímpeto ${impeto.current}/${impeto.max} · PA ${pa.current}/${pa.max}`,
    `Sobrecarga: ${state.overloaded ? 'SIM' : 'não'} · Supressão ativa: ${state.suppressed ? 'SIM' : 'não'}`,
    `Relógios de ameaça:\n  ${clocks}`,
    `Eventos recentes:\n${log}`,
  ].join('\n')
}

export function buildArenaSystemPrompt(
  sheet: ArenaSheetSummary,
  state: ArenaGameState,
): string {
  return `Você é o Mestre de RPG de Amnia.
Narre em português brasileiro, com tom sombrio, tático, cinematográfico e claro.

Você NÃO é o motor de regras. Você é o narrador.
Todas as rolagens, danos, gastos de PM, Sobrecarga, Máculas e relógios devem ser calculados pelas ferramentas disponíveis.
Nunca invente resultados de dados. Nunca diga que rolou dados sem ter usado uma ferramenta.
Nunca altere PV, PM, Limiar, Ímpeto, PA ou Relógios "por conta própria": use as ferramentas.

## Regras principais
- Jogadores têm 4 PA por turno. Reações usam o PA restante do turno anterior.
- Ações repetidas (ex.: atacar de novo) sofrem −2 dados por repetição.
- Testes usam d6 empilhados: 4–6 = 1 sucesso, 1–3 = falha. Par de 6 = 4 sucessos no total (crítico). Par de 1 = falha crítica.
- Margem de Sucesso (MoS) = sucessos − dificuldade. MoS < 0 falha; MoS = 0 empate/sucesso parcial; MoS > 0 sucesso.
- Inimigos significativos NÃO usam PV: usam Relógios de Ameaça (segmentos).
  Mook = 1 (cai com qualquer acerto), Fraco = 4, Padrão = 6, Elite/Sobrenatural = 8, Lendário = 10–12.
- Inimigo resiliente: apenas a base da arma é dividida pela metade; a MoS permanece inteira.
- Todo ataque bem-sucedido causa no mínimo 1 segmento.
- PM gasto aumenta o Limiar na mesma quantidade. O Limiar NÃO reseta no começo do turno.
- Limiar acima do máximo = Sobrecarga. Lançar magia em Sobrecarga exige SAVE (Ocultismo/Arcanismo + VON) com dificuldade igual à Complexidade da magia; falha gera Mácula.
- Mácula de Reforço: dano igual à margem de falha + debuff físico. As demais Máculas seguem o tipo retornado pela ferramenta.
- Supressão: resfria o Limiar em 2 + atributo chave, corta a mana e impede magia até o próximo turno.
- Se uma rolagem falhar e o jogador tiver Ímpeto, pergunte se ele quer gastar Ímpeto para rerrolar antes de consolidar a consequência final.

## Uso obrigatório das ferramentas
- Qualquer teste, ataque, defesa ou perícia → \`roll_test\` ANTES de narrar o resultado.
- Dano contra inimigo → \`calculate_enemy_damage\` e depois \`advance_threat_clock\` para o relógio do alvo.
- Gasto de PM / magia → \`spend_mana\` (e \`roll_macula_save\` se houver Sobrecarga).
- Relógio de ameaça que avança ou recua → \`advance_threat_clock\`.
- Use os números REAIS retornados pelas ferramentas. Cite dados, sucessos, MoS e segmentos na narração quando relevante.

## Ficha do personagem
${sheetBlock(sheet)}

## Estado atual da mesa
${stateBlock(state)}

## Formato da resposta
- 2 a 4 parágrafos curtos.
- Termine perguntando o que o jogador faz.
- Se houver risco mecânico importante (Sobrecarga, Mácula, morte, relógio completo), destaque de forma clara.`
}
