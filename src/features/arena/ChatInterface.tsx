import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Bot, Send, Sparkles, User } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { Character } from '@/rules/character'
import { classes } from '@/rules/data'
import { runeName } from '@/rules/runes'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  'Descreva o lugar onde estou.',
  'Quero atacar a criatura à minha frente.',
  'O que minhas runas podem fazer aqui?',
]

/**
 * Chat da Arena. Ainda não há backend de IA: o "Mestre" responde com textos
 * locais de demonstração, mas o fluxo (mensagens, envio, indicador de digitação
 * e rolagem automática) já é o definitivo.
 */
export function ChatInterface({
  character,
  demo,
}: {
  character: Character
  demo: boolean
}) {
  const firstName = character.name.trim().split(/\s+/)[0] || 'viajante'
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { role: 'assistant', content: welcomeMessage(character) },
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const timer = useRef<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages, typing])

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [])

  function send(raw: string) {
    const text = raw.trim()
    if (!text || typing) return

    setMessages((current) => [...current, { role: 'user', content: text }])
    setInput('')
    setTyping(true)

    // Pequena espera para o indicador "Mestre está digitando..." ser visível.
    const delay = 900 + Math.min(900, text.length * 12)
    timer.current = window.setTimeout(() => {
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: masterReply(text, character) },
      ])
      setTyping(false)
      timer.current = null
    }, delay)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    send(input)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      send(input)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/45 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800/80 bg-slate-950/60 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative grid size-9 shrink-0 place-items-center rounded-full border border-slate-700/80 bg-slate-900">
            <Sparkles className="size-4 text-[#F1269C]" aria-hidden />
            <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-slate-950 bg-emerald-400" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-100">Mestre de Amnia</p>
            <p className="truncate text-[11px] text-slate-500">
              {typing ? 'está tecendo a próxima cena…' : 'narrando a cena'}
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-slate-700/70 bg-slate-900/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          {demo ? 'Demo local' : 'Sessão local'}
        </span>
      </header>

      <div
        ref={scrollRef}
        className="arena-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-4"
      >
        {messages.map((message, index) => (
          <MessageBubble key={`${index}-${message.role}`} message={message} />
        ))}

        {messages.length === 1 && !typing ? (
          <div className="flex flex-wrap gap-2 pl-10 sm:pl-11">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => send(suggestion)}
                className="rounded-full border border-slate-700/70 bg-slate-900/60 px-3 py-1.5 text-left text-[11px] text-slate-300 transition hover:border-[#0055FE]/60 hover:bg-slate-800/80 hover:text-slate-100"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}

        {typing ? (
          <div className="flex items-start gap-2.5" role="status" aria-live="polite">
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-slate-700/70 bg-slate-900 text-slate-400">
              <Bot className="size-3.5" aria-hidden />
            </span>
            <div className="rounded-2xl rounded-tl-sm border border-slate-700/60 bg-slate-800/60 px-3.5 py-2.5">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                Mestre está digitando…
                <span className="inline-flex gap-0.5" aria-hidden>
                  <span className="size-1 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                  <span className="size-1 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                  <span className="size-1 animate-bounce rounded-full bg-slate-400" />
                </span>
              </p>
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
            disabled={!input.trim() || typing}
            className={cn(
              'inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition',
              'bg-gradient-to-r from-[#0055FE] to-[#F1269C] shadow-[0_8px_24px_rgba(0,85,254,0.25)]',
              'hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F1269C]/70',
              'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100',
            )}
          >
            <Send className="size-4" aria-hidden />
            Enviar
          </button>
        </form>
        <p className="mt-2 text-center text-[10px] text-slate-600">
          Enter envia · Shift + Enter quebra linha · sem IA conectada nesta demonstração
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
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
          isUser
            ? 'rounded-tr-sm bg-[#0055FE] text-white shadow-[0_8px_24px_rgba(0,85,254,0.18)]'
            : 'rounded-tl-sm border border-slate-700/60 bg-slate-800/65 text-slate-100',
        )}
      >
        {message.content}
      </div>
    </div>
  )
}

