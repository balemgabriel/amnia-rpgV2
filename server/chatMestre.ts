import { createGroq } from '@ai-sdk/groq'
import { generateText, stepCountIs, tool } from 'ai'
import { z } from 'zod'
import {
  applyImpetoReroll,
  applyMaculaEffect,
  appendArenaLog,
  calculateEnemyDamage,
  isThreatKind,
  normalizeGameState,
  normalizeSheetSummary,
  spendActionPoints,
  spendMana,
  startTurn,
  suppressMana,
  upsertThreatClock,
} from '../src/lib/amnia/rules'
import { resolveAmniaTest, rollMaculaSave } from '../src/lib/amnia/dice'
import { resolveTestPool } from '../src/lib/amnia/testResolver'
import { buildArenaSystemPrompt } from '../src/lib/amnia/prompt'
import type {
  AmniaAttributeId,
  ArenaChatResponse,
  ArenaGameState,
  ArenaPendingTest,
  ArenaSheetSummary,
  ArenaTableActionType,
  ArenaToolResultView,
} from '../src/lib/amnia/types'

/**
 * API do Mestre de Amnia (`POST /api/chat-mestre`).
 *
 * A chave do Groq só existe aqui, no processo do servidor. O navegador envia a
 * ficha resumida + o estado da mesa e recebe a narração com os resultados reais
 * das ferramentas.
 */

export const CHAT_MESTRE_PATH = '/api/chat-mestre'

export const MISSING_KEY_ERROR = 'Groq API key ausente. Configure GROQ_API_KEY.'

/**
 * Modelo padrão. `llama-3.3-70b-versatile` foi aposentado pelo Groq; este é o
 * modelo atual com suporte a tool calling. Pode ser trocado por `GROQ_MODEL`.
 */
export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b'

export type ChatMestreHttpResult =
  | { status: 200; body: ArenaChatResponse }
  | { status: number; body: { error: string } }

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(8000),
})

const requestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(60),
  fichaPersonagem: z.unknown(),
  gameState: z.unknown().optional(),
  /** Rerrolagem de Ímpeto escolhida na interface (dados falhos, 0-based). */
  impetoReroll: z
    .object({
      indices: z.array(z.number().int().min(0).max(29)).min(1).max(2),
    })
    .optional(),
  /**
   * Ação de mesa disparada por botão (Encerrar turno / Supressão). O motor
   * aplica o efeito ANTES de chamar o modelo; a narração só descreve o que já
   * aconteceu. `id` é um nonce local para diferenciar cliques.
   */
  tableAction: z
    .object({
      type: z.enum(['end_turn', 'suppress']),
      id: z.number().int().optional(),
    })
    .optional(),
})

const MAX_HISTORY = 24

