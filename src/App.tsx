import { useState } from 'react'
import { CharacterList } from '@/features/characters/CharacterList'
import { CreateWizard } from '@/features/create/CreateWizard'
import { ReadySheetsPage } from '@/features/reference/ReadySheetsPage'
import { SheetView } from '@/features/sheet/SheetView'
import { SpellCreator } from '@/features/spells/SpellCreator'
import { SpellWorkshop } from '@/features/spells/SpellWorkshop'
import { characterSchema } from '@/rules/character'
import { getCharacter } from '@/storage/characters'
import { useDraft } from '@/store/draft'

type View =
  | { name: 'list' }
  | { name: 'create'; from?: 'ready' | 'home' }
  | { name: 'ready' }
  | { name: 'workshop' }
  | { name: 'workshopSpell'; spellId?: string }
  | { name: 'sheet'; id: string; from?: 'ready' }
  | { name: 'spell'; id: string; spellId?: string; from?: 'ready' }

export default function App() {
  const [view, setView] = useState<View>({ name: 'list' })
  const reset = useDraft((state) => state.reset)

  /**
   * Abre uma ficha salva no assistente para alteração.
   *
   * A ficha é carregada e validada antes de entrar no rascunho: o assistente
   * trabalha com os mesmos dados salvos e, ao salvar, atualiza o mesmo registro
   * (o `referenceId` é preservado pelo storage quando for uma ficha pronta).
   *
   * `from` define o caminho de volta: a página de fichas prontas ou a lista de
   * fichas do jogador na página inicial.
   */
  async function editCharacter(id: string, from: 'ready' | 'home') {
    const record = await getCharacter(id)
    if (!record) return
    const parsed = characterSchema.safeParse(record.data)
    if (!parsed.success) return
    reset(parsed.data)
    setView({ name: 'create', from })
  }

  if (view.name === 'create') {
    const fromReady = view.from === 'ready'
    const editing = view.from !== undefined
    return (
      <CreateWizard
        editing={editing}
        backLabel={fromReady ? '← Fichas Prontas' : '← Fichas'}
        onExit={() => setView(fromReady ? { name: 'ready' } : { name: 'list' })}
        onSaved={(id) => setView(fromReady ? { name: 'ready' } : { name: 'sheet', id })}
      />
    )
  }

  if (view.name === 'ready') {
    return (
      <ReadySheetsPage
        onBack={() => setView({ name: 'list' })}
        onOpen={(id) => setView({ name: 'sheet', id, from: 'ready' })}
        onEdit={(id) => void editCharacter(id, 'ready')}
      />
    )
  }

  if (view.name === 'workshop') {
    return (
      <SpellWorkshop
        onBack={() => setView({ name: 'list' })}
        onNew={() => setView({ name: 'workshopSpell' })}
        onEdit={(spellId) => setView({ name: 'workshopSpell', spellId })}
      />
    )
  }

  if (view.name === 'workshopSpell') {
    return (
      <SpellCreator
        spellId={view.spellId}
        onDone={() => setView({ name: 'workshop' })}
      />
    )
  }

  if (view.name === 'spell') {
    return (
      <SpellCreator
        characterId={view.id}
        spellId={view.spellId}
        onDone={() => setView({ name: 'sheet', id: view.id, from: view.from })}
      />
    )
  }

  if (view.name === 'sheet') {
    const fromReady = view.from === 'ready'
    return (
      <SheetView
        id={view.id}
        onBack={() => setView(fromReady ? { name: 'ready' } : { name: 'list' })}
        backLabel={fromReady ? '← Fichas Prontas' : undefined}
        onOpenSpell={(spellId) =>
          setView({ name: 'spell', id: view.id, spellId, from: view.from })
        }
      />
    )
  }

  return (
    <CharacterList
      onNew={() => {
        reset()
        setView({ name: 'create' })
      }}
      onReady={() => setView({ name: 'ready' })}
      onWorkshop={() => setView({ name: 'workshop' })}
      onOpen={(id) => setView({ name: 'sheet', id })}
      onEdit={(id) => void editCharacter(id, 'home')}
    />
  )
}
