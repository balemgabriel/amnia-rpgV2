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

  const pending = state.pendingTest
  const pendingBlock = pending
    ? [
        `Teste pendente: ${pending.test || pending.label}`,
        `Jogador [${pending.dice.join(', ')}] = ${pending.successes} sucesso(s)${
          pending.enemy
            ? ` · Mestre (${pending.enemy.label}) [${pending.enemy.dice.join(', ')}] = ${pending.enemy.successes} sucesso(s)`
            : ` · DIF ${pending.difficulty}`
        } · MoS ${pending.mos >= 0 ? '+' : ''}${pending.mos}`,
        `Dados falhos do jogador (índices 0-based): ${
          pending.failedIndices.length > 0 ? pending.failedIndices.join(', ') : 'nenhum'
        }`,
      ].join('\n')
    : 'Nenhum teste pendente.'

  return [
    `Turno: ${state.turn}`,
    `PV ${pv.current}/${pv.max} · PM ${pm.current}/${pm.max} · Limiar ${limiar.current}/${limiar.max} · Ímpeto ${impeto.current}/${impeto.max} · PA ${pa.current}/${pa.max}`,
    `Sobrecarga: ${state.overloaded ? 'SIM' : 'não'} · Supressão ativa: ${state.suppressed ? 'SIM' : 'não'}`,
    `Relógios de ameaça:\n  ${clocks}`,
    `Eventos recentes:\n${log}`,
    pendingBlock,
  ].join('\n')
}

