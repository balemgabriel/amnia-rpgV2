import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Dices, ScrollText, Sparkles, Swords } from 'lucide-react'
import { cn } from '@/lib/cn'
import { createGameState } from '@/lib/amnia/rules'
import type {
  ArenaGameState,
  ArenaTableActionRequest,
  ArenaTableActionType,
} from '@/lib/amnia/types'
import {
  publishCurrentCharacter,
  readCurrentCharacter,
  type CurrentCharacter,
} from '@/storage/currentCharacter'
import { ChatInterface } from './ChatInterface'
import { CharacterSheetPanel } from './CharacterSheetPanel'
import { clearArenaState, readArenaState, writeArenaState } from './arenaStorage'
import { createMockArenaCharacter } from './mockCharacter'
import { buildSheetSummary } from './sheetSummary'

/**
 * Arena de Amnia: chat do Mestre (esquerda) + ficha ativa (direita).
 *
 * A ficha vem de `localStorage['amnia_ficha_atual']`, publicado pela ficha
 * completa ao ser aberta/salva. Sem ficha, mostramos um estado vazio com
 * caminho de volta ao criador (e uma ficha de exemplo opcional).
 *
 * O estado da mesa (PV/PM/Limiar/relógios) é salvo por personagem em
 * `amnia_arena_estado`; a IA recebe uma cópia e devolve o estado atualizado
 * junto da narração.
 */
export function ArenaPage({ onBack }: { onBack: () => void }) {
  /** `undefined` = carregando; `null` = nenhuma ficha publicada. */
  const [current, setCurrent] = useState<CurrentCharacter | null | undefined>(undefined)
  const [gameState, setGameState] = useState<ArenaGameState | null>(null)
  /** A ficha lateral pode ser ocultada para dar a tela toda ao chat. */
  const [sidebarOpen, setSidebarOpen] = useState(true)
  /** O chat está aguardando o Mestre; botões de mesa ficam bloqueados. */
  const [chatBusy, setChatBusy] = useState(false)
  /** Ação de mesa pedida por um botão; o chat envia e narra o resultado. */
  const [tableAction, setTableAction] = useState<ArenaTableActionRequest | null>(null)
  const tableActionSeq = useRef(0)

  useEffect(() => {
    const loaded = readCurrentCharacter()
    setCurrent(loaded)
    if (loaded) {
      const summary = buildSheetSummary(loaded.character)
      setGameState(readArenaState(loaded.character.id, summary.max))
    }
  }, [])

  // O título da aba acompanha a página; a ficha completa restaura o original.
  useEffect(() => {
    const previous = document.title
    document.title = 'Arena de Amnia — Amnia v2'
    return () => {
      document.title = previous
    }
  }, [])

  const sheet = useMemo(
    () => (current ? buildSheetSummary(current.character) : null),
    [current],
  )

  const updateGameState = useCallback(
    (next: ArenaGameState) => {
      setGameState(next)
      if (current) writeArenaState(current.character.id, next)
    },
    [current],
  )

  const resetTable = useCallback(() => {
    if (!current || !sheet) return
    clearArenaState(current.character.id)
    const next = createGameState(sheet.max)
    setGameState(next)
    writeArenaState(current.character.id, next)
  }, [current, sheet])

  /**
   * Pede uma ação de mesa ao chat. O nonce (`id`) faz o chat distinguir um
   * clique novo de um re-render, evitando disparos repetidos.
   */
  const requestTableAction = useCallback(
    (type: ArenaTableActionType) => {
      if (chatBusy) return
      tableActionSeq.current += 1
      setTableAction({ type, id: tableActionSeq.current })
    },
    [chatBusy],
  )

  function loadDemo() {
    const mock = createMockArenaCharacter()
    publishCurrentCharacter(mock, { demo: true })
    const summary = buildSheetSummary(mock)
    const next = createGameState(summary.max)
    setCurrent({ character: mock, demo: true })
    setGameState(next)
    writeArenaState(mock.id, next)
  }

  const status =
    current === undefined
      ? 'Carregando ficha'
      : current === null
        ? 'Sem ficha ativa'
        : current.demo
          ? 'Ficha de exemplo'
          : 'Ficha conectada'

  return (
    <div
      className="flex min-h-dvh flex-col bg-slate-900 text-slate-100 lg:h-dvh lg:overflow-hidden"
      style={{ colorScheme: 'dark' }}
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(0,85,254,0.14),transparent_45%),radial-gradient(ellipse_at_bottom_right,rgba(241,38,156,0.10),transparent_45%)]"
      />

      <header className="relative z-10 shrink-0 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-3 px-3 py-3 sm:px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#0055FE]/40 bg-gradient-to-br from-[#0055FE]/25 to-[#F1269C]/25 shadow-[0_0_28px_rgba(0,85,254,0.2)]">
              <Swords className="size-5 text-slate-50" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="truncate font-display text-xl leading-none tracking-wide text-slate-50">
                Arena de Amnia
              </h1>
              <p className="mt-1 truncate text-[10px] uppercase tracking-[0.18em] text-slate-500">
                Mesa do Mestre · sessão local
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-slate-700/70 bg-slate-900/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:inline-flex">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden />
              {status}
            </span>
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/70 bg-slate-900/70 px-2.5 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FE]/60"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              Fichas
            </button>
          </div>
        </div>
      </header>

      <main
        className={cn(
          'relative z-10 mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-3 px-3 py-3 sm:px-4 lg:grid lg:min-h-0 lg:gap-5 lg:px-6 lg:py-5',
          sidebarOpen ? 'lg:grid-cols-[3fr_2fr]' : 'lg:grid-cols-1',
        )}
      >
        {current === undefined ? (
          <section aria-label="Carregando Arena" className="flex min-h-[68dvh] flex-col lg:min-h-0">
            <PanelSkeleton lines={6} />
          </section>
        ) : current === null || !sheet || !gameState ? (
          <EmptyState onBack={onBack} onUseDemo={loadDemo} />
        ) : (
          <>
            <section
              aria-label="Chat com o Mestre"
              className="flex min-h-[68dvh] flex-col lg:min-h-0"
            >
              <ChatInterface
                sheet={sheet}
                gameState={gameState}
                onGameState={updateGameState}
                demo={current.demo}
                tableAction={tableAction}
                onTableAction={requestTableAction}
                onBusyChange={setChatBusy}
                sidebarOpen={sidebarOpen}
                onToggleSidebar={() => setSidebarOpen((open) => !open)}
              />
            </section>

            {sidebarOpen ? (
              <aside
                aria-label="Ficha do personagem"
                className="arena-scroll flex flex-col lg:min-h-0 lg:overflow-y-auto"
              >
                <CharacterSheetPanel
                  character={current.character}
                  state={gameState}
                  onStateChange={updateGameState}
                  onReset={resetTable}
                  onTableAction={requestTableAction}
                  busy={chatBusy}
                  demo={current.demo}
                  onBackToCreator={onBack}
                />

                <p className="mt-3 flex items-center justify-center gap-1.5 px-2 text-center text-[10px] text-slate-600">
                  <Dices className="size-3" aria-hidden />
                  A IA narra. Dados, PA, dano, PM, Limiar e Ímpeto são calculados no servidor.
                </p>
              </aside>
            ) : null}
          </>
        )}
      </main>
    </div>
  )
}

