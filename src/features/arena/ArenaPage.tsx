import { useEffect, useState } from 'react'
import { ArrowLeft, Dices, Swords } from 'lucide-react'
import {
  publishCurrentCharacter,
  readCurrentCharacter,
  type CurrentCharacter,
} from '@/storage/currentCharacter'
import { ChatInterface } from './ChatInterface'
import { CharacterSheetPanel } from './CharacterSheetPanel'
import { createMockArenaCharacter } from './mockCharacter'

/**
 * Arena de Amnia: chat do Mestre (esquerda) + ficha ativa (direita).
 *
 * A ficha vem de `localStorage['amnia_ficha_atual']`, publicado pela ficha
 * completa ao ser aberta/salva. Sem ficha, semeamos uma demonstração para o
 * design ficar visível e mantemos o botão de voltar ao criador.
 */
export function ArenaPage({ onBack }: { onBack: () => void }) {
  const [loaded, setLoaded] = useState<CurrentCharacter | null>(null)

  useEffect(() => {
    const current = readCurrentCharacter()
    if (current) {
      setLoaded(current)
      return
    }

    const mock = createMockArenaCharacter()
    publishCurrentCharacter(mock, { demo: true })
    setLoaded({ character: mock, demo: true })
  }, [])

  // O título da aba acompanha a página; a ficha completa restaura o original.
  useEffect(() => {
    const previous = document.title
    document.title = 'Arena de Amnia — Amnia v2'
    return () => {
      document.title = previous
    }
  }, [])

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
              {loaded ? (loaded.demo ? 'Modo demonstração' : 'Ficha conectada') : 'Carregando ficha'}
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

      <main className="relative z-10 mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-3 px-3 py-3 sm:px-4 lg:grid lg:min-h-0 lg:grid-cols-[3fr_2fr] lg:gap-5 lg:px-6 lg:py-5">
        <section
          aria-label="Chat com o Mestre"
          className="flex min-h-[68dvh] flex-col lg:min-h-0"
        >
          {loaded ? (
            <ChatInterface character={loaded.character} demo={loaded.demo} />
          ) : (
            <PanelSkeleton lines={5} />
          )}
        </section>

        <aside
          aria-label="Ficha do personagem"
          className="arena-scroll flex flex-col lg:min-h-0 lg:overflow-y-auto"
        >
          {loaded ? (
            <CharacterSheetPanel
              character={loaded.character}
              demo={loaded.demo}
              onBackToCreator={onBack}
            />
          ) : (
            <PanelSkeleton lines={8} />
          )}

          <p className="mt-3 flex items-center justify-center gap-1.5 px-2 text-center text-[10px] text-slate-600">
            <Dices className="size-3" aria-hidden />
            Dados, magias e Limiar são calculados pela ficha salva neste dispositivo.
          </p>
        </aside>
      </main>
    </div>
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
