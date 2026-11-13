/**
 * Dados do sistema, extraídos do material oficial (docs/amnia-export).
 * Os JSONs foram gerados a partir do export do Notion e são a fonte da verdade.
 */
import advantagesJson from './advantages.json'
import classesJson from './classes.json'
import lineagesJson from './lineages.json'
import runesJson from './runes.json'
import type { AdvantageDef, ClassDef, Lineage, RuneDef } from './types'

export const lineages = lineagesJson as unknown as Lineage[]
export const classes = classesJson as unknown as ClassDef[]
export const advantages = advantagesJson as unknown as AdvantageDef[]
export const runes = runesJson as unknown as RuneDef[]

export * from './types'
