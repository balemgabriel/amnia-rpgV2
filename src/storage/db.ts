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
  /**
   * Presente apenas em fichas prontas da campanha. Guarda o id da ficha de
   * referência original (`sheets.json`) para permitir "Resetar ao padrão".
   * Fichas do jogador não têm esse campo.
   */
  referenceId?: string
  data: unknown
  createdAt: number
  updatedAt: number
}

/**
 * Magia guardada na Oficina de Magias.
 *
 * O `data` segue o mesmo princípio da ficha: o banco guarda o blob e a camada
 * de domínio valida com Zod ao ler. `name` e `updatedAt` existem só para
 * ordenar e listar sem abrir cada magia.
 */
export interface LibrarySpellRecord {
  id: string
  name: string
  data: unknown
  createdAt: number
  updatedAt: number
}

const db = new Dexie('amnia-v2') as Dexie & {
  characters: EntityTable<CharacterRecord, 'id'>
  spells: EntityTable<LibrarySpellRecord, 'id'>
}

db.version(1).stores({
  characters: 'id, name, updatedAt',
})

// v2: biblioteca da Oficina de Magias (não mexe nas fichas existentes).
db.version(2).stores({
  spells: 'id, name, updatedAt',
})

// v3: marcador das fichas prontas da campanha (referenceId).
db.version(3).stores({
  characters: 'id, name, updatedAt, referenceId',
})

export { db }
