<template>
  <v-theme-provider v-if="store.viewerOpen" theme="apexDark" class="viewer-theme">
  <div
    ref="viewerRef"
    class="viewer"
      :class="{ 'is-fullscreen': isFullscreen, 'cursor-hidden': isFullscreen && !hudVisible }"
      :style="{ '--veil': veil, '--bar-top-h': `${barTop}px`, '--bar-top': hudVisible && !isFullscreen ? `${barTop}px` : '0px', '--bar-bottom': hudVisible && !isFullscreen ? `${barBottom}px` : '0px' }"
      role="dialog"
      aria-modal="true"
      aria-label="Media viewer"
      tabindex="0"
      @keydown="handleKeydown"
      @mousemove="onMouseMoveViewer"
    >
      <div v-if="store.slideshowPlaying && !isFullscreen" class="progress" :style="{ width: `${progressPercent}%` }"></div>

      <!-- Top bar -->
      <div ref="topBarRef" class="bar top" :class="{ 'is-hidden': !hudVisible }">
        <div class="meta">
          <span class="name text-truncate">{{ currentMedia?.title || currentMedia?.originalName }}</span>
          <span class="count font-mono tabular">{{ store.viewerActiveIndex + 1 }} / {{ store.displayMedia.length }}</span>
          <span v-if="dimensions" class="count font-mono d-none d-md-inline">{{ dimensions }}</span>
        </div>
        <div class="tools">
          <button class="ax-icon-btn" :class="{ 'is-active': currentMedia?.favorite }" :title="currentMedia?.favorite ? 'Remove favourite (S)' : 'Favourite (S)'" @click="toggleFavorite">
            <v-icon :icon="currentMedia?.favorite ? 'mdi-star' : 'mdi-star-outline'" size="18"></v-icon>
          </button>
          <button class="ax-icon-btn" :class="{ 'is-active': showInfo }" title="Details (I)" @click="showInfo = !showInfo"><v-icon icon="mdi-information-outline" size="18"></v-icon></button>
          <a class="ax-icon-btn" :href="`/media-stream/${currentMedia?.id}`" :download="currentMedia?.originalName || 'media'" title="Download (D)">
            <v-icon icon="mdi-download-outline" size="18"></v-icon>
          </a>
          <button class="ax-icon-btn is-danger" title="Delete (Del)" @click="deleteCurrent"><v-icon icon="mdi-delete-outline" size="18"></v-icon></button>
          <span class="tools-sep"></span>
          <button class="ax-icon-btn d-none d-sm-grid" title="Shortcuts (?)" @click="showHelp = !showHelp"><v-icon icon="mdi-keyboard-outline" size="18"></v-icon></button>
          <button class="ax-icon-btn fs-btn" :title="isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'" @click="toggleFullscreen">
            <v-icon :icon="isFullscreen ? 'mdi-fullscreen-exit' : 'mdi-fullscreen'" size="18"></v-icon>
          </button>
          <button class="ax-icon-btn" title="Close (Esc)" @click="closeWithTransition"><v-icon icon="mdi-close" size="18"></v-icon></button>
        </div>
      </div>

    <!-- Stage -->
    <div
      ref="stageRef"
      class="stage"
      @wheel.prevent="onWheel"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
      @dblclick="onDoubleClick"
    >
      <transition name="xfade">
        <div
          v-if="currentMedia"
          :key="currentMedia.id"
          class="frame"
          :class="{ 'is-dragging': gesture === 'swipe-x' || gesture === 'swipe-y' || gesture === 'pan' || gesture === 'pinch' }"
          :style="{
            transform: `translate(${panX + dragX}px, ${panY + dragY}px) scale(${scale})`,
            cursor: canPan ? (isPanning ? 'grabbing' : 'grab') : 'default'
          }"
        >
          <template v-if="!currentMedia.isVideo">
            <img class="layer placeholder" :class="{ 'is-hidden': fullLoaded }" :src="`/thumb/${currentMedia.id}`" alt="" draggable="false" />
            <img
              class="layer full"
              :class="{ 'is-loaded': fullLoaded }"
              :src="`/media-stream/${currentMedia.id}`"
              :alt="currentMedia.title"
              draggable="false"
              @load="onImageLoad"
            />
            <div v-if="!fullLoaded" class="spinner" aria-hidden="true"></div>
          </template>
          <video
            v-else
            ref="videoPlayerRef"
            class="layer video"
            :src="`/media-stream/${currentMedia.id}`"
            :poster="`/thumb/${currentMedia.id}`"
            controls autoplay playsinline
            @ended="onVideoEnded"
          ></video>
        </div>
      </transition>
    </div>

    <button class="arrow left" :class="{ 'is-hidden': !hudVisible }" title="Previous (←)" @click="prev"><v-icon icon="mdi-chevron-left" size="22"></v-icon></button>
    <button class="arrow right" :class="{ 'is-hidden': !hudVisible, 'has-info': showInfo }" title="Next (→)" @click="next"><v-icon icon="mdi-chevron-right" size="22"></v-icon></button>

    <!-- Details drawer -->
    <transition name="drawer">
      <aside v-if="showInfo && currentMedia" class="info" aria-label="Details">
        <header>
          <h3>Details</h3>
          <button class="ax-icon-btn" title="Close details" @click="showInfo = false"><v-icon icon="mdi-close" size="17"></v-icon></button>
        </header>
        <dl>
          <div><dt>Name</dt><dd>{{ currentMedia.originalName || currentMedia.title }}</dd></div>
          <div><dt>Type</dt><dd>{{ currentMedia.mimeType || (currentMedia.isVideo ? 'Video' : 'Image') }}</dd></div>
          <div><dt>Size</dt><dd class="font-mono">{{ formatBytes(currentMedia.size) }}</dd></div>
          <div v-if="dimensions || currentMedia.width"><dt>Dimensions</dt><dd class="font-mono">{{ dimensions || `${currentMedia.width} × ${currentMedia.height}` }}</dd></div>
          <div v-if="currentMedia.duration"><dt>Duration</dt><dd class="font-mono">{{ formatDuration(currentMedia.duration) }}</dd></div>
          <div v-if="currentMedia.createdAt"><dt>Added</dt><dd>{{ new Date(currentMedia.createdAt).toLocaleString() }}</dd></div>
          <div v-if="store.activeAlbum"><dt>Album</dt><dd>{{ store.activeAlbum.title }}</dd></div>
        </dl>
      </aside>
    </transition>

    <!-- Bottom: filmstrip + controls -->
    <div v-if="!isFullscreen" ref="bottomBarRef" class="bar bottom" :class="{ 'is-hidden': !hudVisible }">
      <div v-if="store.displayMedia.length > 1" ref="stripRef" class="strip" role="listbox" aria-label="Items">
        <button
          v-for="(m, i) in store.displayMedia"
          :key="m.id"
          class="strip-item"
          :class="{ 'is-active': i === store.viewerActiveIndex }"
          :data-i="i"
          role="option"
          :aria-selected="i === store.viewerActiveIndex"
          :title="m.title"
          @click="store.viewerActiveIndex = i"
        >
          <img :src="`/thumb/${m.id}`" alt="" loading="lazy" draggable="false" />
          <v-icon v-if="m.isVideo" class="strip-play" icon="mdi-play" size="12"></v-icon>
        </button>
      </div>

      <div class="controls">
        <div class="group zoom-group">
          <button class="ax-icon-btn" :disabled="percent <= PRESETS[0]" title="Zoom out" @click="zoomOut"><v-icon icon="mdi-minus" size="18"></v-icon></button>
          <div class="zoom-field" :class="{ 'is-editing': zoomDraft !== null }">
            <input
              class="zoom-input font-mono tabular"
              inputmode="numeric"
              aria-label="Zoom percentage"
              :value="zoomDraft ?? percent"
              @focus="onZoomFocus"
              @input="zoomDraft = $event.target.value"
              @keydown.stop="onZoomKey"
              @blur="commitZoom"
            />
            <span class="zoom-unit">%</span>
            <v-menu location="top" :close-on-content-click="true">
              <template #activator="{ props }">
                <button v-bind="props" class="zoom-caret" title="Zoom options" aria-label="Zoom options"><v-icon icon="mdi-chevron-down" size="16"></v-icon></button>
              </template>
              <div class="ax-menu zoom-menu">
                <button class="ax-menu-item" @click="fitWidth">Fit to width</button>
                <button class="ax-menu-item" @click="resetZoom">Fit to page</button>
                <div class="ax-menu-sep"></div>
                <button v-for="p in PRESETS" :key="p" class="ax-menu-item" :class="{ 'is-current': p === percent }" @click="setPercent(p)">{{ p }}%</button>
              </div>
            </v-menu>
          </div>
          <button class="ax-icon-btn" :disabled="percent >= PRESETS[PRESETS.length - 1]" title="Zoom in" @click="zoomIn"><v-icon icon="mdi-plus" size="18"></v-icon></button>
          <button class="ax-icon-btn zoom-fit" title="Fit to page" @click="resetZoom"><v-icon icon="mdi-fit-to-screen-outline" size="18"></v-icon></button>
        </div>

        <div class="group center">
          <button class="ax-btn is-sm" @click="toggleSlideshow">
            <v-icon :icon="store.slideshowPlaying ? 'mdi-pause' : 'mdi-play'"></v-icon><span class="btn-label">{{ store.slideshowPlaying ? 'Pause' : 'Slideshow' }}</span>
          </button>
          <button class="ax-icon-btn" :class="{ 'is-active': store.slideshowShuffle }" title="Shuffle" @click="store.slideshowShuffle = !store.slideshowShuffle">
            <v-icon icon="mdi-shuffle-variant" size="17"></v-icon>
          </button>
          <v-menu location="top">
            <template #activator="{ props }">
              <button v-bind="props" class="ax-btn is-sm is-outline font-mono" title="Seconds per slide" aria-label="Seconds per slide">{{ store.slideshowInterval }}s<v-icon icon="mdi-chevron-up"></v-icon></button>
            </template>
            <div class="ax-menu" style="min-width: 110px">
              <button v-for="sec in [1, 2, 3, 5, 8, 10, 15]" :key="sec" class="ax-menu-item font-mono" @click="setRotationInterval(sec)">
                <span class="flex-grow-1">{{ sec }}s</span>
                <v-icon v-if="store.slideshowInterval === sec" icon="mdi-check" size="15" style="color: var(--ax-accent)"></v-icon>
              </button>
            </div>
          </v-menu>
        </div>

        <div class="group end">
          <button v-if="currentMedia?.isVideo" class="ax-icon-btn" title="Mute (M)" @click="toggleMute">
            <v-icon :icon="isMuted ? 'mdi-volume-off' : 'mdi-volume-high'" size="18"></v-icon>
          </button>
        </div>
      </div>
    </div>

    <!-- Shortcuts -->
    <v-dialog v-model="showHelp" max-width="420">
      <div class="ax-modal">
        <div class="ax-modal-head">
          <div><h2 class="ax-modal-title">Keyboard shortcuts</h2></div>
          <button class="ax-icon-btn" @click="showHelp = false"><v-icon icon="mdi-close" size="18"></v-icon></button>
        </div>
        <ul class="keys">
          <li><span>Previous / next</span><span><kbd>←</kbd><kbd>→</kbd></span></li>
          <li><span>Toggle slideshow</span><kbd>Space</kbd></li>
          <li><span>Favourite</span><kbd>S</kbd></li>
          <li><span>Details</span><kbd>I</kbd></li>
          <li><span>Fit page / actual size</span><kbd>Z</kbd></li>
          <li><span>Download original</span><kbd>D</kbd></li>
          <li><span>Delete (with undo)</span><kbd>Del</kbd></li>
          <li><span>Mute video</span><kbd>M</kbd></li>
          <li><span>Fullscreen</span><kbd>F</kbd></li>
          <li><span>Close</span><kbd>Esc</kbd></li>
        </ul>
        <p class="ax-hint" style="margin-top: 14px">Double-click (or double-tap) zooms in and back out. On touch: swipe to navigate, pinch to zoom, swipe down to close.</p>
      </div>
    </v-dialog>
  </div>
  </v-theme-provider>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useVaultStore } from '../stores/vaultStore'
