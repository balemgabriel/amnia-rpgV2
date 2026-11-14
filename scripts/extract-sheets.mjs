import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Extrai as fichas preenchidas da pasta `Fichas` do material para um JSON
 * consumido pela tela inicial. As fichas 8, 9 e 10 são templates vazios e
 * ficam de fora.
 *
 * Uso: node scripts/extract-sheets.mjs
 */

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const sourceDir = join(
  root,
  'docs',
  'amnia-export',
  'Particular e Compartilhado',
  'AMNIA RPG - V2',
  'Fichas',
)
const target = join(root, 'src', 'features', 'reference', 'sheets.json')

function field(markdown, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = markdown.match(new RegExp(`^###\\s*${escaped}\\s*;\\s*(.*)$`, 'm'))
  return match ? match[1].trim() : ''
}

function slug(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

const files = (await readdir(sourceDir))
  .filter((name) => name.endsWith('.md'))
  .filter((name) => !/^Ficha \(\d+\)/.test(name))

const sheets = []
for (const file of files.sort((a, b) => a.localeCompare(b, 'pt-BR'))) {
  const markdown = (await readFile(join(sourceDir, file), 'utf8'))
    .replace(/\r\n/g, '\n')
    .trim()
  const name = field(markdown, 'NOME') || markdown.split('\n')[0].replace(/^#\s*/, '')
  const sheet = {
    id: slug(name),
    name,
    concept: field(markdown, 'CONCEITO'),
    className: field(markdown, 'CLASSE'),
    ancestry: field(markdown, 'RAÇA'),
    markdown,
  }
  if (!sheet.name) {
    console.warn(`Ignorando ${file}: sem nome.`)
    continue
  }
  sheets.push(sheet)
}

await mkdir(dirname(target), { recursive: true })
await writeFile(target, `${JSON.stringify(sheets, null, 2)}\n`, 'utf8')
console.log(`OK — ${sheets.length} fichas em ${target}`)
