import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleChatMestre } from '../server/chatMestre'

/** Sonda: importa o núcleo completo do Mestre. */
export default function handler(_req: IncomingMessage, res: ServerResponse): void {
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify({ ok: true, probe: 'chat', hasHandler: typeof handleChatMestre === 'function' }))
}
