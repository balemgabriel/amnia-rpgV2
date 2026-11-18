import { createGroq } from '@ai-sdk/groq'
import { generateText, stepCountIs, tool } from 'ai'
import { z } from 'zod'
import {
  applyMaculaEffect,
  appendArenaLog,
  calculateEnemyDamage,
  isThreatKind,
  normalizeGameState,
  normalizeSheetSummary,
  spendMana,
  upsertThreatClock,
} from '../src/lib/amnia/rules'
import { resolveAmniaTest, rollMaculaSave } from '../src/lib/amnia/dice'
import { buildArenaSystemPrompt } from '../src/lib/amnia/prompt'
import type {
  ArenaChatResponse,
  ArenaGameState,
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
})

const MAX_HISTORY = 24

function buildTools(getState: () => ArenaGameState, setState: (next: ArenaGameState) => void) {
  return {
    roll_test: tool({
      description:
        'Rola um teste de Amnia com d6 empilhados e calcula sucessos, dificuldade e Margem de Sucesso (MoS). Use SEMPRE antes de narrar qualquer ataque, defesa, perícia ou resistência. Nunca invente dados.',
      inputSchema: z.object({
        diceCount: z.number().int().min(0).max(30).describe('Quantidade de d6 a rolar.'),
        difficulty: z.number().int().min(0).max(30).describe('Dificuldade do teste em sucessos.'),
        label: z.string().min(1).max(160).describe('O que está sendo testado (ex.: ataque de espada).'),
      }),
      execute: async (input) => {
        const result = resolveAmniaTest(input)
        setState(
          appendArenaLog(
            getState(),
            'rolagem',
            `${result.label}: ${result.successes} sucesso(s) vs DIF ${result.difficulty} (MoS ${result.mos})`,
            `Dados: [${result.dice.join(', ')}]${result.criticalPairs > 0 ? ' · crítico (par de 6)' : ''}${
              result.criticalFailures > 0 ? ' · falha crítica (par de 1)' : ''
            }`,
          ),
        )
        return result
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

  const messages = parsed.data.messages
    .slice(-MAX_HISTORY)
    .map((message) => ({ role: message.role, content: message.content }))

  const modelId = process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL

  try {
    const groq = createGroq({ apiKey })
    const tools = buildTools(
      () => gameState,
      (next) => {
        gameState = next
      },
    )

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
      abortSignal: options.signal,
    })

    const toolResults: ArenaToolResultView[] = result.toolResults.map((entry) => ({
      toolName: entry.toolName,
      input: entry.input,
      output: entry.output,
    }))

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
