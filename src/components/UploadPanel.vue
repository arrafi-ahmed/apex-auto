<template>
  <transition name="panel">
    <section
      v-if="store.uploads.length"
      class="uploads"
      :class="{ 'is-raised': store.selectedCount > 0 }"
      aria-label="Uploads"
    >
      <header class="uploads-head">
        <div class="uploads-title">
          <v-icon :icon="busy ? 'mdi-tray-arrow-up' : failed ? 'mdi-alert-circle-outline' : 'mdi-check-circle-outline'" size="17"
                  :class="{ 'is-bad': !busy && failed, 'is-ok': !busy && !failed }"></v-icon>
          <span>{{ headline }}</span>
        </div>
        <div class="uploads-tools">
          <button v-if="failed && !busy" type="button" class="ax-btn is-sm is-ghost" @click="store.retryFailedUploads()">Retry failed</button>
          <button type="button" class="ax-icon-btn" :title="collapsed ? 'Expand' : 'Minimize'" :aria-expanded="!collapsed" @click.stop="collapsed = !collapsed">
            <v-icon :icon="collapsed ? 'mdi-chevron-up' : 'mdi-chevron-down'" size="18"></v-icon>
          </button>
          <button type="button" class="ax-icon-btn" :title="busy ? 'Cancel all uploads' : 'Close'" @click.stop="closePanel">
            <v-icon icon="mdi-close" size="17"></v-icon>
          </button>
        </div>
      </header>

      <div class="overall" :class="{ 'is-done': !busy }"><span :style="{ width: `${overall * 100}%` }"></span></div>

      <ul v-show="!collapsed" class="uploads-list">
        <li v-for="u in store.uploads" :key="u.id" class="item" :class="`is-${u.status}`">
          <span class="item-name text-truncate" :title="u.note || u.name">{{ u.name }}</span>
          <span class="item-state font-mono tabular">{{ stateLabel(u) }}</span>
          <button v-if="u.status === 'error'" type="button" class="ax-icon-btn mini" title="Retry" @click="store.retryUpload(u.id)"><v-icon icon="mdi-refresh" size="14"></v-icon></button>
          <button v-else-if="u.status === 'queued' || u.status === 'uploading'" type="button" class="ax-icon-btn mini" title="Cancel" @click="store.cancelUpload(u.id)"><v-icon icon="mdi-close" size="14"></v-icon></button>
          <span v-else class="mini-spacer"></span>
          <div v-if="u.status === 'uploading'" class="item-bar"><span :style="{ width: `${u.progress * 100}%` }"></span></div>
        </li>
      </ul>
    </section>
  </transition>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useVaultStore } from '../stores/vaultStore'

const store = useVaultStore()
const collapsed = ref(false)

const count = (status) => store.uploads.filter(u => u.status === status).length
const busy = computed(() => store.uploads.some(u => u.status === 'queued' || u.status === 'uploading'))
const failed = computed(() => count('error'))
const finished = computed(() => store.uploads.filter(u => ['done', 'skipped', 'error'].includes(u.status)).length)
const overall = computed(() => {
  const list = store.uploads
  if (!list.length) return 0
  return list.reduce((acc, u) => acc + (['done', 'skipped', 'error'].includes(u.status) ? 1 : u.progress), 0) / list.length
})

const headline = computed(() => {
  const total = store.uploads.length
  if (busy.value) return `Uploading ${Math.min(finished.value + 1, total)} of ${total}`
  const parts = []
  if (count('done')) parts.push(`${count('done')} uploaded`)
  if (count('skipped')) parts.push(`${count('skipped')} already there`)
  if (failed.value) parts.push(`${failed.value} failed`)
  return parts.join(' · ') || 'Done'
})

function stateLabel(u) {
  if (u.status === 'uploading') return u.progress >= 1 ? 'Processing' : `${Math.round(u.progress * 100)}%`
  if (u.status === 'queued') return u.note ? 'Retrying' : 'Queued'
  if (u.status === 'done') return '✓'
  if (u.status === 'skipped') return 'Duplicate'
  return 'Failed'
}

// While uploads are running the X cancels them; once finished it simply clears the panel
function closePanel() {
  if (busy.value) store.cancelAllUploads()
  else store.dismissUploads()
}
</script>

<style scoped>
.uploads {
  position: fixed;
  z-index: 2500;
  right: 20px;
  bottom: calc(20px + var(--ax-safe-bottom));
  width: 340px;
  max-width: calc(100vw - 24px);
  border-radius: 14px;
  overflow: hidden;
  background: rgb(var(--v-theme-surface-bright));
  border: 1px solid var(--ax-line-strong);
  box-shadow: var(--ax-shadow-lg);
  transition: bottom 0.24s var(--ax-ease);
}
.uploads.is-raised {
  bottom: calc(88px + var(--ax-safe-bottom));
}
.uploads-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 8px 10px 14px;
}
.uploads-title {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 13.5px;
  font-weight: 550;
}
.uploads-title .v-icon { color: var(--ax-accent); }
.uploads-title .is-ok { color: rgb(var(--v-theme-success)); }
.uploads-title .is-bad { color: var(--ax-danger); }
.uploads-tools { display: flex; align-items: center; gap: 2px; }
.overall { height: 2px; background: var(--ax-line); }
.overall span { display: block; height: 100%; background: var(--ax-accent); transition: width 0.2s linear; }
.overall.is-done span { background: rgb(var(--v-theme-success)); }
.uploads-list {
  margin: 0;
  padding: 4px 0;
  max-height: 220px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  list-style: none;
}
.item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 8px 8px 14px;
  font-size: 12.5px;
}
.item-name { flex: 1; color: var(--ax-text-2); }
.item-state { font-size: 12px; color: var(--ax-text-3); }
.item.is-uploading .item-state { color: var(--ax-accent); }
.item.is-done .item-state { color: rgb(var(--v-theme-success)); }
.item.is-error .item-state, .item.is-error .item-name { color: var(--ax-danger); }
.item-bar {
  position: absolute;
  left: 14px;
  right: 8px;
  bottom: 2px;
  height: 2px;
  border-radius: 2px;
  background: var(--ax-line);
}
.item-bar span { display: block; height: 100%; border-radius: 2px; background: var(--ax-accent); }
.mini { width: 28px; height: 28px; }
.mini-spacer { width: 28px; flex: none; }
.item.is-skipped .item-state { color: var(--ax-text-3); }
.item.is-skipped .item-name { color: var(--ax-text-3); }
.panel-enter-active, .panel-leave-active { transition: opacity 0.2s var(--ax-ease), transform 0.2s var(--ax-ease); }
.panel-enter-from, .panel-leave-to { opacity: 0; transform: translateY(10px); }

@media (pointer: coarse) {
  .item { padding: 9px 8px 9px 14px; }
}

@media (max-width: 600px) {
  .uploads {
    right: 12px;
    left: 12px;
    width: auto;
    max-width: none;
    bottom: calc(12px + var(--ax-safe-bottom));
  }
  .uploads.is-raised {
    bottom: calc(76px + var(--ax-safe-bottom));
  }
}
</style>
