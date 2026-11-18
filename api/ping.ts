import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * Diagnóstico do deploy: confirma que as funções serverless estão de pé e em
 * qual versão do Node. Não expõe nenhuma variável de ambiente.
 */
function handler(_req: IncomingMessage, res: ServerResponse): void {
  const body = JSON.stringify({
    ok: true,
    node: process.version,
    region: process.env.VERCEL_REGION ?? null,
  })
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(body)
}

// A Vercel compila as funções em CommonJS (o projeto não é `type: module`);
// nesse formato o runtime procura o handler em `module.exports`, não em
// `exports.default`.
module.exports = handler
