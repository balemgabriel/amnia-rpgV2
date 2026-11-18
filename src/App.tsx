import { useEffect, useRef, useState } from 'react'
import { ArenaPage } from '@/features/arena/ArenaPage'
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
  | { name: 'arena' }
  | { name: 'create'; from?: 'ready' | 'home' }
  | { name: 'ready' }
  | { name: 'workshop' }
  | { name: 'workshopSpell'; spellId?: string }
  | { name: 'sheet'; id: string; from?: 'ready' }
  | { name: 'spell'; id: string; spellId?: string; from?: 'ready' }

/** `/arena` abre direto na Arena (o dev server e o preview servem o index.html). */
function initialView(): View {
  const path = window.location.pathname.replace(/\/+$/, '')
  return path === '/arena' ? { name: 'arena' } : { name: 'list' }
}

export default function App() {
  const [view, setView] = useState<View>(initialView)
  const reset = useDraft((state) => state.reset)
  /** Tela para onde a Arena volta (ficha, início ou fichas prontas). */
  const arenaReturn = useRef<View>({ name: 'list' })

  // Botão voltar/avançar do navegador acompanha a única rota real: /arena.
  useEffect(() => {
    function onPopState() {
      setView(initialView())
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  function openArena() {
    if (view.name !== 'arena') arenaReturn.current = view
    if (window.location.pathname.replace(/\/+$/, '') !== '/arena') {
      window.history.pushState({ arena: true }, '', '/arena')
    }
    setView({ name: 'arena' })
  }

  function closeArena() {
    if (window.location.pathname.replace(/\/+$/, '') === '/arena') {
      window.history.replaceState({}, '', '/')
    }
    setView(arenaReturn.current)
  }

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

  if (view.name === 'arena') {
    return <ArenaPage onBack={closeArena} />
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
        onArena={openArena}
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
      onArena={openArena}
      onOpen={(id) => setView({ name: 'sheet', id })}
      onEdit={(id) => void editCharacter(id, 'home')}
    />
  )
}
