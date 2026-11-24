import { z } from 'zod'
import { characterSchema, rulesVersion, SHEET_VERSION, type Character } from './character'
import { reconcileTraitRunes } from './traitGrants'

/**
 * Código compartilhável da ficha.
 *
 * Formato: `AMNIA1-<Z|P>.<base64url>.<checksum>`
 *
 * - `AMNIA1`: versão deste formato de código (não é a versão da ficha);
 * - `Z`: JSON comprimido com Deflate; `P`: JSON puro (fallback para navegadores
 *   sem `CompressionStream`);
 * - base64url: bytes do JSON (comprimido ou não), sem `=` no fim;
 * - checksum: FNV-1a do JSON original em base36, para pegar cópias cortadas.
 *
 * O conteúdo do JSON carrega a versão da ficha e as regras, além do `Character`
 * completo. A leitura sempre passa pelo `characterSchema` (que já migra fichas
 * antigas) e por `reconcileTraitRunes`, então um código de outra versão não
 * entra direto no estado da aplicação.
 */

const CODE_PREFIX = 'AMNIA1'
const FORMAT = 1

const payloadSchema = z.object({
  format: z.literal(FORMAT),
  sheetVersion: z.number().int().positive(),
  rulesVersion: z.string(),
  character: z.unknown(),
})

export interface SheetCodePayload {
  format: typeof FORMAT
  sheetVersion: number
  rulesVersion: string
  character: Character
}

type CompressionKind = 'Z' | 'P'

/** Remove quebras de linha e cercas Markdown que costumam acompanhar um copiar/colar. */
export function normalizeSheetCode(input: string): string {
  return input
    .replace(/^\s*```(?:[a-z0-9_-]+)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .replace(/\s+/g, '')
}

/** FNV-1a de 32 bits, curto o bastante para caber no código. */
function checksum(text: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(36)
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
}

type ByteTransform = ReadableWritablePair<Uint8Array, Uint8Array>

function byteStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
}

/** Comprime com Deflate; devolve `null` se o navegador não oferecer a API. */
async function deflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null
  try {
    const transform = new CompressionStream('deflate') as unknown as ByteTransform
    const compressed = byteStream(bytes).pipeThrough(transform)
    return new Uint8Array(await new Response(compressed).arrayBuffer())
  } catch {
    return null
  }
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error(
      'Este navegador não abre códigos comprimidos. Atualize o navegador ou peça um código compatível.',
    )
  }
  try {
    const transform = new DecompressionStream('deflate') as unknown as ByteTransform
    const restored = byteStream(bytes).pipeThrough(transform)
    return new Uint8Array(await new Response(restored).arrayBuffer())
  } catch {
    throw new Error('Não foi possível descomprimir o código da ficha.')
  }
}

/** Gera o código que o usuário copia e compartilha. */
export async function createSheetCode(character: Character): Promise<string> {
  const payload: SheetCodePayload = {
    format: FORMAT,
    sheetVersion: SHEET_VERSION,
    rulesVersion,
    character,
  }
  const json = JSON.stringify(payload)
  const bytes = new TextEncoder().encode(json)
  const compressed = await deflate(bytes)
  const kind: CompressionKind = compressed ? 'Z' : 'P'
  const encoded = bytesToBase64Url(compressed ?? bytes)
  return `${CODE_PREFIX}-${kind}.${encoded}.${checksum(json)}`
}

/** Lê, valida e normaliza um código colado pelo usuário. */
export async function readSheetCode(input: string): Promise<SheetCodePayload> {
  const code = normalizeSheetCode(input)
  const match = new RegExp(`^${CODE_PREFIX}-([ZP])\\.([A-Za-z0-9_-]+)\\.([a-z0-9]+)$`).exec(code)
  if (!match) {
    throw new Error('Código de ficha inválido. Confira se copiou o código inteiro.')
  }

  const kind = match[1] as CompressionKind
  const payloadBytes = base64UrlToBytes(match[2] ?? '')
  const jsonBytes = kind === 'Z' ? await inflate(payloadBytes) : payloadBytes
  const json = new TextDecoder().decode(jsonBytes)

  if (checksum(json) !== match[3]) {
    throw new Error('Código de ficha corrompido. Copie o código novamente.')
  }

  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    throw new Error('Código de ficha inválido.')
  }

  const parsedPayload = payloadSchema.safeParse(raw)
  if (!parsedPayload.success) {
    throw new Error('Código de ficha incompatível com esta versão do app.')
  }
  if (parsedPayload.data.sheetVersion > SHEET_VERSION) {
    throw new Error(
      'Este código foi criado numa versão mais nova do app. Atualize o aplicativo para abri-lo.',
    )
  }

  const parsedCharacter = characterSchema.safeParse(parsedPayload.data.character)
  if (!parsedCharacter.success) {
    const first = parsedCharacter.error.issues[0]
    const field = first?.path.join('.')
    throw new Error(
      field
        ? `A ficha do código é inválida (campo: ${field}).`
        : 'A ficha do código é inválida.',
    )
  }

  return {
    format: FORMAT,
    sheetVersion: parsedPayload.data.sheetVersion,
    rulesVersion: parsedPayload.data.rulesVersion,
    character: reconcileTraitRunes(parsedCharacter.data),
  }
}

/**
 * Devolve uma cópia independente da ficha lida: novo id e datas, para que
 * importar duas vezes não sobrescreva a ficha original no IndexedDB.
 *
 * `id`/`now` permitem que fichas prontas usem um id estável sem perder a
 * definição padrão do botão "Resetar ao padrão".
 */
export function instantiateImportedCharacter(
  payload: SheetCodePayload,
  options: { id?: string; now?: number } = {},
): Character {
  const now = options.now ?? Date.now()
  return {
    ...payload.character,
    id: options.id ?? crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  }
}