function nextTestId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function buildTools(
  sheet: ArenaSheetSummary,
  getState: () => ArenaGameState,
  setState: (next: ArenaGameState) => void,
  keyAttributeValue: number,
  /** Evita aplicar duas vezes a mesma ação de mesa na mesma mensagem. */
  guard: Record<ArenaTableActionType, boolean>,
) {
  return {
    spend_action_points: tool({
      description:
        'OBRIGATÓRIO quando o jogador declara uma ação que custa PA (atacar, mover, manobrar, lançar magia, ajudar, reagir). Gasta o PA ANTES de rolar ou narrar. Sem PA suficiente a ação é bloqueada e o teste não acontece. Custo padrão 1. Não cobre PA duas vezes pela mesma ação.',
      inputSchema: z.object({
        amount: z.number().int().min(1).max(4).describe('Custo em PA da ação (normalmente 1).'),
        actionName: z.string().min(1).max(120).describe('Ação declarada, ex.: "atacar o bandido".'),
      }),
      execute: async (input) => {
        const state = getState()
        const result = spendActionPoints({
          amount: input.amount,
          actionName: input.actionName,
          currentPa: state.resources.pa.current,
        })

        const next: ArenaGameState = {
          ...state,
          resources: {
            ...state.resources,
            pa: { ...state.resources.pa, current: result.newPa },
          },
        }

        setState(
          appendArenaLog(
            next,
            'acao',
            `${input.actionName}: ${result.blocked ? 'bloqueada por falta de PA' : `−${result.spent} PA`}`,
            result.message,
          ),
        )
        return result
      },
    }),

    roll_test: tool({
      description:
        'Rola um teste de Amnia com d6 empilhados e calcula sucessos, alvo e Margem de Sucesso (MoS). Use SEMPRE antes de narrar qualquer ataque, defesa, perícia ou resistência. Monte o teste como o Mestre pediu (perícia + atributo): envie test/skill/attribute e o servidor soma os valores da ficha. Em ataques/defesas opostos, envie também enemyDiceCount/enemyLabel: a MoS vira sucessos do jogador − sucessos do Mestre e a DIF é ignorada. Nunca invente dados.',
      inputSchema: z.object({
        test: z
          .string()
          .min(1)
          .max(160)
          .describe('Teste pedido, ex.: "Armas brancas + Destreza" ou "Vontade vs medo".'),
        skill: z.string().max(80).optional().describe('Perícia usada, ex.: "Armas brancas".'),
        attribute: z
          .enum(['forca', 'destreza', 'carisma', 'inteligencia', 'vontade'])
          .optional()
          .describe('Atributo usado, ex.: "destreza".'),
        diceCount: z
          .number()
          .int()
          .min(0)
          .max(30)
          .optional()
          .describe(
            'Só para modificadores explícitos (ex.: −2 por repetição). Se omitido, o servidor soma perícia + atributo da ficha.',
          ),
        difficulty: z
          .number()
          .int()
          .min(0)
          .max(30)
          .optional()
          .describe(
            'DIF situacional. Padrão 0. Só use quando a ficção impõe resistência passiva; ignorada em teste oposto.',
          ),
        difficultyReason: z
          .string()
          .max(160)
          .optional()
          .describe('Por que a DIF é essa (ex.: "escuridão total").'),
        enemyDiceCount: z
          .number()
          .int()
          .min(0)
          .max(30)
          .optional()
          .describe('Pilha de defesa do inimigo (dados do Mestre) em um teste oposto.'),
        enemyLabel: z
          .string()
          .max(120)
          .optional()
          .describe('Quem está defendendo, ex.: "Bandido — Atletismo + Destreza".'),
      }),
      execute: async (input) => {
        const pool = resolveTestPool(sheet, input)
        const result = resolveAmniaTest({
          diceCount: pool.diceCount,
          difficulty: input.difficulty ?? 0,
          difficultyReason: input.difficultyReason,
          label: input.test,
          test: input.test,
          diceBreakdown: pool.breakdown,
          enemyDiceCount: input.enemyDiceCount,
          enemyLabel: input.enemyLabel,
        })

        const pending: ArenaPendingTest = {
          ...result,
          id: nextTestId(),
          createdAt: Date.now(),
        }

        const targetDetail = result.enemy
          ? `Mestre (${result.enemy.label}) [${result.enemy.dice.join(', ')}] = ${result.enemy.successes}`
          : `DIF ${result.difficulty}${result.difficultyReason ? ` (${result.difficultyReason})` : ''}`

        let next = appendArenaLog(
          getState(),
          'rolagem',
          `${result.label}: ${result.successes} sucesso(s) vs ${result.targetSuccesses} (MoS ${result.mos >= 0 ? '+' : ''}${result.mos})`,
          `${pool.breakdown} · Jogador [${result.dice.join(', ')}] = ${result.successes} · ${targetDetail}${
            result.criticalPairs > 0 ? ' · crítico (par de 6)' : ''
          }${result.criticalFailures > 0 ? ' · falha crítica (par de 1)' : ''}`,
        )
        next = { ...next, pendingTest: pending }
        setState(next)

        return { ...result, testId: pending.id }
      },
    }),

    reroll_with_impeto: tool({
      description:
        'Rerrola até 2 dados falhos do último teste usando 1 ponto de Ímpeto. Use SOMENTE depois que o jogador escolher quais dados falhos rerrolar. Os índices são 0-based conforme o teste pendente no estado da mesa. Nunca escolha os dados pelo jogador.',
      inputSchema: z.object({
        indices: z
          .array(z.number().int().min(0).max(29))
          .min(1)
          .max(2)
          .describe('Índices 0-based dos dados falhos escolhidos pelo jogador.'),
      }),
      execute: async (input) => {
        const outcome = applyImpetoReroll(getState(), input.indices)
        if (!outcome.ok) return { error: outcome.error }

        setState(outcome.state)
        return {
          ...outcome.test,
          testId: outcome.test.id,
          message: outcome.message,
        }
      },
    }),

    calculate_enemy_damage: tool({
      description:
        'Calcula quantos segmentos de Relógio de Ameaça um ataque bem-sucedido causa. Mook cai com qualquer MoS > 0; inimigo resiliente divide apenas a base da arma; todo acerto causa no mínimo 1 segmento. Use depois de roll_test e antes de advance_threat_clock.',
      inputSchema: z.object({
        baseWeaponDamage: z.number().int().min(0).max(99).describe('Dano base da arma, em segmentos.'),
        mos: z.number().int().describe('Margem de Sucesso retornada por roll_test.'),
        isResilient: z.boolean().describe('O inimigo é resiliente?'),
        isMook: z.boolean().describe('O inimigo é um mook (cai com qualquer acerto)?'),
        targetName: z.string().max(120).optional().describe('Nome do alvo, para o log da mesa.'),
      }),
      execute: async (input) => {
        const result = calculateEnemyDamage({
          baseWeaponDamage: input.baseWeaponDamage,
          mos: input.mos,
          isResilient: input.isResilient,
          isMook: input.isMook,
        })
        const target = input.targetName?.trim() || 'inimigo'
        setState(
          appendArenaLog(
            getState(),
            'dano',
            `Dano contra ${target}: ${result.damage} segmento(s)`,
            result.note,
          ),
        )
        return result
      },
    }),

    spend_mana: tool({
      description:
        'OBRIGATÓRIO ao lançar qualquer magia. Calcula o gasto de PM, sobe o Limiar na mesma quantidade e atualiza a mesa. Nunca narre PM ou Limiar sem chamar esta ferramenta. Se o Limiar passar do máximo, chame roll_macula_save em seguida. Se a Supressão estiver ativa, a magia é bloqueada.',
      inputSchema: z.object({
        amount: z.number().int().min(0).max(99).describe('Custo em PM da magia.'),
        spellName: z.string().min(1).max(160).describe('Nome da magia lançada.'),
      }),
      execute: async (input) => {
        const state = getState()

        if (state.suppressed) {
          const blocked = {
            newMana: state.resources.pm.current,
            newThreshold: state.resources.limiar.current,
            overloaded: state.overloaded,
            message: `Supressão ativa: ${input.spellName} não pode ser lançada até o próximo turno. Nenhum PM foi gasto.`,
          }
          setState(
            appendArenaLog(state, 'magia', `${input.spellName} bloqueada pela Supressão`),
          )
          return blocked
        }

        const result = spendMana({
          amount: input.amount,
          spellName: input.spellName,
          // O estado da mesa é a fonte da verdade: o modelo não envia números
          // de PM/Limiar, só o custo da magia.
          currentPlayerMana: state.resources.pm.current,
          currentThreshold: state.resources.limiar.current,
          maxThreshold: state.resources.limiar.max,
        })

        setState(
          appendArenaLog(
            {
              ...state,
              resources: {
                ...state.resources,
                pm: { ...state.resources.pm, current: result.newMana },
                limiar: { ...state.resources.limiar, current: result.newThreshold },
              },
              overloaded: result.overloaded,
            },
            'magia',
            `${input.spellName}: −${input.amount} PM`,
            result.message,
          ),
        )

        return result
      },
    }),

    roll_macula_save: tool({
      description:
        'Rola o SAVE contra Mácula quando uma magia é lançada em Sobrecarga. Dificuldade = Complexidade da magia. Em caso de falha, aplica o efeito da Mácula (dano, Ímpeto, Limiar) no estado da mesa.',
      inputSchema: z.object({
        diceCount: z.number().int().min(0).max(30).describe('Dados do SAVE (arcanismo/ocultismo + vontade).'),
        complexity: z.number().int().min(0).max(30).describe('Complexidade da magia lançada.'),
        maculaType: z
          .enum(['reforco', 'projecao', 'elemental', 'alteracao', 'multiplicacao', 'arcana'])
          .describe('Tipo de Mácula conforme a Esfera da magia.'),
      }),
      execute: async (input) => {
        const result = rollMaculaSave(input)
        let state = appendArenaLog(
          getState(),
          'macula-save',
          `SAVE contra Mácula: ${result.successes} sucesso(s) vs DIF ${input.complexity}`,
          result.failed
            ? `Falhou por ${result.failureMargin}.`
            : 'Passou: nenhuma Mácula.',
        )

        if (result.failed) {
          state = applyMaculaEffect(state, input.maculaType, result.failureMargin)
        }

        setState(state)
        return result
      },
    }),

    advance_threat_clock: tool({
      description:
        'Avança ou reduz um Relógio de Ameaça (segmentos). Cria o relógio se ainda não existir. Use depois de calculate_enemy_damage para aplicar o dano ao alvo, ou para relógios de tensão da cena.',
      inputSchema: z.object({
        clockName: z.string().min(1).max(120).describe('Nome do relógio ou do inimigo.'),
        current: z.number().int().min(0).max(20).describe('Segmentos atuais informados.'),
        max: z.number().int().min(1).max(20).describe('Total de segmentos do relógio.'),
        delta: z.number().int().min(-20).max(20).describe('Quanto avançar (positivo) ou recuar (negativo).'),
        clockKind: z
          .enum(['mook', 'fraco', 'padrao', 'elite', 'lendario'])
          .optional()
          .describe('Classificação do inimigo, usada ao criar o relógio.'),
        resilient: z.boolean().optional().describe('O inimigo é resiliente?'),
      }),
      execute: async (input) => {
        const { state, result } = upsertThreatClock(getState(), {
          clockName: input.clockName,
          current: input.current,
          max: input.max,
          delta: input.delta,
        })

        let next = state
        const clock = next.clocks.find(
          (entry) => entry.name.toLowerCase() === result.name.toLowerCase(),
        )
        if (clock) {
          next = {
            ...next,
            clocks: next.clocks.map((entry) =>
              entry.id === clock.id
                ? {
                    ...entry,
                    kind: input.clockKind && isThreatKind(input.clockKind) ? input.clockKind : entry.kind,
                    resilient: input.resilient ?? entry.resilient,
                  }
                : entry,
            ),
          }
        }

        setState(next)
        return result
      },
    }),

    end_turn: tool({
      description:
        'Encerra o turno do jogador: restaura PA e PM, encerra a Supressão e limpa o teste pendente. Use SOMENTE quando o jogador declarar que encerra o turno (ou clicar no botão). Nunca encerre o turno por conta própria.',
      inputSchema: z.object({}),
      execute: async () => {
        if (guard.end_turn) {
          return {
            applied: false,
            alreadyApplied: true,
            message:
              'O turno já foi encerrado pelo motor nesta mensagem. Narre apenas a transição e devolva a palavra ao jogador.',
          }
        }

        const before = getState()
        const next = startTurn(before)
        guard.end_turn = true
        setState(next)

        return {
          applied: true,
          turn: next.turn,
          pa: next.resources.pa.current,
          pm: next.resources.pm.current,
          suppressed: next.suppressed,
          message: `Turno ${before.turn} → ${next.turn}. PA e PM restaurados; Supressão encerrada.`,
        }
      },
    }),

    enter_suppression: tool({
      description:
        'Entra em Supressão Arcana: resfria o Limiar em 2 + atributo chave, corta a mana e bloqueia magias até o próximo turno. Use SOMENTE quando o jogador declarar Supressão (ou clicar no botão). Se a Supressão já estiver ativa, não aplique de novo.',
      inputSchema: z.object({}),
      execute: async () => {
        if (guard.suppress) {
          return {
            applied: false,
            alreadyApplied: true,
            message:
              'A Supressão já foi aplicada pelo motor nesta mensagem. Narre apenas o resfriamento e devolva a palavra ao jogador.',
          }
        }

        const state = getState()
        if (state.suppressed) {
          guard.suppress = true
          return {
            applied: false,
            suppressed: true,
            message:
              'Supressão já está ativa: a mana só volta no próximo turno. Nada foi alterado.',
          }
        }

        const next = suppressMana(state, keyAttributeValue)
        const cooling = 2 + keyAttributeValue
        guard.suppress = true
        setState(next)

        return {
          applied: true,
          cooling,
          limiar: next.resources.limiar.current,
          pm: next.resources.pm.current,
          suppressed: next.suppressed,
          message: `Supressão ativa: Limiar −${cooling} (agora ${next.resources.limiar.current}), mana cortada até o próximo turno.`,
        }
      },
    }),
  }
}

