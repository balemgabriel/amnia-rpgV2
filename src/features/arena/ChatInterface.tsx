import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import {
  Bot,
  ChevronDown,
  Clock3,
  Dices,
  Droplet,
  Footprints,
  ListChecks,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  Send,
  ShieldAlert,
  Skull,
  Snowflake,
  Sparkles,
  Swords,
  TriangleAlert,
  User,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import type {
  ArenaChatMessage,
  ArenaChatResponse,
  ArenaGameState,
  ArenaSheetSummary,
  ArenaTableActionRequest,
  ArenaTableActionType,
  ArenaToolResultView,
} from '@/lib/amnia/types'

export interface ChatMessage extends ArenaChatMessage {
  id: string
  toolResults?: ArenaToolResultView[]
  model?: string
}

const SUGGESTIONS = [
  'Descreva o lugar onde estou.',
  'Eu ataco o bandido mais próximo com minha espada.',
  'Quero lançar uma magia.',
]

/** Atalhos do menu "Ações": só preenchem o campo, quem envia é o jogador. */
const QUICK_ACTIONS = [
  { label: 'Atacar', text: 'Eu ataco o inimigo mais próximo.' },
  { label: 'Defender', text: 'Eu me defendo e preparo uma reação.' },
  { label: 'Observar', text: 'Eu observo a cena com atenção, procurando detalhes.' },
  { label: 'Falar', text: 'Eu falo com quem está à minha frente.' },
  { label: 'Ajudar', text: 'Eu ajudo um aliado na ação dele.' },
  { label: 'Lançar magia', text: 'Eu preparo uma magia.' },
]

let messageSequence = 0

/** Tempo máximo de espera por uma resposta do Mestre. */
const REQUEST_TIMEOUT_MS = 120_000

function nextMessageId(prefix: string): string {
  messageSequence += 1
  return `${prefix}-${Date.now()}-${messageSequence}`
}

/**
 * Chat da Arena.
 *
 * A conversa é enviada para `POST /api/chat-mestre` junto da ficha resumida e
 * do estado da mesa. O servidor chama as ferramentas de regras e devolve a
 * narração + os resultados reais; nada de dados é inventado no navegador.
 */
export function ChatInterface({
  sheet,
  gameState,
  onGameState,
  demo,
  tableAction,
  onTableAction,
  onBusyChange,
  sidebarOpen,
  onToggleSidebar,
}: {
  sheet: ArenaSheetSummary
  gameState: ArenaGameState
  onGameState: (state: ArenaGameState) => void
  demo: boolean
  /** Ação de mesa pedida por um botão (fora do chat). */
  tableAction: ArenaTableActionRequest | null
  /** Pede Encerrar turno / Supressão; a ação é resolvida pelo servidor. */
  onTableAction: (type: ArenaTableActionType) => void
  /** Informa ao painel da ficha quando o chat está aguardando resposta. */
  onBusyChange: (busy: boolean) => void
  sidebarOpen: boolean
  onToggleSidebar: () => void
}) {
  const firstName = sheet.name.trim().split(/\s+/)[0] || 'viajante'
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { id: nextMessageId('welcome'), role: 'assistant', content: welcomeMessage(sheet) },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [model, setModel] = useState<string | null>(null)
  /** Menu "Ações" e faixa compacta de inimigos. */
  const [showActions, setShowActions] = useState(false)
  const [showEnemies, setShowEnemies] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  /** Último histórico enviado, para o botão "Tentar novamente". */
  const lastRequest = useRef<ChatMessage[]>([])
  /** Rerrolagem de Ímpeto que acompanha a última requisição, se houver. */
  const lastReroll = useRef<{ indices: number[] } | undefined>(undefined)
  /** Ação de mesa que acompanha a última requisição (reenvio). */
  const lastTableAction = useRef<ArenaTableActionRequest | undefined>(undefined)
  /** Id da última ação de mesa já enviada por este chat. */
  const handledTableAction = useRef<number | null>(null)

  // O painel da ficha usa este estado para desabilitar Encerrar turno/Supressão
  // enquanto o Mestre responde.
  useEffect(() => {
    onBusyChange(loading)
  }, [loading, onBusyChange])

  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages, loading, error])

  async function request(
    history: ChatMessage[],
    reroll?: { indices: number[] },
    action?: ArenaTableActionRequest,
  ) {
    setError(null)
    setLoading(true)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch('/api/chat-mestre', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
          fichaPersonagem: sheet,
          gameState,
          ...(reroll ? { impetoReroll: reroll } : {}),
          ...(action ? { tableAction: { type: action.type, id: action.id } } : {}),
        }),
        signal: controller.signal,
      })

      const raw = await response.text()
      let payload: unknown = null
      try {
        payload = raw ? JSON.parse(raw) : null
      } catch {
        payload = null
      }

      if (response.status === 404) {
        throw new Error(
          'A API do Mestre não está disponível neste endereço (HTTP 404). Use `npm run dev` ou `npm run preview`; o `vite preview` puro não monta a API.',
        )
      }

      if (!response.ok) {
        const detail = readError(payload)
        const snippet = raw.trim().replace(/\s+/g, ' ').slice(0, 180)
        throw new Error(
          detail ??
            (snippet
              ? `O Mestre não respondeu (HTTP ${response.status}): ${snippet}`
              : `O Mestre não respondeu (HTTP ${response.status}).`),
        )
      }

      const data = payload as ArenaChatResponse | null
      if (!data || typeof data.reply !== 'string') {
        throw new Error('Resposta inesperada do servidor do Mestre.')
      }

      setMessages((current) => [
        ...current,
        {
          id: nextMessageId('master'),
          role: 'assistant',
          content: data.reply,
          toolResults: Array.isArray(data.toolResults) ? data.toolResults : [],
          model: data.model,
        },
      ])
      setModel(data.model)
      if (data.gameState) onGameState(data.gameState)
    } catch (caught) {
      const message = controller.signal.aborted
        ? 'O Mestre demorou demais para responder. Se o limite do Groq foi atingido, aguarde ~20 segundos e tente novamente.'
        : caught instanceof Error
          ? caught.message
          : 'Não foi possível falar com o Mestre.'
      setError(message)
    } finally {
      window.clearTimeout(timeout)
      setLoading(false)
    }
  }

  async function send(raw: string) {
    const text = raw.trim()
    if (!text || loading) return

    const userMessage: ChatMessage = {
      id: nextMessageId('user'),
      role: 'user',
      content: text,
    }
    const history = [...messages, userMessage]

    lastRequest.current = history
    lastReroll.current = undefined
    lastTableAction.current = undefined
    setMessages(history)
    setInput('')
    await request(history)
  }

  /**
   * Rerrolagem de Ímpeto escolhida nos dados do último teste.
   *
   * A seleção acontece na interface; o servidor aplica a rerrolagem, gasta o
   * Ímpeto e devolve o novo resultado para o Mestre narrar.
   */
  async function useImpeto(indices: number[]) {
    if (loading || indices.length === 0) return

    const label = indices.map((index) => index + 1).join(' e ')
    const userMessage: ChatMessage = {
      id: nextMessageId('user'),
      role: 'user',
      content: `Uso 1 Ímpeto para rerrolar ${indices.length === 1 ? `o dado ${label}` : `os dados ${label}`}.`,
    }
    const history = [...messages, userMessage]

    lastRequest.current = history
    lastReroll.current = { indices }
    lastTableAction.current = undefined
    setMessages(history)
    await request(history, { indices })
  }

  /**
   * Encerrar turno / Supressão disparados por botão.
   *
   * A ação é aplicada pelo servidor ANTES da narração, então o chat mostra a
   * mensagem do jogador e o Mestre descreve a transição. O `id` evita que o
   * mesmo clique seja enviado duas vezes.
   */
  async function sendTableAction(type: ArenaTableActionType, id = 0) {
    if (loading) return

    const content =
      type === 'end_turn' ? 'Encerro meu turno.' : 'Entro em Supressão Arcana.'
    const userMessage: ChatMessage = {
      id: nextMessageId('user'),
      role: 'user',
      content,
    }
    const history = [...messages, userMessage]
    const action: ArenaTableActionRequest = { type, id }

    lastRequest.current = history
    lastReroll.current = undefined
    lastTableAction.current = action
    setMessages(history)
    setShowActions(false)
    await request(history, undefined, action)
  }

  // Um botão de fora do chat (ficha ou menu) pediu uma ação de mesa.
  useEffect(() => {
    if (!tableAction || loading) return
    if (handledTableAction.current === tableAction.id) return
    handledTableAction.current = tableAction.id
    void sendTableAction(tableAction.type, tableAction.id)
    // `sendTableAction` usa o histórico atual; a guarda por id evita repetição.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableAction, loading])

  /** Reenvia a última mensagem sem duplicá-la no histórico. */
  function retry() {
    if (loading || lastRequest.current.length === 0) return
    void request(lastRequest.current, lastReroll.current, lastTableAction.current)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void send(input)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void send(input)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/45 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800/80 bg-slate-950/60 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative grid size-9 shrink-0 place-items-center rounded-full border border-slate-700/80 bg-slate-900">
            <Sparkles className="size-4 text-[#F1269C]" aria-hidden />
            <span
              className={cn(
                'absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-slate-950',
                loading ? 'animate-pulse bg-amber-400' : 'bg-emerald-400',
              )}
            />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-100">Mestre de Amnia</p>
            <p className="truncate text-[11px] text-slate-500">
              {loading
                ? 'está narrando a próxima cena…'
                : model
                  ? `narrando com ${model}`
                  : 'narrando a cena'}
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-slate-700/70 bg-slate-900/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          {demo ? 'Ficha de exemplo' : 'Groq · servidor'}
        </span>
      </header>

      <div
        ref={scrollRef}
        className="arena-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-4"
        aria-live="polite"
      >
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            pendingTestId={gameState.pendingTest?.id}
            impeto={gameState.resources.impeto.current}
            onImpetoReroll={useImpeto}
            loading={loading}
          />
        ))}

        {messages.length === 1 && !loading ? (
          <div className="flex flex-wrap gap-2 pl-10 sm:pl-11">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => void send(suggestion)}
                className="rounded-full border border-slate-700/70 bg-slate-900/60 px-3 py-1.5 text-left text-[11px] text-slate-300 transition hover:border-[#0055FE]/60 hover:bg-slate-800/80 hover:text-slate-100"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-start gap-2.5" role="status" aria-live="polite">
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-slate-700/70 bg-slate-900 text-slate-400">
              <Bot className="size-3.5" aria-hidden />
            </span>
            <div className="rounded-2xl rounded-tl-sm border border-slate-700/60 bg-slate-800/60 px-3.5 py-2.5">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                <Loader2 className="size-3 animate-spin" aria-hidden />
                Mestre está narrando…
              </p>
            </div>
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="ml-10 flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2.5 text-[12px] leading-relaxed text-rose-200 sm:ml-11"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div className="min-w-0">
              <p>{error}</p>
              <button
                type="button"
                onClick={retry}
                disabled={loading}
                className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-rose-400/40 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className="size-3" aria-hidden />
                Tentar novamente
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-slate-800/80 bg-slate-950/70 p-3">
        {showEnemies ? (
          <EnemyStrip
            clocks={gameState.clocks}
            onAttack={(name) => {
              setInput(`Eu ataco ${name}.`)
              setShowEnemies(false)
              inputRef.current?.focus()
            }}
          />
        ) : null}

        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <ToolbarButton
            active={showActions}
            onClick={() => setShowActions((open) => !open)}
            icon={<ListChecks className="size-3.5" aria-hidden />}
            label="Ações"
          />
          <ToolbarButton
            active={showEnemies}
            onClick={() => setShowEnemies((open) => !open)}
            icon={<Skull className="size-3.5" aria-hidden />}
            label={`Inimigos${gameState.clocks.length > 0 ? ` (${gameState.clocks.length})` : ''}`}
          />
          <ToolbarButton
            active={!sidebarOpen}
            onClick={onToggleSidebar}
            icon={
              sidebarOpen ? (
                <PanelRightClose className="size-3.5" aria-hidden />
              ) : (
                <PanelRightOpen className="size-3.5" aria-hidden />
              )
            }
            label={sidebarOpen ? 'Ocultar ficha' : 'Mostrar ficha'}
          />
        </div>

        {showActions ? (
          <div className="mb-2 rounded-xl border border-slate-800/80 bg-slate-900/60 p-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Ações narrativas
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => {
                    setInput(action.text)
                    setShowActions(false)
                    inputRef.current?.focus()
                  }}
                  className="rounded-full border border-slate-700/70 bg-slate-950/60 px-2.5 py-1 text-[11px] text-slate-300 transition hover:border-[#0055FE]/60 hover:bg-slate-800 hover:text-slate-100"
                >
                  {action.label}
                </button>
              ))}
            </div>

            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Ações de mesa
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={loading || gameState.suppressed}
                onClick={() => onTableAction('suppress')}
                title={
                  gameState.suppressed
                    ? 'Supressão já está ativa até o próximo turno'
                    : 'O Mestre narra o resfriamento do Limiar e a mana cortada'
                }
                className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-100 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Snowflake className="size-3" aria-hidden />
                Supressão
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => onTableAction('end_turn')}
                title="O Mestre narra o fim do turno; PA e PM são restaurados"
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-600/70 bg-slate-900/70 px-2.5 py-1 text-[11px] font-semibold text-slate-200 transition hover:border-slate-400 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RefreshCw className="size-3" aria-hidden />
                Encerrar turno
              </button>
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-slate-600">
              Ações de mesa são aplicadas pelo servidor e narradas pelo Mestre. Os botões ficam
              bloqueados enquanto ele responde.
            </p>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={`O que ${firstName} faz?`}
            aria-label="Mensagem para o Mestre"
            className="arena-scroll min-h-11 max-h-32 w-full flex-1 resize-none rounded-xl border border-slate-700/80 bg-slate-900/80 px-3.5 py-3 text-sm leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-[#0055FE]/70 focus:outline-none focus:ring-2 focus:ring-[#0055FE]/20"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className={cn(
              'inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition',
              'bg-gradient-to-r from-[#0055FE] to-[#F1269C] shadow-[0_8px_24px_rgba(0,85,254,0.25)]',
              'hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F1269C]/70',
              'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100',
            )}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Send className="size-4" aria-hidden />
            )}
            Enviar
          </button>
        </form>
        <p className="mt-2 text-center text-[10px] text-slate-600">
          Enter envia · Shift + Enter quebra linha · dados e regras são calculados no servidor
        </p>
      </div>
    </div>
  )
}

