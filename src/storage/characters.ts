import { db, type CharacterRecord } from './db'

export function newId(): string {
  return crypto.randomUUID()
}

/**
 * Fichas do jogador, mais recentes primeiro.
 *
 * As fichas prontas da campanha ficam no mesmo banco (com `referenceId`) mas
 * não aparecem aqui: elas têm a própria página ("Fichas Prontas").
 */
export function listCharacters(): Promise<CharacterRecord[]> {
  return db.characters
    .orderBy('updatedAt')
    .reverse()
    .filter((record) => !record.referenceId)
    .toArray()
}

/** Fichas prontas da campanha, na ordem em que foram semeadas. */
export function listReferenceSheets(): Promise<CharacterRecord[]> {
  return db.characters
    .filter((record) => Boolean(record.referenceId))
    .toArray()
}

export function getCharacter(id: string): Promise<CharacterRecord | undefined> {
  return db.characters.get(id)
}

export interface SaveCharacterInput {
  id?: string
  /** Id da ficha de referência; só é usado ao semear uma ficha pronta. */
  referenceId?: string
  name: string
  rulesVersion: string
  sheetVersion: number
  data: unknown
}

export async function saveCharacter(input: SaveCharacterInput): Promise<string> {
  const now = Date.now()
  const id = input.id ?? newId()
  const existing = input.id ? await db.characters.get(input.id) : undefined

  // Editar uma ficha pronta nunca a "promove" a ficha do jogador: o marcador
  // da referência é preservado para o botão "Resetar ao padrão" continuar
  // funcionando depois de qualquer alteração.
  const referenceId = existing?.referenceId ?? input.referenceId

  const record: CharacterRecord = {
    id,
    name: input.name,
    rulesVersion: input.rulesVersion,
    sheetVersion: input.sheetVersion,
    data: input.data,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    ...(referenceId ? { referenceId } : {}),
  }

  await db.characters.put(record)
  return id
}

export function deleteCharacter(id: string): Promise<void> {
  return db.characters.delete(id)
}
