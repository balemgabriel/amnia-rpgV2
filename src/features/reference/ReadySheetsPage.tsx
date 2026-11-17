import { useEffect, useState } from 'react'
import { StarIcon } from '@/components/StarIcon'
import { Badge, Button, Card } from '@/components/ui'
import { attributes } from '@/rules/amnia'
import { characterSchema, type Character } from '@/rules/character'
import { computeDerived } from '@/rules/derive'
import { listReferenceSheets } from '@/storage/characters'
import type { CharacterRecord } from '@/storage/db'
import { ensureReadySheets, resetReadySheet } from './readySheets'

/**
 * Página "Fichas Prontas": os personagens já jogados da campanha.
 *
 * Cada ficha é uma ficha real do app — semeada no dispositivo a partir do
 * material original — então pode ser aberta, alterada no mesmo assistente de
 * criação e restaurada ao padrão.
 */
export function ReadySheetsPage({
  onBack,
  onOpen,
  onEdit,
}: {
  onBack: () => void
  onOpen: (id: string) => void
  onEdit: (id: string) => void
}) {
  const [records, setRecords] = useState<CharacterRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resettingId, setResettingId] = useState<string | null>(null)

  async function refresh() {
    const rows = await listReferenceSheets()
    setRecords(rows)
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        await ensureReadySheets()
        if (!cancelled) await refresh()
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : 'Não foi possível carregar as fichas prontas.',
          )
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleReset(record: CharacterRecord) {
    if (!record.referenceId) return
    const confirmed = window.confirm(
      `Restaurar "${record.name}" ao padrão? Todas as alterações feitas nesta ficha serão perdidas.`,
    )
    if (!confirmed) return

    setResettingId(record.id)
    setError(null)
    try {
      await resetReadySheet(record.referenceId)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível restaurar a ficha.')
    } finally {
      setResettingId(null)
    }
  }

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
        <div className="mb-4">
          <p className="text-xs text-ink-soft">
            {loading
              ? 'Carregando…'
              : `${records.length} personagens já jogados. Abra para consultar, altere como qualquer ficha ou restaure ao original do material.`}
          </p>
        </div>

        {error ? (
          <p role="alert" className="mb-4 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-accent">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-ink-soft">Carregando fichas…</p>
        ) : records.length === 0 ? (
          <Card className="border-dashed px-6 py-16 text-center">
            <p className="font-display text-xl">Nenhuma ficha pronta encontrada</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
              O material da campanha não trouxe fichas jogadas para importar.
            </p>
          </Card>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {records.map((record) => {
              const character = parseCharacter(record)
              const busy = resettingId === record.id
              return (
                <li key={record.id}>
                  <div className="group relative flex h-full flex-col rounded-xl border border-ink/10 bg-white/45 p-4 transition hover:border-ink/25">
                    <button
                      type="button"
                      onClick={() => onOpen(record.id)}
                      className="block w-full text-left"
                    >
                      <p className="font-display text-xl leading-tight">{record.name}</p>
                      {character ? (
                        <>
                          <p className="mt-0.5 text-sm text-ink-soft">
                            {[character.concept, character.age ? `${character.age} anos` : '']
                              .filter(Boolean)
                              .join(' · ') || 'Sem conceito'}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {attributes.map((attribute) => (
                              <span
                                key={attribute.id}
                                className="inline-flex items-center gap-1 rounded border border-ink/12 px-1.5 py-0.5 text-[11px] tabular-nums text-ink-soft"
                              >
                                {attribute.short} {character.attributes[attribute.id]}
                                {character.keyAttribute === attribute.id ? (
                                  <StarIcon className="size-2.5 text-gold" label="Atributo Chave" />
                                ) : null}
                              </span>
                            ))}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {computeDerived(character)
                              .filter((stat) =>
                                ['pv', 'pm', 'limiar', 'impeto'].includes(stat.id),
                              )
                              .map((stat) => (
                                <Badge key={stat.id}>
                                  {stat.name.split(' ').pop()} {stat.value}
                                </Badge>
                              ))}
                            {character.spells.length > 0 ? (
                              <Badge tone="gold">
                                {character.spells.length}{' '}
                                {character.spells.length === 1 ? 'magia' : 'magias'}
                              </Badge>
                            ) : null}
                          </div>
                        </>
                      ) : (
                        <p className="mt-1 text-sm text-accent">Ficha com formato inválido.</p>
                      )}
                    </button>

                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3">
                      <Button onClick={() => onOpen(record.id)} className="px-3 py-1.5 text-xs">
                        Abrir
                      </Button>
                      <Button
                        variant="quiet"
                        onClick={() => onEdit(record.id)}
                        className="px-3 py-1.5 text-xs"
                      >
                        Alterar
                      </Button>
                      <Button
                        variant="quiet"
                        onClick={() => void handleReset(record)}
                        disabled={busy || !record.referenceId}
                        className="ml-auto px-3 py-1.5 text-xs text-ink-soft hover:text-accent"
                      >
                        {busy ? 'Restaurando…' : 'Resetar ao padrão'}
                      </Button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}

function parseCharacter(record: CharacterRecord): Character | null {
  const parsed = characterSchema.safeParse(record.data)
  return parsed.success ? parsed.data : null
}
