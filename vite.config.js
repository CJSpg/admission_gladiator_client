import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/admission_gladiator_client/',
  server: {
    proxy: {
      '/local-api': {
        target: 'http://127.0.0.1:18000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/local-api/, ''),
        secure: false,
      }
    }
  }
})
