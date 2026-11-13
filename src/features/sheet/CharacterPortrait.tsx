import { useRef, useState } from 'react'
import { fileToPortrait } from '@/lib/image'

/**
 * Foto do personagem no topo da ficha, à direita do nome.
 * A imagem é redimensionada e guardada na própria ficha (IndexedDB).
 */
export function CharacterPortrait({
  name,
  portrait,
  onSelect,
}: {
  name: string
  portrait: string
  onSelect: (dataUrl: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const dataUrl = await fileToPortrait(file)
      onSelect(dataUrl)
    } catch {
      setError('Não foi possível usar essa imagem.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-32 shrink-0 sm:w-40">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void handleFile(event.target.files?.[0])
          event.target.value = ''
        }}
      />

      {portrait ? (
        <div className="group relative overflow-hidden rounded-lg border border-ink/15 bg-white/50">
          <img
            src={portrait}
            alt={`Retrato de ${name || 'personagem'}`}
            className="aspect-[3/4] w-full object-cover"
          />
          <div className="no-print absolute inset-x-0 bottom-0 flex justify-center gap-3 bg-ink/60 px-2 py-1.5 text-[11px] text-parchment opacity-0 transition group-hover:opacity-100">
            <button type="button" onClick={() => inputRef.current?.click()}>
              trocar
            </button>
            <button type="button" onClick={() => onSelect('')}>
              remover
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="no-print flex aspect-[3/4] w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-ink/25 bg-white/30 px-2 text-center text-xs text-ink-soft transition hover:border-ink/40 hover:text-ink disabled:opacity-50"
        >
          <span aria-hidden className="text-xl leading-none">
            +
          </span>
          {busy ? 'Carregando…' : 'Adicionar foto'}
        </button>
      )}

      {error ? <p className="mt-1 text-[11px] text-accent">{error}</p> : null}
    </div>
  )
}
