<template>
  <div>
    <transition name="dock">
      <div v-if="store.selectedCount > 0" class="dock" role="toolbar" aria-label="Selection actions">
        <span class="dock-count"><b class="tabular">{{ store.selectedCount }}</b> selected</span>
        <span class="dock-sep"></span>
        <button class="dock-btn" title="Move to album" aria-label="Move" @click="showMoveModal = true"><v-icon icon="mdi-folder-move-outline"></v-icon><span class="dock-label">Move</span></button>
        <button class="dock-btn" title="Copy to album" aria-label="Copy" @click="showCopyModal = true"><v-icon icon="mdi-content-copy"></v-icon><span class="dock-label">Copy</span></button>
        <button class="dock-btn" title="Download .zip" aria-label="Download" @click="store.batchDownload"><v-icon icon="mdi-download-outline"></v-icon><span class="dock-label">Download</span></button>
        <button class="dock-btn is-danger" title="Delete permanently" aria-label="Delete" @click="store.batchDelete"><v-icon icon="mdi-delete-outline"></v-icon><span class="dock-label">Delete</span></button>
        <span class="dock-sep"></span>
        <button class="ax-icon-btn" title="Clear selection" aria-label="Clear selection" @click="store.clearSelection"><v-icon icon="mdi-close" size="17"></v-icon></button>
      </div>
    </transition>

    <!-- Move -->
    <v-dialog v-model="showMoveModal" max-width="440">
      <form class="ax-modal" @submit.prevent="targetAlbumId && handleBatchMove()">
        <div class="ax-modal-head">
          <div>
            <h2 class="ax-modal-title">Move {{ store.selectedCount }} {{ store.selectedCount === 1 ? 'item' : 'items' }}</h2>
            <p class="ax-modal-sub">Choose the album they should live in.</p>
          </div>
          <button type="button" class="ax-icon-btn" aria-label="Close" @click="showMoveModal = false"><v-icon icon="mdi-close" size="18"></v-icon></button>
        </div>
        <label class="ax-label" for="move-target">Destination</label>
        <select id="move-target" v-model="targetAlbumId" class="ax-input">
          <option :value="null" disabled>Select album…</option>
          <option v-for="a in availableAlbums" :key="a.id" :value="a.id">{{ a.title }}</option>
        </select>
        <div class="ax-modal-actions">
          <button type="button" class="ax-btn is-ghost" @click="showMoveModal = false">Cancel</button>
          <button type="submit" class="ax-btn is-primary" :disabled="!targetAlbumId">Move</button>
        </div>
      </form>
    </v-dialog>

    <!-- Copy -->
    <v-dialog v-model="showCopyModal" max-width="440">
      <form class="ax-modal" @submit.prevent="targetAlbumId && handleBatchCopy()">
        <div class="ax-modal-head">
          <div>
            <h2 class="ax-modal-title">Copy {{ store.selectedCount }} {{ store.selectedCount === 1 ? 'item' : 'items' }}</h2>
            <p class="ax-modal-sub">Duplicates are added to the album you choose.</p>
          </div>
          <button type="button" class="ax-icon-btn" aria-label="Close" @click="showCopyModal = false"><v-icon icon="mdi-close" size="18"></v-icon></button>
        </div>
        <label class="ax-label" for="copy-target">Destination</label>
        <select id="copy-target" v-model="targetAlbumId" class="ax-input">
          <option :value="null" disabled>Select album…</option>
          <option v-for="a in availableAlbums" :key="a.id" :value="a.id">{{ a.title }}</option>
        </select>
        <div class="ax-modal-actions">
          <button type="button" class="ax-btn is-ghost" @click="showCopyModal = false">Cancel</button>
          <button type="submit" class="ax-btn is-primary" :disabled="!targetAlbumId">Copy</button>
        </div>
      </form>
    </v-dialog>

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useVaultStore } from '../stores/vaultStore'

const store = useVaultStore()

const showMoveModal = ref(false)
const showCopyModal = ref(false)
const targetAlbumId = ref(null)

const availableAlbums = computed(() => {
  if (!store.activeAlbum) return store.albums
  return store.albums.filter(a => a.id !== store.activeAlbum.id)
})

async function handleBatchMove() {
  if (!targetAlbumId.value) return
  await store.batchMove(targetAlbumId.value)
  showMoveModal.value = false
  targetAlbumId.value = null
}

async function handleBatchCopy() {
  if (!targetAlbumId.value) return
  await store.batchCopy(targetAlbumId.value)
  showCopyModal.value = false
  targetAlbumId.value = null
}

</script>

<style scoped>
.dock {
  position: fixed;
  z-index: 999;
  left: 50%;
  bottom: calc(24px + var(--ax-safe-bottom));
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px;
  max-width: calc(100vw - 24px);
  border-radius: 14px;
  background: rgba(var(--v-theme-surface-bright), 0.92);
  backdrop-filter: blur(20px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
  border: 1px solid var(--ax-line-strong);
  box-shadow: var(--ax-shadow-lg);
}
.dock-count {
  padding: 0 10px 0 8px;
  font-size: 13px;
  color: var(--ax-text-2);
  white-space: nowrap;
}
.dock-count b {
  color: var(--ax-text);
  font-weight: 600;
}
.dock-sep {
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: var(--ax-line-strong);
  flex-shrink: 0;
}
.dock-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 34px;
  padding: 0 11px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--ax-text);
  font: 500 13px/1 var(--font-sans);
  cursor: pointer;
  transition: background-color var(--ax-fast), color var(--ax-fast);
  white-space: nowrap;
}
.dock-btn .v-icon {
  font-size: 16px;
  color: var(--ax-text-2);
  transition: color var(--ax-fast);
}
@media (hover: hover) {
  .dock-btn:hover {
    background: rgba(var(--v-theme-on-surface), 0.08);
  }
  .dock-btn:hover .v-icon {
    color: var(--ax-text);
  }
  .dock-btn.is-danger:hover {
    background: var(--ax-danger-soft);
    color: var(--ax-danger);
  }
  .dock-btn.is-danger:hover .v-icon {
    color: var(--ax-danger);
  }
}
.dock-enter-active,
.dock-leave-active {
  transition: opacity 0.22s var(--ax-ease), transform 0.22s var(--ax-ease);
}
.dock-enter-from,
.dock-leave-to {
  opacity: 0;
  transform: translate(-50%, 12px);
}

@media (max-width: 600px) {
  .dock {
    left: 12px;
    right: 12px;
    transform: none;
    max-width: none;
    justify-content: space-between;
    bottom: calc(12px + var(--ax-safe-bottom));
    padding: 4px;
    gap: 2px;
  }
  .dock-enter-from,
  .dock-leave-to {
    transform: translateY(12px);
  }
  .dock-count {
    padding: 0 6px 0 8px;
    font-size: 12.5px;
  }
  .dock-btn {
    width: 40px;
    height: 40px;
    padding: 0;
    gap: 0;
    flex: none;
  }
  .dock-btn .dock-label {
    display: none;
  }
  .dock-btn .v-icon {
    font-size: 19px;
  }
  .dock-sep {
    margin: 0 2px;
    height: 16px;
  }
}
</style>
