import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  // Carrega o `.env` no processo do servidor de desenvolvimento. Só variáveis
  // do servidor (GROQ_*) são usadas; nada disso vai para o bundle do cliente.
  const env = loadEnv(mode, process.cwd(), '')
  for (const key of ['GROQ_API_KEY', 'GROQ_MODEL']) {
    if (env[key] && !process.env[key]) process.env[key] = env[key]
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'amnia-chat-mestre-api',
        configureServer(server) {
          // A API roda no mesmo processo do Vite, mas em SSR: o código de
          // `server/` nunca entra no bundle do navegador.
          server.middlewares.use('/api/chat-mestre', async (req, res) => {
            try {
              const mod = await server.ssrLoadModule('/server/http.ts')
              await mod.handleChatMestreRequest(req, res)
            } catch (error) {
              if (res.headersSent) return
              const message = error instanceof Error ? error.message : 'erro desconhecido'
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify({ error: `Falha interna na API do Mestre: ${message}` }))
            }
          })
        },
      },
    ],
    server: {
      watch: {
        // A pasta "Nova pasta" contém arquivos bloqueados pelo Windows/OneDrive
        // (ex.: .rar) que derrubavam o watcher com EBUSY.
        ignored: ['**/Nova pasta/**', '**/*.rar'],
      },
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})