/** Mesmo limite do motor: 1 Ímpeto rerrola até 2 dados falhos. */
const MAX_IMPETO_SELECTION = 2

function MessageBubble({
  message,
  pendingTestId,
  impeto,
  onImpetoReroll,
  loading,
}: {
  message: ChatMessage
  pendingTestId?: string
  impeto: number
  onImpetoReroll: (indices: number[]) => void
  loading: boolean
}) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex items-start gap-2.5', isUser && 'flex-row-reverse')}>
      <span
        className={cn(
          'mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border text-slate-300',
          isUser
            ? 'border-[#0055FE]/40 bg-[#0055FE]/15 text-[#93B4FF]'
            : 'border-slate-700/70 bg-slate-900 text-slate-400',
        )}
        aria-hidden
      >
        {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
      </span>

      <div className={cn('flex min-w-0 max-w-[85%] flex-col gap-2', isUser && 'items-end')}>
        <div
          className={cn(
            'rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
            isUser
              ? 'rounded-tr-sm bg-[#0055FE] text-white shadow-[0_8px_24px_rgba(0,85,254,0.18)]'
              : 'rounded-tl-sm border border-slate-700/60 bg-slate-800/65 text-slate-100',
          )}
        >
          {message.content}
        </div>

        {message.toolResults && message.toolResults.length > 0 ? (
          <div className="grid w-full gap-1.5">
            {message.toolResults.map((result, index) => (
              <ToolResultCard
                key={`${result.toolName}-${index}`}
                toolName={result.toolName}
                input={result.input}
                output={result.output}
                pendingTestId={pendingTestId}
                impeto={impeto}
                onImpetoReroll={onImpetoReroll}
                loading={loading}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

type ToolTone = 'positive' | 'warning' | 'danger' | 'neutral'

const TOOL_TONE_CLASS: Record<ToolTone, string> = {
  positive: 'border-emerald-500/30 bg-emerald-500/[0.07] text-emerald-200',
  warning: 'border-amber-500/30 bg-amber-500/[0.07] text-amber-200',
  danger: 'border-rose-500/35 bg-rose-500/[0.08] text-rose-200',
  neutral: 'border-slate-700/70 bg-slate-900/60 text-slate-300',
}

const TOOL_ICON_CLASS: Record<ToolTone, string> = {
  positive: 'text-emerald-300',
  warning: 'text-amber-300',
  danger: 'text-rose-300',
  neutral: 'text-slate-400',
}

function ToolResultCard({
  toolName,
  input,
  output,
  pendingTestId,
  impeto,
  onImpetoReroll,
  loading,
}: {
  toolName: string
  input: unknown
  output: unknown
  pendingTestId?: string
  impeto: number
  onImpetoReroll: (indices: number[]) => void
  loading: boolean
}) {
  // Testes ganham a mesa de dados (jogador em verde, Mestre em vermelho) e a
  // seleção de rerrolagem de Ímpeto.
  const test = readTestResult(toolName, output)
  if (test) {
    return (
      <DiceTable
        test={test}
        interactive={Boolean(test.testId && pendingTestId && test.testId === pendingTestId)}
        impeto={impeto}
        onReroll={onImpetoReroll}
        loading={loading}
      />
    )
  }

  const view = describeToolResult(toolName, input, output)

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-xl border px-2.5 py-2 text-[11px] leading-relaxed',
        TOOL_TONE_CLASS[view.tone],
      )}
    >
      <span className={cn('mt-0.5 shrink-0', TOOL_ICON_CLASS[view.tone])}>{view.icon}</span>
      <div className="min-w-0">
        <p className="font-semibold uppercase tracking-[0.1em]">{view.title}</p>
        <p className="mt-0.5 break-words tabular-nums opacity-90">{view.detail}</p>
      </div>
    </div>
  )
}

interface TestResultView {
  testId?: string
  name: string
  breakdown?: string
  dice: number[]
  successes: number
  targetSuccesses: number
  difficulty: number
  difficultyReason?: string
  mos: number
  enemy?: { label: string; dice: number[]; successes: number }
  failedIndices: number[]
  criticalPairs: number
  criticalFailures: number
  impetoReroll?: { indices: number[]; previousValues: number[] }
  message?: string
}

/** Lê o resultado de `roll_test`/`reroll_with_impeto` para a mesa de dados. */
function readTestResult(toolName: string, output: unknown): TestResultView | null {
  if (toolName !== 'roll_test' && toolName !== 'reroll_with_impeto') return null

  const out = asRecord(output)
  const dice = asNumberList(out.dice)
  if (dice.length === 0) return null

  const enemy = asRecord(out.enemy)
  const enemyDice = asNumberList(enemy.dice)
  const reroll = asRecord(out.impetoReroll)
  const rerollIndices = asNumberList(reroll.indices)
  const previousValues = asNumberList(reroll.previousValues)

  return {
    ...(asString(out.testId) ? { testId: asString(out.testId) } : {}),
    name: asString(out.test) || asString(out.label) || 'Teste de Amnia',
    ...(asString(out.diceBreakdown) ? { breakdown: asString(out.diceBreakdown) } : {}),
    dice,
    successes: asNumber(out.successes) ?? 0,
    targetSuccesses: asNumber(out.targetSuccesses) ?? asNumber(out.difficulty) ?? 0,
    difficulty: asNumber(out.difficulty) ?? 0,
    ...(asString(out.difficultyReason) ? { difficultyReason: asString(out.difficultyReason) } : {}),
    mos: asNumber(out.mos) ?? 0,
    ...(enemyDice.length > 0
      ? {
          enemy: {
            label: asString(enemy.label) || 'Inimigo',
            dice: enemyDice,
            successes: asNumber(enemy.successes) ?? 0,
          },
        }
      : {}),
    failedIndices: asNumberList(out.failedIndices),
    criticalPairs: asNumber(out.criticalPairs) ?? 0,
    criticalFailures: asNumber(out.criticalFailures) ?? 0,
    ...(rerollIndices.length > 0
      ? { impetoReroll: { indices: rerollIndices, previousValues } }
      : {}),
    ...(asString(out.message) ? { message: asString(out.message) } : {}),
  }
}

const MOS_BADGE_CLASS: Record<ToolTone, string> = {
  positive: 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100',
  warning: 'border-amber-400/50 bg-amber-500/15 text-amber-100',
  danger: 'border-rose-400/50 bg-rose-500/15 text-rose-100',
  neutral: 'border-slate-600/70 bg-slate-800/80 text-slate-200',
}

const TEST_BORDER_CLASS: Record<ToolTone, string> = {
  positive: 'border-emerald-500/35',
  warning: 'border-amber-500/35',
  danger: 'border-rose-500/35',
  neutral: 'border-slate-700/70',
}

/**
 * Mesa visual de um teste: dados do jogador (contorno verde) contra os dados do
 * Mestre (contorno vermelho), com a seleção de até 2 dados falhos para Ímpeto.
 */
function DiceTable({
  test,
  interactive,
  impeto,
  onReroll,
  loading,
}: {
  test: TestResultView
  interactive: boolean
  impeto: number
  onReroll: (indices: number[]) => void
  loading: boolean
}) {
  const [selected, setSelected] = useState<number[]>([])

  const canReroll = interactive && test.failedIndices.length > 0 && impeto >= 1
  const activeSelection = canReroll ? selected : []
  const tone: ToolTone = test.mos > 0 ? 'positive' : test.mos === 0 ? 'warning' : 'danger'
  const rerolledIndices = new Set(test.impetoReroll?.indices ?? [])

  function toggle(index: number) {
    setSelected((current) => {
      if (current.includes(index)) return current.filter((value) => value !== index)
      if (current.length >= MAX_IMPETO_SELECTION) return current
      return [...current, index]
    })
  }

  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-xl border bg-slate-900/60 text-left',
        TEST_BORDER_CLASS[tone],
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-2.5 py-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-100">
            {test.name}
          </p>
          {test.breakdown ? (
            <p className="truncate text-[10px] text-slate-500">{test.breakdown}</p>
          ) : null}
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold tabular-nums',
            MOS_BADGE_CLASS[tone],
          )}
        >
          MoS {test.mos >= 0 ? '+' : ''}
          {test.mos}
        </span>
      </div>

      <div className="space-y-2.5 px-2.5 py-2.5">
        <DicePoolRow
          owner="player"
          label="Seus dados"
          dice={test.dice}
          successes={test.successes}
          failedIndices={test.failedIndices}
          selectableIndices={canReroll ? test.failedIndices : []}
          selectedIndices={activeSelection}
          rerolledIndices={rerolledIndices}
          onToggle={toggle}
        />

        {test.enemy ? (
          <DicePoolRow
            owner="enemy"
            label={test.enemy.label}
            dice={test.enemy.dice}
            successes={test.enemy.successes}
          />
        ) : (
          <p className="text-[10px] text-slate-400">
            Alvo: DIF {test.difficulty}
            {test.difficultyReason ? ` · ${test.difficultyReason}` : ' · sem resistência'}
          </p>
        )}

        {test.impetoReroll ? (
          <p className="flex items-start gap-1 text-[10px] leading-relaxed text-amber-200/90">
            <Zap className="mt-0.5 size-3 shrink-0" aria-hidden />
            <span>
              Ímpeto −1 · {describeReroll(test.impetoReroll)}
            </span>
          </p>
        ) : null}

        {test.criticalPairs > 0 || test.criticalFailures > 0 ? (
          <p className="text-[10px] text-slate-400">
            {test.criticalPairs > 0 ? 'Par de 6: crítico (+4 sucessos).' : ''}
            {test.criticalPairs > 0 && test.criticalFailures > 0 ? ' ' : ''}
            {test.criticalFailures > 0 ? 'Par de 1: falha crítica.' : ''}
          </p>
        ) : null}

        {test.message ? <p className="text-[10px] text-slate-400">{test.message}</p> : null}
      </div>

      {canReroll ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 bg-slate-950/40 px-2.5 py-2">
          <p className="text-[10px] text-slate-400">
            {selected.length === 0
              ? 'Clique em até 2 dados falhos para rerrolar com Ímpeto.'
              : `${selected.length} dado(s) selecionado(s).`}
          </p>
          <button
            type="button"
            disabled={selected.length === 0 || loading}
            onClick={() => onReroll([...selected].sort((a, b) => a - b))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/50 bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-100 transition hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Zap className="size-3" aria-hidden />
            Rerrolar {selected.length > 0 ? `${selected.length} · ` : ''}1 Ímpeto
          </button>
        </div>
      ) : interactive && test.failedIndices.length > 0 && impeto < 1 ? (
        <p className="border-t border-white/5 px-2.5 py-2 text-[10px] text-slate-500">
          Sem Ímpeto para rerrolar este teste.
        </p>
      ) : null}
    </div>
  )
}

