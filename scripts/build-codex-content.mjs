/**
 * Gera o conteúdo do Codex Amnia a partir do export do Notion.
 *
 * O export bruto fica em `docs/amnia-export` (pasta ignorada pelo git), então
 * este script copia os textos para `src/features/codex/content`, onde passam a
 * fazer parte do bundle, e escreve o índice em `manifest.generated.ts`.
 *
 * Uso (depois de atualizar o export do Notion):
 *   node scripts/build-codex-content.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = path.join(ROOT, 'docs', 'amnia-export')
const CONTENT = path.join(ROOT, 'src', 'features', 'codex', 'content')
const PUBLIC_CODEX = path.join(ROOT, 'public', 'codex')
const MANIFEST = path.join(ROOT, 'src', 'features', 'codex', 'manifest.generated.ts')

const NOTION_ID = /[ \t]+[0-9a-f]{32}$/i

const SECTIONS = [
  { id: 'mundo', title: 'Mundo e lore', icon: '🌒' },
  { id: 'regras', title: 'Regras e mecânicas', icon: '⚔️' },
  { id: 'racas', title: 'Raças e culturas', icon: '🏛️' },
  { id: 'itens', title: 'Itens e equipamentos', icon: '🧰' },
  { id: 'magias', title: 'Magias e runas', icon: '✦' },
]

function stripId(value) {
  return value.replace(NOTION_ID, '').trim()
}

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function compareKey(value) {
  return slugify(stripId(value))
}

function titleFor(filename) {
  const base = stripId(path.basename(filename, '.md'))
  if (base.startsWith('AMNIA RPG - V2')) return 'Índice do Compêndio'
  const model = base.match(/^Ficha\s*\((\d+)\)$/i)
  if (model) return `Modelo de ficha ${model[1]}`
  return base.replace(/\s+/g, ' ').trim()
}

function sectionFor(relPath) {
  if (relPath.startsWith('Equipamento')) return 'itens'
  if (/Equipamento\s/.test(relPath)) return 'itens'
  if (/Linhagens\s*&\s*Raças/.test(relPath)) return 'racas'
  if (/Magia|Familiares|Runas/.test(relPath)) return 'magias'
  if (/Classes|Regras|Criação de Personagem|Vantagens|Ações/.test(relPath)) return 'regras'
  return 'mundo'
}

function groupFor(relPath) {
  if (/[\\/]Classes[\\/]/.test(relPath)) return 'Classes'
  if (/[\\/]Linhagens\s*&\s*Raças[\\/]/.test(relPath)) return 'Ancestralidades'
  if (/[\\/]Lista de Runas[\\/]/.test(relPath)) return 'Runas'
  if (/[\\/]Fichas[\\/]/.test(relPath)) return 'Personagens da campanha'
  if (/Fichas de Conhecimento/.test(relPath)) return 'Cultura & conhecimento'
  if (/Criação de Personagem/.test(relPath)) return 'Criação'
  if (/[\\/]Magia[\\/]/.test(relPath)) return 'Arcanae'
  if (/Classes\s/.test(relPath)) return 'Classes'
  return 'Geral'
}

function listFiles(dir, base = '') {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...listFiles(full, rel))
    else out.push(rel)
  }
  return out.sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

// ---------------------------------------------------------------------------
// 1. Descobrir artigos e montar a tabela de resolução de links internos.
// ---------------------------------------------------------------------------
if (!fs.existsSync(SOURCE)) {
  console.error(`Export do Notion não encontrado em ${SOURCE}`)
  process.exit(1)
}

const allFiles = listFiles(SOURCE)
const sourceFiles = allFiles.filter((file) => file.toLowerCase().endsWith('.md'))
const usedIds = new Set()
const usedPaths = new Set()
const articles = []

for (const rel of sourceFiles) {
  const title = titleFor(rel)
  const section = sectionFor(rel)
  const group = groupFor(rel)
  let id = `${section}-${slugify(title)}`
  if (!id || id === section) id = `${section}-pagina`
  if (usedIds.has(id)) id = `${id}-${usedIds.size + 1}`
  usedIds.add(id)

  let file = `${section}/${slugify(title)}.md`
  let suffix = 2
  while (usedPaths.has(file)) {
    file = `${section}/${slugify(title)}-${suffix++}.md`
  }
  usedPaths.add(file)

  articles.push({
    id,
    title,
    section,
    group,
    file,
    sourceRel: rel,
    // Preenchido depois de limpar o texto.
    words: 0,
    stub: false,
  })
}

const byKey = new Map()
for (const article of articles) {
  byKey.set(compareKey(article.sourceRel.replace(/^Particular e Compartilhado\//, '')), article.id)
  byKey.set(compareKey(path.basename(article.sourceRel)), article.id)
  byKey.set(compareKey(article.title), article.id)
}

function resolveArticle(rawUrl) {
  let decoded = rawUrl.trim()
  try {
    decoded = decodeURIComponent(decoded)
  } catch {
    // URL já decodificada ou malformada: seguir como está.
  }
  decoded = decoded.split('#')[0].replace(/\.md$/i, '').replace(/^\.\//, '')
  const candidates = [compareKey(decoded), compareKey(path.basename(decoded))].filter(Boolean)
  for (const key of candidates) {
    if (byKey.has(key)) return byKey.get(key)
  }
  // Links quebrados no export (nomes com parênteses truncados).
  for (const key of candidates) {
    for (const [candidate, id] of byKey) {
      if (candidate.length > 5 && (candidate.startsWith(key) || key.startsWith(candidate))) {
        return id
      }
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// 2. Limpar o markdown e copiar as imagens.
// ---------------------------------------------------------------------------
fs.rmSync(CONTENT, { recursive: true, force: true })
fs.mkdirSync(CONTENT, { recursive: true })
fs.rmSync(PUBLIC_CODEX, { recursive: true, force: true })
fs.mkdirSync(PUBLIC_CODEX, { recursive: true })

const imageMap = new Map()
for (const rel of allFiles) {
  if (!/\.(png|jpe?g|gif|webp|svg)$/i.test(rel)) continue
  const name = `${slugify(path.dirname(rel).split('/').pop() ?? 'codex')}-${path.basename(rel)}`
  fs.copyFileSync(path.join(SOURCE, rel), path.join(PUBLIC_CODEX, name))
  imageMap.set(compareKey(rel), `/codex/${name}`)
  imageMap.set(compareKey(path.basename(rel)), `/codex/${name}`)
}

function sanitize(text, article) {
  let out = text.replace(/\r\n?/g, '\n').trim()

  // O título já aparece no cabeçalho da wiki: evita duplicá-lo no artigo.
  out = out.replace(/^\s*#\s+[^\n]+\n/, '')

  // Índice automático do Notion e linhas deblockquote vazias.
  out = out.replace(/^>\s*(?:#{1,6}\s*)?\**\s*(ÍNDICE|INDICE)\s*\**\s*$/gim, '')
  out = out.replace(/^>\s*$/gm, '')

  // Imagens viram tokens para não conflitar com a regex de links.
  const images = []
  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_all, label, url) => {
    const key = compareKey(decodeSafe(url))
    const src =
      imageMap.get(key) ??
      imageMap.get(compareKey(path.basename(decodeSafe(url)))) ??
      decodeSafe(url)
    images.push(`![${label}](${src})`)
    return `\u0000IMG${images.length - 1}\u0000`
  })

  // Links internos apontam para artigos do Codex; links quebrados viram texto.
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (all, label, url) => {
    const target = resolveArticle(url)
    return target ? `[${label}](#/${target})` : label
  })
  // `**[**Texto**](link)` deixa dois pares de `**` em volta do rótulo.
  out = out
    .replace(/\*\*\[\*\*([^\]]+)\*\*\]/g, '[$1]')
    .replace(/\*\*(\[[^\]]+\])\*\*/g, '$1')

  out = images.reduce(
    (value, image, index) => value.replace(`\u0000IMG${index}\u0000`, image),
    out,
  )

  out = out
    // Links aninhados dentro de negrito deixam `****` no export.
    .replace(/\*{4,}/g, '**')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (!out) out = '*(Esta página ainda não tem conteúdo no material original.)*'
  article.words = out.split(/\s+/).filter(Boolean).length
  article.stub = article.words < 8
  return `${out}\n`
}

