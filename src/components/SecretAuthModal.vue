<template>
  <v-dialog v-model="store.authModalOpen" max-width="380" persistent>
    <div class="ax-modal portal" role="dialog" aria-label="Client portal sign in">
      <div class="ax-modal-head">
        <div>
          <h2 class="ax-modal-title">Client portal</h2>
          <p class="ax-modal-sub">Enter your passphrase to continue.</p>
        </div>
        <button type="button" class="ax-icon-btn" aria-label="Close" :disabled="loading" @click="closeModal">
          <v-icon icon="mdi-close" size="18"></v-icon>
        </button>
      </div>
      <form @submit.prevent="handleUnlock">
        <label class="ax-label" for="portal-pass">Passphrase</label>
        <div class="ax-input-wrap">
          <input
            id="portal-pass"
            v-model="password"
            class="ax-input"
            :class="{ 'has-error': !!errorMessage }"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            autofocus
            :disabled="loading"
            @input="errorMessage = ''"
          />
          <button type="button" class="ax-icon-btn" :title="showPassword ? 'Hide' : 'Show'" :aria-label="showPassword ? 'Hide password' : 'Show password'" @click="showPassword = !showPassword">
            <v-icon :icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'" size="17"></v-icon>
          </button>
        </div>
        <div v-if="errorMessage" class="auth-error-msg" role="alert">
          <v-icon icon="mdi-alert-circle-outline" size="14"></v-icon>
          <span>{{ errorMessage }}</span>
        </div>
        <button type="submit" class="ax-btn is-primary submit" :disabled="loading || !password">{{ loading ? 'Signing in…' : 'Sign in' }}</button>
        <button type="button" class="ax-btn is-ghost submit" :disabled="loading" @click="closeModal">Cancel</button>
      </form>
    </div>
  </v-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useVaultStore } from '../stores/vaultStore'

const store = useVaultStore()
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const errorMessage = ref('')

function closeModal() {
  store.authModalOpen = false
  password.value = ''
  errorMessage.value = ''
}

watch(() => store.authModalOpen, (isOpen) => {
  if (!isOpen) {
    password.value = ''
    errorMessage.value = ''
  }
})

async function handleUnlock() {
  if (!password.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    const res = await store.login(password.value)
    if (!res.success) {
      if (!res.lockedOut) {
        const remaining = res.remainingAttempts
        if (typeof remaining === 'number') {
          errorMessage.value = `Incorrect passphrase. ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining.`
        } else {
          errorMessage.value = res.error || 'Incorrect passphrase.'
        }
      }
    }
  } finally {
    loading.value = false
    password.value = ''
  }
}
</script>

<style scoped>
.submit { width: 100%; height: 40px; margin-top: 12px; }
.submit + .submit { margin-top: 6px; }
.has-error {
  border-color: var(--ax-danger) !important;
  box-shadow: 0 0 0 2px var(--ax-danger-soft) !important;
}
.auth-error-msg {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 12.5px;
  color: var(--ax-danger);
}
</style>
