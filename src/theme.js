import { ref, onMounted, onUnmounted } from 'vue'
import { useTheme } from 'vuetify'

export const THEME_KEY = 'ax-theme'

export function readPref() {
  try {
    return localStorage.getItem(THEME_KEY) || 'system'
  } catch {
    return 'system'
  }
}

export function resolve(pref) {
  if (pref === 'light' || pref === 'dark') return pref
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }
  return 'dark'
}

export const vuetifyName = (scheme) => (scheme === 'light' ? 'apexLight' : 'apexDark')

export function applyChrome(scheme) {
  if (typeof document === 'undefined') return
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', scheme === 'light' ? '#fafafa' : '#09090b')
  }
  document.documentElement.style.colorScheme = scheme
}

export function useAppTheme() {
  const theme = useTheme()
  const pref = ref(readPref())
  const effective = ref(resolve(pref.value))

  function applyTheme(targetPref) {
    pref.value = targetPref
    try {
      if (targetPref === 'system') {
        localStorage.removeItem(THEME_KEY)
      } else {
        localStorage.setItem(THEME_KEY, targetPref)
      }
    } catch {}

    const resolved = resolve(targetPref)
    effective.value = resolved
    const name = vuetifyName(resolved)
    if (theme.change) {
      theme.change(name)
    } else if (theme.global?.name) {
      theme.global.name.value = name
    }
    applyChrome(resolved)
  }

  function onSystemChange() {
    if (pref.value === 'system') {
      const resolved = resolve('system')
      effective.value = resolved
      const name = vuetifyName(resolved)
      if (theme.change) {
        theme.change(name)
      } else if (theme.global?.name) {
        theme.global.name.value = name
      }
      applyChrome(resolved)
    }
  }

  function onStorage(e) {
    if (e.key === THEME_KEY) {
      pref.value = readPref()
      const resolved = resolve(pref.value)
      effective.value = resolved
      const name = vuetifyName(resolved)
      if (theme.change) {
        theme.change(name)
      } else if (theme.global?.name) {
        theme.global.name.value = name
      }
      applyChrome(resolved)
    }
  }

  let mq = null
  onMounted(() => {
    // Initial sync
    const resolved = resolve(pref.value)
    effective.value = resolved
    const name = vuetifyName(resolved)
    if (theme.change) {
      theme.change(name)
    } else if (theme.global?.name) {
      theme.global.name.value = name
    }
    applyChrome(resolved)

    if (typeof window !== 'undefined' && window.matchMedia) {
      mq = window.matchMedia('(prefers-color-scheme: light)')
      mq.addEventListener?.('change', onSystemChange)
    }
    window.addEventListener('storage', onStorage)
  })

  onUnmounted(() => {
    mq?.removeEventListener?.('change', onSystemChange)
    window.removeEventListener('storage', onStorage)
  })

  return {
    pref,
    effective,
    setTheme: applyTheme
  }
}
