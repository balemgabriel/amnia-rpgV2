/**
 * Cores do Codex na seção de raças.
 *
 * A paleta é a mesma da criação de personagens (`lineageColors.ts`): a
 * ancestralidade define a cor base e cada linhagem/casta/grupo pode ter a sua.
 * Aqui só traduzimos os ids e títulos do markdown para essa paleta.
 */
import { lineages } from '../../rules/data'
import type { Lineage } from '../../rules/data/types'
import { ancestryColor, lineageColor } from '../../rules/lineageColors'

const ARTICLE_PREFIX = 'racas-'

/** Chave de comparação: sem acento, sem emoji, sem pontuação e sem caixa. */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/** `racas-shrumakara-wip` → `shrumakara`. Fora da seção, devolve null. */
export function ancestryIdFromArticle(articleId: string): string | null {
  if (!articleId.startsWith(ARTICLE_PREFIX)) return null
  const id = articleId.slice(ARTICLE_PREFIX.length).replace(/-wip$/, '')
  return lineages.some((lineage) => lineage.id === id) ? id : null
}

/** Cor da ancestralidade de um artigo do Codex. */
export function codexArticleColor(articleId: string): string | null {
  const id = ancestryIdFromArticle(articleId)
  return id ? ancestryColor(id) : null
}

interface NameTone {
  key: string
  color: string
}

/** Nomes que podem aparecer nos headings de uma página de raça → cor. */
function tonesFor(lineage: Lineage): NameTone[] {
  const base = ancestryColor(lineage.id)
  if (!base) return []

  const tones: NameTone[] = []
  const add = (name: string, color: string | null) => {
    const key = normalize(name)
    if (key) tones.push({ key, color: color ?? base })
  }

  add(lineage.name, base)
  for (const group of lineage.lineageGroups ?? []) add(group.name, lineageColor(group.id))
  for (const caste of lineage.castes ?? []) add(caste.name, null)
  for (const sublineage of lineage.lineages) {
    const color = lineageColor(sublineage.id) ?? base
    add(sublineage.name, color)
    // "Ulfhednar (Fúria Vermelha)" também aparece só como "Ulfhednar".
    const shortName = sublineage.name.replace(/\s*\([^)]*\)\s*/g, '').trim()
    if (shortName && shortName !== sublineage.name) add(shortName, color)
  }

  return tones.filter((tone, index) => tones.findIndex((item) => item.key === tone.key) === index)
}

const toneCache = new Map<string, NameTone[]>()

function cachedTones(lineage: Lineage): NameTone[] {
  let tones = toneCache.get(lineage.id)
  if (!tones) {
    tones = tonesFor(lineage)
    toneCache.set(lineage.id, tones)
  }
  return tones
}

/**
 * Cor do outline de um heading dentro de uma página de raça.
 *
 * Títulos como `## ☀️Soltianos`, `## 🐜 Qatae` ou `# Linhagem Kuetz` usam a cor
 * da linhagem/grupo/casta correspondente. Os títulos genéricos (Traços Raciais,
 * Linhagens, Castas…) caem na cor da ancestralidade — o mesmo fallback usado na
 * criação quando não há sub-ramificação selecionada.
 */
export function codexHeadingColor(articleId: string, headingText: string): string | null {
  const ancestryId = ancestryIdFromArticle(articleId)
  if (!ancestryId) return null

  const base = ancestryColor(ancestryId)
  const lineage = lineages.find((item) => item.id === ancestryId)
  if (!lineage) return base

  const key = normalize(headingText)
  const tones = cachedTones(lineage)
  const exact = tones.find((tone) => tone.key === key)
  if (exact) return exact.color

  // "Linhagem Kuetz" contém o nome do grupo; a correspondência mais longa
  // evita confundir nomes curtos que aparecem dentro de outros.
  const partial = tones
    .filter((tone) => tone.key.length >= 3 && key.includes(tone.key))
    .sort((a, b) => b.key.length - a.key.length)[0]
  return partial?.color ?? base
}
