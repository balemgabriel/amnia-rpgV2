import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleChatMestre } from '../server/chatMestre'
import { readJsonBody, sendJson } from '../server/http'

/**
 * Função serverless da Vercel para `POST /api/chat-mestre`.
 *
 * Reaproveita o mesmo núcleo do servidor local: nada de regra duplicada e a
 * chave do Groq continua só no servidor (variável de ambiente da Vercel).
 * A Vercel já entrega o corpo JSON parseado em `req.body`; se vier cru, lemos
 * o stream como o servidor Node faz.
 */
type VercelRequest = IncomingMessage & { body?: unknown }

export default async function handler(
  req: VercelRequest,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    sendJson(res, 405, { error: 'Método não permitido. Use POST.' })
    return
  }

  const controller = new AbortController()
  const abortIfDisconnected = () => {
    if (!res.writableEnded) controller.abort()
  }
  res.on('close', abortIfDisconnected)

  try {
    let payload: unknown = req.body
    if (typeof payload === 'string') {
      payload = payload.trim() ? JSON.parse(payload) : {}
    } else if (payload === undefined || payload === null) {
      payload = await readJsonBody(req)
    }

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
