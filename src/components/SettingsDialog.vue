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
        <button type="button" role="tab" :aria-selected="activeTab === 'appearance'" :class="{ 'is-active': activeTab === 'appearance' }" @click="activeTab = 'appearance'">Appearance</button>
        <button type="button" role="tab" :aria-selected="activeTab === 'slideshow'" :class="{ 'is-active': activeTab === 'slideshow' }" @click="activeTab = 'slideshow'">Slideshow</button>
        <button type="button" role="tab" :aria-selected="activeTab === 'security'" :class="{ 'is-active': activeTab === 'security' }" @click="activeTab = 'security'">Security</button>
      </div>

      <div v-show="activeTab === 'appearance'" class="pane">
        <div>
          <label class="ax-label">Theme</label>
          <div class="ax-seg ax-seg-fill" role="radiogroup" aria-label="Theme selection">
            <button
              type="button"
              role="radio"
              :aria-checked="pref === 'system'"
              :class="{ 'is-active': pref === 'system' }"
              @click="setTheme('system')"
            >
              <v-icon icon="mdi-laptop" size="16"></v-icon>
              <span>System ({{ effective === 'light' ? 'Light' : 'Dark' }})</span>
            </button>
            <button
              type="button"
              role="radio"
              :aria-checked="pref === 'light'"
              :class="{ 'is-active': pref === 'light' }"
              @click="setTheme('light')"
            >
              <v-icon icon="mdi-white-balance-sunny" size="16"></v-icon>
              <span>Light</span>
            </button>
            <button
              type="button"
              role="radio"
              :aria-checked="pref === 'dark'"
              :class="{ 'is-active': pref === 'dark' }"
              @click="setTheme('dark')"
            >
              <v-icon icon="mdi-weather-night" size="16"></v-icon>
              <span>Dark</span>
            </button>
          </div>
          <p class="ax-hint">Adjusts the UI color scheme. The media viewer always stays in darkroom mode.</p>
        </div>
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
          <div class="ax-input-wrap">
            <input id="trigger" v-model="form.secretTriggerWord" class="ax-input" :type="showTriggerWord ? 'text' : 'password'" autocomplete="off" placeholder="••••••••" />
            <button type="button" class="ax-icon-btn" :title="showTriggerWord ? 'Hide' : 'Show'" :aria-label="showTriggerWord ? 'Hide gateway keyword' : 'Show gateway keyword'" @click="showTriggerWord = !showTriggerWord">
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
          <input
            id="newpass"
            v-model="form.newPassword"
            class="ax-input"
            :class="{ 'has-error': !!passError }"
            type="password"
            autocomplete="new-password"
            placeholder="Leave blank to keep current"
            @input="passError = ''"
          />
          <div v-if="passError" class="auth-error-msg" role="alert">
            <v-icon icon="mdi-alert-circle-outline" size="14"></v-icon>
            <span>{{ passError }}</span>
          </div>
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
import { ref, watch } from 'vue'
import { useVaultStore } from '../stores/vaultStore'
import { useAppTheme } from '../theme'

const store = useVaultStore()
const { pref, effective, setTheme } = useAppTheme()
const activeTab = ref('appearance')
const saving = ref(false)
const showTriggerWord = ref(false)
const passError = ref('')
const lockOptions = [1, 3, 5, 10, 15, 30]

const form = ref({
  slideshowInterval: 3,
  skipVideosInSlideshow: true,
  secretTriggerWord: 'guarantee',
  autoLockMinutes: 15,
  tabSwitchLock: true,
  newPassword: ''
})

function syncForm() {
  Object.assign(form.value, {
    slideshowInterval: store.slideshowInterval,
    skipVideosInSlideshow: store.skipVideosInSlideshow,
    secretTriggerWord: store.triggerWord,
    autoLockMinutes: store.autoLockMinutes || 15,
    tabSwitchLock: store.tabSwitchLock !== false,
    newPassword: ''
  })
  passError.value = ''
}

watch(() => store.settingsModalOpen, (open) => {
  if (open) syncForm()
}, { immediate: true })

async function saveSettings() {
  if (form.value.newPassword && form.value.newPassword.length < 4) {
    passError.value = 'Use at least 4 characters.'
    activeTab.value = 'security'
    return
  }

  saving.value = true
  passError.value = ''
  try {
    const payload = {
      slideshowInterval: form.value.slideshowInterval,
      skipVideosInSlideshow: form.value.skipVideosInSlideshow,
      secretTriggerWord: form.value.secretTriggerWord,
      autoLockMinutes: form.value.autoLockMinutes,
      tabSwitchLock: form.value.tabSwitchLock
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
    } else {
      store.showNotice('Could not save settings', 'error')
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
