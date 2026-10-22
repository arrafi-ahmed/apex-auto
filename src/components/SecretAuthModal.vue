<template>
  <v-dialog
    v-model="store.authModalOpen"
    max-width="380"
    persistent
    transition="dialog-transition"
  >
    <v-card class="glass-panel text-white rounded-2xl pa-4" elevation="24">
      <div class="d-flex align-center gap-3 mb-4">
        <v-avatar color="primary" variant="tonal" size="38" rounded="lg">
          <v-icon icon="mdi-shield-check-outline" size="20"></v-icon>
        </v-avatar>
        <div>
          <div class="text-subtitle-1 font-weight-bold">Client Portal</div>
          <div class="text-caption text-medium-emphasis">Sign in to manage logistics</div>
        </div>
      </div>

      <v-card-text class="pa-0">
        <form @submit.prevent="handleUnlock">
          <v-text-field
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            label="Password"
            placeholder="••••••••"
            variant="outlined"
            density="comfortable"
            color="primary"
            autofocus
            :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
            @click:append-inner="showPassword = !showPassword"
            class="mb-4"
            :loading="loading"
            :disabled="loading"
          ></v-text-field>

          <div class="d-flex justify-end gap-2">
            <v-btn
              variant="text"
              color="grey-lighten-1"
              @click="store.authModalOpen = false"
              :disabled="loading"
              class="text-none"
              size="small"
            >
              Cancel
            </v-btn>
            <v-btn
              type="submit"
              color="primary"
              variant="flat"
              :loading="loading"
              class="text-none px-5 font-weight-bold"
              size="small"
              rounded="lg"
            >
              Sign In
            </v-btn>
          </div>
        </form>
      </v-card-text>
    </v-card>
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
.font-mono {
  font-family: var(--font-mono) !important;
}
</style>
