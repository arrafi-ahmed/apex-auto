<template>
  <v-dialog v-model="store.authModalOpen" max-width="380" persistent>
    <div class="ax-modal otr-lookup" role="dialog" aria-label="Regional OTR lookup">
      <div class="ax-modal-head">
        <div>
          <h2 class="ax-modal-title">Regional OTR lookup</h2>
          <p class="ax-modal-sub">Enter a postal or dealer code to check indicative local pricing.</p>
        </div>
        <button type="button" class="ax-icon-btn" aria-label="Close" :disabled="loading" @click="closeModal">
          <v-icon icon="mdi-close" size="18"></v-icon>
        </button>
      </div>
      <form @submit.prevent="handleUnlock">
        <label class="ax-label" for="otr-region-code">Postal / dealer code</label>
        <input
          id="otr-region-code"
          v-model="password"
          class="ax-input masked-code"
          :class="{ 'has-error': !!errorMessage }"
          type="text"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          placeholder="e.g. 12190"
          autofocus
          :disabled="loading"
          @input="errorMessage = ''"
        />
        <div v-if="errorMessage" class="auth-error-msg" role="alert">
          <v-icon icon="mdi-alert-circle-outline" size="14"></v-icon>
          <span>{{ errorMessage }}</span>
        </div>
        <button type="submit" class="ax-btn is-primary submit" :disabled="loading || !password">{{ loading ? 'Checking…' : 'Check pricing' }}</button>
        <button type="button" class="ax-btn is-ghost submit" :disabled="loading" @click="closeModal">Close</button>
      </form>
    </div>
  </v-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useVaultStore } from '../stores/vaultStore'

const store = useVaultStore()
const password = ref('')
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
    if (!res.success && !res.lockedOut) {
      errorMessage.value = 'No regional listing matched that code.'
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
.masked-code:not(:placeholder-shown) {
  -webkit-text-security: disc;
}
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
