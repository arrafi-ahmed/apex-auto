import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import vuetify from 'vite-plugin-vuetify'

// https://vite.dev/config/
// The API port follows PORT (same variable the Express server reads), default 3000
const apiTarget = `http://localhost:${process.env.PORT || 3000}`

export default defineConfig({
  plugins: [
    vue(),
    vuetify({ autoImport: true })
  ],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true
      },
      '/news-img': {
        target: apiTarget,
        changeOrigin: true
      },
      '/thumb': {
        target: apiTarget,
        changeOrigin: true
      },
      '/media-stream': {
        target: apiTarget,
        changeOrigin: true
      }
    }
  }
})
