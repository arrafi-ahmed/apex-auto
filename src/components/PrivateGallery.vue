<template>
  <div
    class="private-gallery-root"
    @dragenter.prevent="isDragging = true"
    @dragover.prevent
  >
    <!-- Top Vault App Bar -->
    <!-- Top Minimal App Bar -->
    <v-app-bar flat class="glass-nav px-4" height="60">
      <div class="d-flex align-center gap-3">
        <v-icon icon="mdi-view-gallery-outline" size="22" color="primary"></v-icon>
        <div>
          <div class="text-subtitle-1 font-weight-bold">
            <span v-if="!store.activeAlbum">Gallery</span>
            <span v-else class="cursor-pointer" @click="store.activeAlbum = null">
              <span class="text-medium-emphasis">Albums</span>
              <span class="mx-2 text-disabled">/</span>
              <span>{{ store.activeAlbum.title }}</span>
            </span>
          </div>
        </div>
      </div>

      <v-spacer></v-spacer>

      <!-- Action Buttons -->
      <div class="d-flex align-center gap-2">
        <!-- New Album Button (when in albums view) -->
        <v-btn
          v-if="!store.activeAlbum"
          color="primary"
          variant="flat"
          size="small"
          prepend-icon="mdi-plus"
          class="text-none font-weight-bold"
          @click="openNewAlbumModal"
        >
          New Album
        </v-btn>

        <!-- Album Inside Actions -->
        <template v-else>
          <!-- Upload Button -->
          <v-btn
            color="primary"
            variant="flat"
            size="small"
            prepend-icon="mdi-upload"
            class="text-none font-weight-bold"
            @click="triggerFileInput"
          >
            Upload
          </v-btn>

          <!-- Slideshow Button -->
          <v-btn
            variant="tonal"
            size="small"
            prepend-icon="mdi-play"
            class="text-none font-weight-medium"
            :disabled="!store.currentMedia.length"
            @click="store.startSlideshow"
          >
            Slideshow
          </v-btn>

          <!-- Select All / Toggle Selection -->
          <v-btn
            variant="outlined"
            size="small"
            color="grey-lighten-1"
            class="text-none"
            @click="toggleBatchSelect"
          >
            {{ store.selectedCount > 0 ? 'Deselect All' : 'Select' }}
          </v-btn>
        </template>

        <!-- Preferences Button -->
        <v-btn
          icon="mdi-tune"
          variant="text"
          size="small"
          color="grey-lighten-1"
          @click="store.settingsModalOpen = true"
          title="Preferences"
        ></v-btn>

        <!-- Discreet Lock Button -->
        <v-btn
          icon="mdi-lock-outline"
          variant="text"
          size="small"
          color="grey-lighten-1"
          @click="store.panicLock"
          title="Lock"
        ></v-btn>
      </div>
    </v-app-bar>

    <!-- Hidden File Input for Uploads -->
    <input
      ref="fileInputRef"
      type="file"
      multiple
      accept="image/*,video/*"
      style="display: none;"
      @change="handleFilesSelected"
    />

    <!-- Main Content Container -->
    <v-main class="gallery-main-content">
      <v-container class="py-6">
        <!-- ================= VIEW 1: ALBUMS (GALLERY & MANAGER) ================= -->
        <div v-if="!store.activeAlbum">
          <div class="d-flex flex-wrap align-center justify-space-between mb-6 pb-3 border-b">
            <div>
              <h1 class="text-h5 font-weight-bold mb-1">
                {{ store.adminViewMode === 'manager' ? 'Album Manager' : 'Albums' }}
              </h1>
              <p class="text-caption text-medium-emphasis mb-0">
                {{ store.albums.length }} collections • 
                {{ store.vaultStats?.totalSizeFormatted || '' }} Storage
              </p>
            </div>

            <div class="d-flex align-center gap-2 mt-2 mt-sm-0">
              <v-btn-toggle
                v-model="store.adminViewMode"
                mandatory
                density="compact"
                variant="outlined"
                color="primary"
                rounded="lg"
              >
                <v-btn value="gallery" size="small" class="text-none">
                  <v-icon icon="mdi-view-grid-outline" size="16" class="mr-1"></v-icon>
                  Grid
                </v-btn>
                <v-btn value="manager" size="small" class="text-none">
                  <v-icon icon="mdi-folder-cog-outline" size="16" class="mr-1"></v-icon>
                  Manage
                </v-btn>
              </v-btn-toggle>

              <v-btn
                color="primary"
                variant="flat"
                size="small"
                prepend-icon="mdi-plus"
                class="text-none font-weight-bold ml-2"
                @click="openNewAlbumModal"
              >
                New Album
              </v-btn>
            </div>
          </div>

          <!-- SUB-VIEW A: MINIMALIST GALLERY GRID -->
          <v-row v-if="store.adminViewMode === 'gallery'">
            <v-col
              v-for="album in store.albums"
              :key="album.id"
              cols="12"
              sm="6"
              md="4"
              lg="3"
            >
              <div
                class="minimal-album-card"
                @click="store.selectAlbum(album)"
              >
                <!-- Album Cover Image -->
                <div class="minimal-album-thumb position-relative mb-2">
                  <img
                    v-if="album.coverUrl"
                    :src="album.coverUrl"
                    class="minimal-album-img"
                    alt="Album Cover"
                  />
                  <div v-else class="w-100 h-100 d-flex align-center justify-center bg-card">
                    <v-icon icon="mdi-folder-image" size="44" color="grey-darken-1"></v-icon>
                  </div>
                </div>

                <div class="d-flex align-center justify-space-between px-1">
                  <div style="max-width: 80%;">
                    <div class="text-subtitle-2 font-weight-bold text-truncate">{{ album.title }}</div>
                    <div class="text-caption text-medium-emphasis text-truncate">
                      {{ album.mediaCount }} items
                    </div>
                  </div>
                  <v-menu location="bottom end">
                    <template #activator="{ props }">
                      <v-btn
                        v-bind="props"
                        icon="mdi-dots-horizontal"
                        variant="text"
                        size="x-small"
                        color="grey-lighten-1"
                        @click.stop
                      ></v-btn>
                    </template>
                    <v-list density="compact" bg-color="#0b0f19" class="border">
                      <v-list-item prepend-icon="mdi-pencil-outline" @click.stop="openEditAlbumModal(album)">
                        <v-list-item-title>Edit Details</v-list-item-title>
                      </v-list-item>
                      <v-list-item prepend-icon="mdi-download" @click.stop="store.downloadAlbum(album.id)">
                        <v-list-item-title>Download (.zip)</v-list-item-title>
                      </v-list-item>
                      <v-list-item prepend-icon="mdi-delete-outline" class="text-error" @click.stop="confirmDeleteAlbum(album)">
                        <v-list-item-title>Delete Album</v-list-item-title>
                      </v-list-item>
                    </v-list>
                  </v-menu>
                </div>
              </div>
            </v-col>

            <!-- New Album Placeholder Card -->
            <v-col cols="12" sm="6" md="4" lg="3">
              <div
                class="minimal-album-thumb d-flex flex-column align-center justify-center cursor-pointer"
                style="border-style: dashed !important; border-width: 2px !important;"
                @click="openNewAlbumModal"
              >
                <v-icon icon="mdi-plus" size="32" color="primary" class="mb-2"></v-icon>
                <div class="text-subtitle-2 font-weight-bold">New Album</div>
                <div class="text-caption text-medium-emphasis">Create collection</div>
              </div>
            </v-col>
          </v-row>

          <!-- SUB-VIEW B: DEDICATED ADMIN ALBUM MANAGER -->
          <div v-else class="album-manager-dashboard">
            <!-- Overall Storage Metrics Cards -->
            <v-row class="mb-6">
              <v-col cols="6" sm="3">
                <v-card class="glass-panel pa-4 rounded-xl text-center">
                  <v-icon icon="mdi-database-outline" color="primary" size="26" class="mb-1"></v-icon>
                  <div class="text-h6 font-weight-bold font-mono">{{ store.vaultStats?.totalSizeFormatted || '0 B' }}</div>
                  <div class="text-caption text-medium-emphasis">Raw Disk Storage Used</div>
                </v-card>
              </v-col>
              <v-col cols="6" sm="3">
                <v-card class="glass-panel pa-4 rounded-xl text-center">
                  <v-icon icon="mdi-folder-multiple-outline" color="blue" size="26" class="mb-1"></v-icon>
                  <div class="text-h6 font-weight-bold font-mono">{{ store.albums.length }}</div>
                  <div class="text-caption text-medium-emphasis">Managed Albums</div>
                </v-card>
              </v-col>
              <v-col cols="6" sm="3">
                <v-card class="glass-panel pa-4 rounded-xl text-center">
                  <v-icon icon="mdi-image-multiple" color="teal" size="26" class="mb-1"></v-icon>
                  <div class="text-h6 font-weight-bold font-mono">{{ store.vaultStats?.totalImages || 0 }}</div>
                  <div class="text-caption text-medium-emphasis">Full-Size Photos</div>
                </v-card>
              </v-col>
              <v-col cols="6" sm="3">
                <v-card class="glass-panel pa-4 rounded-xl text-center">
                  <v-icon icon="mdi-video" color="deep-purple-accent-2" size="26" class="mb-1"></v-icon>
                  <div class="text-h6 font-weight-bold font-mono">{{ store.vaultStats?.totalVideos || 0 }}</div>
                  <div class="text-caption text-medium-emphasis">Video Files</div>
                </v-card>
              </v-col>
            </v-row>

            <!-- Detailed Management Table of Albums -->
            <v-card class="glass-panel rounded-xl overflow-hidden pa-3" elevation="8">
              <div class="d-flex align-center justify-space-between mb-3 px-2 pt-2">
                <div class="text-subtitle-1 font-weight-bold d-flex align-center gap-2">
                  <v-icon icon="mdi-format-list-bulleted" size="20" color="primary"></v-icon>
                  <span>Album Directory</span>
                </div>
                <div class="text-caption text-medium-emphasis">
                  All uploads stored uncompressed at 100% full original resolution
                </div>
              </div>

              <v-table class="bg-transparent text-caption">
                <thead>
                  <tr class="text-left text-medium-emphasis">
                    <th style="width: 60px;">Cover</th>
                    <th>Album Title &amp; Description</th>
                    <th>Full-Size Media</th>
                    <th>Disk Usage</th>
                    <th>Created</th>
                    <th class="text-right">Manage Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="album in store.albums" :key="album.id" class="border-b">
                    <!-- Cover Thumbnail -->
                    <td class="py-3">
                      <v-avatar rounded="lg" size="44" class="border cursor-pointer" @click="store.selectAlbum(album)">
                        <v-img v-if="album.coverUrl" :src="album.coverUrl" cover></v-img>
                        <v-icon v-else icon="mdi-folder-image" color="grey"></v-icon>
                      </v-avatar>
                    </td>

                    <!-- Title & Description -->
                    <td class="py-3">
                      <div class="font-weight-bold text-subtitle-2 cursor-pointer text-white" @click="store.selectAlbum(album)">
                        {{ album.title }}
                      </div>
                      <div class="text-caption text-medium-emphasis text-truncate" style="max-width: 320px;">
                        {{ album.description || 'No description provided' }}
                      </div>
                    </td>

                    <!-- Items breakdown -->
                    <td class="py-3 font-mono">
                      <v-chip size="x-small" color="blue" variant="tonal" class="mr-1">
                        {{ album.imageCount }} Photos
                      </v-chip>
                      <v-chip size="x-small" color="purple" variant="tonal">
                        {{ album.videoCount }} Videos
                      </v-chip>
                    </td>

                    <!-- Disk Usage -->
                    <td class="py-3 font-mono text-success font-weight-bold">
                      {{ album.totalSizeFormatted || '0 B' }}
                    </td>

                    <!-- Created Date -->
                    <td class="py-3 text-medium-emphasis font-mono">
                      {{ new Date(album.createdAt).toLocaleDateString() }}
                    </td>

                    <!-- Actions -->
                    <td class="py-3 text-right">
                      <div class="d-flex align-center justify-end gap-1">
                        <v-btn
                          size="small"
                          variant="tonal"
                          color="primary"
                          class="text-none"
                          prepend-icon="mdi-folder-open-outline"
                          @click="store.selectAlbum(album)"
                        >
                          Browse
                        </v-btn>
                        <v-btn
                          size="small"
                          variant="tonal"
                          color="teal"
                          class="text-none"
                          prepend-icon="mdi-cloud-upload"
                          @click="triggerUploadForAlbum(album)"
                          title="Upload Raw Full-Size Media Directly"
                        >
                          Upload
                        </v-btn>
                        <v-btn
                          icon="mdi-download"
                          size="small"
                          variant="text"
                          color="grey-lighten-1"
                          @click="store.downloadAlbum(album.id)"
                          title="Download Whole Album (.zip)"
                        ></v-btn>
                        <v-btn
                          icon="mdi-pencil-outline"
                          size="small"
                          variant="text"
                          color="grey-lighten-1"
                          @click="openEditAlbumModal(album)"
                          title="Edit Details"
                        ></v-btn>
                        <v-btn
                          icon="mdi-delete-outline"
                          size="small"
                          variant="text"
                          color="error"
                          @click="confirmDeleteAlbum(album)"
                          title="Delete Album"
                        ></v-btn>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </v-card>
          </div>
        </div>

        <!-- ================= VIEW 2: ALBUM MEDIA GRID ================= -->
        <div v-else>
          <!-- Album Header Banner -->
          <div class="d-flex flex-wrap align-center justify-space-between mb-4 pb-4 border-b">
            <div class="d-flex align-center gap-3">
              <v-btn
                icon="mdi-arrow-left"
                variant="tonal"
                color="grey-lighten-1"
                size="small"
                @click="store.activeAlbum = null"
                title="Back to Albums"
              ></v-btn>
              <div>
                <h1 class="text-h5 font-weight-bold mb-1">{{ store.activeAlbum.title }}</h1>
                <p class="text-caption text-medium-emphasis mb-0">
                  {{ store.currentMedia.length }} items
                </p>
              </div>
            </div>
          </div>

          <!-- Empty Album State -->
          <div
            v-if="!store.currentMedia.length"
            class="empty-album-dropzone glass-panel rounded-2xl pa-12 text-center my-8"
            @dragover.prevent
            @drop.prevent="handleDrop"
          >
            <v-icon icon="mdi-cloud-upload-outline" size="72" color="primary" class="mb-4"></v-icon>
            <h2 class="text-h5 font-weight-bold mb-2">No media files in this album yet</h2>
            <p class="text-body-2 text-medium-emphasis mb-6">
              Drag &amp; drop photos or videos anywhere here, or click below to browse.
            </p>
            <v-btn color="primary" variant="flat" size="large" prepend-icon="mdi-plus" @click="triggerFileInput">
              Select Photos &amp; Videos
            </v-btn>
          </div>

          <!-- Media Controls: Filter, Search & Sort Toolbar -->
          <div v-else class="mb-4">
            <div class="d-flex flex-wrap align-center justify-space-between gap-3 mb-4 pa-3 glass-panel rounded-xl">
              <!-- Filter Type Toggle -->
              <v-btn-toggle
                v-model="filterType"
                mandatory
                density="compact"
                variant="tonal"
                color="primary"
                rounded="pill"
              >
                <v-btn value="all" size="small" class="text-none">
                  All ({{ store.currentMedia.length }})
                </v-btn>
                <v-btn value="images" size="small" class="text-none">
                  <v-icon icon="mdi-image-outline" start size="15"></v-icon>
                  Photos ({{ imageCount }})
                </v-btn>
                <v-btn value="videos" size="small" class="text-none">
                  <v-icon icon="mdi-video-outline" start size="15"></v-icon>
                  Videos ({{ videoCount }})
                </v-btn>
              </v-btn-toggle>

              <!-- Search & Sort -->
              <div class="d-flex align-center gap-2 flex-grow-1 flex-sm-grow-0 justify-end">
                <v-text-field
                  v-model="searchQuery"
                  placeholder="Filter name..."
                  prepend-inner-icon="mdi-magnify"
                  variant="outlined"
                  density="compact"
                  hide-details
                  clearable
                  style="max-width: 200px;"
                  class="font-mono text-caption"
                ></v-text-field>

                <v-select
                  v-model="sortOrder"
                  :items="sortOptions"
                  item-title="title"
                  item-value="value"
                  variant="outlined"
                  density="compact"
                  hide-details
                  prepend-inner-icon="mdi-sort-variant"
                  style="min-width: 170px;"
                  class="text-caption"
                ></v-select>
              </div>
            </div>

            <!-- Minimalist Media Cards Grid -->
            <v-row dense>
              <v-col
                v-for="(item, index) in filteredMedia"
                :key="item.id"
                cols="6"
                sm="4"
                md="3"
                lg="2"
              >
                <div
                  class="minimal-media-tile"
                  :class="{ 'is-selected': isSelected(item.id) }"
                  @click="handleMediaClick(item, index, $event)"
                >
                  <!-- Fast WebP Thumbnail (480x480) -->
                  <img
                    v-if="!item.isVideo"
                    :src="`/thumb/${item.id}`"
                    class="minimal-media-img"
                    :alt="item.title"
                    loading="lazy"
                  />
                  <div v-else class="video-thumb-placeholder w-100 h-100 d-flex align-center justify-center">
                    <v-icon icon="mdi-play-circle" size="44" color="deep-purple-accent-2"></v-icon>
                  </div>

                  <!-- Item Selection Checkbox (supports Shift+Click) -->
                  <div class="minimal-check-overlay" @click.stop="handleCheckClick(item.id, index, $event)">
                    <v-checkbox-btn
                      :model-value="isSelected(item.id)"
                      color="primary"
                      density="compact"
                      class="ma-0 pa-0"
                    ></v-checkbox-btn>
                  </div>

                  <!-- Quick Action Menu -->
                  <div class="tile-menu-overlay" @click.stop>
                    <v-menu location="bottom end">
                      <template #activator="{ props }">
                        <v-btn
                          v-bind="props"
                          icon="mdi-dots-vertical"
                          size="x-small"
                          variant="text"
                          color="white"
                          class="tile-menu-btn"
                        ></v-btn>
                      </template>
                      <v-list density="compact" bg-color="#0b0f19" class="border">
                        <v-list-item
                          prepend-icon="mdi-image-filter-vintage"
                          @click="store.setAlbumCover(store.activeAlbum.id, item.id)"
                        >
                          <v-list-item-title>Set as Album Cover</v-list-item-title>
                        </v-list-item>
                        <v-list-item
                          prepend-icon="mdi-download"
                          :href="`/media-stream/${item.id}`"
                          :download="item.originalName || item.filename"
                        >
                          <v-list-item-title>Download Raw Original</v-list-item-title>
                        </v-list-item>
                        <v-list-item
                          prepend-icon="mdi-delete-outline"
                          class="text-error"
                          @click="quickDeleteMedia(item)"
                        >
                          <v-list-item-title>Delete</v-list-item-title>
                        </v-list-item>
                      </v-list>
                    </v-menu>
                  </div>

                  <!-- Video Indicator -->
                  <div v-if="item.isVideo" class="video-indicator-badge">
                    <v-icon icon="mdi-play" size="14"></v-icon>
                  </div>

                  <!-- Size Pill on Hover -->
                  <div class="media-size-badge font-mono">
                    {{ formatBytes(item.size) }}
                  </div>
                </div>
              </v-col>
            </v-row>
          </div>
        </div>
      </v-container>
    </v-main>

    <!-- Album Create / Edit Dialog -->
    <v-dialog v-model="albumDialog.open" max-width="480">
      <v-card class="glass-panel pa-4 rounded-xl text-white">
        <v-card-title class="font-weight-bold">
          {{ albumDialog.isEdit ? 'Edit Album' : 'Create New Album' }}
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="albumDialog.title"
            label="Album Title"
            placeholder="e.g. Vintage Exotics"
            variant="outlined"
            density="comfortable"
            color="primary"
            class="mb-3"
            autofocus
          ></v-text-field>
          <v-textarea
            v-model="albumDialog.description"
            label="Description (Optional)"
            placeholder="Brief overview or notes..."
            variant="outlined"
            rows="3"
            color="primary"
          ></v-textarea>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="albumDialog.open = false">Cancel</v-btn>
          <v-btn color="primary" variant="flat" :disabled="!albumDialog.title" @click="saveAlbum">
            {{ albumDialog.isEdit ? 'Save Changes' : 'Create Album' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Album Delete Confirmation Dialog -->
    <v-dialog v-model="deleteConfirmDialog.open" max-width="420">
      <v-card class="glass-panel pa-4 rounded-xl border border-red">
        <v-card-title class="text-error font-weight-bold d-flex align-center gap-2">
          <v-icon icon="mdi-alert-outline" color="error"></v-icon>
          Delete Album
        </v-card-title>
        <v-card-text>
          Are you sure you want to delete <strong>{{ deleteConfirmDialog.album?.title }}</strong>?
          All media files contained inside will also be permanently deleted.
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="deleteConfirmDialog.open = false">Cancel</v-btn>
          <v-btn color="error" variant="flat" @click="executeDeleteAlbum">Delete Permanently</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Floating Batch Toolbar -->
    <BatchBar />

    <!-- Lightbox & Slideshow Viewer -->
    <MediaViewer />

    <!-- Preferences / Settings Dialog -->
    <SettingsDialog />

    <!-- Global Drag & Drop Overlay -->
    <div
      v-if="isDragging"
      class="drag-drop-overlay"
      @dragover.prevent
      @dragleave.prevent="isDragging = false"
      @drop.prevent="handleDrop"
    >
      <div class="drag-drop-box glass-panel text-center pa-8 rounded-2xl">
        <v-icon icon="mdi-cloud-upload-outline" size="56" color="primary" class="mb-3 animate-pulse"></v-icon>
        <div class="text-subtitle-1 font-weight-bold mb-1">Drop to Upload</div>
        <div class="text-caption text-medium-emphasis">Files will be added to this collection</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useVaultStore } from '../stores/vaultStore'
import MediaViewer from './MediaViewer.vue'
import BatchBar from './BatchBar.vue'
import SettingsDialog from './SettingsDialog.vue'

const store = useVaultStore()
const fileInputRef = ref(null)
const targetUploadAlbum = ref(null)

// Filtering & Sorting State
const filterType = ref('all') // 'all' | 'images' | 'videos'
const sortOrder = ref('newest') // 'newest' | 'oldest' | 'size-desc' | 'name-asc'
const searchQuery = ref('')
const lastSelectedIndex = ref(-1)
const isDragging = ref(false)

const sortOptions = [
  { title: 'Newest First', value: 'newest' },
  { title: 'Oldest First', value: 'oldest' },
  { title: 'Size (Largest)', value: 'size-desc' },
  { title: 'File Name (A-Z)', value: 'name-asc' }
]

const imageCount = computed(() => store.currentMedia.filter(m => !m.isVideo).length)
const videoCount = computed(() => store.currentMedia.filter(m => m.isVideo).length)

const filteredMedia = computed(() => {
  let list = [...store.currentMedia]

  // Type filter
  if (filterType.value === 'images') {
    list = list.filter(m => !m.isVideo)
  } else if (filterType.value === 'videos') {
    list = list.filter(m => m.isVideo)
  }

  // Search query
  if (searchQuery.value && searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(m =>
      (m.title && m.title.toLowerCase().includes(q)) ||
      (m.originalName && m.originalName.toLowerCase().includes(q))
    )
  }

  // Sort order
  if (sortOrder.value === 'newest') {
    list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  } else if (sortOrder.value === 'oldest') {
    list.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
  } else if (sortOrder.value === 'size-desc') {
    list.sort((a, b) => (b.size || 0) - (a.size || 0))
  } else if (sortOrder.value === 'name-asc') {
    list.sort((a, b) => (a.title || a.originalName || '').localeCompare(b.title || b.originalName || ''))
  }

  return list
})

// Dialogs state
const albumDialog = ref({
  open: false,
  isEdit: false,
  id: null,
  title: '',
  description: ''
})

const deleteConfirmDialog = ref({
  open: false,
  album: null
})

onMounted(async () => {
  await store.fetchVaultStats()
})

function formatLockCountdown(sec) {
  if (!sec || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

function isSelected(mediaId) {
  return store.selectedMediaIds.includes(mediaId)
}

function handleMediaClick(item, index, event) {
  if (event && event.shiftKey && lastSelectedIndex.value !== -1) {
    store.selectRange(lastSelectedIndex.value, index)
    lastSelectedIndex.value = index
    return
  }
  if (store.selectedCount > 0) {
    store.toggleSelect(item.id)
    lastSelectedIndex.value = index
  } else {
    // Open in Lightbox viewer matching actual media position
    const realIndex = store.currentMedia.findIndex(m => m.id === item.id)
    lastSelectedIndex.value = index
    store.openViewer(realIndex >= 0 ? realIndex : index)
  }
}

function handleCheckClick(itemId, index, event) {
  if (event && event.shiftKey && lastSelectedIndex.value !== -1) {
    store.selectRange(lastSelectedIndex.value, index)
  } else {
    store.toggleSelect(itemId)
  }
  lastSelectedIndex.value = index
}

function getFileExtension(item) {
  if (item.isVideo) return 'VIDEO'
  const name = item.originalName || item.filename || ''
  const parts = name.split('.')
  return parts.length > 1 ? parts.pop().toUpperCase() : 'IMG'
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

async function quickDeleteMedia(item) {
  if (confirm(`Delete "${item.title || item.originalName}" permanently?`)) {
    await fetch('/api/media/batch-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaIds: [item.id] })
    })
    await store.fetchMedia(store.activeAlbum.id)
    await store.fetchVaultStats()
  }
}

function toggleBatchSelect() {
  if (store.selectedCount > 0) {
    store.clearSelection()
  } else {
    store.selectAll()
  }
}

function triggerFileInput() {
  targetUploadAlbum.value = null
  fileInputRef.value?.click()
}

function triggerUploadForAlbum(album) {
  targetUploadAlbum.value = album
  fileInputRef.value?.click()
}

async function handleFilesSelected(e) {
  const files = e.target.files
  const targetId = targetUploadAlbum.value?.id || store.activeAlbum?.id
  if (!files || !files.length || !targetId) return
  await store.uploadFiles(targetId, files)
  await store.fetchVaultStats()
  targetUploadAlbum.value = null
  e.target.value = ''
}

async function handleDrop(e) {
  isDragging.value = false
  const files = e.dataTransfer.files
  const targetId = targetUploadAlbum.value?.id || store.activeAlbum?.id
  if (!files || !files.length || !targetId) return
  await store.uploadFiles(targetId, files)
  await store.fetchVaultStats()
}

function openNewAlbumModal() {
  albumDialog.value = {
    open: true,
    isEdit: false,
    id: null,
    title: '',
    description: ''
  }
}

function openEditAlbumModal(album) {
  albumDialog.value = {
    open: true,
    isEdit: true,
    id: album.id,
    title: album.title,
    description: album.description
  }
}

async function saveAlbum() {
  if (albumDialog.value.isEdit) {
    await store.updateAlbum(albumDialog.value.id, albumDialog.value.title, albumDialog.value.description)
  } else {
    await store.createAlbum(albumDialog.value.title, albumDialog.value.description)
  }
  albumDialog.value.open = false
}

function confirmDeleteAlbum(album) {
  deleteConfirmDialog.value = {
    open: true,
    album
  }
}

async function executeDeleteAlbum() {
  if (deleteConfirmDialog.value.album) {
    await store.deleteAlbum(deleteConfirmDialog.value.album.id)
  }
  deleteConfirmDialog.value.open = false
}
</script>

<style scoped>
.private-gallery-root {
  min-height: 100vh;
  background-color: #070b14;
  color: #f1f5f9;
}

.gallery-main-content {
  padding-top: 16px;
}

.album-card {
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
}

.album-card:hover {
  transform: translateY(-4px);
  border-color: rgba(59, 130, 246, 0.4) !important;
  box-shadow: 0 12px 30px -10px rgba(59, 130, 246, 0.2) !important;
}

.album-cover-box {
  width: 100%;
  height: 180px;
  background-color: #0c1222;
  overflow: hidden;
}

.album-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.album-cover-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
}

.album-count-badge {
  position: absolute;
  top: 10px;
  right: 10px;
}

.new-album-card {
  border: 2px dashed rgba(255, 255, 255, 0.15) !important;
  background: rgba(15, 23, 42, 0.3) !important;
  min-height: 260px;
  transition: all 0.2s ease;
}

.new-album-card:hover {
  border-color: #3b82f6 !important;
  background: rgba(59, 130, 246, 0.05) !important;
}

/* Media Grid Card */
.media-grid-card {
  border: 1px solid rgba(255, 255, 255, 0.06) !important;
  transition: transform 0.15s ease, border-color 0.15s ease;
  cursor: pointer;
}

.media-grid-card:hover {
  transform: scale(1.02);
  border-color: rgba(59, 130, 246, 0.4) !important;
}

.card-selected {
  border-color: #3b82f6 !important;
  box-shadow: 0 0 0 2px #3b82f6 !important;
}

.media-thumb-container {
  width: 100%;
  height: 140px;
  background-color: #090e1a;
  position: relative;
  overflow: hidden;
}

.media-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-thumb-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #1e1145 0%, #090e1a 100%);
}

.media-checkbox-overlay {
  position: absolute;
  top: 4px;
  left: 4px;
  z-index: 5;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  border-radius: 6px;
  padding: 2px;
}

.media-type-badge {
  position: absolute;
  bottom: 6px;
  right: 6px;
  z-index: 5;
}

.empty-album-dropzone {
  border: 2px dashed rgba(255, 255, 255, 0.15);
}

.tile-menu-overlay {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 6;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.minimal-media-tile:hover .tile-menu-overlay {
  opacity: 1;
}

.tile-menu-btn {
  background: rgba(15, 23, 42, 0.7) !important;
  backdrop-filter: blur(4px);
  border-radius: 6px;
}

.media-size-badge {
  position: absolute;
  bottom: 6px;
  left: 6px;
  font-size: 10px;
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(4px);
  color: #94a3b8;
  padding: 1px 6px;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.minimal-media-tile:hover .media-size-badge {
  opacity: 1;
}

.drag-drop-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(3, 7, 18, 0.85);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: all;
}

.drag-drop-box {
  border: 3px dashed #3b82f6;
  max-width: 500px;
  animation: pulseGlow 1.5s infinite alternate;
}

.video-indicator-badge {
  position: absolute;
  bottom: 6px;
  right: 6px;
  z-index: 5;
  background: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(4px);
  color: #ffffff;
  padding: 2px 6px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

@keyframes pulseGlow {
  from { box-shadow: 0 0 20px rgba(59, 130, 246, 0.2); }
  to { box-shadow: 0 0 50px rgba(59, 130, 246, 0.5); }
}
</style>
