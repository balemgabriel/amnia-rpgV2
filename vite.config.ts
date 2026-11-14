import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
})
