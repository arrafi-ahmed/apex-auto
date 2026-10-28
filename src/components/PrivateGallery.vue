<template>
  <div class="gallery" @dragenter.prevent="isDragging = true" @dragover.prevent>
    <!-- ───────── Top bar ───────── -->
    <header class="topbar">
      <div class="topbar-inner">
        <nav class="crumbs" aria-label="Breadcrumb">
          <button class="brand" title="Collections" @click="store.leaveAlbum()">
            <v-icon icon="mdi-shield-lock-outline" size="17"></v-icon>
          </button>
          <button class="crumb" :class="{ 'is-current': !store.activeAlbum }" @click="store.leaveAlbum()">Vault</button>
          <template v-if="store.activeAlbum">
            <span class="crumb-sep">/</span>
            <span class="crumb is-current text-truncate">{{ store.activeAlbum.title }}</span>
          </template>
        </nav>

        <div class="topbar-actions">
          <div v-if="store.secondsRemainingUntilAutoLock < 120" class="lock-chip font-mono is-low" :title="`Auto-lock in ${formatLockCountdown(store.secondsRemainingUntilAutoLock)}`">
            <span class="lock-dot"></span>{{ formatLockCountdown(store.secondsRemainingUntilAutoLock) }}
          </div>
          <button class="ax-icon-btn" title="Preferences" @click="store.settingsModalOpen = true">
            <v-icon icon="mdi-tune-variant" size="18"></v-icon>
          </button>
          <button class="ax-icon-btn is-danger" title="Lock now (double Esc)" @click="store.panicLock">
            <v-icon icon="mdi-lock-outline" size="18"></v-icon>
          </button>
        </div>
      </div>
    </header>

    <!-- Pull-to-refresh indicator (touch only) -->
    <div
      v-if="pull > 0 || refreshing"
      class="ptr-chip"
      :class="{ 'is-refreshing': refreshing }"
      :style="{
        transform: `translateY(${pull}px) ${refreshing ? '' : `rotate(${pull * 3}deg)`}`,
        opacity: refreshing ? 1 : Math.min(1, pull / 48)
      }"
      role="status"
      aria-live="polite"
    >
      <v-icon icon="mdi-refresh" size="18" :class="{ 'spin-anim': refreshing }"></v-icon>
      <span class="sr-only">Refreshing…</span>
    </div>

    <input ref="fileInputRef" type="file" multiple accept="image/*,video/*" hidden @change="handleFilesSelected" />

    <main class="page">
      <!-- ═════════ Collections / manager / logs ═════════ -->
      <template v-if="!store.activeAlbum">
        <div class="page-head">
          <div>
            <h1 class="page-title">
              {{ store.adminViewMode === 'manager' ? 'Manage' : store.adminViewMode === 'logs' ? 'Access log' : 'Collections' }}
            </h1>
            <p class="page-meta">
              <template v-if="store.adminViewMode === 'logs'">
                Last sign-in {{ formatRelativeTime(store.lastLoginTime) }}
              </template>
              <template v-else>
                {{ store.albums.length }} {{ store.albums.length === 1 ? 'collection' : 'collections' }}
                <i></i>{{ store.vaultStats?.totalSizeFormatted || '0 B' }} used
              </template>
            </p>
          </div>
          <div class="page-tools">
            <div class="ax-seg" role="tablist">
              <button :class="{ 'is-active': store.adminViewMode === 'gallery' }" @click="store.adminViewMode = 'gallery'">
                <v-icon icon="mdi-view-grid-outline"></v-icon>Grid
              </button>
              <button :class="{ 'is-active': store.adminViewMode === 'manager' }" @click="store.adminViewMode = 'manager'">
                <v-icon icon="mdi-table"></v-icon>Manage
              </button>
              <button :class="{ 'is-active': store.adminViewMode === 'logs' }" @click="store.adminViewMode = 'logs'">
                <v-icon icon="mdi-shield-check-outline"></v-icon>Logs
              </button>
            </div>
            <button v-if="store.adminViewMode !== 'logs'" class="ax-btn is-primary" @click="openNewAlbumModal">
              <v-icon icon="mdi-plus"></v-icon>New collection
            </button>
          </div>
        </div>

        <!-- Grid -->
        <div v-if="store.adminViewMode === 'gallery' && store.loadingAlbums && !store.albums.length" class="album-grid">
          <div v-for="n in 4" :key="n" class="album">
            <div class="album-cover ax-skeleton"></div>
            <div class="album-info"><div class="sk-line ax-skeleton"></div><div class="sk-line short ax-skeleton"></div></div>
          </div>
        </div>
        <div v-else-if="store.adminViewMode === 'gallery'" class="album-grid ax-enter">
          <article v-for="album in store.albums" :key="album.id" class="album" @click="store.selectAlbum(album)">
            <div class="album-cover">
              <img v-if="album.coverUrl" :src="album.coverUrl" :alt="album.title" loading="lazy" />
              <div v-else class="album-empty"><v-icon icon="mdi-image-outline" size="30"></v-icon></div>
              <span class="album-count"><v-icon icon="mdi-image-multiple-outline" size="12"></v-icon>{{ album.mediaCount }}</span>
              <v-menu location="bottom end">
                <template #activator="{ props }">
                  <button v-bind="props" class="album-more" title="Options" @click.stop>
                    <v-icon icon="mdi-dots-horizontal" size="18"></v-icon>
                  </button>
                </template>
                <div class="ax-menu">
                  <button class="ax-menu-item" @click.stop="openEditAlbumModal(album)"><v-icon icon="mdi-pencil-outline"></v-icon>Edit details</button>
                  <button class="ax-menu-item" @click.stop="triggerUploadForAlbum(album)"><v-icon icon="mdi-upload-outline"></v-icon>Upload media</button>
                  <button class="ax-menu-item" @click.stop="store.downloadAlbum(album.id)"><v-icon icon="mdi-download-outline"></v-icon>Download .zip</button>
                  <div class="ax-menu-sep"></div>
                  <button class="ax-menu-item is-danger" @click.stop="confirmDeleteAlbum(album)"><v-icon icon="mdi-delete-outline"></v-icon>Delete</button>
                </div>
              </v-menu>
            </div>
            <div class="album-info">
              <div class="album-title text-truncate">{{ album.title }}</div>
              <div class="album-sub">{{ album.mediaCount }} {{ album.mediaCount === 1 ? 'item' : 'items' }}<i></i>{{ album.totalSizeFormatted || '0 B' }}</div>
            </div>
          </article>

          <button class="album-new" @click="openNewAlbumModal">
            <span class="album-new-plus"><v-icon icon="mdi-plus" size="20"></v-icon></span>
            <span>New collection</span>
          </button>
        </div>

        <!-- Manager -->
        <div v-else-if="store.adminViewMode === 'manager'" class="ax-enter">
          <div class="stats">
            <div class="stat"><b class="tabular">{{ store.vaultStats?.totalSizeFormatted || '—' }}</b><span>Storage</span></div>
            <div class="stat"><b class="tabular">{{ store.albums.length }}</b><span>Collections</span></div>
            <div class="stat"><b class="tabular">{{ store.vaultStats?.totalImages || 0 }}</b><span>Photos</span></div>
            <div class="stat"><b class="tabular">{{ store.vaultStats?.totalVideos || 0 }}</b><span>Videos</span></div>
          </div>

          <div class="ax-table-wrap">
            <table class="ax-table manager-table">
              <thead>
                <tr><th>Collection</th><th>Contents</th><th>Size</th><th>Created</th><th></th></tr>
              </thead>
              <tbody>
                <tr v-for="album in store.albums" :key="album.id">
                  <td class="c-album">
                    <div class="row-album" @click="store.selectAlbum(album)">
                      <span class="row-thumb">
                        <img v-if="album.coverUrl" :src="album.coverUrl" alt="" />
                        <v-icon v-else icon="mdi-image-outline" size="16"></v-icon>
                      </span>
                      <span class="row-text">
                        <span class="row-title">{{ album.title }}</span>
                        <span class="row-desc text-truncate">{{ album.description || 'No description' }}</span>
                      </span>
                    </div>
                  </td>
                  <td class="c-contents">
                    <span class="ax-chip mr-1">{{ album.imageCount }} photos</span>
                    <span class="ax-chip">{{ album.videoCount }} videos</span>
                  </td>
                  <td class="c-size font-mono tabular">{{ album.totalSizeFormatted || '0 B' }}</td>
                  <td class="c-date text-2 tabular">{{ new Date(album.createdAt).toLocaleDateString() }}</td>
                  <td class="c-actions">
                    <div class="row-actions">
                      <button class="ax-icon-btn" title="Upload" @click="triggerUploadForAlbum(album)"><v-icon icon="mdi-upload-outline" size="17"></v-icon></button>
                      <button class="ax-icon-btn" title="Download .zip" @click="store.downloadAlbum(album.id)"><v-icon icon="mdi-download-outline" size="17"></v-icon></button>
                      <button class="ax-icon-btn" title="Edit" @click="openEditAlbumModal(album)"><v-icon icon="mdi-pencil-outline" size="17"></v-icon></button>
                      <button class="ax-icon-btn is-danger" title="Delete" @click="confirmDeleteAlbum(album)"><v-icon icon="mdi-delete-outline" size="17"></v-icon></button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-else-if="store.adminViewMode === 'logs'" class="ax-enter"><AdminAuditLogs /></div>
      </template>

      <!-- ═════════ Album contents ═════════ -->
      <template v-else>
        <div class="page-head">
          <div class="head-back">
            <button class="ax-icon-btn" title="Back" @click="store.leaveAlbum()"><v-icon icon="mdi-arrow-left" size="18"></v-icon></button>
            <div>
              <h1 class="page-title">{{ store.activeAlbum.title }}</h1>
              <p class="page-meta">
                {{ store.currentMedia.length }} {{ store.currentMedia.length === 1 ? 'item' : 'items' }}
                <template v-if="store.activeAlbum.description"><i></i>{{ store.activeAlbum.description }}</template>
              </p>
            </div>
          </div>
          <div class="page-tools">
            <button class="ax-btn is-outline" :disabled="!store.displayMedia.length" title="Slideshow" aria-label="Slideshow" @click="store.startSlideshow">
              <v-icon icon="mdi-play"></v-icon><span class="btn-label">Slideshow</span>
            </button>
            <button class="ax-btn is-outline" :disabled="!store.displayMedia.length" :title="store.selectedCount > 0 ? 'Clear selection' : 'Select all'" :aria-label="store.selectedCount > 0 ? 'Clear selection' : 'Select all'" @click="toggleBatchSelect">
              <v-icon :icon="store.selectedCount > 0 ? 'mdi-close' : 'mdi-checkbox-multiple-marked-outline'"></v-icon>
              <span class="btn-label">{{ store.selectedCount > 0 ? 'Clear' : 'Select' }}</span>
            </button>
            <button class="ax-btn is-primary" title="Upload" aria-label="Upload" @click="triggerFileInput"><v-icon icon="mdi-upload"></v-icon>Upload</button>
          </div>
        </div>

        <!-- Loading -->
        <div v-if="store.loadingMedia && !store.currentMedia.length" class="sk-grid" aria-busy="true">
          <div v-for="n in 12" :key="n" class="sk-tile ax-skeleton" :style="{ width: `${[220, 160, 280, 200, 240, 180][n % 6]}px` }"></div>
        </div>

        <!-- Empty -->
        <div v-else-if="!store.currentMedia.length" class="dropzone ax-enter" @dragover.prevent @drop.prevent="handleDrop">
          <span class="dropzone-icon"><v-icon icon="mdi-image-plus-outline" size="26"></v-icon></span>
          <h2>Nothing here yet</h2>
          <p>Drop photos or videos anywhere on this page, or browse your files.</p>
          <button class="ax-btn is-primary" @click="triggerFileInput"><v-icon icon="mdi-plus"></v-icon>Add media</button>
        </div>

        <template v-else>
          <div class="filters">
            <div class="ax-seg">
              <button :class="{ 'is-active': store.mediaFilter === 'all' }" @click="store.mediaFilter = 'all'">All <span class="seg-n">{{ store.currentMedia.length }}</span></button>
              <button :class="{ 'is-active': store.mediaFilter === 'images' }" @click="store.mediaFilter = 'images'">Photos <span class="seg-n">{{ imageCount }}</span></button>
              <button :class="{ 'is-active': store.mediaFilter === 'videos' }" @click="store.mediaFilter = 'videos'">Videos <span class="seg-n">{{ videoCount }}</span></button>
              <button :class="{ 'is-active': store.mediaFilter === 'favorites' }" @click="store.mediaFilter = 'favorites'">
                <v-icon icon="mdi-star-outline"></v-icon><span class="seg-n">{{ favoriteCount }}</span>
              </button>
            </div>
            <div class="filters-right">
              <label class="ax-search">
                <v-icon icon="mdi-magnify"></v-icon>
                <input v-model="store.mediaQuery" class="ax-input" type="search" placeholder="Search files" />
              </label>
              <select v-model="store.mediaSort" class="ax-input sort" aria-label="Sort">
                <option v-for="o in sortOptions" :key="o.value" :value="o.value">{{ o.title }}</option>
              </select>
            </div>
          </div>

          <div ref="gridRef" class="jgrid" :style="{ height: `${layout.height}px` }" role="grid" aria-label="Media">
            <template v-for="b in visibleBlocks" :key="b.key">
              <h3 v-if="b.type === 'h'" class="jgroup" :style="{ top: `${b.top}px`, height: `${b.height}px` }">
                {{ b.label }}<span class="seg-n">{{ b.count }}</span>
              </h3>
              <div v-else class="jrow" role="row" :style="{ top: `${b.top}px`, height: `${b.height}px`, gap: `${gapSize}px` }">
                <div
                  v-for="t in b.items"
                  :key="t.item.id"
                  class="tile"
                  :class="{ 'is-selected': isSelected(t.item.id), 'is-selecting': store.selectedCount > 0, 'is-pressing': pressingId === t.item.id }"
                  :style="{ width: `${t.w}px` }"
                  :data-index="t.index"
                  role="gridcell"
                  :tabindex="t.index === focusIndex ? 0 : -1"
                  :aria-label="t.item.title || t.item.originalName"
                  :aria-selected="isSelected(t.item.id)"
                  @click="handleMediaClick(t.item, t.index, $event)"
                  @keydown="onTileKeydown($event, t)"
                  @focus="focusIndex = t.index"
                  @pointerdown="onTilePointerDown($event, t)"
                  @pointermove="onTilePointerMove"
                  @pointerup="clearPress"
                  @pointercancel="clearPress"
                  @pointerleave="clearPress"
                  @contextmenu="onTileContextMenu"
                >
                  <img :src="`/thumb/${t.item.id}`" :alt="t.item.title" loading="lazy" decoding="async" draggable="false" />
                  <span v-if="t.item.isVideo" class="tile-play"><v-icon icon="mdi-play" size="22"></v-icon></span>

                  <button class="tile-check" tabindex="-1" :aria-pressed="isSelected(t.item.id)" title="Select" @click.stop="handleCheckClick(t.item.id, t.index, $event)">
                    <v-icon icon="mdi-check" size="14"></v-icon>
                  </button>

                  <v-menu location="bottom end">
                    <template #activator="{ props }">
                      <button v-bind="props" class="tile-more" tabindex="-1" title="Options" @click.stop>
                        <v-icon icon="mdi-dots-vertical" size="16"></v-icon>
                      </button>
                    </template>
                    <div class="ax-menu">
                      <button class="ax-menu-item" @click="store.toggleFavorite([t.item.id], !t.item.favorite)">
                        <v-icon :icon="t.item.favorite ? 'mdi-star-off-outline' : 'mdi-star-outline'"></v-icon>{{ t.item.favorite ? 'Remove favourite' : 'Favourite' }}
                      </button>
                      <button class="ax-menu-item" @click="store.setAlbumCover(store.activeAlbum.id, t.item.id)"><v-icon icon="mdi-image-check-outline"></v-icon>Set as cover</button>
                      <a class="ax-menu-item" :href="`/media-stream/${t.item.id}`" :download="t.item.originalName || t.item.filename"><v-icon icon="mdi-download-outline"></v-icon>Download original</a>
                      <div class="ax-menu-sep"></div>
                      <button class="ax-menu-item is-danger" @click="store.trashMedia([t.item.id])"><v-icon icon="mdi-delete-outline"></v-icon>Delete</button>
                    </div>
                  </v-menu>

                  <span v-if="t.item.isVideo && t.item.duration" class="tile-badge font-mono">{{ formatDuration(t.item.duration) }}</span>
                  <v-icon v-if="t.item.favorite" class="tile-fav" icon="mdi-star" size="15"></v-icon>
                  <span class="tile-size font-mono">{{ formatBytes(t.item.size) }}</span>
                </div>
              </div>
            </template>
          </div>
          <p v-if="!store.displayMedia.length" class="no-match">No files match your filters.</p>
        </template>
      </template>
    </main>

    <!-- ───────── Album dialog ───────── -->
    <v-dialog v-model="albumDialog.open" max-width="480">
      <form class="ax-modal" @submit.prevent="albumDialog.title && saveAlbum()">
        <div class="ax-modal-head">
          <div>
            <h2 class="ax-modal-title">{{ albumDialog.isEdit ? 'Edit collection' : 'New collection' }}</h2>
            <p class="ax-modal-sub">Originals are stored untouched, at full resolution.</p>
          </div>
          <button type="button" class="ax-icon-btn" @click="albumDialog.open = false"><v-icon icon="mdi-close" size="18"></v-icon></button>
        </div>
        <label class="ax-label" for="album-title">Title</label>
        <input id="album-title" v-model="albumDialog.title" class="ax-input mb-4" placeholder="Untitled" autofocus />
        <label class="ax-label" for="album-desc">Description <span class="text-3">(optional)</span></label>
        <textarea id="album-desc" v-model="albumDialog.description" class="ax-input" rows="3" placeholder="Notes about this collection"></textarea>
        <div class="ax-modal-actions">
          <button type="button" class="ax-btn is-ghost" @click="albumDialog.open = false">Cancel</button>
          <button type="submit" class="ax-btn is-primary" :disabled="!albumDialog.title">{{ albumDialog.isEdit ? 'Save changes' : 'Create collection' }}</button>
        </div>
      </form>
    </v-dialog>

    <!-- ───────── Delete dialog ───────── -->
    <v-dialog v-model="deleteConfirmDialog.open" max-width="420">
      <div class="ax-modal">
        <div class="ax-modal-head">
          <div>
            <h2 class="ax-modal-title">Delete “{{ deleteConfirmDialog.album?.title }}”?</h2>
            <p class="ax-modal-sub">Every file in this collection is permanently removed from disk. This can’t be undone.</p>
          </div>
        </div>
        <div class="ax-modal-actions" style="margin-top: 8px">
          <button class="ax-btn is-ghost" @click="deleteConfirmDialog.open = false">Cancel</button>
          <button class="ax-btn is-danger" @click="executeDeleteAlbum">Delete permanently</button>
        </div>
      </div>
    </v-dialog>

    <BatchBar />
    <MediaViewer />
    <SettingsDialog />

    <!-- Drop overlay -->
    <div v-if="isDragging" class="drop-overlay" @dragover.prevent @dragleave.prevent="isDragging = false" @drop.prevent="handleDrop">
      <div class="drop-card">
        <v-icon icon="mdi-tray-arrow-up" size="34"></v-icon>
        <strong>Drop to upload</strong>
        <span>Files are saved at original quality</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useVaultStore } from '../stores/vaultStore'
