import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, resolve, sep } from 'node:path'
import { CHAT_MESTRE_PATH } from './chatMestre'
import { loadEnvFile } from './env'
import { handleChatMestreRequest, sendJson } from './http'

/**
 * Servidor de produção da Arena.
 *
 * `npm run build` gera `dist/`; este processo serve os arquivos estáticos com
 * fallback de SPA e monta a API do Mestre em `/api/chat-mestre`.
 */

loadEnvFile()

const ROOT = resolve(process.cwd(), 'dist')
const PORT = Number(process.env.PORT) || 4173

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.pdf': 'application/pdf',
}

function contentType(file: string): string {
  return MIME_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream'
}

async function sendFile(res: import('node:http').ServerResponse, file: string): Promise<boolean> {
  try {
    const info = await stat(file)
    if (!info.isFile()) return false

    const data = await readFile(file)
    res.statusCode = 200
    res.setHeader('Content-Type', contentType(file))
    res.setHeader('Content-Length', data.length)
    res.end(data)
    return true
  } catch {
    return false
  }
}

async function sendIndex(res: import('node:http').ServerResponse): Promise<void> {
  const index = join(ROOT, 'index.html')
  if (await sendFile(res, index)) return

  sendJson(res, 503, {
    error: 'Build não encontrado. Rode `npm run build` antes de `npm run start`.',
  })
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  const pathname = decodeURIComponent(url.pathname)

  if (pathname === CHAT_MESTRE_PATH) {
    await handleChatMestreRequest(req, res)
    return
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { error: 'Método não permitido.' })
    return
  }

  // Impede path traversal: o arquivo precisa ficar dentro de `dist/`.
  const target = resolve(ROOT, `.${pathname}`)
  if (target !== ROOT && !target.startsWith(ROOT + sep)) {
    sendJson(res, 403, { error: 'Acesso negado.' })
    return
  }

  if (await sendFile(res, target)) return
  await sendIndex(res)
})

server.listen(PORT, () => {
  console.log(`Arena de Amnia em http://localhost:${PORT}`)
  if (!process.env.GROQ_API_KEY?.trim()) {
    console.warn('GROQ_API_KEY ausente: o chat responderá com erro até configurar o .env.')
  }
})
