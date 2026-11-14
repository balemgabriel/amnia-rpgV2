import { useEffect, useState } from 'react'
import { StarIcon } from '@/components/StarIcon'
import { Badge, Button, Card } from '@/components/ui'
import { attributes } from '@/rules/amnia'
import { characterSchema, type Character } from '@/rules/character'
import { computeDerived } from '@/rules/derive'
import { deleteCharacter, listCharacters } from '@/storage/characters'
import type { CharacterRecord } from '@/storage/db'
import { ReferenceSheets } from '@/features/reference/ReferenceSheets'

export function CharacterList({
  onNew,
  onOpen,
}: {
  onNew: () => void
  onOpen: (id: string) => void
}) {
  const [records, setRecords] = useState<CharacterRecord[]>([])
  const [loading, setLoading] = useState(true)

  async function refresh() {
    const rows = await listCharacters()
    setRecords(rows)
    setLoading(false)
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Excluir a ficha "${name}"? Essa ação não pode ser desfeita.`)) return
    await deleteCharacter(id)
    await refresh()
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-5">
          <div>
            <h1 className="font-display text-2xl leading-none tracking-tight">
              Amnia <span className="text-ink-soft">v2</span>
            </h1>
            <p className="mt-1.5 text-[11px] uppercase tracking-[0.18em] text-ink-soft">
              Fichas de personagem
            </p>
          </div>
          <Button onClick={onNew}>Nova ficha</Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <ReferenceSheets />

        <section className="mt-12" aria-labelledby="suas-fichas">
          <div className="mb-4">
            <h2 id="suas-fichas" className="font-display text-xl tracking-wide">
              Suas fichas
            </h2>
            <p className="mt-1 text-xs text-ink-soft">
              Salvas neste dispositivo. Nada é enviado para servidor.
            </p>
          </div>

          {loading ? (
            <p className="text-sm text-ink-soft">Carregando…</p>
          ) : records.length === 0 ? (
            <Card className="border-dashed px-6 py-16 text-center">
              <p className="font-display text-xl">Nenhuma ficha ainda</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
                Crie o seu primeiro personagem. Tudo é salvo no seu dispositivo, sem login.
              </p>
              <div className="mt-5 flex justify-center">
                <Button onClick={onNew}>Começar a criação</Button>
              </div>
            </Card>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {records.map((record) => {
                const character = parseCharacter(record)
                return (
                  <li key={record.id}>
                    <div className="group relative rounded-xl border border-ink/10 bg-white/45 p-4 transition hover:border-ink/25">
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
                        <p className="mt-3 text-xs text-ink-soft">
                          Atualizada em {new Date(record.updatedAt).toLocaleDateString('pt-BR')}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(record.id, record.name)}
                        className="absolute right-3 top-3 text-xs text-ink-soft opacity-0 transition hover:text-accent group-hover:opacity-100"
                        aria-label={`Excluir ${record.name}`}
                      >
                        excluir
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}

function parseCharacter(record: CharacterRecord): Character | null {
  const parsed = characterSchema.safeParse(record.data)
  return parsed.success ? parsed.data : null
}
