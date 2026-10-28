import { ref, onMounted, onUnmounted } from 'vue'

export function usePullToRefresh(onRefresh, { threshold = 64, max = 96, enabled = () => true } = {}) {
  const pull = ref(0)
  const refreshing = ref(false)

  let startY = 0
  let isTracking = false

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  function onTouchStart(e) {
    if (refreshing.value) return
    if (!window.matchMedia('(pointer: coarse)').matches && !(navigator.maxTouchPoints > 0)) return
    if (window.scrollY > 0) return
    if (!enabled()) return

    const target = e.target
    if (target.closest('.ax-seg, .ax-snap-row, input, select, textarea, button')) return

    startY = e.touches[0].clientY
    isTracking = true
  }

  function onTouchMove(e) {
    if (!isTracking || refreshing.value) return
    if (window.scrollY > 0) {
      isTracking = false
      pull.value = 0
      return
    }

    const currentY = e.touches[0].clientY
    const dy = currentY - startY

    if (dy <= 0) {
      pull.value = 0
      return
    }

    // Resistance formula
    pull.value = Math.min(max, dy * 0.5)
  }

  async function onTouchEnd() {
    if (!isTracking) return
    isTracking = false

    if (pull.value >= threshold && !refreshing.value) {
      refreshing.value = true
      pull.value = threshold
      try {
        await Promise.all([
          Promise.resolve(onRefresh?.()),
          delay(400)
        ])
      } catch (err) {
        console.error('Pull-to-refresh failed', err)
      } finally {
        refreshing.value = false
        pull.value = 0
      }
    } else {
      pull.value = 0
    }
  }

  function onTouchCancel() {
    isTracking = false
    if (!refreshing.value) {
      pull.value = 0
    }
  }

  onMounted(() => {
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('touchcancel', onTouchCancel, { passive: true })
  })

  onUnmounted(() => {
    window.removeEventListener('touchstart', onTouchStart)
    window.removeEventListener('touchmove', onTouchMove)
    window.removeEventListener('touchend', onTouchEnd)
    window.removeEventListener('touchcancel', onTouchCancel)
  })

  return {
    pull,
    refreshing
  }
}
