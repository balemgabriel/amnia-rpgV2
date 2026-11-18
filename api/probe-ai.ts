import type { IncomingMessage, ServerResponse } from 'node:http'
import { createGroq } from '@ai-sdk/groq'
import { generateText } from 'ai'

/**
 * Sonda: confirma que `ai` e `@ai-sdk/groq` carregam no runtime da Vercel.
 * Se esta rota falhar, o problema é o bundle do SDK; se funcionar, o problema
 * está nos imports locais de `server/`.
 *
 * Não chama a rede nem exige chave: só instancia o provider e o modelo.
 */
function handler(_req: IncomingMessage, res: ServerResponse): void {
  const groq = createGroq({ apiKey: process.env.GROQ_API_KEY?.trim() || 'sonda-sem-chave' })
  const model = groq(process.env.GROQ_MODEL?.trim() || 'openai/gpt-oss-120b')

  const body = JSON.stringify({
    ok: true,
    probe: 'ai',
    hasGenerateText: typeof generateText === 'function',
    hasCreateGroq: typeof createGroq === 'function',
    modelId: model.modelId,
    node: process.version,
  })

  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(body)
}

// A Vercel compila as funções em CommonJS (o projeto não é `type: module`);
// nesse formato o runtime procura o handler em `module.exports`.
module.exports = handler