import { formatBytes, formatDuration, formatRelativeTime } from '../format'
import { usePullToRefresh } from '../composables/usePullToRefresh'
import { reduceMotion, viewerMediaEl, trackTransition } from '../viewTransition'
import MediaViewer from './MediaViewer.vue'
import BatchBar from './BatchBar.vue'
import SettingsDialog from './SettingsDialog.vue'
import AdminAuditLogs from './AdminAuditLogs.vue'

const store = useVaultStore()
const { pull, refreshing } = usePullToRefresh(async () => {
  store.registerActivity()
  if (store.activeAlbum) return store.fetchMedia(store.activeAlbum.id)
  if (store.adminViewMode === 'logs') return store.fetchAuditLogs()
  return Promise.all([store.fetchAlbums(), store.fetchVaultStats()])
}, { enabled: () => !store.viewerOpen && !document.querySelector('.v-overlay--active') })

const fileInputRef = ref(null)
const targetUploadAlbum = ref(null)
const isDragging = ref(false)

const sortOptions = [
  { title: 'Newest first', value: 'newest' },
  { title: 'Oldest first', value: 'oldest' },
  { title: 'Largest first', value: 'size-desc' },
  { title: 'Name (A–Z)', value: 'name-asc' }
]

const imageCount = computed(() => store.currentMedia.filter(m => !m.isVideo).length)
const videoCount = computed(() => store.currentMedia.filter(m => m.isVideo).length)
const favoriteCount = computed(() => store.currentMedia.filter(m => m.favorite).length)

