import { db, type CharacterRecord } from './db'

export function newId(): string {
  return crypto.randomUUID()
}

/** Fichas mais recentes primeiro. */
export function listCharacters(): Promise<CharacterRecord[]> {
  return db.characters.orderBy('updatedAt').reverse().toArray()
}

export function getCharacter(id: string): Promise<CharacterRecord | undefined> {
  return db.characters.get(id)
}

export interface SaveCharacterInput {
  id?: string
  name: string
  rulesVersion: string
  sheetVersion: number
  data: unknown
}

export async function saveCharacter(input: SaveCharacterInput): Promise<string> {
  const now = Date.now()
  const id = input.id ?? newId()
  const existing = input.id ? await db.characters.get(input.id) : undefined

  const record: CharacterRecord = {
    id,
    name: input.name,
    rulesVersion: input.rulesVersion,
    sheetVersion: input.sheetVersion,
    data: input.data,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  await db.characters.put(record)
  return id
}

export function deleteCharacter(id: string): Promise<void> {
  return db.characters.delete(id)
}