function EmptyState({
  onBack,
  onUseDemo,
}: {
  onBack: () => void
  onUseDemo: () => void
}) {
  return (
    <section
      aria-label="Nenhuma ficha ativa"
      className="flex min-h-[68dvh] flex-col items-center justify-center lg:col-span-2 lg:min-h-0"
    >
      <div className="w-full max-w-xl rounded-2xl border border-slate-800/80 bg-slate-950/50 p-6 text-center shadow-[0_24px_70px_rgba(0,0,0,0.35)] sm:p-8">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-[#0055FE]/40 bg-gradient-to-br from-[#0055FE]/20 to-[#F1269C]/20 text-slate-200">
          <ScrollText className="size-6" aria-hidden />
        </span>
        <h2 className="mt-4 font-display text-2xl tracking-wide text-slate-50">
          Nenhuma ficha ativa
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-400">
          A Arena lê a ficha salva neste dispositivo. Crie ou abra um personagem e
          salve a ficha para carregar PV, PM, Limiar, Ímpeto e suas runas aqui.
        </p>

        <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0055FE] to-[#F1269C] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(0,85,254,0.25)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F1269C]/70 sm:w-auto"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Voltar ao criador
          </button>
          <button
            type="button"
            onClick={onUseDemo}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/70 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0055FE]/60 sm:w-auto"
          >
            <Sparkles className="size-4" aria-hidden />
            Usar ficha de exemplo
          </button>
        </div>

        <p className="mt-4 text-[11px] text-slate-600">
          A ficha de exemplo é criada só no seu navegador e pode ser substituída a qualquer momento.
        </p>
      </div>
    </section>
  )
}

function PanelSkeleton({ lines }: { lines: number }) {
  return (
    <div className="flex h-full min-h-[220px] flex-col gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/45 p-4">
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="h-4 animate-pulse rounded bg-slate-800/70"
          style={{ width: `${65 + ((index * 13) % 30)}%` }}
        />
      ))}
    </div>
  )
}
