import Dexie, { type EntityTable } from 'dexie'

/**
 * Registro persistido no IndexedDB.
 *
 * `data` é intencionalmente opaco aqui: o banco guarda o blob e a camada de
 * domínio (src/rules) valida/normaliza com Zod ao ler. Assim, mudanças no
 * formato da ficha não exigem migração do banco, só um bump de `sheetVersion`.
 */
export interface CharacterRecord {
  id: string
  name: string
  /** Versão das regras usadas na criação (ex.: "2.0.0"). */
  rulesVersion: string
  /** Versão do formato da ficha, para migrar fichas antigas. */
  sheetVersion: number
  data: unknown
  createdAt: number
  updatedAt: number
}

const db = new Dexie('amnia-v2') as Dexie & {
  characters: EntityTable<CharacterRecord, 'id'>
}

db.version(1).stores({
  characters: 'id, name, updatedAt',
})

export { db }
