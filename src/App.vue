<template>
  <v-app class="app-root">
    <!-- View 1: Hard Lockdown Camouflage (503 Service Temporarily Unavailable) -->
    <Camouflage503 v-if="store.isLockedOut" />

    <!-- View 2: Unlocked Private Media Vault -->
    <PrivateGallery v-else-if="store.isAuthenticated" />

    <!-- View 3: Public news article -->
    <NewsArticle v-else-if="route.name === 'news'" />

    <!-- View 4: Public Decoy Car Transport Landing Page -->
    <DecoyLandingPage v-else />

    <!-- Hidden Authentication Dialog (when secret word is triggered) -->
    <SecretAuthModal v-if="!store.isLockedOut && !store.isAuthenticated" />

    <!-- Upload queue (bottom-right) -->
    <UploadPanel v-if="store.isAuthenticated" />

    <!-- Global toast (optional action button, e.g. Undo) -->
    <transition name="toast">
      <div v-if="toastVisible" class="toast" :class="`is-${store.noticeColor}`" role="status" aria-live="polite">
        <v-icon
          :icon="store.noticeColor === 'success' ? 'mdi-check-circle-outline' : store.noticeColor === 'error' ? 'mdi-alert-circle-outline' : 'mdi-information-outline'"
          size="17"
        ></v-icon>
        <span class="toast-msg">{{ store.noticeMessage }}</span>
        <button v-if="store.noticeAction" class="toast-action" @click="runToastAction">{{ store.noticeAction.label }}</button>
        <button class="toast-close" aria-label="Dismiss" @click="toastVisible = false"><v-icon icon="mdi-close" size="15"></v-icon></button>
      </div>
    </transition>
  </v-app>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useVaultStore } from './stores/vaultStore'
import DecoyLandingPage from './components/DecoyLandingPage.vue'
import SecretAuthModal from './components/SecretAuthModal.vue'
import PrivateGallery from './components/PrivateGallery.vue'
import Camouflage503 from './components/Camouflage503.vue'
import UploadPanel from './components/UploadPanel.vue'
import NewsArticle from './components/NewsArticle.vue'
import { route, onRoutePop } from './router'

const store = useVaultStore()
const toastVisible = ref(false)
let toastTimer = null

watch(() => store.noticeSeq, () => {
  if (!store.noticeMessage) { toastVisible.value = false; return }
  toastVisible.value = true
  clearTimeout(toastTimer)
  // Toasts with an action (Undo) stay long enough to be acted on
  toastTimer = setTimeout(() => { toastVisible.value = false }, store.noticeAction ? 8000 : 3200)
})

function runToastAction() {
  const action = store.noticeAction
  toastVisible.value = false
  action?.run()
}

let lastEscTime = 0
let inactivityTimerInterval = null
let tabHiddenTimestamp = 0

// True while anything that Escape should dismiss first is open
function escapeHasOtherJob() {
  return store.viewerOpen
    || store.selectedCount > 0
    || store.settingsModalOpen
    || !!document.querySelector('.v-overlay--active')
}

// Capture phase: runs before the viewer/dialogs handle (and close) themselves, so a
// double-Esc used to close a viewer or dialog never counts as the panic gesture.
function handleGlobalKeydown(e) {
  store.registerActivity()
  if (e.key !== 'Escape' || e.repeat) return
  if (escapeHasOtherJob()) {
    lastEscTime = 0
    return
  }
  if (store.isAuthenticated) {
    const now = Date.now()
    if (now - lastEscTime < 450) store.panicLock()
    lastEscTime = now
  }
}

function onPopState() {
  store.handlePopState()
  onRoutePop()
}

function handleUserActivity() {
  store.registerActivity()
}

function handleVisibilityChange() {
  if (!store.isAuthenticated) return
  if (document.visibilityState === 'hidden') {
    tabHiddenTimestamp = Date.now()
  } else if (document.visibilityState === 'visible') {
    // If tab was hidden for more than 45 seconds and tabSwitchLock is active, auto-lock
    if (store.tabSwitchLock && tabHiddenTimestamp > 0) {
      const awaySeconds = (Date.now() - tabHiddenTimestamp) / 1000
      if (awaySeconds > 45) {
        store.panicLock()
        return
      }
    }
    store.registerActivity()
  }
}

function handleBrowserClose() {
  if (store.isAuthenticated) {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/auth/logout')
    }
  }
}

const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']

onMounted(() => {
  store.checkStatus()
  window.addEventListener('keydown', handleGlobalKeydown, true)
  window.addEventListener('popstate', onPopState)

  // Inactivity tracking
  activityEvents.forEach(evt => {
    window.addEventListener(evt, handleUserActivity, { passive: true })
  })

  // Tab switch & browser close handlers
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('beforeunload', handleBrowserClose)
  window.addEventListener('pagehide', handleBrowserClose)

  // 1-second countdown ticker
  inactivityTimerInterval = setInterval(() => {
    store.updateInactivityCountdown()
  }, 1000)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown, true)
  window.removeEventListener('popstate', onPopState)
  activityEvents.forEach(evt => {
    window.removeEventListener(evt, handleUserActivity)
  })
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('beforeunload', handleBrowserClose)
  window.removeEventListener('pagehide', handleBrowserClose)
  if (inactivityTimerInterval) {
    clearInterval(inactivityTimerInterval)
  }
})
</script>

<style>
.app-root {
  background-color: var(--ax-bg) !important;
  color: var(--ax-text);
}

.toast {
  position: fixed;
  z-index: 100000;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: calc(100vw - 24px);
  padding: 8px 8px 8px 14px;
  border-radius: 12px;
  background: rgb(var(--v-theme-surface-bright));
  border: 1px solid var(--ax-line-strong);
  box-shadow: var(--ax-shadow-lg);
  font-size: 13.5px;
  color: var(--ax-text);
}
.toast .v-icon { color: var(--ax-text-2); }
.toast.is-success .v-icon { color: rgb(var(--v-theme-success)); }
.toast.is-error .v-icon { color: var(--ax-danger); }
.toast-msg { padding-right: 4px; }
.toast-action {
  height: 28px;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: var(--ax-accent-soft);
  color: var(--ax-accent);
  font: 600 13px/1 var(--font-sans);
  cursor: pointer;
}
.toast-action:hover { background: var(--ax-accent-ring); color: #fff; }
.toast-close {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--ax-text-3);
  cursor: pointer;
}
.toast-close:hover { background: rgba(var(--v-theme-on-surface), 0.08); color: var(--ax-text); }
.toast-enter-active, .toast-leave-active { transition: opacity 0.22s var(--ax-ease), transform 0.22s var(--ax-ease); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 10px); }
</style>
