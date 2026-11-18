import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleChatMestre } from './chatMestre'

/** Limite defensivo: a ficha resumida + histórico não passam disso. */
const MAX_BODY_BYTES = 2 * 1024 * 1024

export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0

  for await (const chunk of req) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
    size += buffer.length
    if (size > MAX_BODY_BYTES) {
      throw new Error('Corpo da requisição grande demais.')
    }
    chunks.push(buffer)
  }

  if (chunks.length === 0) return {}
  const text = Buffer.concat(chunks).toString('utf8').trim()
  return text ? JSON.parse(text) : {}
}

export function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(body)
}

/**
 * Handler HTTP compartilhado entre o servidor de produção e o middleware de
 * desenvolvimento do Vite. Não expõe a chave do Groq em nenhuma resposta.
 */
export async function handleChatMestreRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    sendJson(res, 405, { error: 'Método não permitido. Use POST.' })
    return
  }

  const controller = new AbortController()
  // Se o navegador fechar a aba/recarregar, aborta a chamada ao Groq em vez de
  // continuar gastando tokens por uma resposta que ninguém vai ler.
  const abortIfDisconnected = () => {
    if (!res.writableEnded) controller.abort()
  }
  res.on('close', abortIfDisconnected)

  try {
    const payload = await readJsonBody(req)
    const result = await handleChatMestre(payload, { signal: controller.signal })
    if (!res.writableEnded && !res.destroyed) sendJson(res, result.status, result.body)
  } catch (error) {
    if (res.writableEnded || res.destroyed) return
    const message = error instanceof Error ? error.message : 'erro desconhecido'
    sendJson(res, 400, { error: `Não foi possível ler a requisição: ${message}` })
  } finally {
    res.off('close', abortIfDisconnected)
  }
}
