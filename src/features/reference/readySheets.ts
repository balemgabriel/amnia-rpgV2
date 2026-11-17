import { rulesVersion, SHEET_VERSION } from '@/rules/character'
import { getCharacter, saveCharacter } from '@/storage/characters'
import {
  convertReferenceSheet,
  referenceRecordId,
  referenceSheets,
  type ReferenceSheet,
} from './convertSheets'

/**
 * Semeia as fichas prontas no banco local.
 *
 * Elas são fichas normais do app (mesmo schema, mesmo motor de cálculo), só
 * que marcadas com `referenceId`. A semeadura só cria o que ainda não existe:
 * se o jogador alterou uma ficha pronta, a alteração é preservada.
 */
export async function ensureReadySheets(): Promise<void> {
  for (const sheet of referenceSheets) {
    const id = referenceRecordId(sheet.id)
    const existing = await getCharacter(id)
    if (existing) continue
    await persist(sheet)
  }
}

/** Restaura uma ficha pronta ao conteúdo original do material. */
export async function resetReadySheet(referenceId: string): Promise<string> {
  const sheet = referenceSheets.find((item) => item.id === referenceId)
  if (!sheet) throw new Error(`Ficha de referência "${referenceId}" não encontrada.`)
  return persist(sheet)
}

async function persist(sheet: ReferenceSheet): Promise<string> {
  const character = convertReferenceSheet(sheet)
  return saveCharacter({
    id: character.id,
    referenceId: sheet.id,
    name: character.name,
    rulesVersion,
    sheetVersion: SHEET_VERSION,
    data: character,
  })
}
