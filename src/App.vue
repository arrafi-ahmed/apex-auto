<template>
  <v-app class="app-root">
    <!-- View 1: Hard Lockdown Camouflage (503 Service Temporarily Unavailable) -->
    <Camouflage503 v-if="store.isLockedOut" />

    <!-- View 2: Unlocked Private Media Vault -->
    <PrivateGallery v-else-if="store.isAuthenticated" />

    <!-- View 3: Public Decoy Car Transport Landing Page -->
    <DecoyLandingPage v-else />

    <!-- Hidden Authentication Dialog (when secret word is triggered) -->
    <SecretAuthModal v-if="!store.isLockedOut && !store.isAuthenticated" />

    <!-- Global Floating Notifications -->
    <v-snackbar
      v-model="showSnackbar"
      :color="store.noticeColor"
      timeout="3000"
      location="top right"
      rounded="pill"
    >
      {{ store.noticeMessage }}
      <template #actions>
        <v-btn variant="text" size="small" icon="mdi-close" @click="showSnackbar = false"></v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useVaultStore } from './stores/vaultStore'
import DecoyLandingPage from './components/DecoyLandingPage.vue'
import SecretAuthModal from './components/SecretAuthModal.vue'
import PrivateGallery from './components/PrivateGallery.vue'
import Camouflage503 from './components/Camouflage503.vue'

const store = useVaultStore()
const showSnackbar = ref(false)

watch(() => store.noticeMessage, (msg) => {
  if (msg) showSnackbar.value = true
})

let lastEscTime = 0
let inactivityTimerInterval = null
let tabHiddenTimestamp = 0

function handleGlobalKeydown(e) {
  store.registerActivity()
  // Global Panic Button: Double ESC press or ESC while authenticated locks immediately
  if (e.key === 'Escape') {
    const now = Date.now()
    if (store.isAuthenticated) {
      if (now - lastEscTime < 450) {
        store.panicLock()
      }
      lastEscTime = now
    }
  }
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
  window.addEventListener('keydown', handleGlobalKeydown)

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
  window.removeEventListener('keydown', handleGlobalKeydown)
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
  background-color: #05070d !important;
  color: #f1f5f9;
}
</style>