import { reduceMotion, viewerMediaEl, trackTransition } from '../viewTransition'

const store = useVaultStore()
const viewerRef = ref(null)
const stageRef = ref(null)
const stripRef = ref(null)
const topBarRef = ref(null)
const bottomBarRef = ref(null)
const barTop = ref(56)
const barBottom = ref(84)
const zoomDraft = ref(null)
const videoPlayerRef = ref(null)

// UI state
const showHelp = ref(false)
const showInfo = ref(false)
const dimensions = ref(null)
const isMuted = ref(false)
const fullLoaded = ref(false)

// Zoom & pan. `scale` is relative to "fit to page" (1 = whole image visible); the percentage
// shown to the user is relative to the image's actual pixels, like a document viewer.
const PRESETS = [10, 25, 50, 75, 100, 125, 150, 200, 400, 800]
const natural = ref({ w: 0, h: 0 })
const stageSize = ref({ w: 0, h: 0 })
const scale = ref(1)
const panX = ref(0)
const panY = ref(0)
const isPanning = ref(false)

// Touch / pointer gesture state
const dragX = ref(0)
const dragY = ref(0)
const gesture = ref(null) // 'pending' | 'pan' | 'swipe-x' | 'swipe-y' | 'pinch' | null
const pointers = new Map()
let startPt = { x: 0, y: 0, t: 0 }
let panOrigin = { x: 0, y: 0 }
let pinchStartDist = 0
let pinchStartScale = 1
let lastTap = { t: 0, x: 0, y: 0 }
let lastPointerType = 'mouse'
let tapTimer = null

