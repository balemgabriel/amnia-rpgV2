import { spellSchema, type Spell } from '@/rules/spell'
import { db, type LibrarySpellRecord } from './db'

/**
 * Biblioteca da Oficina de Magias.
 *
 * As magias ficam soltas do personagem: o jogador cria e guarda aqui e só
 * depois escolhe em qual ficha usá-las. Ao adicionar, a ficha recebe uma
 * CÓPIA com id novo — a magia original continua na oficina.
 */

/** Magias guardadas, mais recentes primeiro. */
export function listLibrarySpells(): Promise<LibrarySpellRecord[]> {
  return db.spells.orderBy('updatedAt').reverse().toArray()
}

export function getLibrarySpell(id: string): Promise<LibrarySpellRecord | undefined> {
  return db.spells.get(id)
}

export async function saveLibrarySpell(spell: Spell): Promise<string> {
  const existing = await db.spells.get(spell.id)
  const record: LibrarySpellRecord = {
    id: spell.id,
    name: spell.name.trim() || 'Magia sem nome',
    data: spell,
    createdAt: existing?.createdAt ?? spell.createdAt,
    updatedAt: spell.updatedAt,
  }
  await db.spells.put(record)
  return record.id
}

export async function deleteLibrarySpell(id: string): Promise<void> {
  await db.spells.delete(id)
}

export function parseLibrarySpell(record: LibrarySpellRecord): Spell | null {
  const parsed = spellSchema.safeParse(record.data)
  return parsed.success ? parsed.data : null
}
