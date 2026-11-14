import { useEffect, useState, type ReactNode } from 'react'
import { Card } from '@/components/ui'
import { classTone } from '@/rules/classColors'
import { withAlpha } from '@/rules/lineageColors'
import rawSheets from './sheets.json'

/**
 * Fichas já jogadas da campanha, vindas da pasta `Fichas` do material.
 *
 * Elas são somente leitura: servem de referência e exemplo. As fichas 8, 9 e
 * 10 do material são templates vazios e ficam de fora da extração
 * (`scripts/extract-sheets.mjs`).
 */

interface ReferenceSheet {
  id: string
  name: string
  concept: string
  className: string
  ancestry: string
  markdown: string
}

const sheets = rawSheets as ReferenceSheet[]

/** Primeira palavra da classe ("Guerreiro Espadachim" → guerreiro). */
function classIdOf(className: string): string {
  return className
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/\s+/)[0] ?? ''
}

export function ReferenceSheets() {
  const [openId, setOpenId] = useState<string | null>(null)
  const open = sheets.find((sheet) => sheet.id === openId) ?? null

  useEffect(() => {
    if (!openId) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [openId])

  return (
    <section aria-labelledby="fichas-campanha">
      <div className="mb-4">
        <h2 id="fichas-campanha" className="font-display text-xl tracking-wide">
          Fichas da campanha
        </h2>
        <p className="mt-1 text-xs text-ink-soft">
          {sheets.length} personagens já jogados, importados da pasta Fichas do material.
          Somente leitura.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sheets.map((sheet) => {
          const tone = classTone(classIdOf(sheet.className))
          return (
            <li key={sheet.id}>
              <button
                type="button"
                onClick={() => setOpenId(sheet.id)}
                className="block h-full w-full rounded-xl border bg-white/45 p-4 text-left transition hover:bg-white/70"
                style={{ borderColor: tone ? withAlpha(tone, 0.35) : undefined }}
              >
                <p className="font-display text-lg leading-tight">{sheet.name}</p>
                <p className="mt-0.5 text-sm text-ink-soft">{sheet.concept || 'Sem conceito'}</p>
                <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-semibold uppercase tracking-wide">
                  {sheet.className ? (
                    <span
                      className="rounded-full border px-2 py-0.5"
                      style={
                        tone
                          ? {
                              borderColor: withAlpha(tone, 0.45),
                              backgroundColor: withAlpha(tone, 0.1),
                              color: tone,
                            }
                          : undefined
                      }
                    >
                      {sheet.className}
                    </span>
                  ) : null}
                  {sheet.ancestry ? (
                    <span className="rounded-full border border-ink/15 px-2 py-0.5 text-ink-soft">
                      {sheet.ancestry}
                    </span>
                  ) : null}
                </div>
              </button>
            </li>
          )
        })}
      </ul>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-sm sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={`Ficha de ${open.name}`}
          onClick={() => setOpenId(null)}
        >
          <div
            className="my-4 w-full max-w-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <Card
              className="bg-parchment shadow-xl"
              style={{ backgroundColor: '#f3ece0' }}
            >
              <div className="mb-4 flex items-start justify-between gap-4 border-b border-ink/10 pb-3">
                <div>
                  <h2 className="font-display text-2xl leading-tight">{open.name}</h2>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
                    {open.className ? <span>{open.className}</span> : null}
                    {open.className && open.ancestry ? <span aria-hidden>·</span> : null}
                    {open.ancestry ? <span>{open.ancestry}</span> : null}
                    {open.concept ? <span aria-hidden>·</span> : null}
                    {open.concept ? <span>{open.concept}</span> : null}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenId(null)}
                  className="rounded-md border border-ink/20 px-2.5 py-1 text-xs text-ink-soft transition hover:text-ink"
                >
                  fechar
                </button>
              </div>
              <SheetMarkdown markdown={open.markdown} />
            </Card>
          </div>
        </div>
      ) : null}
    </section>
  )
}

/** Renderizador mínimo do Markdown do Notion (títulos, listas, negrito). */
function SheetMarkdown({ markdown }: { markdown: string }) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let items: ReactNode[] = []
  let itemLines: string[] | null = null
  let skippedTitle = false
  let key = 0

  function closeItem() {
    if (!itemLines) return
    const [first, ...rest] = itemLines
    items.push(
      <li key={`li-${key++}`} className="pl-1">
        <Inline text={first ?? ''} />
        {rest.map((line, index) => (
          <span key={index} className="mt-1 block text-sm leading-relaxed text-ink-soft">
            <Inline text={line} />
          </span>
        ))}
      </li>,
    )
    itemLines = null
  }

  function closeList() {
    closeItem()
    if (items.length === 0) return
    blocks.push(
      <ul key={`ul-${key++}`} className="my-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
        {items}
      </ul>,
    )
    items = []
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '')

    if (line.trim() === '') {
      closeItem()
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      closeList()
      const text = heading[2] ?? ''
      // O primeiro título repete o nome que já está no cabeçalho do modal.
      if (!skippedTitle && heading[1] === '#') {
        skippedTitle = true
        continue
      }
      const level = heading[1]?.length ?? 3
      const className =
        level <= 2
          ? 'mt-5 mb-2 border-b border-ink/10 pb-1 font-display text-lg tracking-wide'
          : 'mt-4 mb-1.5 font-display text-base tracking-wide'
      blocks.push(
        <p key={`h-${key++}`} className={className}>
          <Inline text={text} />
        </p>,
      )
      continue
    }

    if (/^-{3,}$/.test(line.trim())) {
      closeList()
      blocks.push(<hr key={`hr-${key++}`} className="my-4 border-ink/15" />)
      continue
    }

    const listItem = line.match(/^\s*[-*]\s+(.*)$/)
    if (listItem) {
      closeItem()
      const content = listItem[1] ?? ''
      const checkbox = content.match(/^\[([ xX])\]\s*(.*)$/)
      itemLines = checkbox
        ? [`${checkbox[1]?.toLowerCase() === 'x' ? '☑' : '☐'} ${checkbox[2] ?? ''}`]
        : [content]
      continue
    }

    // Linhas indentadas continuam o item de lista anterior.
    if (/^\s{2,}\S/.test(line) && itemLines) {
      itemLines.push(line.trim())
      continue
    }

    closeList()
    blocks.push(
      <p key={`p-${key++}`} className="my-2 text-sm leading-relaxed text-ink-soft">
        <Inline text={line} />
      </p>,
    )
  }

  closeList()
  return <div>{blocks}</div>
}

/** Negrito e itálico simples. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean)
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index}>{part.slice(2, -2)}</strong>
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={index}>{part.slice(1, -1)}</em>
        }
        return <span key={index}>{part}</span>
      })}
    </>
  )
}