// ---- Filter/sort preferences survive navigation but not the tab (sessionStorage leaves no trace) ----
const PREFS_KEY = 'ax.view'
try {
  const saved = JSON.parse(sessionStorage.getItem(PREFS_KEY) || 'null')
  if (saved) {
    store.mediaFilter = saved.filter || 'all'
    store.mediaSort = saved.sort || 'newest'
  }
} catch { /* storage unavailable */ }
watch(() => [store.mediaFilter, store.mediaSort], ([filter, sort]) => {
  try { sessionStorage.setItem(PREFS_KEY, JSON.stringify({ filter, sort })) } catch { /* ignore */ }
})

// ───────────── Justified grid + 2-col mobile grid + windowing ─────────────
const HEADER_H = 44
const gridRef = ref(null)
const gridWidth = ref(0)
const viewTop = ref(0)
const viewBottom = ref(1200)
let lastScrollY = 0

const mobileMq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(max-width: 600px)') : null
const isCompact = ref(mobileMq ? mobileMq.matches : false)
const onMq = (e) => { isCompact.value = e.matches; measure(); }

// Adaptive gap: 4px on compact mobile screens, 6px on tablet & desktop
const gapSize = computed(() => (isCompact.value ? 4 : 6))

// Dynamic row height tailored for optimal readability across all viewports
const targetRowH = computed(() => {
  const w = gridWidth.value
  if (w < 900) return 185       // Tablet
  if (w < 1440) return 220      // Standard desktop
  return 250                    // Ultrawide / 4K monitors
})

