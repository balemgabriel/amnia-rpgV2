import { Button } from '@/components/ui'
import { ReferenceSheets } from './ReferenceSheets'

/**
 * Página "Fichas Prontas": as fichas já jogadas da campanha, em somente
 * leitura. Sai da página inicial para não misturar com as fichas do jogador.
 */
export function ReadySheetsPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-ink/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-6 py-4">
          <Button variant="quiet" onClick={onBack} className="px-2">
            ← Início
          </Button>
          <div className="text-center">
            <h1 className="font-display text-2xl leading-tight tracking-tight">Fichas Prontas</h1>
            <p className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-ink-soft">
              Personagens da campanha
            </p>
          </div>
          <span className="w-[72px]" aria-hidden />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <ReferenceSheets />
      </main>
    </div>
  )
}
