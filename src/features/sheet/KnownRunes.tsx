import { useState } from 'react'
import { Modal } from '@/components/Modal'
import { RuneCard } from '@/components/RuneCard'
import { runeCircleLabels } from '@/rules/amnia'
import { circleColor } from '@/rules/circleColors'
import type { RuneDef } from '@/rules/data'
import { withAlpha } from '@/rules/lineageColors'
import { runeById } from '@/rules/runes'

/**
 * Runas conhecidas na ficha final.
 *
 * A ficha mostra só chips compactos (nome + Esfera). Clicar abre a carta
 * completa num modal, com a escada de níveis 1–7. Assim a seção ocupa
 * poucas linhas mesmo com muitas runas.
 */
export function KnownRunes({ runeIds }: { runeIds: readonly string[] }) {
  const [openId, setOpenId] = useState<string | null>(null)

  const runes = runeIds.flatMap((id) => {
    const rune = runeById(id)
    return rune ? [rune] : []
  })
  const open: RuneDef | undefined = openId ? runeById(openId) : undefined

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {runes.map((rune) => {
          const tone = circleColor(rune.circle) ?? '#5c5044'
          return (
            <button
              key={rune.id}
              type="button"
              onClick={() => setOpenId(rune.id)}
              aria-haspopup="dialog"
              aria-label={`Ver a runa ${rune.name} por completo`}
              title={`Ver ${rune.name} por completo`}
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition hover:bg-white/60 hover:shadow-sm"
              style={{
                borderColor: withAlpha(tone, 0.45),
                backgroundColor: withAlpha(tone, 0.07),
              }}
            >
              <span
                aria-hidden
                className="size-1.5 rounded-full"
                style={{ backgroundColor: tone }}
              />
              <span className="font-medium">{rune.name}</span>
              <span className="text-[9px] uppercase tracking-wide text-ink-soft">
                {runeCircleLabels[rune.circle]}
              </span>
            </button>
          )
        })}
      </div>

      <Modal
        open={Boolean(open)}
        onClose={() => setOpenId(null)}
        label={open ? `Runa ${open.name}` : 'Runa'}
        className="max-w-xl"
      >
        {open ? (
          <div
            className="rounded-xl border border-ink/10 bg-parchment shadow-xl"
            style={{ backgroundColor: '#f3ece0' }}
          >
            <div className="flex justify-end border-b border-ink/10 px-3 py-2">
              <button
                type="button"
                onClick={() => setOpenId(null)}
                className="rounded-md border border-ink/20 px-2.5 py-1 text-xs text-ink-soft transition hover:text-ink"
              >
                fechar
              </button>
            </div>
            <div className="p-4">
              <RuneCard rune={open} />
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  )
}
