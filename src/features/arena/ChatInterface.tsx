import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import {
  Bot,
  Clock3,
  Dices,
  Droplet,
  Loader2,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  Swords,
  TriangleAlert,
  User,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import type {
  ArenaChatMessage,
  ArenaChatResponse,
  ArenaGameState,
  ArenaSheetSummary,
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
}: {
  sheet: ArenaSheetSummary
  gameState: ArenaGameState
  onGameState: (state: ArenaGameState) => void
  demo: boolean
}) {
  const firstName = sheet.name.trim().split(/\s+/)[0] || 'viajante'
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { id: nextMessageId('welcome'), role: 'assistant', content: welcomeMessage(sheet) },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [model, setModel] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  /** Último histórico enviado, para o botão "Tentar novamente". */
  const lastRequest = useRef<ChatMessage[]>([])

  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages, loading, error])

  async function request(history: ChatMessage[]) {
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
        }),
        signal: controller.signal,
      })

      const payload: unknown = await response.json().catch(() => null)

      if (response.status === 404) {
        throw new Error(
          'A API do Mestre não está disponível neste endereço (HTTP 404). Use `npm run dev` ou `npm run preview`; o `vite preview` puro não monta a API.',
        )
      }

      if (!response.ok) {
        throw new Error(readError(payload) ?? `O Mestre não respondeu (HTTP ${response.status}).`)
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
    setMessages(history)
    setInput('')
    await request(history)
  }

  /** Reenvia a última mensagem sem duplicá-la no histórico. */
  function retry() {
    if (loading || lastRequest.current.length === 0) return
    void request(lastRequest.current)
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
          <MessageBubble key={message.id} message={message} />
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
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <textarea
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

function MessageBubble({ message }: { message: ChatMessage }) {
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
}: {
  toolName: string
  input: unknown
  output: unknown
}) {
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
      return {
        title: 'Teste de Amnia',
        detail: `Rolagem: ${dice.length}d6 → [${dice.join(', ')}] = ${successes} sucesso(s) | DIF ${difficulty} | MoS ${mos >= 0 ? '+' : ''}${mos}`,
        tone: mos > 0 ? 'positive' : mos === 0 ? 'warning' : 'danger',
        icon: <Dices className="size-3.5" aria-hidden />,
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
