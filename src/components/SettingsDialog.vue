<template>
  <v-dialog v-model="store.settingsModalOpen" max-width="500">
    <v-card class="glass-panel pa-4 rounded-xl text-white">
      <v-card-title class="font-weight-bold d-flex align-center justify-space-between">
        <div class="d-flex align-center gap-2">
          <v-icon icon="mdi-cog-outline" color="primary"></v-icon>
          <span>Vault Preferences</span>
        </div>
        <v-btn icon="mdi-close" variant="text" size="small" @click="store.settingsModalOpen = false"></v-btn>
      </v-card-title>

      <v-card-text>
        <v-tabs v-model="activeTab" color="primary" density="compact" class="mb-4">
          <v-tab value="slideshow">Slideshow</v-tab>
          <v-tab value="security">Security &amp; Trigger</v-tab>
        </v-tabs>

        <v-window v-model="activeTab">
          <!-- Slideshow Config Tab -->
          <v-window-item value="slideshow">
            <div class="mb-4">
              <label class="text-caption font-weight-bold mb-1 d-block">Default Slide Rotation Speed: {{ form.slideshowInterval }} seconds</label>
              <v-slider
                v-model="form.slideshowInterval"
                :min="1"
                :max="30"
                :step="1"
                thumb-label
                color="primary"
                track-color="rgba(255,255,255,0.1)"
              ></v-slider>
            </div>

            <v-switch
              v-model="form.skipVideosInSlideshow"
              label="Skip Videos in Slideshow (Only rotate images)"
              color="primary"
              density="compact"
              class="mb-2"
            ></v-switch>

            <p class="text-caption text-medium-emphasis">
              When enabled, slideshow automatically bypasses video clips. When disabled, slideshow pauses until the video finishes playback before advancing.
            </p>
          </v-window-item>

          <!-- Security Tab -->
          <v-window-item value="security">
            <div class="mb-4">
              <label class="text-caption font-weight-bold mb-1 d-block">Secret Decoy Trigger Word</label>
              <v-text-field
                v-model="form.secretTriggerWord"
                placeholder="e.g. guarantee"
                variant="outlined"
                density="comfortable"
                hint="The word in the decoy car transport footer that reveals the login prompt"
                persistent-hint
                color="primary"
              ></v-text-field>
            </div>

            <div class="mb-4">
              <label class="text-caption font-weight-bold mb-1 d-block">Inactivity Auto-Lock Duration</label>
              <v-select
                v-model="form.autoLockMinutes"
                :items="[
                  { title: '1 minute (Maximum Security)', value: 1 },
                  { title: '3 minutes', value: 3 },
                  { title: '5 minutes (Recommended)', value: 5 },
                  { title: '10 minutes', value: 10 },
                  { title: '15 minutes', value: 15 },
                  { title: '30 minutes', value: 30 }
                ]"
                item-title="title"
                item-value="value"
                variant="outlined"
                density="comfortable"
                color="primary"
                hint="Automatically returns to decoy car transport page when idle"
                persistent-hint
              ></v-select>
            </div>

            <v-switch
              v-model="form.tabSwitchLock"
              label="Lock if browser tab is switched away (> 45s)"
              color="primary"
              density="compact"
              class="mb-3"
            ></v-switch>

            <div class="mb-4">
              <label class="text-caption font-weight-bold mb-1 d-block">Change Master Passphrase</label>
              <v-text-field
                v-model="form.newPassword"
                type="password"
                placeholder="Leave blank to keep current"
                variant="outlined"
                density="comfortable"
                color="primary"
              ></v-text-field>
            </div>

            <div class="pa-3 bg-surface-variant rounded-lg text-caption">
              <strong>Emergency Reset Note:</strong><br />
              If you or an intruder triggers the 503 lockout camouflage, access can be unlocked anytime via URL:
              <code class="d-block mt-1 font-mono text-primary">/?reset_vault_token=unlock123</code>
            </div>
          </v-window-item>
        </v-window>
      </v-card-text>

      <v-card-actions class="pt-2">
        <v-spacer></v-spacer>
        <v-btn variant="text" @click="store.settingsModalOpen = false">Cancel</v-btn>
        <v-btn color="primary" variant="flat" :loading="saving" @click="saveSettings">
          Save Settings
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useVaultStore } from '../stores/vaultStore'

const store = useVaultStore()
const activeTab = ref('slideshow')
const saving = ref(false)

const form = ref({
  slideshowInterval: 3,
  skipVideosInSlideshow: true,
  secretTriggerWord: 'guarantee',
  autoLockMinutes: 5,
  tabSwitchLock: true,
  newPassword: ''
})

onMounted(() => {
  form.value.slideshowInterval = store.slideshowInterval
  form.value.skipVideosInSlideshow = store.skipVideosInSlideshow
  form.value.secretTriggerWord = store.triggerWord
  form.value.autoLockMinutes = store.autoLockMinutes || 5
  form.value.tabSwitchLock = store.tabSwitchLock !== false
})

async function saveSettings() {
  saving.value = true
  try {
    const payload = {
      slideshowInterval: form.value.slideshowInterval,
      skipVideosInSlideshow: form.value.skipVideosInSlideshow,
      secretTriggerWord: form.value.secretTriggerWord,
      autoLockMinutes: form.value.autoLockMinutes
    }
    if (form.value.newPassword) {
      payload.newPassword = form.value.newPassword
    }

    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (res.ok) {
      store.slideshowInterval = form.value.slideshowInterval
      store.skipVideosInSlideshow = form.value.skipVideosInSlideshow
      store.triggerWord = form.value.secretTriggerWord
      store.autoLockMinutes = form.value.autoLockMinutes
      store.tabSwitchLock = form.value.tabSwitchLock
      store.showNotice('Settings saved successfully', 'success')
      store.settingsModalOpen = false
      form.value.newPassword = ''
    }
  } catch (err) {
    store.showNotice('Failed to save settings', 'error')
  } finally {
    saving.value = false
  }
}
</script>
