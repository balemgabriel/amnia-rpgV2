import type { IncomingMessage, ServerResponse } from 'node:http'
import { normalizeGameState } from '../src/lib/amnia/rules'

/** Sonda: importa as regras puras de `src/lib/amnia`. */
export default function handler(_req: IncomingMessage, res: ServerResponse): void {
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify({ ok: true, probe: 'rules', hasNormalize: typeof normalizeGameState === 'function' }))
}
