<template>
  <div>
    <!-- Floating Action Bar -->
    <v-fade-transition>
      <div v-if="store.selectedCount > 0" class="floating-batch-bar d-flex align-center gap-3">
        <v-chip color="primary" variant="flat" size="small" class="font-weight-medium">
          {{ store.selectedCount }} selected
        </v-chip>

        <v-divider vertical class="mx-1 my-2 opacity-20"></v-divider>

        <v-btn
          size="small"
          variant="tonal"
          color="white"
          prepend-icon="mdi-folder-move-outline"
          class="text-none font-weight-medium"
          @click="showMoveModal = true"
        >
          Move
        </v-btn>

        <v-btn
          size="small"
          variant="tonal"
          color="white"
          prepend-icon="mdi-content-copy"
          class="text-none font-weight-medium"
          @click="showCopyModal = true"
        >
          Copy
        </v-btn>

        <v-btn
          size="small"
          variant="tonal"
          color="success"
          prepend-icon="mdi-download"
          class="text-none font-weight-medium"
          @click="store.batchDownload"
        >
          Download (.zip)
        </v-btn>

        <v-btn
          size="small"
          variant="tonal"
          color="error"
          prepend-icon="mdi-delete-outline"
          class="text-none font-weight-medium"
          @click="showDeleteModal = true"
        >
          Delete
        </v-btn>

        <v-btn
          size="small"
          icon="mdi-close"
          variant="text"
          color="grey-lighten-1"
          class="ml-1"
          @click="store.clearSelection"
          title="Clear Selection"
        ></v-btn>
      </div>
    </v-fade-transition>

    <!-- Batch Move Dialog -->
    <v-dialog v-model="showMoveModal" max-width="440">
      <v-card class="glass-panel pa-4 rounded-xl">
        <v-card-title class="font-weight-bold d-flex align-center gap-2">
          <v-icon icon="mdi-folder-move-outline" color="primary"></v-icon>
          Move {{ store.selectedCount }} items to Album
        </v-card-title>
        <v-card-text>
          <p class="text-caption text-medium-emphasis mb-3">
            Select the destination album where the selected media will be relocated:
          </p>
          <v-select
            v-model="targetAlbumId"
            :items="availableAlbums"
            item-title="title"
            item-value="id"
            label="Destination Album"
            variant="outlined"
            density="comfortable"
            color="primary"
          ></v-select>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="showMoveModal = false">Cancel</v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :disabled="!targetAlbumId"
            @click="handleBatchMove"
          >
            Confirm Move
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Batch Copy Dialog -->
    <v-dialog v-model="showCopyModal" max-width="440">
      <v-card class="glass-panel pa-4 rounded-xl">
        <v-card-title class="font-weight-bold d-flex align-center gap-2">
          <v-icon icon="mdi-content-copy" color="info"></v-icon>
          Copy {{ store.selectedCount }} items to Album
        </v-card-title>
        <v-card-text>
          <p class="text-caption text-medium-emphasis mb-3">
            Select the album to duplicate the selected media into:
          </p>
          <v-select
            v-model="targetAlbumId"
            :items="availableAlbums"
            item-title="title"
            item-value="id"
            label="Destination Album"
            variant="outlined"
            density="comfortable"
            color="primary"
          ></v-select>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="showCopyModal = false">Cancel</v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :disabled="!targetAlbumId"
            @click="handleBatchCopy"
          >
            Confirm Copy
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Batch Delete Dialog -->
    <v-dialog v-model="showDeleteModal" max-width="440">
      <v-card class="glass-panel pa-4 rounded-xl border border-red">
        <v-card-title class="font-weight-bold d-flex align-center gap-2 text-error">
          <v-icon icon="mdi-alert-octagon-outline" color="error"></v-icon>
          Confirm Permanent Deletion
        </v-card-title>
        <v-card-text>
          Are you sure you want to permanently delete <strong>{{ store.selectedCount }} items</strong>?
          This action will immediately wipe the files from the disk and cannot be undone.
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="showDeleteModal = false">Cancel</v-btn>
          <v-btn color="error" variant="flat" @click="handleBatchDelete">
            Delete Permanently
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useVaultStore } from '../stores/vaultStore'

const store = useVaultStore()

const showMoveModal = ref(false)
const showCopyModal = ref(false)
const showDeleteModal = ref(false)
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

async function handleBatchDelete() {
  await store.batchDelete()
  showDeleteModal.value = false
}
</script>