function DicePoolRow({
  owner,
  label,
  dice,
  successes,
  failedIndices = [],
  selectableIndices = [],
  selectedIndices = [],
  rerolledIndices,
  onToggle,
}: {
  owner: 'player' | 'enemy'
  label: string
  dice: number[]
  successes: number
  failedIndices?: number[]
  selectableIndices?: number[]
  selectedIndices?: number[]
  rerolledIndices?: Set<number>
  onToggle?: (index: number) => void
}) {
  const isPlayer = owner === 'player'
  const failed = new Set(failedIndices)
  const selectable = new Set(selectableIndices)
  const selected = new Set(selectedIndices)
  const rerolled = rerolledIndices ?? new Set<number>()

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'truncate text-[10px] font-semibold uppercase tracking-[0.08em]',
            isPlayer ? 'text-emerald-300' : 'text-rose-300',
          )}
        >
          {label}
        </span>
        <span className="shrink-0 rounded-full border border-slate-600/70 bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-300">
          {successes} sucesso(s)
        </span>
      </div>

      <div className="flex flex-wrap gap-1">
        {dice.map((die, index) => {
          const success = die >= 4
          const isSelectable = selectable.has(index)
          const isSelected = selected.has(index)

          return (
            <button
              key={index}
              type="button"
              disabled={!isSelectable}
              onClick={isSelectable ? () => onToggle?.(index) : undefined}
              aria-pressed={isSelectable ? isSelected : undefined}
              aria-label={`Dado ${index + 1}: ${die}${success ? ', sucesso' : ', falha'}${
                isSelectable ? ', selecionável' : ''
              }`}
              title={
                isSelectable
                  ? 'Dado falho — clique para selecionar para a rerrolagem'
                  : undefined
              }
              className={cn(
                'relative grid size-7 shrink-0 place-items-center rounded-md border-2 text-[12px] font-bold tabular-nums transition',
                isPlayer ? 'border-emerald-400/70' : 'border-rose-500/70',
                success
                  ? isPlayer
                    ? 'bg-emerald-500/15 text-emerald-100'
                    : 'bg-emerald-500/10 text-emerald-100'
                  : 'bg-slate-800/80 text-slate-400',
                die === 6 && 'bg-emerald-500/30 text-white',
                die === 1 && 'bg-rose-500/25 text-rose-100',
                failed.has(index) && !success && 'text-slate-300',
                isSelectable && 'cursor-pointer hover:brightness-125',
                isSelected && 'ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-950',
                !isSelectable && 'cursor-default',
                rerolled.has(index) && 'shadow-[0_0_0_2px_rgba(251,191,36,0.45)]',
              )}
            >
              {die}
              {failed.has(index) && !success ? (
                <span
                  className="absolute -bottom-0.5 -right-0.5 size-1.5 rounded-full bg-rose-400"
                  aria-hidden
                />
              ) : null}
              {rerolled.has(index) ? (
                <span
                  className="absolute -right-1 -top-1 grid size-3 place-items-center rounded-full bg-amber-400 text-[8px] font-black leading-none text-slate-950"
                  aria-hidden
                >
                  R
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Faixa compacta de inimigos: quadrados com barra de vida simplificada. */
function EnemyStrip({
  clocks,
  onAttack,
}: {
  clocks: ArenaGameState['clocks']
  onAttack: (name: string) => void
}) {
  return (
    <div className="mb-2 rounded-xl border border-slate-800/80 bg-slate-900/60 p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Inimigos atuais
        </p>
        <span className="text-[10px] tabular-nums text-slate-600">
          {clocks.length} relógio(s)
        </span>
      </div>

      {clocks.length === 0 ? (
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
          Nenhum inimigo ativo. O Mestre cria relógios de ameaça quando a cena exige.
        </p>
      ) : (
        <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {clocks.map((clock) => {
            const completed = clock.current >= clock.max
            const percent =
              clock.max > 0
                ? Math.min(100, Math.round((clock.current / clock.max) * 100))
                : 0

            return (
              <button
                key={clock.id}
                type="button"
                onClick={() => onAttack(clock.name)}
                title={`Preparar ataque contra ${clock.name} (${clock.current}/${clock.max})`}
                className={cn(
                  'min-w-0 rounded-lg border px-2 py-1.5 text-left transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FE]/50',
                  completed
                    ? 'border-amber-500/40 bg-amber-500/[0.07]'
                    : 'border-slate-700/70 bg-slate-950/60',
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-[10px] font-semibold text-slate-200">
                    {clock.name}
                  </span>
                  <span className="shrink-0 text-[9px] tabular-nums text-slate-500">
                    {clock.current}/{clock.max}
                  </span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300',
                      completed ? 'bg-amber-400' : 'bg-rose-500',
                    )}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </button>
            )
          })}
        </div>
      )}

      <p className="mt-1.5 text-[10px] text-slate-600">
        Clique em um inimigo para preparar um ataque no campo.
      </p>
    </div>
  )
}

function ToolbarButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FE]/50',
        active
          ? 'border-[#0055FE]/60 bg-[#0055FE]/15 text-slate-100'
          : 'border-slate-700/70 bg-slate-900/70 text-slate-400 hover:border-slate-500 hover:bg-slate-800 hover:text-slate-100',
      )}
    >
      {icon}
      {label}
      {label === 'Ações' ? (
        <ChevronDown
          className={cn('size-3 transition-transform', active && 'rotate-180')}
          aria-hidden
        />
      ) : null}
    </button>
  )
}

function describeReroll(reroll: { indices: number[]; previousValues: number[] }): string {
  const labels = reroll.indices.map((index) => index + 1).join(' e ')
  const previous = reroll.previousValues.join(', ')
  return `dado(s) ${labels} rerrolado(s) [${previous}]`
}

function describeToolResult(
  toolName: string,
  input: unknown,
  output: unknown,
): { title: string; detail: string; tone: ToolTone; icon: ReactNode } {
  const out = asRecord(output)
  const inp = asRecord(input)

  switch (toolName) {
    case 'roll_test': {
      const dice = asNumberList(out.dice)
      const successes = asNumber(out.successes) ?? 0
      const difficulty = asNumber(out.difficulty) ?? asNumber(inp.difficulty) ?? 0
      const mos = asNumber(out.mos) ?? 0
      const enemy = asRecord(out.enemy)
      const enemySuccesses = asNumber(enemy.successes)
      const target =
        enemySuccesses !== null
          ? `defesa do Mestre (${enemySuccesses})`
          : `DIF ${difficulty}`
      return {
        title: 'Teste de Amnia',
        detail: `Rolagem: ${dice.length}d6 → [${dice.join(', ')}] = ${successes} sucesso(s) | ${target} | MoS ${mos >= 0 ? '+' : ''}${mos}`,
        tone: mos > 0 ? 'positive' : mos === 0 ? 'warning' : 'danger',
        icon: <Dices className="size-3.5" aria-hidden />,
      }
    }
    case 'reroll_with_impeto': {
      const error = asString(out.error)
      const message = asString(out.message)
      const indices = asNumberList(inp.indices)
      const labels = indices.map((index) => index + 1).join(' e ')
      return {
        title: error ? 'Rerrolagem indisponível' : 'Rerrolagem de Ímpeto',
        detail:
          error ||
          message ||
          (labels ? `Dado(s) ${labels} rerrolado(s) por 1 Ímpeto.` : 'Rerrolagem aplicada.'),
        tone: error ? 'danger' : 'warning',
        icon: <Zap className="size-3.5" aria-hidden />,
      }
    }
    case 'spend_action_points': {
      const blocked = out.blocked === true
      const spent = asNumber(out.spent) ?? 0
      const newPa = asNumber(out.newPa) ?? 0
      const message = asString(out.message)
      return {
        title: blocked ? 'Ação bloqueada · sem PA' : 'Ação · PA gasto',
        detail:
          message ||
          (blocked
            ? 'PA insuficiente: a ação não acontece neste turno.'
            : `−${spent} PA · PA restante ${newPa}`),
        tone: blocked ? 'danger' : 'neutral',
        icon: <Footprints className="size-3.5" aria-hidden />,
      }
    }
    case 'calculate_enemy_damage': {
      const damage = asNumber(out.damage) ?? 0
      const note = asString(out.note)
      return {
        title: 'Dano em segmentos',
        detail: `${damage} segmento(s)${note ? ` · ${note}` : ''}`,
        tone: damage > 0 ? 'positive' : 'danger',
        icon: <Swords className="size-3.5" aria-hidden />,
      }
    }
    case 'spend_mana': {
      const message = asString(out.message)
      const overloaded = out.overloaded === true
      return {
        title: overloaded ? 'Gasto de PM · Sobrecarga' : 'Gasto de PM',
        detail: message || 'Mana e Limiar atualizados.',
        tone: overloaded ? 'danger' : 'neutral',
        icon: <Droplet className="size-3.5" aria-hidden />,
      }
    }
    case 'roll_macula_save': {
      const failed = out.failed === true
      const successes = asNumber(out.successes) ?? 0
      const complexity = asNumber(inp.complexity) ?? 0
      const failureMargin = asNumber(out.failureMargin) ?? 0
      const maculaType = asString(out.maculaType) || asString(inp.maculaType) || 'arcana'
      const summary = asString(out.effectSummary)
      return {
        title: failed ? 'Mácula ativada' : 'SAVE contra Mácula',
        detail: `${successes} sucesso(s) vs DIF ${complexity} · ${failed ? `falhou por ${failureMargin}` : 'passou'} · ${maculaType}${summary ? ` — ${summary}` : ''}`,
        tone: failed ? 'danger' : 'positive',
        icon: failed ? (
          <ShieldAlert className="size-3.5" aria-hidden />
        ) : (
          <Sparkles className="size-3.5" aria-hidden />
        ),
      }
    }
    case 'advance_threat_clock': {
      const name = asString(out.name) || asString(inp.clockName) || 'Ameaça'
      const previous = asNumber(out.previous) ?? 0
      const current = asNumber(out.current) ?? 0
      const max = asNumber(out.max) ?? 0
      const completed = out.completed === true
      return {
        title: completed ? 'Relógio completo' : 'Relógio de Ameaça',
        detail: `${name}: ${previous} → ${current}/${max}`,
        tone: completed ? 'warning' : 'neutral',
        icon: <Clock3 className="size-3.5" aria-hidden />,
      }
    }
    case 'end_turn': {
      const applied = out.applied !== false
      const turn = asNumber(out.turn)
      return {
        title: applied ? 'Turno encerrado' : 'Turno já encerrado',
        detail:
          asString(out.message) ||
          (turn !== null ? `Turno ${turn} começou.` : 'Transição de turno aplicada.'),
        tone: applied ? 'neutral' : 'warning',
        icon: <RefreshCw className="size-3.5" aria-hidden />,
      }
    }
    case 'enter_suppression': {
      const applied = out.applied !== false
      return {
        title: applied ? 'Supressão ativa' : 'Supressão',
        detail:
          asString(out.message) ||
          (applied
            ? 'Limiar resfriado e mana cortada até o próximo turno.'
            : 'A Supressão não foi reaplicada.'),
        tone: applied ? 'warning' : 'neutral',
        icon: <Snowflake className="size-3.5" aria-hidden />,
      }
    }
    default:
      return {
        title: toolName.replaceAll('_', ' '),
        detail: safeJson(output),
        tone: 'neutral',
        icon: <Dices className="size-3.5" aria-hidden />,
      }
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asNumberList(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is number => typeof entry === 'number')
}

function safeJson(value: unknown): string {
  try {
    const text = JSON.stringify(value)
    return text.length > 220 ? `${text.slice(0, 217)}…` : text
  } catch {
    return 'resultado indisponível'
  }
}

function readError(payload: unknown): string | null {
  const record = asRecord(payload)
  return typeof record.error === 'string' && record.error.trim() ? record.error : null
}

function welcomeMessage(sheet: ArenaSheetSummary): string {
  const firstName = sheet.name.trim().split(/\s+/)[0] || 'viajante'
  const classLabel = sheet.className ? `um ${sheet.className}` : 'um viajante'
  const runeNames = sheet.runes.slice(0, 3).map((rune) => rune.name)

  const lines = [
    `A taverna cheira a chuva e ferro quente. Quando ${firstName} empurra a porta, o burburinho diminui — todos sabem o que você é.`,
    `O Mestre reconhece ${classLabel}${
      runeNames.length > 0 ? `, com ${runeNames.join(', ')} à mão` : ''
    }. "O que você faz agora?"`,
    'Descreva uma ação, uma fala ou uma magia. Dados e consequências serão rolados de verdade.',
  ]

  return lines.join('\n\n')
}
