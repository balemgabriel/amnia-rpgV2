import { useEffect, useState } from 'react'
import { ClipboardPaste, Swords } from 'lucide-react'
import { StarIcon } from '@/components/StarIcon'
import { Badge, Button, Card } from '@/components/ui'
import { cn } from '@/lib/cn'
import { attributes } from '@/rules/amnia'
import { characterSchema, type Character } from '@/rules/character'
import { computeDerived } from '@/rules/derive'
import { SheetCodeDialog } from '@/features/sheet/SheetCodeDialog'
import { deleteCharacter, listCharacters } from '@/storage/characters'
import type { CharacterRecord } from '@/storage/db'

export function CharacterList({
  onNew,
  onReady,
  onWorkshop,
  onCodex,
  onArena,
  onOpen,
  onEdit,
  onImport,
}: {
  onNew: () => void
  onReady: () => void
  onWorkshop: () => void
  onCodex: () => void
  onArena: () => void
  onOpen: (id: string) => void
  onEdit: (id: string) => void
  onImport: (character: Character) => Promise<void> | void
}) {
  const [records, setRecords] = useState<CharacterRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [importOpen, setImportOpen] = useState(false)

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
          <button
            type="button"
            onClick={onArena}
            className="inline-flex items-center gap-2 rounded-lg border border-ink/15 bg-white/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-soft transition hover:border-accent/40 hover:bg-white/70 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
            title="Abrir o chat da Arena com a última ficha aberta"
          >
            <Swords className="size-4" aria-hidden />
            Arena de Amnia
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <section aria-labelledby="comecar" className="mb-12">
          <div className="mb-4">
            <h2 id="comecar" className="font-display text-xl tracking-wide">
              Começar
            </h2>
            <p className="mt-1 text-xs text-ink-soft">Escolha por onde quer ir.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <HomeOption
              eyebrow="Passo a passo"
              title="Criar Nova Ficha"
              description="Monte um personagem do zero, com atributos, perícias, classe e magias calculados automaticamente."
              action="Começar criação"
              onClick={onNew}
              primary
            />
            <HomeOption
              eyebrow="Referência"
              title="Fichas Prontas"
              description="Veja os personagens já jogados da campanha, com a ficha completa do material."
              action="Ver fichas"
              onClick={onReady}
            />
            <HomeOption
              eyebrow="Biblioteca"
              title="Oficina de Magias"
              description="Crie magias, guarde neste dispositivo e adicione a qualquer personagem depois."
              action="Abrir oficina"
              onClick={onWorkshop}
            />
            <HomeOption
              eyebrow="Compêndio"
              title="Codex Amnia"
              description="Mundo, regras, raças, itens e magias do material original em uma wiki interativa."
              action="Abrir Codex"
              onClick={onCodex}
            />
          </div>
        </section>

        <section aria-labelledby="suas-fichas">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="suas-fichas" className="font-display text-xl tracking-wide">
                Suas fichas
              </h2>
              <p className="mt-1 text-xs text-ink-soft">
                Salvas neste dispositivo. Nada é enviado para servidor.
              </p>
            </div>
            <Button
              variant="ghost"
              onClick={() => setImportOpen(true)}
              className="text-xs"
              title="Colar um código recebido e criar uma cópia da ficha"
            >
              <ClipboardPaste className="size-4" aria-hidden />
              Importar código
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-ink-soft">Carregando…</p>
          ) : records.length === 0 ? (
            <Card className="border-dashed px-6 py-16 text-center">
              <p className="font-display text-xl">Nenhuma ficha ainda</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
                Crie o seu primeiro personagem. Tudo é salvo no seu dispositivo, sem login.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Button onClick={onNew}>Começar a criação</Button>
                <Button variant="ghost" onClick={() => setImportOpen(true)}>
                  Importar código
                </Button>
              </div>
            </Card>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {records.map((record) => {
                const character = parseCharacter(record)
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
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </main>

      <SheetCodeDialog
        mode="import"
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={onImport}
      />
    </div>
  )
}

function parseCharacter(record: CharacterRecord): Character | null {
  const parsed = characterSchema.safeParse(record.data)
  return parsed.success ? parsed.data : null
}

/**
 * Um dos caminhos da página inicial. É um cartão inteiro clicável, com
 * uma chamada de ação no rodapé para deixar claro o que acontece ao entrar.
 */
function HomeOption({
  eyebrow,
  title,
  description,
  action,
  onClick,
  primary = false,
}: {
  eyebrow: string
  title: string
  description: string
  action: string
  onClick: () => void
  primary?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex h-full w-full flex-col rounded-xl border bg-white/45 p-5 text-left transition',
        'hover:-translate-y-0.5 hover:bg-white/75 hover:shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-parchment',
        primary ? 'border-accent/35' : 'border-ink/10 hover:border-ink/25',
      )}
    >
      <span
        className={cn(
          'block text-[10px] font-semibold uppercase tracking-[0.16em]',
          primary ? 'text-accent' : 'text-ink-soft',
        )}
      >
        {eyebrow}
      </span>
      <span className="mt-2 block font-display text-xl leading-tight tracking-wide">{title}</span>
      <span className="mt-2 block flex-1 text-sm leading-relaxed text-ink-soft">{description}</span>
      <span
        className={cn(
          'mt-4 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide transition group-hover:gap-2.5',
          primary ? 'text-accent' : 'text-ink-soft group-hover:text-ink',
        )}
      >
        {action}
        <span aria-hidden>→</span>
      </span>
    </button>
  )
}
