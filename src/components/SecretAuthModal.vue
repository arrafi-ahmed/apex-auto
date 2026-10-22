<template>
  <v-dialog v-model="store.authModalOpen" max-width="380" persistent>
    <div class="ax-modal portal" role="dialog" aria-label="Client portal sign in">
      <div class="ax-modal-head">
        <div>
          <h2 class="ax-modal-title">Client portal</h2>
          <p class="ax-modal-sub">Enter your passphrase to continue.</p>
        </div>
        <button type="button" class="ax-icon-btn" aria-label="Close" :disabled="loading" @click="store.authModalOpen = false">
          <v-icon icon="mdi-close" size="18"></v-icon>
        </button>
      </div>
      <form @submit.prevent="handleUnlock">
        <label class="ax-label" for="portal-pass">Passphrase</label>
        <div class="reveal">
          <input
            id="portal-pass"
            v-model="password"
            class="ax-input"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            autofocus
            :disabled="loading"
          />
          <button type="button" class="ax-icon-btn" :title="showPassword ? 'Hide' : 'Show'" @click="showPassword = !showPassword">
            <v-icon :icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'" size="17"></v-icon>
          </button>
        </div>
        <button type="submit" class="ax-btn is-primary submit" :disabled="loading || !password">{{ loading ? 'Signing in…' : 'Sign in' }}</button>
        <button type="button" class="ax-btn is-ghost submit" :disabled="loading" @click="store.authModalOpen = false">Cancel</button>
      </form>
    </div>
  </v-dialog>
</template>

<script setup>
import { ref } from 'vue'
import { useVaultStore } from '../stores/vaultStore'

const store = useVaultStore()
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)

async function handleUnlock() {
  if (!password.value) return
  loading.value = true
  try {
    const success = await store.login(password.value)
    if (!success) {
      // Intentionally do nothing; store.isLockedOut will be true and the Camouflage503 screen renders!
    }
  } finally {
    loading.value = false
    password.value = ''
  }
}
</script>

<style scoped>
.reveal { display: flex; align-items: center; gap: 6px; }
.submit { width: 100%; height: 38px; margin-top: 12px; }
.submit + .submit { margin-top: 4px; }
</style>