const groupByDate = computed(() => store.mediaSort === 'newest' || store.mediaSort === 'oldest')

function ratioOf(m) {
  const r = m.width && m.height ? m.width / m.height : 4 / 3
  return Math.min(2.6, Math.max(0.55, r))
}

function monthLabel(iso) {
  return new Date(iso || 0).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

const layout = computed(() => {
  const list = store.displayMedia
  const width = gridWidth.value
  const blocks = []
  if (!width || !list.length) return { blocks, height: 0, rows: [] }

  const rows = []
  const rowH = targetRowH.value
  const gap = gapSize.value
  let y = 0

  // Split into date groups (or a single group)
  const groups = []
  list.forEach((item, index) => {
    const label = groupByDate.value ? monthLabel(item.createdAt) : ''
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push({ item, index })
    else groups.push({ label, items: [{ item, index }] })
  })

  const maxRowItems = width < 768 ? 5 : 8

  for (const group of groups) {
    if (groupByDate.value) {
      blocks.push({ key: `h-${group.label}-${y}`, type: 'h', top: y, height: HEADER_H, label: group.label, count: group.items.length })
      y += HEADER_H
    }

    // 2-column square grid on mobile viewports (<= 600px)
    if (isCompact.value) {
      const tileW = Math.floor((width - gap) / 2)
      for (let i = 0; i < group.items.length; i += 2) {
        const items = group.items.slice(i, i + 2).map((entry, k) => ({
          ...entry,
          w: k === 1 ? width - gap - tileW : tileW
        }))
        const block = { key: `r-${items[0].item.id}`, type: 'r', top: y, height: tileW, items }
        blocks.push(block)
        rows.push(block)
        y += tileW + gap
      }
      if (groupByDate.value) y += 8
      continue
    }

    let row = []
    let ratioSum = 0

    const flush = (full) => {
      if (!row.length) return
      const gaps = gap * (row.length - 1)
      const height = full ? Math.min((width - gaps) / ratioSum, rowH * 1.6) : rowH

      // Calculate initial item widths
      const items = row.map(r => ({
        ...r,
        w: Math.round(ratioOf(r.item) * height)
      }))

      // Pixel-perfect edge justification: distribute remainder to fill container width exactly
      if (full && items.length > 0) {
        const totalW = items.reduce((acc, it) => acc + it.w, 0) + gaps
        const remainder = width - totalW
        if (remainder !== 0) {
          items[items.length - 1].w += remainder
        }
      }

      const block = { key: `r-${items[0].item.id}`, type: 'r', top: y, height: Math.round(height), items }
      blocks.push(block)
      rows.push(block)
      y += Math.round(height) + gap
      row = []
      ratioSum = 0
    }

    for (const entry of group.items) {
      row.push(entry)
      ratioSum += ratioOf(entry.item)

      // Break row if target width is reached OR if mobile max-item limit is reached
      const fitsWidth = (ratioSum * rowH + gap * (row.length - 1)) >= width
      const reachesMax = row.length >= maxRowItems
      if (fitsWidth || (reachesMax && ratioSum * rowH >= width * 0.75)) {
        flush(true)
      }
    }
    flush(false)
    if (groupByDate.value) y += 8
  }
  return { blocks, height: Math.max(0, y - gap), rows }
})

const visibleBlocks = computed(() => {
  const lo = viewTop.value - 1000
  const hi = viewBottom.value + 1000
  return layout.value.blocks.filter(b => b.top + b.height >= lo && b.top <= hi)
})

function measure() {
  const el = gridRef.value
  if (!el) return
  gridWidth.value = Math.floor(el.clientWidth)
  const top = el.getBoundingClientRect().top
  viewTop.value = Math.max(0, -top)
  viewBottom.value = viewTop.value + window.innerHeight
}

let raf = 0
function onScrollOrResize() {
  lastScrollY = window.scrollY
  if (raf) return
  raf = requestAnimationFrame(() => { raf = 0; measure() })
}

let resizeObserver = null
watch(gridRef, (el, prev) => {
  if (prev && resizeObserver) resizeObserver.unobserve(prev)
  if (el) {
    resizeObserver ||= new ResizeObserver(() => measure())
    resizeObserver.observe(el)
    nextTick(measure)
  }
})

// ---- Remember scroll position per album ----
const scrollMemory = new Map()
watch(() => store.activeAlbum?.id ?? null, (id, prevId) => {
  scrollMemory.set(prevId ?? 'root', lastScrollY)
  nextTick(() => {
    if (id && !store.currentMedia.length) return // restored once the media has loaded
    window.scrollTo(0, scrollMemory.get(id ?? 'root') || 0)
  })
}, { flush: 'sync' })

watch(() => store.loadingMedia, (loading) => {
  if (!loading && store.activeAlbum) {
    nextTick(() => {
      measure()
      window.scrollTo(0, scrollMemory.get(store.activeAlbum.id) || 0)
    })
  }
})

// ───────────── Selection & opening ─────────────
const lastSelectedIndex = ref(-1)
const focusIndex = ref(0)

const LONG_PRESS_MS = 450
const pressingId = ref(null)
let press = null
let suppressClick = false
let lastPointerType = 'mouse'

function onTilePointerDown(e, t) {
  lastPointerType = e.pointerType
  suppressClick = false
  if (e.pointerType !== 'touch' || e.target.closest('.tile-check, .tile-more')) return
  clearPress()
  pressingId.value = t.item.id
  press = {
    x: e.clientX,
    y: e.clientY,
    timer: setTimeout(() => {
      press = null
      pressingId.value = null
      suppressClick = true
      if (!isSelected(t.item.id)) store.toggleSelect(t.item.id)
      lastSelectedIndex.value = t.index
      navigator.vibrate?.(12)
      try {
        if (!sessionStorage.getItem('ax-longpress-hint')) {
          sessionStorage.setItem('ax-longpress-hint', '1')
          store.showNotice('Tap more photos to add them', 'info')
        }
      } catch { /* storage unavailable: skip the hint */ }
    }, LONG_PRESS_MS)
  }
}

function onTilePointerMove(e) {
  if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) clearPress()
}

