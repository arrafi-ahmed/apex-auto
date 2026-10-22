<template>
  <div
    v-if="store.viewerOpen"
    ref="viewerRef"
    class="media-viewer-root"
    :class="{ 'is-fullscreen': isFullscreen, 'cursor-hidden': isFullscreen && !hudVisible }"
    tabindex="0"
    @keydown="handleKeydown"
    @mousemove="onMouseMoveViewer"
  >
    <!-- Slideshow Progress Line (Only in windowed mode) -->
    <div
      v-if="store.slideshowPlaying && !isFullscreen"
      class="slideshow-progress-line"
      :style="{ width: `${progressPercent}%` }"
    ></div>

    <!-- Top Navigation / Info Bar -->
    <div
      class="viewer-top-bar d-flex align-center justify-space-between px-6 py-3"
      :class="{ 'viewer-hud-hidden': !hudVisible }"
    >
      <div class="d-flex align-center gap-3">
        <span class="text-subtitle-2 font-weight-medium text-truncate" style="max-width: 45vw;">
          {{ currentMedia?.title || currentMedia?.originalName }}
        </span>
        <span class="text-caption text-medium-emphasis font-mono">
          {{ store.viewerActiveIndex + 1 }} / {{ store.currentMedia.length }}
        </span>
        <span v-if="dimensions" class="text-caption text-disabled font-mono d-none d-md-inline">
          • {{ dimensions }}
        </span>
      </div>

      <div class="d-flex align-center gap-1">
        <!-- Direct Raw Download Button -->
        <v-btn
          icon="mdi-download-outline"
          variant="text"
          color="white"
          size="small"
          :href="`/media-stream/${currentMedia?.id}`"
          :download="currentMedia?.originalName || 'media'"
          title="Download (D)"
        ></v-btn>

        <!-- Keyboard Shortcuts Help -->
        <v-btn
          icon="mdi-keyboard-outline"
          variant="text"
          color="white"
          size="small"
          @click="showHelp = !showHelp"
          title="Shortcuts (?)"
        ></v-btn>

        <!-- Fullscreen Button -->
        <v-btn
          icon
          variant="text"
          color="white"
          size="small"
          @click="toggleFullscreen"
          :title="isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'"
        >
          <v-icon :icon="isFullscreen ? 'mdi-fullscreen-exit' : 'mdi-fullscreen'"></v-icon>
        </v-btn>

        <!-- Close Button -->
        <v-btn
          icon="mdi-close"
          variant="text"
          color="white"
          size="small"
          @click="close"
          title="Close (Esc)"
        ></v-btn>
      </div>
    </div>

    <!-- Main Media Display Area -->
    <div
      class="viewer-stage"
      @wheel.prevent="onWheel"
      @mousedown="startPan"
      @mousemove="onPan"
      @mouseup="endPan"
      @mouseleave="endPan"
      @dblclick="resetZoom"
    >
      <!-- Image Display with Pan & Zoom -->
      <img
        v-if="currentMedia && !currentMedia.isVideo"
        :src="`/media-stream/${currentMedia.id}`"
        :alt="currentMedia.title"
        class="viewer-media-element"
        :style="{
          transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
          cursor: scale > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default'
        }"
        draggable="false"
        @load="onImageLoad"
      />

      <!-- Video Display -->
      <video
        v-else-if="currentMedia && currentMedia.isVideo"
        ref="videoPlayerRef"
        :src="`/media-stream/${currentMedia.id}`"
        controls
        autoplay
        playsinline
        class="viewer-video-element"
        @ended="onVideoEnded"
      ></video>
    </div>

    <!-- Navigation Arrows -->
    <v-btn
      icon="mdi-chevron-left"
      variant="flat"
      class="nav-arrow left-arrow"
      :class="{ 'viewer-hud-hidden': !hudVisible }"
      size="default"
      @click="prev"
      title="Previous (Left Arrow)"
    ></v-btn>
    <v-btn
      icon="mdi-chevron-right"
      variant="flat"
      class="nav-arrow right-arrow"
      :class="{ 'viewer-hud-hidden': !hudVisible }"
      size="default"
      @click="next"
      title="Next (Right Arrow)"
    ></v-btn>

    <!-- Bottom Controls Deck (Only in non-fullscreen windowed mode) -->
    <div
      v-if="!isFullscreen"
      class="viewer-bottom-bar d-flex align-center justify-space-between px-6 py-2"
      :class="{ 'viewer-hud-hidden': !hudVisible }"
    >
      <!-- Zoom Controls -->
      <div class="d-flex align-center gap-1">
        <v-btn icon="mdi-minus" size="small" variant="text" color="grey-lighten-1" @click="zoomOut" :disabled="scale <= 1"></v-btn>
        <span class="text-caption font-mono text-medium-emphasis px-1">{{ Math.round(scale * 100) }}%</span>
        <v-btn icon="mdi-plus" size="small" variant="text" color="grey-lighten-1" @click="zoomIn" :disabled="scale >= 5"></v-btn>
        <v-btn size="x-small" variant="tonal" :color="scale === 1 ? 'grey' : 'primary'" class="text-none ml-1" @click="toggleFullScale">
          {{ scale === 1 ? '1:1' : 'Fit' }}
        </v-btn>
      </div>

      <!-- Slideshow Central Controls -->
      <div class="d-flex align-center gap-3">
        <v-btn
          variant="tonal"
          size="small"
          class="text-none rounded-pill font-weight-medium"
          :prepend-icon="store.slideshowPlaying ? 'mdi-pause' : 'mdi-play'"
          @click="toggleSlideshow"
        >
          {{ store.slideshowPlaying ? 'Pause' : 'Slideshow' }}
        </v-btn>

        <!-- Interval Dropdown Menu -->
        <v-menu location="top">
          <template #activator="{ props }">
            <v-btn v-bind="props" variant="text" color="grey-lighten-1" size="small" class="text-none font-mono">
              {{ store.slideshowInterval }}s
            </v-btn>
          </template>
          <v-list density="compact" bg-color="#0f172a" class="border">
            <v-list-item
              v-for="sec in [1, 2, 3, 5, 8, 10, 15]"
              :key="sec"
              :active="store.slideshowInterval === sec"
              @click="setRotationInterval(sec)"
            >
              <v-list-item-title class="font-mono text-caption">{{ sec }}s</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </div>

      <!-- Quick Mute / Audio for Video -->
      <div class="d-flex align-center">
        <v-btn
          v-if="currentMedia?.isVideo"
          :icon="isMuted ? 'mdi-volume-off' : 'mdi-volume-high'"
          size="small"
          variant="text"
          color="white"
          @click="toggleMute"
          title="Mute / Unmute (M)"
        ></v-btn>
      </div>
    </div>

    <!-- Keyboard Shortcuts Modal -->
    <v-dialog v-model="showHelp" max-width="460">
      <v-card class="glass-panel pa-5 rounded-2xl text-white">
        <v-card-title class="font-weight-bold d-flex align-center gap-2 px-0 pt-0">
          <v-icon icon="mdi-keyboard-outline" color="primary"></v-icon>
          Viewer Keyboard Shortcuts
        </v-card-title>
        <v-card-text class="px-0 py-2">
          <v-table density="compact" class="bg-transparent text-caption">
            <tbody>
              <tr>
                <td class="font-mono text-primary font-weight-bold">← / →</td>
                <td>Previous / Next media item</td>
              </tr>
              <tr>
                <td class="font-mono text-primary font-weight-bold">Space</td>
                <td>Play / Pause automatic slideshow</td>
              </tr>
              <tr>
                <td class="font-mono text-primary font-weight-bold">Z</td>
                <td>Toggle 100% (1:1) scale pixel inspection</td>
              </tr>
              <tr>
                <td class="font-mono text-primary font-weight-bold">D</td>
                <td>Download 100% raw uncompressed original</td>
              </tr>
              <tr>
                <td class="font-mono text-primary font-weight-bold">M</td>
                <td>Mute / Unmute video audio</td>
              </tr>
              <tr>
                <td class="font-mono text-primary font-weight-bold">F</td>
                <td>Toggle fullscreen mode</td>
              </tr>
              <tr>
                <td class="font-mono text-primary font-weight-bold">?</td>
                <td>Toggle this keyboard shortcut helper</td>
              </tr>
              <tr>
                <td class="font-mono text-primary font-weight-bold">Esc</td>
                <td>Close viewer</td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
        <v-card-actions class="px-0 pb-0">
          <v-spacer></v-spacer>
          <v-btn color="primary" variant="flat" size="small" @click="showHelp = false">Got it</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useVaultStore } from '../stores/vaultStore'

