import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/Modal'
import { Badge, Button, Callout, Card } from '@/components/ui'
import { characterSchema, rulesVersion, SHEET_VERSION } from '@/rules/character'
import type { Spell } from '@/rules/spell'
import { workshopSpellContext } from '@/rules/spellContext'
import { listCharacters, saveCharacter } from '@/storage/characters'
import type { CharacterRecord, LibrarySpellRecord } from '@/storage/db'
import {
  deleteLibrarySpell,
  listLibrarySpells,
  parseLibrarySpell,
} from '@/storage/spellLibrary'
import { SpellCard } from './SpellCard'

/**
 * Oficina de Magias: uma biblioteca de magias independente das fichas.
 *
 * O jogador monta a magia uma vez (com todas as runas do catálogo) e depois
 * escolhe em qual personagem usá-la. Ao adicionar, a ficha recebe uma cópia
 * com id novo; a magia original continua guardada aqui.
 */
export function SpellWorkshop({
  onBack,
  onNew,
  onEdit,
}: {
  onBack: () => void
  onNew: () => void
  onEdit: (spellId: string) => void
}) {
  const [records, setRecords] = useState<LibrarySpellRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const [picker, setPicker] = useState<LibrarySpellRecord | null>(null)
  const [characters, setCharacters] = useState<CharacterRecord[]>([])
  const [charactersLoading, setCharactersLoading] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)

  const context = useMemo(() => workshopSpellContext(), [])

  async function refresh() {
    try {
      setRecords(await listLibrarySpells())
    } catch {
      setError('Não foi possível carregar a oficina.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function openPicker(record: LibrarySpellRecord) {
    setPicker(record)
    setError(null)
    setFeedback(null)
    setCharactersLoading(true)
    try {
      setCharacters(await listCharacters())
    } catch {
      setError('Não foi possível carregar as fichas.')
    } finally {
      setCharactersLoading(false)
    }
  }

  async function addToCharacter(record: LibrarySpellRecord, characterRecord: CharacterRecord) {
    const spell = parseLibrarySpell(record)
    const parsed = characterSchema.safeParse(characterRecord.data)
    if (!spell) {
      setError('Esta magia está com um formato inválido.')
      return
    }
    if (!parsed.success) {
      setError('Esta ficha está com um formato inválido.')
      return
    }

    setAddingId(characterRecord.id)
    setError(null)
    try {
      const character = parsed.data
      const now = Date.now()
      const copy: Spell = { ...spell, id: crypto.randomUUID(), createdAt: now, updatedAt: now }
      const updated = {
        ...character,
        spells: [...character.spells, copy],
        updatedAt: now,
      }
      await saveCharacter({
        id: updated.id,
        name: updated.name,
        rulesVersion,
        sheetVersion: SHEET_VERSION,
        data: updated,
      })
      setPicker(null)
      setFeedback(
        `“${copy.name.trim() || 'Magia sem nome'}” adicionada a ${
          updated.name || 'ficha'
        }. Abra a ficha para ver o custo com os modificadores do personagem.`,
      )
    } catch {
      setError('Não foi possível adicionar a magia à ficha.')
    } finally {
      setAddingId(null)
    }
  }

  async function remove(record: LibrarySpellRecord) {
    if (!window.confirm(`Excluir a magia "${record.name}" da oficina?`)) return
    await deleteLibrarySpell(record.id)
    setFeedback(null)
    await refresh()
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink/10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <Button variant="quiet" onClick={onBack} className="px-2">
            ← Início
          </Button>
          <div className="text-center">
            <h1 className="font-display text-2xl leading-tight tracking-tight">Oficina de Magias</h1>
            <p className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-ink-soft">
              Sua biblioteca de magias
            </p>
          </div>
          <Button onClick={onNew}>+ Nova magia</Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="mb-4 max-w-2xl text-sm text-ink-soft">
          Crie magias com todas as runas do catálogo e guarde aqui. Depois escolha em qual
          personagem usá-las — a ficha aplica os modificadores de Círculo Inato, atributo chave e
          canalização. Custo e Complexidade abaixo são a base da magia.
        </p>

        {feedback ? (
          <div className="mb-4 flex items-start justify-between gap-3">
            <Callout tone="ok">{feedback}</Callout>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="mt-2 shrink-0 text-xs text-ink-soft transition hover:text-ink"
            >
              fechar
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="mb-4">
            <Callout tone="warn">{error}</Callout>
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-ink-soft">Carregando…</p>
        ) : records.length === 0 ? (
          <Card className="border-dashed px-6 py-16 text-center">
            <p className="font-display text-xl">Nenhuma magia guardada</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
              Monte a primeira magia na oficina. Ela fica salva neste dispositivo e pode ser usada
              por qualquer personagem depois.
            </p>
            <div className="mt-5 flex justify-center">
              <Button onClick={onNew}>Criar primeira magia</Button>
            </div>
          </Card>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {records.map((record) => {
              const spell = parseLibrarySpell(record)
              return (
                <li key={record.id}>
                  {spell ? (
                    <SpellCard
                      spell={spell}
                      context={context}
                      onEdit={() => onEdit(record.id)}
                      onDelete={() => void remove(record)}
                      footer={
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Badge tone="neutral">Oficina</Badge>
                          <Button
                            variant="ghost"
                            className="text-xs"
                            onClick={() => void openPicker(record)}
                          >
                            Adicionar a um personagem
                          </Button>
                        </div>
                      }
                    />
                  ) : (
                    <Card className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-display text-lg">{record.name}</p>
                        <p className="text-xs text-accent">Magia com formato inválido.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void remove(record)}
                        className="text-xs text-ink-soft transition hover:text-accent"
                      >
                        excluir
                      </button>
                    </Card>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </main>

      <Modal
        open={Boolean(picker)}
        onClose={() => setPicker(null)}
        label="Adicionar magia a um personagem"
        className="max-w-xl"
      >
        <Card className="bg-parchment shadow-xl" style={{ backgroundColor: '#f3ece0' }}>
          <div className="mb-4 flex items-start justify-between gap-4 border-b border-ink/10 pb-3">
            <div>
              <h2 className="font-display text-2xl leading-tight">Adicionar a um personagem</h2>
              <p className="mt-1 text-xs text-ink-soft">
                {picker ? `“${picker.name}”` : 'Magia'} entra como uma cópia na ficha escolhida.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPicker(null)}
              className="rounded-md border border-ink/20 px-2.5 py-1 text-xs text-ink-soft transition hover:text-ink"
            >
              fechar
            </button>
          </div>

          {charactersLoading ? (
            <p className="text-sm text-ink-soft">Carregando fichas…</p>
          ) : characters.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-ink-soft">
                Você ainda não tem nenhuma ficha salva. Crie um personagem na página inicial para
                poder adicionar magias.
              </p>
              <Button variant="ghost" onClick={onBack}>
                Ir para a página inicial
              </Button>
            </div>
          ) : (
            <ul className="space-y-2">
              {characters.map((record) => {
                const parsed = characterSchema.safeParse(record.data)
                const character = parsed.success ? parsed.data : null
                return (
                  <li key={record.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (picker) void addToCharacter(picker, record)
                      }}
                      disabled={addingId !== null}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-ink/12 bg-white/45 px-3 py-2.5 text-left transition hover:border-ink/30 hover:bg-white/70 disabled:opacity-50"
                    >
                      <span className="min-w-0">
                        <span className="block font-display text-lg leading-tight">
                          {record.name || 'Sem nome'}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-ink-soft">
                          {character
                            ? [character.concept, `${character.spells.length} magia(s)`]
                                .filter(Boolean)
                                .join(' · ')
                            : 'Ficha com formato inválido'}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                        {addingId === record.id ? 'Adicionando…' : 'adicionar'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </Modal>
    </div>
  )
}
