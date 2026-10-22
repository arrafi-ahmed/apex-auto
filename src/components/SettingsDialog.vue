<template>
  <v-dialog v-model="store.settingsModalOpen" max-width="500">
    <form class="ax-modal" @submit.prevent="saveSettings">
      <div class="ax-modal-head">
        <div>
          <h2 class="ax-modal-title">Preferences</h2>
          <p class="ax-modal-sub">Playback and access controls</p>
        </div>
        <button type="button" class="ax-icon-btn" @click="store.settingsModalOpen = false"><v-icon icon="mdi-close" size="18"></v-icon></button>
      </div>

      <div class="ax-tabs" role="tablist">
        <button type="button" :class="{ 'is-active': activeTab === 'slideshow' }" @click="activeTab = 'slideshow'">Slideshow</button>
        <button type="button" :class="{ 'is-active': activeTab === 'security' }" @click="activeTab = 'security'">Security</button>
      </div>

      <div v-show="activeTab === 'slideshow'" class="pane">
        <div>
          <div class="row"><label class="ax-label mb-0" for="interval">Slide duration</label><span class="val font-mono tabular">{{ form.slideshowInterval }}s</span></div>
          <input id="interval" v-model.number="form.slideshowInterval" class="ax-range" :style="{ '--p': `${((form.slideshowInterval - 1) / 29) * 100}%` }" type="range" min="1" max="30" step="1" />
        </div>
        <label class="ax-switch">
          <span><b>Skip videos</b><small>Slideshow rotates through photos only.</small></span>
          <input v-model="form.skipVideosInSlideshow" type="checkbox" /><span class="track"></span>
        </label>
      </div>

      <div v-show="activeTab === 'security'" class="pane">
        <div>
          <label class="ax-label" for="trigger">Gateway keyword</label>
          <div class="reveal">
            <input id="trigger" v-model="form.secretTriggerWord" class="ax-input" :type="showTriggerWord ? 'text' : 'password'" autocomplete="off" placeholder="••••••••" />
            <button type="button" class="ax-icon-btn" :title="showTriggerWord ? 'Hide' : 'Show'" @click="showTriggerWord = !showTriggerWord">
              <v-icon :icon="showTriggerWord ? 'mdi-eye-off-outline' : 'mdi-eye-outline'" size="17"></v-icon>
            </button>
          </div>
          <p class="ax-hint">The word on the public page that opens sign-in.</p>
        </div>
        <div>
          <label class="ax-label" for="autolock">Auto-lock after</label>
          <select id="autolock" v-model.number="form.autoLockMinutes" class="ax-input">
            <option v-for="m in lockOptions" :key="m" :value="m">{{ m }} {{ m === 1 ? 'minute' : 'minutes' }}</option>
          </select>
          <p class="ax-hint">Returns to the public page when idle.</p>
        </div>
        <label class="ax-switch">
          <span><b>Lock on tab switch</b><small>Lock if this tab stays hidden for more than 45 seconds.</small></span>
          <input v-model="form.tabSwitchLock" type="checkbox" /><span class="track"></span>
        </label>
        <div>
          <label class="ax-label" for="newpass">New passphrase</label>
          <input id="newpass" v-model="form.newPassword" class="ax-input" type="password" autocomplete="new-password" placeholder="Leave blank to keep current" />
        </div>
      </div>

      <div class="ax-modal-actions">
        <button type="button" class="ax-btn is-ghost" @click="store.settingsModalOpen = false">Cancel</button>
        <button type="submit" class="ax-btn is-primary" :disabled="saving">{{ saving ? 'Saving…' : 'Save changes' }}</button>
      </div>
    </form>
  </v-dialog>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useVaultStore } from '../stores/vaultStore'

const store = useVaultStore()
const activeTab = ref('slideshow')
const saving = ref(false)
const showTriggerWord = ref(false)
const lockOptions = [1, 3, 5, 10, 15, 30]

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

<style scoped>
.pane { display: flex; flex-direction: column; gap: 20px; }
.row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.val { font-size: 12.5px; color: var(--ax-accent); }
.reveal { display: flex; align-items: center; gap: 6px; }
</style>