const store = useVaultStore()
const viewerRef = ref(null)
const videoPlayerRef = ref(null)

// Help and Dimensions state
const showHelp = ref(false)
const dimensions = ref(null)
const isMuted = ref(false)

// Zoom & Pan state
const scale = ref(1)
const panX = ref(0)
const panY = ref(0)
const isPanning = ref(false)
const startX = ref(0)
const startY = ref(0)

// Slideshow state
const progressPercent = ref(0)
let slideshowTimer = null
let elapsedMs = 0
const TICK_MS = 100

// Fullscreen state
const isFullscreen = ref(false)

// Minimalist HUD auto-hide state
const hudVisible = ref(true)
let hudTimer = null

function onMouseMoveViewer() {
  hudVisible.value = true
  if (hudTimer) clearTimeout(hudTimer)
  const idleMs = isFullscreen.value ? 1500 : 2500
  hudTimer = setTimeout(() => {
    // Only auto-hide if scale is 1 or user isn't actively panning
    if (!isPanning.value && !showHelp.value) {
      hudVisible.value = false
    }
  }, idleMs)
}

function onImageLoad(e) {
  if (e?.target?.naturalWidth && e?.target?.naturalHeight) {
    dimensions.value = `${e.target.naturalWidth} × ${e.target.naturalHeight}`
  }
}