function clearPress() {
  if (press) clearTimeout(press.timer)
  press = null
  pressingId.value = null
}

function onTileContextMenu(e) {
  if (lastPointerType === 'touch') e.preventDefault()
}

function isSelected(mediaId) {
  return store.selectedMediaIds.includes(mediaId)
}

function openWithTransition(index, tileEl) {
  const thumb = tileEl?.querySelector('img')
  if (!document.startViewTransition || reduceMotion() || !thumb) {
    store.openViewer(index)
    return
  }
  let targetEl = null
  thumb.style.viewTransitionName = 'ax-media'
  try {
    const vt = trackTransition(document.startViewTransition(async () => {
      thumb.style.removeProperty('view-transition-name')
      store.openViewer(index)
      await nextTick()
      targetEl = viewerMediaEl()
      targetEl?.style.setProperty('view-transition-name', 'ax-media')
    }))
    vt.finished.catch(() => {}).finally(() => {
      targetEl?.style.removeProperty('view-transition-name')
      document.querySelectorAll('[style*="view-transition-name"]').forEach(el => el.style.removeProperty('view-transition-name'))
    })
  } catch {
    store.openViewer(index)
  }
}

function handleMediaClick(item, index, event) {
  if (suppressClick) {
    suppressClick = false
    return
  }
  if (event && event.shiftKey && lastSelectedIndex.value !== -1) {
    store.selectRange(lastSelectedIndex.value, index)
    lastSelectedIndex.value = index
    return
  }
  lastSelectedIndex.value = index
  if (store.selectedCount > 0 || (event && (event.ctrlKey || event.metaKey))) {
    store.toggleSelect(item.id)
  } else {
    openWithTransition(index, event?.currentTarget)
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

function toggleBatchSelect() {
  if (store.selectedCount > 0) store.clearSelection()
  else store.selectAll()
}

// ───────────── Keyboard navigation (arrows move between tiles) ─────────────
function rowOfIndex(index) {
  return layout.value.rows.findIndex(r => r.items.some(t => t.index === index))
}

function neighbourIndex(index, key) {
  const total = store.displayMedia.length
  if (key === 'ArrowLeft') return Math.max(0, index - 1)
  if (key === 'ArrowRight') return Math.min(total - 1, index + 1)
  if (key === 'Home') return 0
  if (key === 'End') return total - 1
  const rows = layout.value.rows
  const r = rowOfIndex(index)
  const target = rows[key === 'ArrowDown' ? r + 1 : r - 1]
  if (!target) return index
  const here = rows[r].items.find(t => t.index === index)
  const gap = gapSize.value
  const x = rows[r].items.slice(0, rows[r].items.indexOf(here)).reduce((a, t) => a + t.w + gap, 0) + here.w / 2
  let acc = 0
  let best = target.items[0]
  let bestDist = Infinity
  for (const t of target.items) {
    const dist = Math.abs(acc + t.w / 2 - x)
    if (dist < bestDist) { best = t; bestDist = dist }
    acc += t.w + gap
  }
  return best.index
}

function focusTile(index) {
  focusIndex.value = index
  const row = layout.value.rows[rowOfIndex(index)]
  if (row && gridRef.value) {
    const gridTop = gridRef.value.getBoundingClientRect().top + window.scrollY
    const top = gridTop + row.top
    if (top < window.scrollY + 70 || top + row.height > window.scrollY + window.innerHeight - 20) {
      window.scrollTo({ top: top - window.innerHeight / 3 })
    }
  }
  // The row may only be rendered after the scroll/measure cycle
  nextTick(() => requestAnimationFrame(() => {
    measure()
    nextTick(() => gridRef.value?.querySelector(`[data-index="${index}"]`)?.focus({ preventScroll: true }))
  }))
}

function onTileKeydown(e, t) {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
    e.preventDefault()
    focusTile(neighbourIndex(t.index, e.key))
  } else if (e.key === 'Enter') {
    e.preventDefault()
    handleMediaClick(t.item, t.index, e)
  } else if (e.key === ' ') {
    e.preventDefault()
    store.toggleSelect(t.item.id)
    lastSelectedIndex.value = t.index
  } else if (e.key === 'Delete') {
    e.preventDefault()
    if (store.selectedCount > 0 && isSelected(t.item.id)) store.batchDelete()
    else store.trashMedia([t.item.id])
  } else if (e.key === 's' || e.key === 'S') {
    store.toggleFavorite([t.item.id], !t.item.favorite)
  }
}

// After closing the viewer, land on the item that was being viewed
watch(() => store.viewerOpen, (open, wasOpen) => {
  if (wasOpen && !open && store.activeAlbum) focusTile(Math.min(store.viewerActiveIndex, store.displayMedia.length - 1))
})

// Esc clears a selection (App.vue leaves Esc alone while a selection exists)
function onEscape(e) {
  if (e.key === 'Escape' && store.selectedCount > 0 && !store.viewerOpen && !document.querySelector('.v-overlay--active')) {
    store.clearSelection()
  }
}

function formatLockCountdown(sec) {
  if (!sec || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

// ───────────── Uploads ─────────────
function triggerFileInput() {
  targetUploadAlbum.value = null
  fileInputRef.value?.click()
}

function triggerUploadForAlbum(album) {
  targetUploadAlbum.value = album
  fileInputRef.value?.click()
}

function handleFilesSelected(e) {
  const files = e.target.files
  const targetId = targetUploadAlbum.value?.id || store.activeAlbum?.id
  if (files?.length && targetId) store.uploadFiles(targetId, files)
  targetUploadAlbum.value = null
  e.target.value = ''
}

function handleDrop(e) {
  isDragging.value = false
  const files = e.dataTransfer.files
  const targetId = targetUploadAlbum.value?.id || store.activeAlbum?.id
  if (files?.length && targetId) store.uploadFiles(targetId, files)
}

// ───────────── Dialogs ─────────────
const albumDialog = ref({ open: false, isEdit: false, id: null, title: '', description: '' })
const deleteConfirmDialog = ref({ open: false, album: null })

function openNewAlbumModal() {
  albumDialog.value = { open: true, isEdit: false, id: null, title: '', description: '' }
}

function openEditAlbumModal(album) {
  albumDialog.value = { open: true, isEdit: true, id: album.id, title: album.title, description: album.description }
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
  deleteConfirmDialog.value = { open: true, album }
}

async function executeDeleteAlbum() {
  if (deleteConfirmDialog.value.album) {
    await store.deleteAlbum(deleteConfirmDialog.value.album.id)
  }
  deleteConfirmDialog.value.open = false
}

// The viewer asks for a tile to be on screen (and rendered) before animating back to it
function onRevealTile(e) {
  const index = e.detail?.index
  const row = layout.value.rows[rowOfIndex(index)]
  if (!row || !gridRef.value) return
  const gridTop = gridRef.value.getBoundingClientRect().top + window.scrollY
  const top = gridTop + row.top
  if (top < window.scrollY + 70 || top + row.height > window.scrollY + window.innerHeight - 20) {
    window.scrollTo({ top: Math.max(0, top - window.innerHeight / 3), behavior: 'instant' })
    e.detail.ready = new Promise((resolve) => {
      nextTick(() => requestAnimationFrame(() => { measure(); nextTick(resolve) }))
    })
  }
}

onMounted(() => {
  document.documentElement.classList.add('ax-vault')
  store.fetchVaultStats()
  window.addEventListener('ax:reveal-tile', onRevealTile)
  window.addEventListener('scroll', onScrollOrResize, { passive: true })
  window.addEventListener('resize', onScrollOrResize)
  window.addEventListener('keydown', onEscape)
  if (mobileMq?.addEventListener) mobileMq.addEventListener('change', onMq)
})

onUnmounted(() => {
  document.documentElement.classList.remove('ax-vault')
  clearPress()
  window.removeEventListener('ax:reveal-tile', onRevealTile)
  window.removeEventListener('scroll', onScrollOrResize)
  window.removeEventListener('resize', onScrollOrResize)
  window.removeEventListener('keydown', onEscape)
  if (mobileMq?.removeEventListener) mobileMq.removeEventListener('change', onMq)
  resizeObserver?.disconnect()
  if (raf) cancelAnimationFrame(raf)
})
</script>

<style scoped>
.gallery { min-height: 100vh; background: var(--ax-bg); color: var(--ax-text); }

/* ── Top bar ── */
.topbar {
  position: sticky; top: 0; z-index: 20;
  background: rgba(var(--v-theme-background), 0.8);
  backdrop-filter: blur(16px) saturate(150%);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
  border-bottom: 1px solid var(--ax-line);
}
.topbar-inner { max-width: var(--ax-container-wide); margin: 0 auto; height: 56px; padding: 0 var(--ax-gutter); display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.crumbs { display: flex; align-items: center; gap: 6px; min-width: 0; }
.brand {
  display: grid; place-items: center; width: 30px; height: 30px; margin-right: 6px;
  border-radius: 8px; border: 1px solid var(--ax-accent-ring); background: var(--ax-accent-soft); color: var(--ax-accent); cursor: pointer;
}
.crumb { display: inline-flex; align-items: center; min-height: 34px; padding: 0 8px; border: 0; background: none; border-radius: 6px; color: var(--ax-text-2); font: 500 14px/1 var(--font-sans); cursor: pointer; max-width: 280px; }
.crumb:hover { color: var(--ax-text); }
.crumb.is-current { color: var(--ax-text); cursor: default; }
.crumb-sep { color: var(--ax-text-3); }
.topbar-actions { display: flex; align-items: center; gap: 4px; }
.lock-chip {
  display: inline-flex; align-items: center; gap: 7px; height: 28px; padding: 0 10px; margin-right: 6px;
  border-radius: 999px; border: 1px solid var(--ax-line); color: var(--ax-text-2); font-size: 12px;
}
.lock-chip.is-low { color: var(--ax-danger); border-color: rgba(var(--v-theme-error), 0.45); }
.lock-chip.is-low .lock-dot { background: var(--ax-danger); box-shadow: 0 0 0 3px rgba(var(--v-theme-error), 0.2); }
.lock-dot { width: 6px; height: 6px; border-radius: 50%; background: rgb(var(--v-theme-success)); box-shadow: 0 0 0 3px rgba(var(--v-theme-success), 0.18); }

/* ── Page ── */
.page { max-width: var(--ax-container-wide); margin: 0 auto; padding: 32px var(--ax-gutter) calc(96px + var(--ax-safe-bottom)); }
.page-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 28px; }
.head-back { display: flex; align-items: center; gap: 12px; min-width: 0; }
.page-title { margin: 0; font-size: 24px; font-weight: 650; letter-spacing: -0.025em; line-height: 1.2; }
.page-meta { margin: 6px 0 0; font-size: 13px; color: var(--ax-text-2); }
.page-meta i, .album-sub i { display: inline-block; width: 3px; height: 3px; margin: 0 8px; border-radius: 50%; background: var(--ax-text-3); vertical-align: middle; }
.page-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }

/* ── Album grid ── */
.album-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 24px 20px; }
.album { cursor: pointer; }
.album-cover {
  position: relative; aspect-ratio: 4 / 3; overflow: hidden; border-radius: 14px;
  background: var(--ax-surface); border: 1px solid var(--ax-line);
  transition: border-color var(--ax-med) var(--ax-ease), transform var(--ax-med) var(--ax-ease), box-shadow var(--ax-med) var(--ax-ease);
}
@media (hover: hover) {
  .album:hover .album-cover { border-color: var(--ax-line-strong); transform: translateY(-2px); box-shadow: var(--ax-shadow); }
  .album:hover .album-cover img { transform: scale(1.035); }
}
.album-cover img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 600ms var(--ax-ease); }
.album-empty { width: 100%; height: 100%; display: grid; place-items: center; color: var(--ax-text-3); }
.album-count, .tile-badge {
  position: absolute; display: inline-flex; align-items: center; gap: 5px; height: 22px; padding: 0 8px; border-radius: 999px;
  background: rgba(9, 9, 11, 0.62); backdrop-filter: blur(8px); color: #fff; font-size: 11.5px; font-weight: 500;
}
.album-count { left: 10px; bottom: 10px; }
.album-more, .tile-more {
  position: absolute; top: 8px; right: 8px; display: grid; place-items: center; width: 28px; height: 28px; border: 0; border-radius: 8px;
  background: rgba(9, 9, 11, 0.62); backdrop-filter: blur(8px); color: #fff; cursor: pointer; opacity: 0; transition: opacity var(--ax-fast);
}
.album-more[aria-expanded='true'], .tile-more[aria-expanded='true'] { opacity: 1; }
@media (hover: hover) {
  .album:hover .album-more, .tile:hover .tile-more { opacity: 1; }
  .album-more:hover, .tile-more:hover { background: rgba(9, 9, 11, 0.85); }
}
.album-info { padding: 12px 2px 0; }
.album-title { font-size: 14.5px; font-weight: 650; letter-spacing: -0.012em; }
.album-sub { margin-top: 3px; font-size: 12.5px; color: var(--ax-text-2); }
.album-new {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; aspect-ratio: 4 / 3;
  border-radius: 14px; border: 1px dashed var(--ax-line-strong); background: transparent; color: var(--ax-text-2);
  font: 500 13px/1 var(--font-sans); cursor: pointer; transition: border-color var(--ax-fast), color var(--ax-fast), background-color var(--ax-fast);
}
.album-new:hover { border-color: var(--ax-accent-ring); color: var(--ax-text); background: var(--ax-accent-soft); }
.album-new-plus { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 12px; background: var(--ax-surface-2); border: 1px solid var(--ax-line); }

