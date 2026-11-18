import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Carrega `.env` no processo do servidor de produção.
 *
 * Em desenvolvimento quem faz isso é o Vite (`loadEnv`), mas `npm run start`
 * roda direto no Node. O parser é intencionalmente pequeno: só precisamos de
 * linhas `CHAVE=valor`, comentários com `#` e valores entre aspas.
 *
 * Variáveis já definidas no ambiente têm prioridade (ex.: deploy).
 */
export function loadEnvFile(file = '.env'): void {
  const path = resolve(process.cwd(), file)
  if (!existsSync(path)) return

  const content = readFileSync(path, 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const separator = line.indexOf('=')
    if (separator <= 0) continue

    const key = line.slice(0, separator).trim()
    if (!key || key in process.env) continue

    let value = line.slice(separator + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}