/**
 * Executa a chamada ao Groq e devolve uma resposta pronta para HTTP.
 * Separado do `node:http` para poder ser testado e reutilizado pelo middleware
 * de desenvolvimento do Vite.
 */
export async function handleChatMestre(
  payload: unknown,
  options: { signal?: AbortSignal } = {},
): Promise<ChatMestreHttpResult> {
  const apiKey = process.env.GROQ_API_KEY?.trim()
  if (!apiKey) {
    return { status: 500, body: { error: MISSING_KEY_ERROR } }
  }

  const parsed = requestSchema.safeParse(payload)
  if (!parsed.success) {
    return {
      status: 400,
      body: { error: 'Requisição inválida: envie messages, fichaPersonagem e gameState.' },
    }
  }

  const sheet = normalizeSheetSummary(parsed.data.fichaPersonagem)
  let gameState = normalizeGameState(parsed.data.gameState, sheet.max)

  const keyAttributeValue = sheet.keyAttribute
    ? Math.max(
        0,
        Math.trunc(sheet.attributes[sheet.keyAttribute as AmniaAttributeId] ?? 0),
      )
    : 0

  // A rerrolagem de Ímpeto vem da seleção visual do jogador. O servidor aplica
  // antes de chamar o modelo, para que a narração use os dados reais.
  let rerollView: ArenaToolResultView | null = null
  let rerollNote: string | undefined
  if (parsed.data.impetoReroll) {
    const outcome = applyImpetoReroll(gameState, parsed.data.impetoReroll.indices)
    if (!outcome.ok) {
      return { status: 400, body: { error: outcome.error } }
    }

    gameState = outcome.state
    rerollNote = outcome.message
    rerollView = {
      toolName: 'reroll_with_impeto',
      input: { indices: parsed.data.impetoReroll.indices },
      output: {
        ...outcome.test,
        testId: outcome.test.id,
        message: outcome.message,
      },
    }
  }

  // Ações de mesa (botões) são resolvidas deterministicamente aqui. O modelo
  // recebe o resultado pronto e só narra a transição, sem recalcular nada.
  const guard: Record<ArenaTableActionType, boolean> = {
    end_turn: false,
    suppress: false,
  }
  let tableActionView: ArenaToolResultView | null = null
  let tableActionNote: string | undefined
  const requestedAction = parsed.data.tableAction
  if (requestedAction) {
    const actionInput = { type: requestedAction.type, id: requestedAction.id }

    if (requestedAction.type === 'end_turn') {
      const before = gameState
      const next = startTurn(before)
      gameState = next
      guard.end_turn = true
      tableActionNote = `O jogador encerrou o turno. O motor já aplicou: turno ${before.turn} → ${next.turn}, PA ${before.resources.pa.current} → ${next.resources.pa.current}, PM ${before.resources.pm.current} → ${next.resources.pm.current}, Supressão encerrada. Narre a transição em 1–2 frases e devolva a palavra ao jogador. NÃO chame end_turn de novo.`
      tableActionView = {
        toolName: 'end_turn',
        input: actionInput,
        output: {
          applied: true,
          turn: next.turn,
          pa: next.resources.pa.current,
          pm: next.resources.pm.current,
          suppressed: next.suppressed,
          message: `Turno ${before.turn} → ${next.turn}. PA e PM restaurados; Supressão encerrada.`,
        },
      }
    } else if (gameState.suppressed) {
      guard.suppress = true
      tableActionNote =
        'O jogador tentou entrar em Supressão, mas ela já estava ativa. O motor não alterou nada. Narre brevemente que a Supressão continua e que a mana só volta no próximo turno. NÃO chame enter_suppression.'
      tableActionView = {
        toolName: 'enter_suppression',
        input: actionInput,
        output: {
          applied: false,
          suppressed: true,
          message: 'Supressão já estava ativa: nada mudou.',
        },
      }
    } else {
      const before = gameState
      const next = suppressMana(before, keyAttributeValue)
      const cooling = 2 + keyAttributeValue
      gameState = next
      guard.suppress = true
      tableActionNote = `O jogador entrou em Supressão Arcana. O motor já aplicou: Limiar ${before.resources.limiar.current} → ${next.resources.limiar.current} (−${cooling}), PM ${before.resources.pm.current} → 0, magias bloqueadas até o próximo turno. Narre brevemente o resfriamento e a mana cortada. NÃO chame enter_suppression de novo.`
      tableActionView = {
        toolName: 'enter_suppression',
        input: actionInput,
        output: {
          applied: true,
          cooling,
          limiar: next.resources.limiar.current,
          pm: next.resources.pm.current,
          suppressed: next.suppressed,
          message: `Supressão ativa: Limiar −${cooling} (agora ${next.resources.limiar.current}), mana cortada até o próximo turno.`,
        },
      }
    }
  }

  const resolvedNote = [rerollNote, tableActionNote].filter(Boolean).join('\n\n') || undefined

  const messages = parsed.data.messages
    .slice(-MAX_HISTORY)
    .map((message) => ({ role: message.role, content: message.content }))

  const modelId = process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL

  try {
    const groq = createGroq({ apiKey })
    const tools = buildTools(
      sheet,
      () => gameState,
      (next) => {
        gameState = next
      },
      keyAttributeValue,
      guard,
    )

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
      abortSignal: options.signal,
    })

    const toolResults: ArenaToolResultView[] = [
      ...(rerollView ? [rerollView] : []),
      ...(tableActionView ? [tableActionView] : []),
      ...result.toolResults.map((entry) => ({
        toolName: entry.toolName,
        input: entry.input,
        output: entry.output,
      })),
    ]

    const reply =
      result.text.trim() ||
      'O Mestre observa em silêncio por um instante, como se pesasse cada palavra antes de responder. O que você faz?'

    return {
      status: 200,
      body: {
        reply,
        toolResults,
        gameState,
        model: modelId,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erro desconhecido'
    const rateLimited = /rate limit|429|too many requests/i.test(message)
    const hint = rateLimited
      ? `Limite de uso do Groq atingido (modelo ${modelId}). O plano gratuito permite poucas chamadas por minuto: aguarde cerca de 20 segundos e tente novamente.`
      : /does not exist|do not have access/i.test(message)
        ? `${message} Verifique GROQ_MODEL (modelo configurado: ${modelId}).`
        : message
    return {
      status: rateLimited ? 429 : 502,
      body: { error: `Falha ao consultar o Groq: ${hint}` },
    }
  }
}