const currentMedia = computed(() => store.activeMediaItem)

watch(() => store.viewerActiveIndex, () => {
  resetZoom()
  elapsedMs = 0
  progressPercent.value = 0
  dimensions.value = null
})

watch(() => store.viewerOpen, (open) => {
  if (open) {
    nextTick(() => {
      viewerRef.value?.focus()
    })
  } else {
    stopSlideshowTimer()
  }
})

watch(() => store.slideshowPlaying, (playing) => {
  if (playing) {
    startSlideshowTimer()
  } else {
    stopSlideshowTimer()
  }
})

function startSlideshowTimer() {
  stopSlideshowTimer()
  elapsedMs = 0
  progressPercent.value = 0

  slideshowTimer = setInterval(() => {
    // If current item is a video and skipVideos is off, wait for video to end
    if (currentMedia.value?.isVideo && !store.skipVideosInSlideshow) {
      return
    }

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
  if (store.slideshowPlaying) {
    store.nextMedia()
  }
}

function toggleSlideshow() {
  store.slideshowPlaying = !store.slideshowPlaying
}

function setRotationInterval(sec) {
  store.slideshowInterval = sec
  if (store.slideshowPlaying) {
    startSlideshowTimer()
  }
}

function toggleMute() {
  if (videoPlayerRef.value) {
    videoPlayerRef.value.muted = !videoPlayerRef.value.muted
    isMuted.value = videoPlayerRef.value.muted
    store.showNotice(isMuted.value ? 'Video Audio Muted' : 'Video Audio Enabled', 'info')
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
  store.showNotice('Download started', 'success')
}

// Pan & Zoom handlers
function onWheel(e) {
  if (currentMedia.value?.isVideo) return
  const delta = e.deltaY > 0 ? -0.2 : 0.2
  const newScale = Math.min(Math.max(1, scale.value + delta), 5)
  scale.value = Number(newScale.toFixed(2))
  if (scale.value === 1) {
    panX.value = 0
    panY.value = 0
  }
}

function zoomIn() {
  scale.value = Math.min(5, Number((scale.value + 0.3).toFixed(2)))
}

function zoomOut() {
  scale.value = Math.max(1, Number((scale.value - 0.3).toFixed(2)))
  if (scale.value === 1) {
    panX.value = 0
    panY.value = 0
  }
}

function resetZoom() {
  scale.value = 1
  panX.value = 0
  panY.value = 0
}

function toggleFullScale() {
  if (scale.value === 1) {
    scale.value = 2.0 // 100% full scale inspection
    store.showNotice('100% 1:1 Scale Inspection', 'info')
  } else {
    resetZoom()
    store.showNotice('Reset Fit to Screen', 'info')
  }
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function startPan(e) {
  if (scale.value <= 1) return
  isPanning.value = true
  startX.value = e.clientX - panX.value
  startY.value = e.clientY - panY.value
}

function onPan(e) {
  if (!isPanning.value) return
  panX.value = e.clientX - startX.value
  panY.value = e.clientY - startY.value
}

function endPan() {
  isPanning.value = false
}

// Fullscreen
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
  if (isFullscreen.value) {
    if (hudTimer) clearTimeout(hudTimer)
    hudTimer = setTimeout(() => {
      if (!isPanning.value && !showHelp.value) {
        hudVisible.value = false
      }
    }, 1500)
  } else {
    hudVisible.value = true
  }
}

// Navigation
function next() {
  store.nextMedia()
}

function prev() {
  store.prevMedia()
}

function close() {
  store.closeViewer()
}

function handleKeydown(e) {
  if (e.key === 'ArrowRight') {
    next()
  } else if (e.key === 'ArrowLeft') {
    prev()
  } else if (e.key === 'Escape') {
    if (showHelp.value) {
      showHelp.value = false
    } else {
      close()
    }
  } else if (e.key === ' ' || e.code === 'Space') {
    e.preventDefault()
    toggleSlideshow()
  } else if (e.key === 'f' || e.key === 'F') {
    toggleFullscreen()
  } else if (e.key === 'z' || e.key === 'Z') {
    toggleFullScale()
  } else if (e.key === 'd' || e.key === 'D') {
    downloadCurrentMedia()
  } else if (e.key === 'm' || e.key === 'M') {
    toggleMute()
  } else if (e.key === '?' || e.key === '/') {
    showHelp.value = !showHelp.value
  }
}

onMounted(() => {
  document.addEventListener('fullscreenchange', handleFullscreenChange)
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  stopSlideshowTimer()
})
</script>

<style scoped>
.media-viewer-root {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background-color: rgba(3, 7, 18, 0.98);
  display: flex;
  flex-direction: column;
  outline: none;
  user-select: none;
}

/* Fullscreen Immersion */
.media-viewer-root.is-fullscreen {
  background-color: #000000 !important;
}

.media-viewer-root.cursor-hidden,
.media-viewer-root.cursor-hidden * {
  cursor: none !important;
}

.slideshow-progress-line {
  position: absolute;
  top: 0;
  left: 0;
  height: 2px;
  background: #3b82f6;
  z-index: 100;
  transition: width 0.1s linear;
}

.viewer-top-bar {
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  z-index: 10;
  transition: opacity 0.35s ease, transform 0.35s ease;
}

.viewer-top-bar.viewer-hud-hidden {
  opacity: 0;
  transform: translateY(-100%);
  pointer-events: none;
}

.viewer-bottom-bar {
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(16px);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  z-index: 10;
  transition: opacity 0.35s ease, transform 0.35s ease;
}

.viewer-bottom-bar.viewer-hud-hidden {
  opacity: 0;
  transform: translateY(100%);
  pointer-events: none;
}

.viewer-stage {
  flex: 1;
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.is-fullscreen .viewer-stage {
  padding: 0;
}

.viewer-media-element {
  max-width: 90vw;
  max-height: 80vh;
  object-fit: contain;
  transition: transform 0.05s ease-out;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
  border-radius: 8px;
}

.is-fullscreen .viewer-media-element {
  max-width: 100vw !important;
  max-height: 100vh !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}

.viewer-video-element {
  max-width: 90vw;
  max-height: 80vh;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
  border-radius: 8px;
  background: #000;
}

.is-fullscreen .viewer-video-element {
  max-width: 100vw !important;
  max-height: 100vh !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}

.nav-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  background: rgba(0, 0, 0, 0.35) !important;
  color: rgba(255, 255, 255, 0.7) !important;
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  transition: opacity 0.3s ease, background 0.2s ease, color 0.2s ease;
}

.nav-arrow:hover {
  background: rgba(0, 0, 0, 0.7) !important;
  color: #ffffff !important;
}

.nav-arrow.viewer-hud-hidden {
  opacity: 0;
  pointer-events: none;
}

.left-arrow {
  left: 24px;
}

.right-arrow {
  right: 24px;
}
</style>