function decodeSafe(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

for (const article of articles) {
  const sourcePath = path.join(SOURCE, article.sourceRel)
  const text = fs.readFileSync(sourcePath, 'utf8')
  const outputPath = path.join(CONTENT, article.file)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, sanitize(text, article), 'utf8')
}

// ---------------------------------------------------------------------------
// 3. Índice tipado usado pela interface.
// ---------------------------------------------------------------------------
const exportedArticles = articles.map(({ sourceRel: _sourceRel, ...article }) => article)
const manifest = `/**
 * GERADO por scripts/build-codex-content.mjs — não editar à mão.
 * Fonte: export do Notion em docs/amnia-export (fora do git).
 */
export const CODEX_SECTIONS = ${JSON.stringify(SECTIONS, null, 2)} as const

export type CodexSectionId = (typeof CODEX_SECTIONS)[number]['id']

export interface CodexArticle {
  id: string
  title: string
  section: CodexSectionId
  group: string
  /** Caminho dentro de src/features/codex/content. */
  file: string
  words: number
  stub: boolean
}

export const CODEX_ARTICLES: CodexArticle[] = ${JSON.stringify(exportedArticles, null, 2)}
`

fs.writeFileSync(MANIFEST, manifest, 'utf8')

const stubs = articles.filter((article) => article.stub)
console.log(
  `Codex: ${articles.length} páginas em ${SECTIONS.length} seções, ${stubs.length} páginas vazias.`,
)
console.log(`Conteúdo: ${path.relative(ROOT, CONTENT)}`)
console.log(`Índice: ${path.relative(ROOT, MANIFEST)}`)
