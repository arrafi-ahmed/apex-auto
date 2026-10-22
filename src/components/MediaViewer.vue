<template>
  <div
    v-if="store.viewerOpen"
    ref="viewerRef"
    class="media-viewer-root"
    tabindex="0"
    @keydown="handleKeydown"
    @mousemove="onMouseMoveViewer"
  >
    <!-- Slideshow Progress Line -->
    <div
      v-if="store.slideshowPlaying"
      class="slideshow-progress-line"
      :style="{ width: `${progressPercent}%` }"
    ></div>

    <!-- Top Navigation / Info Bar -->
    <div
      class="viewer-top-bar d-flex align-center justify-space-between px-6 py-3"
      :class="{ 'viewer-hud-hidden': !hudVisible }"
    >
      <div class="d-flex align-center gap-3">
        <v-chip size="small" :color="currentMedia?.isVideo ? 'deep-purple-accent-2' : 'blue-darken-1'" variant="flat" class="font-weight-bold">
          <v-icon :icon="currentMedia?.isVideo ? 'mdi-video' : 'mdi-image'" start size="16"></v-icon>
          {{ currentMedia?.isVideo ? 'VIDEO' : 'IMAGE' }}
        </v-chip>
        <span class="text-subtitle-2 font-weight-bold text-truncate" style="max-width: 32vw;">
          {{ currentMedia?.title || currentMedia?.originalName }}
        </span>
        <v-chip size="x-small" variant="outlined" color="grey-lighten-1" class="font-mono">
          {{ store.viewerActiveIndex + 1 }} / {{ store.currentMedia.length }}
        </v-chip>
        <v-chip v-if="dimensions" size="x-small" variant="outlined" color="blue-lighten-2" class="font-mono text-caption d-none d-md-inline-flex">
          {{ dimensions }}
        </v-chip>
        <v-chip size="x-small" color="teal" variant="tonal" class="font-mono text-caption d-none d-sm-inline-flex" title="Uncompressed original file">
          <v-icon icon="mdi-check-decagram" size="12" class="mr-1"></v-icon>
          FULL SIZE ({{ formatBytes(currentMedia?.size) }})
        </v-chip>
      </div>

      <div class="d-flex align-center gap-2">
        <!-- Direct Raw Download Button -->
        <v-btn
          icon="mdi-download"
          variant="text"
          color="white"
          size="small"
          :href="`/media-stream/${currentMedia?.id}`"
          :download="currentMedia?.originalName || 'media'"
          title="Download Raw Full-Size Original (D)"
        ></v-btn>

        <!-- Keyboard Shortcuts Help -->
        <v-btn
          icon="mdi-keyboard-outline"
          variant="text"
          color="white"
          size="small"
          @click="showHelp = !showHelp"
          title="Keyboard Shortcuts (?)"
        ></v-btn>

        <!-- Slideshow Status Indicator -->
        <v-chip
          v-if="store.slideshowPlaying"
          size="small"
          color="amber"
          variant="tonal"
          class="font-weight-bold d-none d-sm-flex"
        >
          <v-icon icon="mdi-play-circle" start size="16"></v-icon>
          Slideshow ({{ store.slideshowInterval }}s)
        </v-chip>

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
          icon
          variant="text"
          color="white"
          size="small"
          @click="close"
          title="Close (Esc)"
        >
          <v-icon icon="mdi-close"></v-icon>
        </v-btn>
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
      color="rgba(15, 23, 42, 0.75)"
      class="nav-arrow left-arrow"
      :class="{ 'viewer-hud-hidden': !hudVisible }"
      size="large"
      @click="prev"
      title="Previous (Left Arrow)"
    ></v-btn>
    <v-btn
      icon="mdi-chevron-right"
      variant="flat"
      color="rgba(15, 23, 42, 0.75)"
      class="nav-arrow right-arrow"
      :class="{ 'viewer-hud-hidden': !hudVisible }"
      size="large"
      @click="next"
      title="Next (Right Arrow)"
    ></v-btn>

    <!-- Bottom Controls Deck -->
    <div
      class="viewer-bottom-bar d-flex align-center justify-space-between px-6 py-2"
      :class="{ 'viewer-hud-hidden': !hudVisible }"
    >
      <!-- Zoom Controls -->
      <div class="d-flex align-center gap-1">
        <v-btn icon="mdi-magnify-minus-outline" size="small" variant="text" color="grey-lighten-1" @click="zoomOut" :disabled="scale <= 1"></v-btn>
        <span class="text-caption font-mono text-medium-emphasis px-1">{{ Math.round(scale * 100) }}%</span>
        <v-btn icon="mdi-magnify-plus-outline" size="small" variant="text" color="grey-lighten-1" @click="zoomIn" :disabled="scale >= 5"></v-btn>
        <v-btn size="x-small" variant="tonal" :color="scale === 1 ? 'grey' : 'primary'" class="text-none ml-1" @click="toggleFullScale">
          {{ scale === 1 ? '100% (1:1)' : 'Reset Fit' }}
        </v-btn>
      </div>

      <!-- Slideshow Central Controls -->
      <div class="d-flex align-center gap-3">
        <v-btn
          :color="store.slideshowPlaying ? 'amber' : 'primary'"
          variant="flat"
          class="text-none font-weight-bold px-4 rounded-pill"
          :prepend-icon="store.slideshowPlaying ? 'mdi-pause' : 'mdi-play'"
          @click="toggleSlideshow"
        >
          {{ store.slideshowPlaying ? 'Pause Slideshow' : 'Play Slideshow' }}
        </v-btn>

        <!-- Interval Dropdown Menu -->
        <v-menu location="top">
          <template #activator="{ props }">
            <v-btn v-bind="props" variant="outlined" color="grey-lighten-1" size="small" class="text-none rounded-pill font-mono">
              <v-icon icon="mdi-timer-outline" start size="14"></v-icon>
              {{ store.slideshowInterval }}s Interval
            </v-btn>
          </template>
          <v-list density="compact" bg-color="#0f172a" class="border">
            <v-list-item
              v-for="sec in [1, 2, 3, 5, 8, 10, 15, 30]"
              :key="sec"
              :active="store.slideshowInterval === sec"
              @click="setRotationInterval(sec)"
            >
              <v-list-item-title class="font-mono">{{ sec }} Seconds</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </div>

      <!-- Slideshow Config Toggles -->
      <div class="d-flex align-center gap-3">
        <v-switch
          v-model="store.skipVideosInSlideshow"
          color="primary"
          density="compact"
          hide-details
          label="Skip Videos in Slideshow"
          class="text-caption"
        ></v-switch>
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
  hudTimer = setTimeout(() => {
    // Only auto-hide if scale is 1 or user isn't actively panning
    if (!isPanning.value && !showHelp.value) {
      hudVisible.value = false
    }
  }, 2500)
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

.viewer-top-bar {
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  z-index: 10;
}

.viewer-bottom-bar {
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(12px);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  z-index: 10;
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

.viewer-media-element {
  max-width: 90vw;
  max-height: 80vh;
  object-fit: contain;
  transition: transform 0.05s ease-out;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
  border-radius: 8px;
}

.viewer-video-element {
  max-width: 90vw;
  max-height: 80vh;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
  border-radius: 8px;
  background: #000;
}

.nav-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  backdrop-filter: blur(10px);
}

.left-arrow {
  left: 24px;
}

.right-arrow {
  right: 24px;
}
</style>