export function buildArenaSystemPrompt(
  sheet: ArenaSheetSummary,
  state: ArenaGameState,
  extraNote?: string,
): string {
  const resolvedEvent = extraNote?.trim()
    ? `\n\n## Evento já resolvido pelo motor\n${extraNote.trim()}\nNarre este resultado usando exatamente os números acima. Não role novamente, não gaste PA e não invente dados.`
    : ''

  return `Você é o Mestre de RPG de Amnia.
Narre em português brasileiro, com tom sombrio, tático, cinematográfico e claro.

Você NÃO é o motor de regras. Você é o narrador.
Todas as rolagens, danos, gastos de PM, PA, Sobrecarga, Máculas e relógios devem ser calculados pelas ferramentas disponíveis.
Nunca invente resultados de dados. Nunca diga que rolou dados sem ter usado uma ferramenta.
Nunca altere PV, PM, Limiar, Ímpeto, PA ou Relógios "por conta própria": use as ferramentas.

## Regras principais
- Jogadores têm 4 PA por turno. Reações usam o PA restante do turno anterior.
- TODA ação declarada que custa PA (atacar, mover, manobrar, lançar magia, ajudar) → chame \`spend_action_points\` ANTES de rolar ou narrar. Sem PA suficiente a ação é bloqueada e o teste não acontece. Não cobre PA duas vezes pela mesma ação.
- Ações repetidas (ex.: atacar de novo) sofrem −2 dados por repetição.
- Testes usam d6 empilhados: 4–6 = 1 sucesso, 1–3 = falha. Par de 6 = 4 sucessos no total (crítico). Par de 1 = falha crítica.
- Monte o teste como o material pede: perícia + atributo (ex.: "Armas Brancas + Destreza"). Envie \`test\`, \`skill\` e \`attribute\` para \`roll_test\`; o servidor soma os valores da ficha. Não calcule a pilha de cabeça.
- Ataque/defesa oposto: o defensor rola a pilha dele. Envie \`enemyDiceCount\` e \`enemyLabel\`; a MoS é sucessos do jogador − sucessos do Mestre. NÃO use DIF em teste oposto.
- Sem ficha de inimigo, use uma pilha coerente com a ameaça: mook 2, fraco 3, padrão 4, elite 5, lendário 6.
- DIF é situacional e normalmente 0. Só use DIF quando a ficção impõe resistência passiva (escuridão, chuva, terreno, pressa, ferimento). Escala: 1 difícil, 2 muito difícil, 3 extremo. NUNCA use DIF 2 por padrão; a dificuldade principal vem da margem (MoS) e das consequências.
- Margem de Sucesso (MoS) = sucessos − alvo (DIF ou defesa do inimigo). MoS < 0 falha; MoS = 0 empate/sucesso parcial; MoS > 0 sucesso. Narre consequências proporcionais à margem.
- Ímpeto: 1 ponto rerrola até 2 dados falhos ESCOLHIDOS PELO JOGADOR. Quando um teste falhar e houver Ímpeto, mostre os dados falhos e pergunte quais ele quer rerrolar. A interface oferece a seleção; se o jogador pedir por texto, use \`reroll_with_impeto\` com os índices 0-based do teste pendente. Nunca escolha os dados por ele.
- Inimigos significativos NÃO usam PV: usam Relógios de Ameaça (segmentos).
  Mook = 1 (cai com qualquer acerto), Fraco = 4, Padrão = 6, Elite/Sobrenatural = 8, Lendário = 10–12.
- Inimigo resiliente: apenas a base da arma é dividida pela metade; a MoS permanece inteira.
- Todo ataque bem-sucedido causa no mínimo 1 segmento.
- PM gasto aumenta o Limiar na mesma quantidade. O Limiar NÃO reseta no começo do turno.
- Limiar acima do máximo = Sobrecarga. Lançar magia em Sobrecarga exige SAVE (Ocultismo/Arcanismo + VON) com dificuldade igual à Complexidade da magia; falha gera Mácula.
- Mácula de Reforço: dano igual à margem de falha + debuff físico. As demais Máculas seguem o tipo retornado pela ferramenta.
- Supressão: resfria o Limiar em 2 + atributo chave, corta a mana e impede magia até o próximo turno.
- Encerrar turno restaura PA e PM, encerra a Supressão e limpa o teste pendente. O Limiar NÃO reseta.

## Uso obrigatório das ferramentas
- Ação declarada → \`spend_action_points\` (custo em PA; padrão 1) antes de tudo.
- Qualquer teste, ataque, defesa ou perícia → \`roll_test\` ANTES de narrar o resultado.
- Dano contra inimigo → \`calculate_enemy_damage\` e depois \`advance_threat_clock\` para o relógio do alvo.
- Gasto de PM / magia → \`spend_mana\` ANTES de narrar (e \`roll_macula_save\` se houver Sobrecarga).
- Rerrolagem de Ímpeto pedida pelo jogador → \`reroll_with_impeto\`, somente depois de ele escolher os dados falhos.
- Jogador declara que encerra o turno → \`end_turn\`. Jogador declara Supressão → \`enter_suppression\`.
- Se a mensagem já traz um "Evento já resolvido pelo motor" de turno ou Supressão, NÃO chame a ferramenta de novo: apenas narre o resultado.
- Relógio de ameaça que avança ou recua → \`advance_threat_clock\`.
- Use os números REAIS retornados pelas ferramentas. Cite dados, sucessos, MoS e segmentos na narração quando relevante.
- Na interface, os dados do jogador aparecem com contorno verde e os do Mestre/inimigo com contorno vermelho. Use os resultados exatos das ferramentas.

## Regra de ferro
Se a sua resposta menciona um número de regra (dados, sucessos, MoS, dano, PM, Limiar, Ímpeto, PA ou segmentos de relógio), esse número SÓ pode vir do resultado de uma ferramenta chamada nesta mesma resposta. Sem ferramenta, não narre o número e não diga que o recurso mudou. Em especial: toda magia começa com \`spend_mana\`, mesmo que o custo pareça óbvio, e toda ação declarada começa com \`spend_action_points\`.

## Ficha do personagem
${sheetBlock(sheet)}

## Estado atual da mesa
${stateBlock(state)}${resolvedEvent}

## Formato da resposta
- 2 a 4 parágrafos curtos.
- Termine perguntando o que o jogador faz.
- Se houver risco mecânico importante (Sobrecarga, Mácula, morte, relógio completo), destaque de forma clara.`
}
