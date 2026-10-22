import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import '@mdi/font/css/materialdesignicons.css'
import App from './App.vue'
import './style.css'

const vuetify = createVuetify({
  theme: {
    defaultTheme: 'dark',
    themes: {
      dark: {
        dark: true,
        colors: {
          primary: '#3b82f6',
          secondary: '#64748b',
          accent: '#8b5cf6',
          error: '#ef4444',
          info: '#06b6d4',
          success: '#10b981',
          warning: '#f59e0b',
          background: '#0a0f1d',
          surface: '#121829',
          'surface-variant': '#1e293b'
        }
      },
      light: {
        dark: false,
        colors: {
          primary: '#1e40af',
          secondary: '#475569',
          accent: '#6366f1',
          background: '#f8fafc',
          surface: '#ffffff'
        }
      }
    }
  }
})

const app = createApp(App)
app.use(createPinia())
app.use(vuetify)
app.mount('#app')
