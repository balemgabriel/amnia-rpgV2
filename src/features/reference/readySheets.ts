import { rulesVersion, SHEET_VERSION } from '@/rules/character'
import { instantiateImportedCharacter, readSheetCode } from '@/rules/sheetCode'
import { getCharacter, saveCharacter } from '@/storage/characters'
import {
  convertReferenceSheet,
  referenceRecordId,
  referenceSheets,
  type ReferenceSheet,
} from './convertSheets'
import { readySheetCodes, type ReadySheetCode } from './readySheetCodes'

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

  for (const entry of readySheetCodes) {
    const referenceId = codeReferenceId(entry.id)
    const id = referenceRecordId(referenceId)
    const existing = await getCharacter(id)
    if (existing) continue
    await persistCode(entry, referenceId, id)
  }
}

/** Restaura uma ficha pronta ao conteúdo original do material ou do código. */
export async function resetReadySheet(referenceId: string): Promise<string> {
  const sheet = referenceSheets.find((item) => item.id === referenceId)
  if (sheet) return persist(sheet)

  const entry = readySheetCodes.find((item) => codeReferenceId(item.id) === referenceId)
  if (entry) return persistCode(entry, referenceId, referenceRecordId(referenceId))

  throw new Error(`Ficha de referência "${referenceId}" não encontrada.`)
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

/** Id estável da ficha-vinda-de-código, usado também pelo reset. */
function codeReferenceId(id: string): string {
  const slug = id
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
  return `code-${slug || 'ficha'}`
}

async function persistCode(
  entry: ReadySheetCode,
  referenceId: string,
  id: string,
): Promise<string> {
  const payload = await readSheetCode(entry.code)
  const character = instantiateImportedCharacter(payload, { id })
  return saveCharacter({
    id,
    referenceId,
    name: character.name.trim() || 'Ficha importada',
    rulesVersion,
    sheetVersion: SHEET_VERSION,
    data: character,
  })
}