function welcomeMessage(character: Character): string {
  const firstName = character.name.trim().split(/\s+/)[0] || 'viajante'
  const classDef = classes.find((item) => item.id === character.classId)

  return [
    `A taverna cheira a chuva e ferro quente. Quando ${firstName} empurra a porta, o burburinho diminui — todos sabem o que você é.`,
    classDef
      ? `O Mestre apoia os cotovelos na mesa: "Então é você o ${classDef.name}. O que faz agora?"`
      : 'O Mestre apoia os cotovelos na mesa: "O que você faz agora?"',
    'Descreva uma ação, uma fala ou uma magia. Eu conduzo o resto.',
  ].join('\n\n')
}

/**
 * Respostas fictícias, porém coerentes com a ficha: citam classe, runas e
 * magias do personagem para o painel parecer vivo durante a revisão de design.
 */
function masterReply(input: string, character: Character): string {
  const text = input.toLowerCase()
  const firstName = character.name.trim().split(/\s+/)[0] || 'viajante'
  const classDef = classes.find((item) => item.id === character.classId)
  const runes = character.knownRunes.slice(0, 3).map(runeName)
  const spell = character.spells[0]

  if (/(magia|runa|conjur|feit|arcan|mana)/.test(text)) {
    const parts = [
      `O ar fica denso quando ${firstName} alcança o Limiar.`,
      runes.length > 0
        ? `Suas runas respondem: ${runes.join(', ')}.`
        : 'Você ainda não tem runas preparadas para este gesto.',
      spell
        ? `A magia "${spell.name}" pulsa na memória, pronta para ser moldada.`
        : 'Sem uma magia preparada, o efeito vai exigir mais esforço.',
      'Diga o que quer atingir e eu descrevo o custo e a consequência.',
    ]
    return parts.join(' ')
  }

  if (/(atac|golpe|luta|espada|lâmina|lamina|combate|inimig|criatura)/.test(text)) {
    return [
      'A criatura se move antes do seu próximo fôlego — uma sombra baixa, rápida demais para ser humana.',
      classDef
        ? `Sua formação de ${classDef.name} cobra uma decisão: posicionamento ou impacto.`
        : 'O Mestre espera a sua decisão.',
      'Role o teste de ataque e descreva onde quer acertar. Se preferir, use uma runa para mudar o terreno antes.',
    ].join(' ')
  }

  if (/(onde|olho|olhar|cena|cenário|cenario|ambiente|lugar|taverna)/.test(text)) {
    return [
      'O Mestre desenha o cenário com poucas palavras: vigas escuras, janelas embaçadas e um mapa rasgado sobre o balcão.',
      'Três figuras encapuzadas ocupam a mesa do canto. Uma delas tem tinta arcana nos dedos — e está olhando diretamente para você.',
      'Há uma saída pelos fundos, uma escada para o andar de cima e a porta principal, agora bloqueada pela chuva.',
    ].join('\n\n')
  }

  if (/(quem|nome|fala|convers|pergunt|npc)/.test(text)) {
    return [
      'A mulher de tinta nos dedos se inclina para frente. "Você carrega o cheiro de uma torre queimada", diz ela, sem levantar a voz.',
      `"Se procura a origem da Mácula, ${firstName}, chegou tarde — ou exatamente na hora certa."`,
      'O Mestre espera sua resposta. Um teste social pode abrir o que a espada não abre.',
    ].join('\n\n')
  }

  return [
    `O Mestre considera a ação de ${firstName} por um instante.`,
    'O gesto funciona, mas o mundo responde: uma porta se fecha atrás de você e alguma coisa grande se mexe no andar de cima.',
    'O que você faz em seguida?',
  ].join('\n\n')
}