// Slideshow
const progressPercent = ref(0)
let slideshowTimer = null
let elapsedMs = 0
const TICK_MS = 100

// Fullscreen & auto-hiding controls
const isFullscreen = ref(false)
const hudVisible = ref(true)
let hudTimer = null

const currentMedia = computed(() => store.activeMediaItem)

// Scale at which the whole image fits the stage (actual-pixel ratio)
const fit = computed(() => {
  const n = natural.value.w ? natural.value : { w: currentMedia.value?.width || 0, h: currentMedia.value?.height || 0 }
  if (!n.w || !n.h || !stageSize.value.w || !stageSize.value.h) return 1
  return Math.min(stageSize.value.w / n.w, stageSize.value.h / n.h)
})
const percent = computed(() => Math.round(scale.value * fit.value * 100))

// True when the zoomed image is larger than the stage, so dragging makes sense
const canPan = computed(() => {
  const n = natural.value
  if (!n.w) return scale.value > 1
  return n.w * fit.value * scale.value > stageSize.value.w + 1 || n.h * fit.value * scale.value > stageSize.value.h + 1
})

function measureStage() {
  const r = stageRef.value?.getBoundingClientRect()
  if (r) stageSize.value = { w: r.width, h: r.height }
}

// Backdrop fades as the viewer is swiped down to close
const veil = computed(() => (1 - Math.min(dragY.value / 420, 0.7)).toFixed(2))

function onMouseMoveViewer() {
  hudVisible.value = true
  if (hudTimer) clearTimeout(hudTimer)
  const idleMs = isFullscreen.value ? 1500 : 2500
  hudTimer = setTimeout(() => {
    const hasActiveOverlay = !!document.querySelector('.v-overlay--active')
    const isEditingZoom = zoomDraft.value !== null
    if (!isPanning.value && !showHelp.value && !hasActiveOverlay && !isEditingZoom) {
      hudVisible.value = false
    }
  }, idleMs)
}

function onImageLoad(e) {
  fullLoaded.value = true
  measureStage()
  if (e?.target?.naturalWidth && e?.target?.naturalHeight) {
    natural.value = { w: e.target.naturalWidth, h: e.target.naturalHeight }
    dimensions.value = `${e.target.naturalWidth} × ${e.target.naturalHeight}`
  }
}

