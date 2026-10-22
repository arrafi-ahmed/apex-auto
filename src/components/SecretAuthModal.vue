<template>
  <v-dialog
    v-model="store.authModalOpen"
    max-width="440"
    persistent
    transition="dialog-bottom-transition"
  >
    <v-card class="glass-panel text-white rounded-xl pa-2" elevation="24">
      <v-card-item class="pb-2">
        <template #prepend>
          <v-avatar color="primary" variant="tonal" size="44">
            <v-icon icon="mdi-shield-key-outline" size="24"></v-icon>
          </v-avatar>
        </template>
        <v-card-title class="text-h6 font-weight-bold d-flex align-center justify-space-between">
          <span>Security Authorization</span>
          <v-chip size="x-small" color="blue" variant="outlined" class="text-caption font-mono">NODE-09</v-chip>
        </v-card-title>
        <v-card-subtitle class="text-caption text-medium-emphasis">
          Restricted access verification required
        </v-card-subtitle>
      </v-card-item>

      <v-card-text class="pt-4">
        <form @submit.prevent="handleUnlock">
          <v-text-field
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            label="Passphrase / Access Key"
            placeholder="Enter security key..."
            variant="outlined"
            density="comfortable"
            color="primary"
            bg-color="rgba(15, 23, 42, 0.6)"
            autofocus
            :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
            @click:append-inner="showPassword = !showPassword"
            class="mb-2 font-mono"
            :loading="loading"
            :disabled="loading"
          ></v-text-field>

          <div class="text-caption text-medium-emphasis d-flex align-center mt-2">
            <v-icon icon="mdi-alert-circle-outline" size="14" class="mr-1 text-warning"></v-icon>
            <span>Notice: Unauthorized attempts trigger permanent lockdown.</span>
          </div>

          <div class="d-flex justify-end gap-2 mt-6">
            <v-btn
              variant="text"
              color="grey-lighten-1"
              @click="store.authModalOpen = false"
              :disabled="loading"
              class="text-none"
            >
              Cancel
            </v-btn>
            <v-btn
              type="submit"
              color="primary"
              variant="flat"
              prepend-icon="mdi-lock-open-variant-outline"
              :loading="loading"
              class="text-none px-6 rounded-lg font-weight-bold"
            >
              Authenticate
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
