import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import '@mdi/font/css/materialdesignicons.css'
import App from './App.vue'
import './style.css'
import { readPref, resolve, vuetifyName, applyChrome } from './theme'

// ─── Apex design system ───────────────────────────────────────────────
// Neutral zinc surfaces + a single indigo accent. Every component reads its
// look from these theme tokens and the `defaults` below, so templates stay
// free of one-off styling props.
const apexDark = {
  dark: true,
  colors: {
    background: '#09090b',
    surface: '#111113',
    'surface-bright': '#18181b',
    'surface-light': '#1f1f23',
    'surface-variant': '#27272a',
    'on-surface-variant': '#d4d4d8',
    primary: '#6d7bff',
    'primary-darken-1': '#5865f2',
    secondary: '#a1a1aa',
    accent: '#8b95ff',
    error: '#f4555a',
    info: '#60a5fa',
    success: '#34d399',
    warning: '#fbbf24',
    'on-background': '#fafafa',
    'on-surface': '#fafafa',
    'on-primary': '#ffffff'
  },
  variables: {
    'border-color': '#ffffff',
    'border-opacity': 0.08,
    'high-emphasis-opacity': 0.96,
    'medium-emphasis-opacity': 0.64,
    'disabled-opacity': 0.38,
    'hover-opacity': 0.05,
    'focus-opacity': 0.1,
    'activated-opacity': 0.1
  }
}

const apexLight = {
  dark: false,
  colors: {
    background: '#fafafa',
    surface: '#ffffff',
    'surface-bright': '#ffffff',
    'surface-light': '#f4f4f5',
    'surface-variant': '#e4e4e7',
    'on-surface-variant': '#3f3f46',
    primary: '#4f5bd5',
    'primary-darken-1': '#4350c4',
    secondary: '#52525b',
    accent: '#6d7bff',
    error: '#dc2626',
    info: '#2563eb',
    success: '#059669',
    warning: '#d97706',
    'on-background': '#09090b',
    'on-surface': '#09090b',
    'on-primary': '#ffffff'
  },
  variables: {
    'border-color': '#09090b',
    'border-opacity': 0.10,
    'high-emphasis-opacity': 0.96,
    'medium-emphasis-opacity': 0.64,
    'disabled-opacity': 0.38,
    'hover-opacity': 0.05,
    'focus-opacity': 0.1,
    'activated-opacity': 0.1
  }
}

const fieldDefaults = {
  variant: 'solo-filled',
  flat: true,
  density: 'comfortable',
  rounded: 'lg',
  color: 'primary',
  bgColor: 'surface-light',
  hideDetails: 'auto'
}

const initialScheme = resolve(readPref())
applyChrome(initialScheme)

const vuetify = createVuetify({
  theme: {
    defaultTheme: vuetifyName(initialScheme),
    themes: { apexDark, apexLight }
  },
  defaults: {
    global: { ripple: false },
    VBtn: { variant: 'flat', rounded: 'lg', class: 'text-none', style: 'letter-spacing: -0.01em' },
    VIconBtn: { rounded: 'lg' },
    VCard: { rounded: 'xl', elevation: 0, border: true, color: 'surface' },
    VSheet: { color: 'surface' },
    VDialog: { scrollable: true },
    VMenu: { offset: 6, transition: 'scale-transition' },
    VList: { density: 'compact', nav: true, bgColor: 'surface-bright', rounded: 'lg' },
    VListItem: { rounded: 'md' },
    VTextField: fieldDefaults,
    VTextarea: { ...fieldDefaults, autoGrow: true, rows: 2 },
    VSelect: { ...fieldDefaults, menuProps: { offset: 6 } },
    VAutocomplete: fieldDefaults,
    VCombobox: fieldDefaults,
    VSwitch: { color: 'primary', inset: true, density: 'compact', hideDetails: true },
    VCheckbox: { color: 'primary', density: 'compact', hideDetails: true },
    VCheckboxBtn: { color: 'primary', density: 'compact' },
    VSlider: { color: 'primary', trackSize: 4, thumbSize: 14, hideDetails: true, trackColor: 'surface-variant' },
    VChip: { size: 'small', variant: 'tonal', rounded: 'md', label: false },
    VTooltip: { location: 'bottom', openDelay: 350 },
    VProgressLinear: { color: 'primary', rounded: true },
    VProgressCircular: { color: 'primary', width: 2 },
    VTabs: { color: 'primary', density: 'compact', sliderColor: 'primary' },
    VBtnToggle: { variant: 'text', density: 'comfortable', rounded: 'lg', divided: false, mandatory: true },
    VSnackbar: { rounded: 'pill', color: 'surface-bright', elevation: 0, location: 'bottom center', timeout: 3000 },
    VAlert: { variant: 'tonal', rounded: 'lg', density: 'compact' },
    VDivider: { opacity: 0.08 },
    VAvatar: { rounded: 'lg' }
  }
})

const app = createApp(App)
app.use(createPinia())
app.use(vuetify)
app.mount('#app')
