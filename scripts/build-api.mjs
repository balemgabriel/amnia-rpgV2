import { build } from 'esbuild'

/**
 * Gera `api/chat-mestre.js` a partir de `server/vercelEntry.ts`.
 *
 * A Vercel só compila TypeScript dentro de `api/`, e a função precisa das
 * regras em `src/lib/amnia/`. O bundle resolve isso incluindo apenas os
 * módulos locais; pacotes npm ficam externos (a Vercel instala e empacota).
 */
await build({
  entryPoints: ['server/vercelEntry.ts'],
  outfile: 'api/chat-mestre.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  logLevel: 'info',
  banner: {
    js: '// GERADO por `npm run build:api` a partir de server/vercelEntry.ts. Não edite à mão.',
  },
})
