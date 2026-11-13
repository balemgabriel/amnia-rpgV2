import { create } from 'zustand'
import { skillDistributions } from '@/rules/amnia'
import {
  createEmptyCharacter,
  rulesVersion,
  runeAllowance,
  SHEET_VERSION,
  type Advantage,
  type Character,
} from '@/rules/character'
import { toggleKnownRune } from '@/rules/runes'
import type { AttributeId } from '@/rules/types'
import { saveCharacter } from '@/storage/characters'

export const WIZARD_STEPS = [
  { id: 'conceito', title: 'Conceito' },
  { id: 'atributos', title: 'Atributos' },
  { id: 'magia', title: 'Círculo & Runas' },
  { id: 'classe', title: 'Classe & Ímpeto' },
  { id: 'pericias', title: 'Perícias' },
  { id: 'vantagens', title: 'Vantagens' },
  { id: 'derivados', title: 'Derivados' },
  { id: 'final', title: 'Finalizar' },
] as const

interface DraftState {
  character: Character
  step: number
  dirty: boolean

  reset: (character?: Character) => void
  goTo: (step: number) => void
  next: () => void
  back: () => void

  patch: (partial: Partial<Character>) => void
  setAttribute: (id: AttributeId, value: number) => void
  setKeyAttribute: (id: Character['keyAttribute']) => void
  setChannelingMethod: (id: string | null) => void

  setDistribution: (id: Character['skillDistributionId']) => void
  setSkill: (skillId: string, value: number) => void

  addSpecialization: (skillId: string, name: string) => void
  removeSpecialization: (id: string) => void

  addAdvantage: (advantage: Omit<Advantage, 'id'>) => void
  removeAdvantage: (id: string) => void
  setAdvantagePoints: (id: string, points: number) => void

  /** Alterna o ACESSO a uma runa (sem nível), respeitando o limite 3 + INT. */
  toggleKnownRune: (runeId: string) => void

  save: () => Promise<string>
}

const CHANNELING_MODIFIER_SOURCE = 'Método de Canalização'

/** Modificadores fixos concedidos por cada método de canalização (nível 1). */
function channelingModifiers(methodId: string | null) {
  if (methodId === 'gatilho') {
    return [{ statId: 'limiar', value: 2, source: `${CHANNELING_MODIFIER_SOURCE}: Gatilho` }]
  }
  return []
}

export const useDraft = create<DraftState>()((set, get) => ({
  character: createEmptyCharacter(),
  step: 0,
  dirty: false,

  reset: (character) =>
    set({ character: character ?? createEmptyCharacter(), step: 0, dirty: false }),

  goTo: (step) => set({ step: Math.max(0, Math.min(WIZARD_STEPS.length - 1, step)) }),
  next: () => set({ step: Math.min(WIZARD_STEPS.length - 1, get().step + 1) }),
  back: () => set({ step: Math.max(0, get().step - 1) }),

  patch: (partial) =>
    set((state) => ({
      character: { ...state.character, ...partial, updatedAt: Date.now() },
      dirty: true,
    })),

  setAttribute: (id, value) =>
    set((state) => ({
      character: {
        ...state.character,
        attributes: { ...state.character.attributes, [id]: value },
        updatedAt: Date.now(),
      },
      dirty: true,
    })),

  setKeyAttribute: (id) =>
    set((state) => ({ character: { ...state.character, keyAttribute: id }, dirty: true })),

  setChannelingMethod: (id) =>
    set((state) => {
      const kept = state.character.modifiers.filter(
        (modifier) => modifier.source !== `${CHANNELING_MODIFIER_SOURCE}: Gatilho`,
      )
      return {
        character: {
          ...state.character,
          channelingMethodId: id,
          modifiers: [...kept, ...channelingModifiers(id)],
        },
        dirty: true,
      }
    }),

  setDistribution: (id) =>
    set((state) => {
      const levels =
        skillDistributions.find((distribution) => distribution.id === id)?.levels ?? {}
      const resetSkills = Object.fromEntries(
        Object.keys(state.character.skills).map((skillId) => {
          const current = state.character.skills[skillId] ?? 0
          return [skillId, Math.min(current, maxLevelFor(levels))]
        }),
      )
      return {
        character: { ...state.character, skillDistributionId: id, skills: resetSkills },
        dirty: true,
      }
    }),

  setSkill: (skillId, value) =>
    set((state) => {
      const distribution = skillDistributions.find(
        (item) => item.id === state.character.skillDistributionId,
      )
      const levels = distribution?.levels ?? {}
      const current = state.character.skills[skillId] ?? 0
      if (value === current) return state

      if (value > 0) {
        const counts = countLevels(state.character.skills, skillId)
        const allowed = levels[value] ?? 0
        if ((counts[value] ?? 0) >= allowed) return state
      }

      return {
        character: {
          ...state.character,
          skills: { ...state.character.skills, [skillId]: value },
        },
        dirty: true,
      }
    }),

  addSpecialization: (skillId, name) =>
    set((state) => ({
      character: {
        ...state.character,
        specializations: [
          ...state.character.specializations,
          { id: crypto.randomUUID(), skillId, name },
        ],
      },
      dirty: true,
    })),

  removeSpecialization: (id) =>
    set((state) => ({
      character: {
        ...state.character,
        specializations: state.character.specializations.filter((item) => item.id !== id),
      },
      dirty: true,
    })),

  addAdvantage: (advantage) =>
    set((state) => ({
      character: {
        ...state.character,
        advantages: [...state.character.advantages, { ...advantage, id: crypto.randomUUID() }],
      },
      dirty: true,
    })),

  removeAdvantage: (id) =>
    set((state) => ({
      character: {
        ...state.character,
        advantages: state.character.advantages.filter((item) => item.id !== id),
      },
      dirty: true,
    })),

  setAdvantagePoints: (id, points) =>
    set((state) => ({
      character: {
        ...state.character,
        advantages: state.character.advantages.map((item) =>
          item.id === id ? { ...item, points: Math.max(1, points) } : item,
        ),
      },
      dirty: true,
    })),

  toggleKnownRune: (runeId) =>
    set((state) => {
      const allowance = runeAllowance(state.character.attributes.inteligencia)
      const next = toggleKnownRune(state.character.knownRunes, runeId, allowance)
      if (next === state.character.knownRunes) return state
      return {
        character: { ...state.character, knownRunes: next, updatedAt: Date.now() },
        dirty: true,
      }
    }),

  save: async () => {
    const { character } = get()
    const id = await saveCharacter({
      id: character.id,
      name: character.name.trim() || 'Sem nome',
      rulesVersion,
      sheetVersion: SHEET_VERSION,
      data: character,
    })
    set({ dirty: false })
    return id
  },
}))

function countLevels(skills: Record<string, number>, exceptId: string): Record<number, number> {
  const counts: Record<number, number> = {}
  for (const [skillId, value] of Object.entries(skills)) {
    if (skillId === exceptId || value <= 0) continue
    counts[value] = (counts[value] ?? 0) + 1
  }
  return counts
}

function maxLevelFor(levels: Record<number, number>): number {
  const keys = Object.keys(levels).map(Number)
  return keys.length > 0 ? Math.max(...keys) : 0
}