// ---- Preload neighbours so stepping through feels instant ----
const preloaded = []
function preloadNeighbours() {
  const list = store.displayMedia
  if (!list.length) return
  preloaded.length = 0
  for (const offset of [1, -1, 2]) {
    const m = list[(store.viewerActiveIndex + offset + list.length) % list.length]
    if (m && !m.isVideo) {
      const img = new Image()
      img.src = `/media-stream/${m.id}`
      preloaded.push(img)
    }
  }
}

function scrollStripToActive() {
  nextTick(() => {
    stripRef.value?.querySelector('.strip-item.is-active')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  })
}

watch(() => store.viewerActiveIndex, () => {
  resetZoom()
  elapsedMs = 0
  progressPercent.value = 0
  dimensions.value = null
  natural.value = { w: 0, h: 0 }
  fullLoaded.value = false
  preloadNeighbours()
  scrollStripToActive()
})

watch(() => store.viewerOpen, (open) => {
  if (open) {
    fullLoaded.value = false
    natural.value = { w: 0, h: 0 }
    preloadNeighbours()
    onMouseMoveViewer()
    nextTick(() => {
      measureBars()
      measureStage()
      viewerRef.value?.focus()
      stripRef.value?.querySelector('.strip-item.is-active')?.scrollIntoView({ inline: 'center', block: 'nearest' })
    })
  } else {
    stopSlideshowTimer()
    showInfo.value = false
  }
})

watch(() => store.slideshowPlaying, (playing) => {
  if (playing) startSlideshowTimer()
  else stopSlideshowTimer()
})

function startSlideshowTimer() {
  stopSlideshowTimer()
  elapsedMs = 0
  progressPercent.value = 0

  slideshowTimer = setInterval(() => {
    // Videos play to the end first; zoomed-in or open panels mean the viewer is busy inspecting
    if (currentMedia.value?.isVideo && !store.skipVideosInSlideshow) return
    if (scale.value > 1.001 || showHelp.value || showInfo.value) return

    elapsedMs += TICK_MS
    const totalMs = store.slideshowInterval * 1000
    progressPercent.value = Math.min(100, (elapsedMs / totalMs) * 100)

    if (elapsedMs >= totalMs) {
      elapsedMs = 0
      progressPercent.value = 0
      store.nextMedia()
    }
  }, TICK_MS)
}

function stopSlideshowTimer() {
  if (slideshowTimer) {
    clearInterval(slideshowTimer)
    slideshowTimer = null
  }
  progressPercent.value = 0
}

function onVideoEnded() {
  if (store.slideshowPlaying) store.nextMedia()
}

function toggleSlideshow() {
  store.slideshowPlaying = !store.slideshowPlaying
}

function setRotationInterval(sec) {
  store.slideshowInterval = sec
  if (store.slideshowPlaying) startSlideshowTimer()
}

function toggleMute() {
  if (videoPlayerRef.value) {
    videoPlayerRef.value.muted = !videoPlayerRef.value.muted
    isMuted.value = videoPlayerRef.value.muted
    store.showNotice(isMuted.value ? 'Video audio muted' : 'Video audio enabled', 'info')
  }
}

