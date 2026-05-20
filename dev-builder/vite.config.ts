import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      // Permite importar módulos/archivos fuera del root (para el core legacy `.DEV/components/devmode`)
      allow: ['..'],
    },
  },
})

