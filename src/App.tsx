import { useState } from 'react'
import { CharacterList } from '@/features/characters/CharacterList'
import { CreateWizard } from '@/features/create/CreateWizard'
import { SheetView } from '@/features/sheet/SheetView'
import { SpellCreator } from '@/features/spells/SpellCreator'
import { useDraft } from '@/store/draft'

type View =
  | { name: 'list' }
  | { name: 'create' }
  | { name: 'sheet'; id: string }
  | { name: 'spell'; id: string; spellId?: string }

export default function App() {
  const [view, setView] = useState<View>({ name: 'list' })
  const reset = useDraft((state) => state.reset)

  if (view.name === 'create') {
    return (
      <CreateWizard
        onExit={() => setView({ name: 'list' })}
        onSaved={(id) => setView({ name: 'sheet', id })}
      />
    )
  }

  if (view.name === 'spell') {
    return (
      <SpellCreator
        characterId={view.id}
        spellId={view.spellId}
        onDone={() => setView({ name: 'sheet', id: view.id })}
      />
    )
  }

  if (view.name === 'sheet') {
    return (
      <SheetView
        id={view.id}
        onBack={() => setView({ name: 'list' })}
        onOpenSpell={(spellId) => setView({ name: 'spell', id: view.id, spellId })}
      />
    )
  }

  return (
    <CharacterList
      onNew={() => {
        reset()
        setView({ name: 'create' })
      }}
      onOpen={(id) => setView({ name: 'sheet', id })}
    />
  )
}