function downloadCurrentMedia() {
  if (!currentMedia.value) return
  const a = document.createElement('a')
  a.href = `/media-stream/${currentMedia.value.id}`
  a.download = currentMedia.value.originalName || currentMedia.value.filename || 'media'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function toggleFavorite() {
  const m = currentMedia.value
  if (m) store.toggleFavorite([m.id], !m.favorite)
}

// Delete with undo, then land on a neighbour (or close when the album is empty)
async function deleteCurrent() {
  const m = currentMedia.value
  if (!m) return
  const index = store.viewerActiveIndex
  if (!(await store.trashMedia([m.id]))) return
  if (!store.displayMedia.length) {
    close()
  } else {
    store.viewerActiveIndex = Math.min(index, store.displayMedia.length - 1)
  }
}

// ---- Zoom ----
const clampScale = (v) => Math.min(8 / fit.value, Math.max(0.1 / fit.value, v))

// Keeps a zoomed image from being dragged completely out of view
function clampPan() {
  const n = natural.value
  if (!n.w || !canPan.value) {
    if (!canPan.value) { panX.value = 0; panY.value = 0 }
    return
  }
  const maxX = Math.max(0, (n.w * fit.value * scale.value - stageSize.value.w) / 2)
  const maxY = Math.max(0, (n.h * fit.value * scale.value - stageSize.value.h) / 2)
  panX.value = Math.min(maxX, Math.max(-maxX, panX.value))
  panY.value = Math.min(maxY, Math.max(-maxY, panY.value))
}

// Zoom keeping the point under (cx, cy) fixed on screen; defaults to the stage centre
function zoomAt(newScale, cx, cy) {
  const r = stageRef.value?.getBoundingClientRect()
  const s0 = scale.value
  const s1 = clampScale(newScale)
  if (r && cx != null) {
    const dx = cx - (r.left + r.width / 2)
    const dy = cy - (r.top + r.height / 2)
    panX.value = dx - (s1 / s0) * (dx - panX.value)
    panY.value = dy - (s1 / s0) * (dy - panY.value)
  }
  scale.value = s1
  clampPan()
}

function setScale(v) {
  zoomAt(v)
}

function setPercent(p) {
  zoomAt(p / 100 / fit.value)
}

function onWheel(e) {
  if (currentMedia.value?.isVideo) return
  zoomAt(scale.value * (e.deltaY > 0 ? 0.9 : 1.1), e.clientX, e.clientY)
}

// Menu-style stepping: jump to the next preset above/below the current zoom
function zoomIn() {
  const next = PRESETS.find(p => p > percent.value)
  if (next) setPercent(next)
}
function zoomOut() {
  const prev = [...PRESETS].reverse().find(p => p < percent.value)
  if (prev) setPercent(prev)
}

function resetZoom() {
  scale.value = 1
  panX.value = 0
  panY.value = 0
}

// Fill the stage width; tall images start at their top edge and scroll by dragging
function fitWidth() {
  const n = natural.value.w ? natural.value : { w: currentMedia.value?.width || 0, h: currentMedia.value?.height || 0 }
  if (!n.w || !stageSize.value.w) return resetZoom()
  const widthScale = stageSize.value.w / n.w
  scale.value = clampScale(widthScale / fit.value)
  panX.value = 0
  const shownH = n.h * widthScale
  panY.value = shownH > stageSize.value.h ? (shownH - stageSize.value.h) / 2 : 0
}

// Double-click / double-tap / Z: zoom in around the pointer (at least 2x the fitted size, never
// below actual pixels), and the next one goes back to the fitted view.
function toggleZoomAt(cx, cy) {
  if (Math.abs(scale.value - 1) < 0.02) {
    const target = Math.min(800, Math.max(100, Math.round(fit.value * 200)))
    zoomAt(target / 100 / fit.value, cx, cy)
  } else {
    resetZoom()
  }
}
const toggleFullScale = () => toggleZoomAt()

function onDoubleClick(e) {
  // Touch double-taps are handled in the pointer logic
  if (lastPointerType === 'touch' || currentMedia.value?.isVideo) return
  toggleZoomAt(e.clientX, e.clientY)
}

// ---- Editable zoom field ----
function onZoomFocus(e) {
  zoomDraft.value = String(percent.value)
  e.target.select()
}

function commitZoom() {
  if (zoomDraft.value === null) return
  const value = parseInt(zoomDraft.value, 10)
  zoomDraft.value = null
  if (Number.isFinite(value)) setPercent(Math.min(800, Math.max(10, value)))
}

function onZoomKey(e) {
  if (e.key === 'Enter') {
    commitZoom()
    e.target.blur()
    viewerRef.value?.focus()
  } else if (e.key === 'Escape') {
    zoomDraft.value = null
    e.target.blur()
    viewerRef.value?.focus()
  } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault()
    zoomDraft.value = null
    if (e.key === 'ArrowUp') zoomIn()
    else zoomOut()
  }
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatDuration(sec) {
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`
}

// ---- Pointer gestures: drag-to-pan when zoomed; on touch also swipe, pinch and double-tap ----
function onPointerDown(e) {
  lastPointerType = e.pointerType
  // Let the native video controls handle their own taps and drags
  if (currentMedia.value?.isVideo && e.target.closest('video')) return
  stageRef.value?.setPointerCapture?.(e.pointerId)
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()]
    pinchStartDist = Math.hypot(a.x - b.x, a.y - b.y) || 1
    pinchStartScale = scale.value
    dragX.value = 0
    dragY.value = 0
    gesture.value = 'pinch'
    return
  }
  if (pointers.size !== 1) return

  startPt = { x: e.clientX, y: e.clientY, t: Date.now() }
  if (canPan.value) {
    gesture.value = 'pan'
    isPanning.value = true
    panOrigin = { x: e.clientX - panX.value, y: e.clientY - panY.value }
  } else {
    gesture.value = e.pointerType === 'touch' ? 'pending' : null
  }
}

function onPointerMove(e) {
  if (!pointers.has(e.pointerId)) return
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

  if (gesture.value === 'pinch' && pointers.size >= 2) {
    const [a, b] = [...pointers.values()]
    setScale(pinchStartScale * (Math.hypot(a.x - b.x, a.y - b.y) / pinchStartDist))
    return
  }
  if (gesture.value === 'pan') {
    panX.value = e.clientX - panOrigin.x
    panY.value = e.clientY - panOrigin.y
    return
  }

  const dx = e.clientX - startPt.x
  const dy = e.clientY - startPt.y
  if (gesture.value === 'pending' && Math.hypot(dx, dy) > 10) {
    if (Math.abs(dx) > Math.abs(dy)) gesture.value = 'swipe-x'
    else gesture.value = dy > 0 ? 'swipe-y' : null
  }
  if (gesture.value === 'swipe-x') dragX.value = dx
  else if (gesture.value === 'swipe-y') dragY.value = Math.max(0, dy)
}

function onPointerUp(e) {
  if (!pointers.has(e.pointerId)) return
  pointers.delete(e.pointerId)

  if (gesture.value === 'pinch') {
    if (pointers.size < 2) {
      if (scale.value < 1.05) resetZoom()
      gesture.value = null
    }
    return
  }

  const g = gesture.value
  gesture.value = null
  isPanning.value = false
  const isTap = e.pointerType === 'touch' && Math.hypot(e.clientX - startPt.x, e.clientY - startPt.y) < 10 && Date.now() - startPt.t < 500

  if (g === 'swipe-x') {
    const dx = dragX.value
    const fast = Math.abs(dx) / Math.max(1, Date.now() - startPt.t) > 0.5
    dragX.value = 0
    if (Math.abs(dx) > 70 || (fast && Math.abs(dx) > 30)) {
      if (dx < 0) next()
      else prev()
    }
  } else if (g === 'swipe-y') {
    const dy = dragY.value
    dragY.value = 0
    if (dy > 110) closeWithTransition()
  } else if (g === 'pending' || (g === 'pan' && isTap)) {
    handleTap(e.clientX, e.clientY)
  } else if (g === 'pan') {
    clampPan()
  }
}

// A tap: single tap toggles the controls (after a short wait), double tap zooms in/out. Works
// while zoomed in as well, where a touch normally starts a pan.
function handleTap(x, y) {
  const now = Date.now()
  const dt = now - lastTap.t
  const dist = Math.hypot(x - lastTap.x, y - lastTap.y)
  if (dt < 380 && dist < 40) {
    clearTimeout(tapTimer)
    if (!currentMedia.value?.isVideo) toggleZoomAt(x, y)
    lastTap = { t: 0, x: 0, y: 0 }
  } else {
    lastTap = { t: now, x, y }
    clearTimeout(tapTimer)
    tapTimer = setTimeout(() => { hudVisible.value = !hudVisible.value }, 390)
  }
}

function onPointerCancel(e) {
  pointers.delete(e.pointerId)
  gesture.value = null
  isPanning.value = false
  dragX.value = 0
  dragY.value = 0
}

// ---- Fullscreen ----
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    viewerRef.value?.requestFullscreen().then(() => {
      isFullscreen.value = true
    }).catch(() => {})
  } else {
    document.exitFullscreen().then(() => {
      isFullscreen.value = false
    }).catch(() => {})
  }
}

function handleFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
  nextTick(measureStage)
  if (isFullscreen.value) {
    if (hudTimer) clearTimeout(hudTimer)
    hudTimer = setTimeout(() => {
      const hasActiveOverlay = !!document.querySelector('.v-overlay--active')
      const isEditingZoom = zoomDraft.value !== null
      if (!isPanning.value && !showHelp.value && !hasActiveOverlay && !isEditingZoom) {
        hudVisible.value = false
      }
    }, 1500)
  } else {
    hudVisible.value = true
  }
}

// ---- Navigation ----
const next = () => store.nextMedia()
const prev = () => store.prevMedia()
const close = () => store.closeViewer()

function untilClosed(ms = 300) {
  return new Promise((resolve) => {
    let unwatch = null
    const timer = setTimeout(() => {
      if (unwatch) unwatch()
      resolve()
    }, ms)
    unwatch = watch(() => store.viewerOpen, (open) => {
      if (!open) {
        clearTimeout(timer)
        if (unwatch) unwatch()
        resolve()
      }
    })
  })
}

async function closeWithTransition() {
  const index = store.viewerActiveIndex
  const from = viewerMediaEl()
  if (!document.startViewTransition || reduceMotion() || !from) return close()
  // The tile for the current photo may be off-screen or unrendered: bring it into view first
  const reveal = { index, ready: null }
  window.dispatchEvent(new CustomEvent('ax:reveal-tile', { detail: reveal }))
  if (reveal.ready) await reveal.ready
  from.style.viewTransitionName = 'ax-media'
  const vt = trackTransition(document.startViewTransition(async () => {
    from.style.viewTransitionName = ''
    close()
    await untilClosed(300)
    await nextTick()
    document.querySelector(`.tile[data-index="${index}"] img`)?.style.setProperty('view-transition-name', 'ax-media')
  }))
  vt.finished.finally(() => {
    const tile = document.querySelector(`.tile[data-index="${index}"]`)
    tile?.querySelector('img')?.style.removeProperty('view-transition-name')
    tile?.focus({ preventScroll: true })
  })
}

function handleKeydown(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return
  if (e.key === 'ArrowRight') {
    next()
  } else if (e.key === 'ArrowLeft') {
    prev()
  } else if (e.key === 'Escape') {
    if (showHelp.value) showHelp.value = false
    else if (showInfo.value) showInfo.value = false
    else closeWithTransition()
  } else if (e.key === ' ' || e.code === 'Space') {
    e.preventDefault()
    toggleSlideshow()
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    deleteCurrent()
  } else if (e.key === 'f' || e.key === 'F') {
    toggleFullscreen()
  } else if (e.key === 'z' || e.key === 'Z') {
    toggleFullScale()
  } else if (e.key === 'd' || e.key === 'D') {
    downloadCurrentMedia()
  } else if (e.key === 'm' || e.key === 'M') {
    toggleMute()
  } else if (e.key === 's' || e.key === 'S') {
    toggleFavorite()
  } else if (e.key === 'i' || e.key === 'I') {
    showInfo.value = !showInfo.value
  } else if (e.key === '?' || e.key === '/') {
    showHelp.value = !showHelp.value
  }
}

// The stage grows into the space of hidden toolbars: watch its size and the bars' heights
let stageObserver = null
let barObserver = null
function measureBars() {
  barTop.value = topBarRef.value?.offsetHeight || 0
  barBottom.value = bottomBarRef.value?.offsetHeight || 0
}
watch(stageRef, (el, old) => {
  if (old && stageObserver) stageObserver.unobserve(old)
  if (el) {
    stageObserver ||= new ResizeObserver(() => measureStage())
    stageObserver.observe(el)
  }
})
watch([topBarRef, bottomBarRef], () => {
  barObserver ||= new ResizeObserver(() => measureBars())
  barObserver.disconnect()
  if (topBarRef.value) barObserver.observe(topBarRef.value)
  if (bottomBarRef.value) barObserver.observe(bottomBarRef.value)
  nextTick(measureBars)
})

onMounted(() => {
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  window.addEventListener('resize', measureStage)
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  window.removeEventListener('resize', measureStage)
  stageObserver?.disconnect()
  barObserver?.disconnect()
  stopSlideshowTimer()
  clearTimeout(hudTimer)
  clearTimeout(tapTimer)
})
</script>

<style scoped>
.viewer {
  position: fixed; inset: 0; z-index: 1800; /* below Vuetify overlays (menus 2000, dialogs 2400) so they open on top */
  background: rgba(6, 6, 8, var(--veil, 1)); outline: none; user-select: none; -webkit-user-select: none;
  color-scheme: dark;
  color: rgba(250, 250, 250, 0.96);
  --ax-bg: #09090b;
  --ax-surface: #111113;
  --ax-surface-2: #18181b;
  --ax-surface-3: #1f1f23;
  --ax-text: rgba(250, 250, 250, 0.96);
  --ax-text-2: rgba(250, 250, 250, 0.64);
  --ax-text-3: rgba(250, 250, 250, 0.42);
  --ax-line: rgba(255, 255, 255, 0.08);
  --ax-line-strong: rgba(255, 255, 255, 0.14);
}
.viewer.is-fullscreen { background: #000; }
.viewer.cursor-hidden, .viewer.cursor-hidden * { cursor: none !important; }
.progress { position: absolute; top: 0; left: 0; height: 2px; z-index: 10; background: var(--ax-accent); transition: width 0.1s linear; pointer-events: none; }

/* ── Bars ── */
.bar {
  position: absolute; left: 0; right: 0; z-index: 5; display: flex; background: rgba(9, 9, 11, 0.72);
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  transition: opacity 0.3s var(--ax-ease), transform 0.3s var(--ax-ease);
}
.bar.top {
  top: 0;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: calc(10px + var(--ax-safe-top)) 16px 10px 20px;
  border-bottom: 1px solid var(--ax-line);
}
.bar.bottom {
  bottom: 0;
  flex-direction: column;
  padding-bottom: var(--ax-safe-bottom);
  border-top: 1px solid var(--ax-line);
}
.bar.top.is-hidden { opacity: 0; transform: translateY(-100%); pointer-events: none; }
.bar.bottom.is-hidden { opacity: 0; transform: translateY(100%); pointer-events: none; }
.meta { display: flex; align-items: baseline; gap: 12px; min-width: 0; }
.name { max-width: 45vw; font-size: 14px; font-weight: 550; letter-spacing: -0.01em; }
.count { font-size: 12px; color: var(--ax-text-3); }
.tools, .group { display: flex; align-items: center; gap: 2px; }
.tools-sep { width: 1px; height: 18px; margin: 0 6px; background: var(--ax-line-strong); }
.ax-icon-btn:disabled { opacity: 0.3; pointer-events: none; }
.ax-icon-btn.is-active { background: var(--ax-accent-soft); color: var(--ax-accent); }

.controls { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 20px; }
.controls .group { flex: 1; }
.controls .group.center { justify-content: center; gap: 8px; }
.controls .group.end { justify-content: flex-end; }
.zoom-group { gap: 2px; }
.zoom-field {
  display: inline-flex; align-items: center; height: 32px; padding: 0 2px 0 10px;
  border-radius: 8px; border: 1px solid var(--ax-line-strong); background: var(--ax-bg);
  transition: border-color var(--ax-fast), box-shadow var(--ax-fast);
}
.zoom-field:focus-within, .zoom-field.is-editing { border-color: var(--ax-accent); box-shadow: 0 0 0 3px var(--ax-accent-soft); }
.zoom-input {
  width: 38px; padding: 0; border: 0; background: transparent; color: var(--ax-text);
  font-size: 13px; text-align: right; outline: none;
}
.zoom-unit { margin: 0 2px 0 1px; font-size: 13px; color: var(--ax-text-2); }
.zoom-caret {
  display: grid; place-items: center; width: 26px; height: 26px; margin-left: 2px;
  padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--ax-text-2); cursor: pointer;
}
.zoom-menu { min-width: 170px; max-height: min(70vh, 460px); overflow-y: auto; }
.zoom-menu .ax-menu-item.is-current { color: var(--ax-accent); background: var(--ax-accent-soft); }

/* ── Filmstrip ── */
.strip { display: flex; gap: 6px; padding: 10px 20px 2px; overflow-x: auto; scrollbar-width: none; }
.strip::-webkit-scrollbar { display: none; }
.strip-item {
  position: relative; flex: none; width: 56px; height: 42px; padding: 0; overflow: hidden; border: 0; border-radius: 8px;
  background: var(--ax-surface); opacity: 0.55; cursor: pointer; outline: 1px solid var(--ax-line);
  transition: opacity var(--ax-fast), outline-color var(--ax-fast), transform var(--ax-fast) var(--ax-ease);
}
.strip-item img { width: 100%; height: 100%; object-fit: cover; display: block; }
.strip-item.is-active { opacity: 1; outline: 2px solid var(--ax-accent); transform: translateY(-1px); }
.strip-play { position: absolute; right: 3px; bottom: 3px; color: #fff; filter: drop-shadow(0 0 3px #000); }

/* ── Stage ── */
.stage {
  position: absolute; left: 0; right: 0; top: var(--bar-top, 0px); bottom: var(--bar-bottom, 0px); overflow: hidden; touch-action: none;
  transition: top 0.28s var(--ax-ease), bottom 0.28s var(--ax-ease);
}
.frame { position: absolute; inset: 0; transition: transform 0.18s var(--ax-ease); will-change: transform; }
.frame.is-dragging { transition: none; }
.layer { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; pointer-events: none; }
.video { pointer-events: auto; background: #000; }
.placeholder { filter: blur(14px); transform: scale(1.01); transition: opacity 0.25s; }
.placeholder.is-hidden { opacity: 0; }
.full { opacity: 0; transition: opacity 0.25s; }
.full.is-loaded { opacity: 1; }
.is-fullscreen .layer { object-fit: contain; }
.spinner {
  position: absolute; left: 50%; top: 50%; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.15); border-top-color: var(--ax-accent); animation: vspin 0.8s linear infinite;
}
@keyframes vspin { to { transform: rotate(360deg); } }

.xfade-enter-active, .xfade-leave-active { transition: opacity 0.3s var(--ax-ease); }
.xfade-enter-from, .xfade-leave-to { opacity: 0; }

/* ── Arrows ── */
.arrow {
  position: absolute; top: 50%; z-index: 6; display: grid; place-items: center; width: 44px; height: 44px; margin-top: -22px; padding: 0;
  border-radius: 50%; border: 1px solid var(--ax-line-strong); background: rgba(24, 24, 27, 0.8);
  backdrop-filter: blur(12px); color: var(--ax-text); cursor: pointer;
  transition: opacity 0.3s, background-color var(--ax-fast), transform var(--ax-fast) var(--ax-ease), right 0.25s var(--ax-ease);
}
.arrow.left { left: 20px; }
.arrow.right { right: 20px; }
.arrow.right.has-info { right: 320px; }
.arrow.is-hidden { opacity: 0; pointer-events: none; }

/* ── Details drawer ── */
.info {
  position: absolute; z-index: 7; top: var(--bar-top-h, 56px); right: 0; bottom: 0; width: 300px; max-width: 86vw; padding: 16px 18px;
  overflow-y: auto; -webkit-overflow-scrolling: touch;
  background: rgba(17, 17, 19, 0.96); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  border-left: 1px solid var(--ax-line);
}
.info header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.info h3 { margin: 0; font-size: 14px; font-weight: 600; }
.info dl { margin: 0; }
.info dl > div { padding: 11px 0; border-bottom: 1px solid var(--ax-line); }
.info dt { margin-bottom: 3px; font-size: 11.5px; color: var(--ax-text-3); }
.info dd { margin: 0; font-size: 13px; word-break: break-word; }
.drawer-enter-active, .drawer-leave-active { transition: transform 0.25s var(--ax-ease), opacity 0.25s; }
.drawer-enter-from, .drawer-leave-to { transform: translateX(24px); opacity: 0; }

.keys { margin: 0; padding: 0; list-style: none; }
.keys li { display: flex; align-items: center; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid var(--ax-line); font-size: 13px; color: var(--ax-text-2); }
.keys li:last-child { border-bottom: 0; }
kbd {
  display: inline-grid; place-items: center; min-width: 26px; height: 24px; margin-left: 4px; padding: 0 7px; border-radius: 6px;
  background: var(--ax-surface-3); border: 1px solid var(--ax-line-strong); box-shadow: 0 1px 0 rgba(0, 0, 0, 0.5);
  font: 500 11.5px/1 var(--font-mono); color: var(--ax-text);
}

@media (hover: hover) {
  .zoom-caret:hover { background: rgba(255, 255, 255, 0.08); color: var(--ax-text); }
  .strip-item:hover { opacity: 0.9; }
  .arrow:hover { background: #27272a; transform: scale(1.06); }
}

@media (max-width: 600px) {
  .arrow, .strip, .fs-btn, .zoom-fit, .tools-sep { display: none; }
  .bar.top { gap: 8px; padding: calc(8px + var(--ax-safe-top)) 8px 8px 14px; }
  .name { max-width: 38vw; font-size: 13px; }
  .controls { padding: 6px 10px; gap: 6px; }
  .controls .group { flex: 0 0 auto; }
  .controls .group.zoom-group { flex: 1 1 auto; gap: 1px; }
  .controls .group.center { justify-content: flex-end; gap: 4px; }
  .controls .group.center > .ax-icon-btn { display: none; }
  .btn-label { display: none; }
  .controls .group.end { display: none; }
  .zoom-input { font-size: 16px; width: 42px; }

  /* Mobile bottom sheet for info */
  .info {
    top: auto;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    max-width: 100%;
    max-height: 65dvh;
    border-radius: 16px 16px 0 0;
    border-left: 0;
    border-top: 1px solid var(--ax-line);
    padding: 16px 18px calc(16px + var(--ax-safe-bottom));
    box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.4);
  }
  .drawer-enter-from, .drawer-leave-to {
    transform: translateY(28px);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .frame, .full, .placeholder, .xfade-enter-active, .xfade-leave-active { transition: none !important; }
}
</style>