/* ── Manager ── */
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 20px; }
.stat { padding: 16px 18px; border-radius: var(--ax-radius-lg); background: var(--ax-surface); border: 1px solid var(--ax-line); }
.stat b { display: block; font-size: 22px; font-weight: 650; letter-spacing: -0.02em; }
.stat span { font-size: 12px; color: var(--ax-text-2); }
.row-album { display: flex; align-items: center; gap: 12px; cursor: pointer; min-width: 220px; }
.row-thumb { flex: none; display: grid; place-items: center; width: 40px; height: 40px; overflow: hidden; border-radius: 9px; background: var(--ax-surface-2); border: 1px solid var(--ax-line); color: var(--ax-text-3); }
.row-thumb img { width: 100%; height: 100%; object-fit: cover; }
.row-text { display: flex; flex-direction: column; min-width: 0; }
.row-title { font-weight: 600; font-size: 13.5px; }
.row-album:hover .row-title { color: var(--ax-accent); }
.row-desc { max-width: 300px; font-size: 12px; color: var(--ax-text-2); }
.row-actions { display: flex; justify-content: flex-end; gap: 2px; }

/* ── Album contents ── */
.filters { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 20px; }
.filters-right { display: flex; flex-wrap: wrap; gap: 8px; }
.filters-right .ax-search { width: 240px; }
.filters-right .sort { width: 168px; }
.seg-n { color: var(--ax-text-3); font-variant-numeric: tabular-nums; }
.is-active .seg-n { color: var(--ax-text-2); }
.jgrid { position: relative; width: 100%; }
.jgroup { position: absolute; left: 0; right: 0; display: flex; align-items: flex-end; gap: 10px; margin: 0; padding-bottom: 10px; font-size: 14px; font-weight: 600; letter-spacing: -0.01em; }
.jrow { position: absolute; left: 0; right: 0; display: flex; gap: 6px; }
.tile {
  position: relative; flex: none; height: 100%; overflow: hidden; cursor: pointer; border-radius: 10px; outline: none;
  background: var(--ax-surface); border: 1px solid var(--ax-line);
  -webkit-tap-highlight-color: transparent;
}
.tile img {
  width: 100%; height: 100%; object-fit: cover; display: block;
  transition: transform var(--ax-fast) var(--ax-ease);
  -webkit-touch-callout: none; -webkit-user-select: none; user-select: none;
}
.tile.is-pressing {
  transform: scale(0.96);
  transition: transform 450ms var(--ax-ease);
}
@media (prefers-reduced-motion: reduce) {
  .tile.is-pressing { transform: none; }
}
@media (hover: hover) {
  .tile:hover { border-color: var(--ax-line-strong); }
}
.tile:focus-visible { box-shadow: 0 0 0 2px var(--ax-bg), 0 0 0 4px var(--ax-accent); }
.tile::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(to top, rgba(0, 0, 0, 0.5), transparent 45%); opacity: 0; transition: opacity var(--ax-fast); }
.tile:focus-visible::after { opacity: 1; }
@media (hover: hover) {
  .tile:hover::after { opacity: 1; }
}
.tile.is-selected { box-shadow: 0 0 0 2px var(--ax-accent); border-color: transparent; }
.tile.is-selected img { transform: scale(0.94); border-radius: 8px; }
.tile-play {
  position: absolute; z-index: 1; left: 50%; top: 50%; display: grid; place-items: center; width: 40px; height: 40px; margin: -20px 0 0 -20px;
  border-radius: 50%; background: rgba(9, 9, 11, 0.55); backdrop-filter: blur(6px); color: #fff; pointer-events: none;
}
.tile-check {
  position: absolute; z-index: 2; top: 8px; left: 8px; display: grid; place-items: center; width: 22px; height: 22px; padding: 0;
  border-radius: 7px; border: 1.5px solid rgba(255, 255, 255, 0.85); background: rgba(9, 9, 11, 0.35); color: transparent; cursor: pointer;
  opacity: 0; transition: opacity var(--ax-fast), background-color var(--ax-fast);
}
.tile-check::before { content: ''; position: absolute; inset: -9px; }
.tile-more::before { content: ''; position: absolute; inset: -6px; }
.tile:focus-visible .tile-check, .tile.is-selecting .tile-check { opacity: 1; }
@media (hover: hover) {
  .tile:hover .tile-check { opacity: 1; }
}
.tile.is-selected .tile-check { opacity: 1; background: var(--ax-accent); border-color: var(--ax-accent); color: #fff; }
.tile-more { z-index: 2; }
.tile-badge { left: 8px; bottom: 8px; z-index: 2; font-size: 11px; }
.tile-fav { position: absolute; z-index: 2; right: 38px; top: 9px; color: #fbbf24; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.7)); pointer-events: none; }
.tile-size { position: absolute; z-index: 1; right: 8px; bottom: 8px; font-size: 11px; color: rgba(255, 255, 255, 0.9); opacity: 0; transition: opacity var(--ax-fast); }
@media (hover: hover) {
  .tile:hover .tile-size { opacity: 1; }
}
.no-match { margin: 56px 0; text-align: center; color: var(--ax-text-2); font-size: 14px; }

/* ── Skeletons ── */
.sk-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.sk-tile { height: 190px; max-width: 100%; border-radius: 10px; }
.sk-line { height: 12px; width: 60%; margin-top: 12px; border-radius: 6px; }
.sk-line.short { width: 35%; margin-top: 8px; }

/* ── Empty state ── */
.dropzone {
  display: flex; flex-direction: column; align-items: center; text-align: center; padding: 72px 24px;
  border-radius: var(--ax-radius-xl); border: 1px dashed var(--ax-line-strong); background: var(--ax-surface);
}
.dropzone-icon { display: grid; place-items: center; width: 56px; height: 56px; margin-bottom: 18px; border-radius: 16px; color: var(--ax-accent); background: var(--ax-accent-soft); border: 1px solid var(--ax-accent-ring); }
.dropzone h2 { margin: 0 0 6px; font-size: 17px; font-weight: 600; letter-spacing: -0.015em; }
.dropzone p { margin: 0 0 22px; max-width: 340px; font-size: 13.5px; color: var(--ax-text-2); }

/* ── Drag overlay ── */
.drop-overlay { position: fixed; inset: 0; z-index: 3000; display: grid; place-items: center; background: rgba(9, 9, 11, 0.78); backdrop-filter: blur(6px); }
.drop-card {
  display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 40px 56px; border-radius: 20px;
  border: 1.5px dashed var(--ax-accent); background: var(--ax-accent-soft); color: var(--ax-accent);
}
.drop-card strong { font-size: 16px; color: var(--ax-text); }
.drop-card span:last-child { font-size: 13px; color: var(--ax-text-2); }

/* ── Pull to refresh ── */
.ptr-chip {
  position: fixed;
  top: calc(56px + var(--ax-safe-top) + 8px);
  left: 50%;
  margin-left: -18px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--ax-surface-2);
  border: 1px solid var(--ax-line);
  box-shadow: var(--ax-shadow);
  display: grid;
  place-items: center;
  z-index: 25;
  color: var(--ax-accent);
  pointer-events: none;
  transition: opacity var(--ax-fast);
}
.ptr-chip .spin-anim {
  animation: ptr-spin 700ms linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .ptr-chip { transform: none !important; }
  .ptr-chip .spin-anim { animation: none; }
}
@keyframes ptr-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Touch screens have no hover: keep the select/options controls visible with comfortable tap targets */
@media (hover: none) {
  .tile-check, .tile-more, .album-more { opacity: 1; }
  .tile-check { width: 30px; height: 30px; border-radius: 9px; }
  .tile-more, .album-more { width: 32px; height: 32px; border-radius: 9px; }
  .tile-size { display: none; }
  .tile-fav { top: auto; right: 8px; bottom: 8px; }
  .tile::after { opacity: 0.55; }
}

@media (max-width: 600px) {
  .topbar-inner, .page { padding-inline: var(--ax-gutter); }
  .crumbs .crumb-sep, .crumbs .crumb-sep + .crumb { display: none; }

  .page-head { flex-direction: column; align-items: stretch; gap: 14px; margin-bottom: 20px; }
  .page-title { font-size: 20px; }
  .page-meta { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .page-tools { width: 100%; display: flex; gap: 8px; }
  .page-tools > .ax-seg { width: 100%; }
  .page-tools > .ax-seg button { flex: 1; justify-content: center; }
  .page-tools > .ax-btn { flex: 1; }
  .page-tools > .ax-btn.is-outline { flex: 0 0 40px; padding: 0; }
  .page-tools .btn-label { display: none; }

  /* Album grid */
  .album-grid { grid-template-columns: repeat(2, 1fr); gap: 16px 12px; }
  .album-cover { border-radius: 12px; }
  .album-title { font-size: 13.5px; }
  .album-sub { font-size: 11.5px; }
  .album-info { padding-top: 10px; }

  /* Manager table becomes cards */
  .stat b { font-size: 18px; }
  .manager-table thead { display: none; }
  .manager-table, .manager-table tbody { display: block; }
  .manager-table tr {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas: "album album" "contents size" "date actions";
    gap: 10px 12px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--ax-line);
  }
  .manager-table tr:last-child { border-bottom: 0; }
  .manager-table td { padding: 0; border: 0; }
  .manager-table tbody tr:hover td { background: none; }
  .c-album { grid-area: album; }
  .c-contents { grid-area: contents; }
  .c-size { grid-area: size; text-align: right; font-size: 12.5px; }
  .c-date { grid-area: date; align-self: center; font-size: 12.5px; }
  .c-actions { grid-area: actions; }
  .row-album { min-width: 0; }
  .row-desc { max-width: none; }

  /* Filters */
  .filters { flex-direction: column; align-items: stretch; gap: 10px; margin-bottom: 16px; }
  .filters .ax-seg { width: 100%; overflow: visible; }
  .filters .ax-seg button { flex: 1; justify-content: center; padding: 0 8px; }
  .filters-right { display: flex; flex-wrap: nowrap; width: 100%; gap: 8px; }
  .filters-right .ax-search { flex: 1; width: auto; min-width: 0; }
  .filters-right .sort { flex: 0 0 136px; width: 136px; }

  /* 2-column square gallery grid on mobile */
  .sk-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px; }
  .sk-tile { width: auto !important; height: auto; aspect-ratio: 1; border-radius: 8px; }
  .tile { border-radius: 8px; }
  .jgroup { font-size: 13px; }
  .dropzone { padding: 48px 20px; }
  .dropzone h2 { font-size: 16px; }
}
</style>
