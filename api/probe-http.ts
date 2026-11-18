import type { IncomingMessage, ServerResponse } from 'node:http'
import { sendJson } from '../server/http'

/** Sonda: importa `server/http` (que importa `server/chatMestre`). */
export default function handler(_req: IncomingMessage, res: ServerResponse): void {
  sendJson(res, 200, { ok: true, probe: 'http', hasSendJson: typeof sendJson === 'function' })
}
