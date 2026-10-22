import { defineStore } from 'pinia'

export const useVaultStore = defineStore('vault', {
  state: () => ({
    isAuthenticated: false,
    isLockedOut: false,
    triggerWord: 'guarantee',
    authModalOpen: false,
    settingsModalOpen: false,

    // Album and Media State
    albums: [],
    activeAlbum: null,
    currentMedia: [],
    loadingAlbums: false,
    loadingMedia: false,

    // Batch Operations State
    isBatchMode: false,
    selectedMediaIds: [],

    // Viewer & Slideshow State
    viewerOpen: false,
    viewerActiveIndex: 0,
    slideshowPlaying: false,
    slideshowInterval: 3, // seconds
    skipVideosInSlideshow: true,
    isFullscreen: false,

    // Admin & UI View Mode ('gallery' | 'manager')
    adminViewMode: 'gallery',
    vaultStats: null,

    // Security & Inactivity Lockout State
    autoLockMinutes: 5,
    tabSwitchLock: true,
    lastActivityTimestamp: Date.now(),
    secondsRemainingUntilAutoLock: 300,

    // Error and Notice
    noticeMessage: '',
    noticeColor: 'info'
  }),

  getters: {
    selectedCount: (state) => state.selectedMediaIds.length,
    activeMediaItem: (state) => {
      if (!state.currentMedia.length || state.viewerActiveIndex < 0) return null
      return state.currentMedia[state.viewerActiveIndex] || null
    },
    slideshowEligibleMedia: (state) => {
      if (!state.skipVideosInSlideshow) return state.currentMedia
      return state.currentMedia.filter(m => !m.isVideo)
    }
  },

  actions: {
    showNotice(msg, color = 'info') {
      this.noticeMessage = msg
      this.noticeColor = color
    },

    async checkStatus() {
      try {
        const res = await fetch('/api/auth/status')
        if (res.status === 503) {
          this.isLockedOut = true
          return
        }
        if (res.ok) {
          const data = await res.json()
          this.isAuthenticated = data.authenticated
          if (this.isAuthenticated) {
            await this.fetchAlbums()
          }
        }
      } catch (err) {
        console.error('Check status error', err)
      }
    },

    async login(password) {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        })

        if (res.status === 503) {
          // Lockout triggered by server
          this.isLockedOut = true
          this.authModalOpen = false
          return false
        }

        if (res.ok) {
          const data = await res.json()
          this.isAuthenticated = true
          this.authModalOpen = false
          if (data.settings) {
            this.slideshowInterval = data.settings.slideshowInterval || 3
            this.skipVideosInSlideshow = data.settings.skipVideosInSlideshow !== false
          }
          await this.fetchAlbums()
          return true
        } else {
          // Fallback lockout on invalid status
          this.isLockedOut = true
          this.authModalOpen = false
          return false
        }
      } catch (err) {
        // Network or 503 lockout error
        this.isLockedOut = true
        this.authModalOpen = false
        return false
      }
    },

    registerActivity() {
      this.lastActivityTimestamp = Date.now()
    },

    updateInactivityCountdown() {
      if (!this.isAuthenticated) return
      const elapsed = Math.floor((Date.now() - this.lastActivityTimestamp) / 1000)
      const totalSec = (this.autoLockMinutes || 5) * 60
      this.secondsRemainingUntilAutoLock = Math.max(0, totalSec - elapsed)
      if (this.secondsRemainingUntilAutoLock <= 0) {
        this.panicLock()
      }
    },

    async panicLock() {
      // Instant escape to decoy
      this.viewerOpen = false
      this.slideshowPlaying = false
      this.isAuthenticated = false
      this.activeAlbum = null
      this.selectedMediaIds = []
      this.isBatchMode = false
      try {
        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
          navigator.sendBeacon('/api/auth/logout')
        } else {
          await fetch('/api/auth/logout', { method: 'POST' })
        }
      } catch (e) { /* ignore */ }
    },

    async fetchAlbums() {
      this.loadingAlbums = true
      try {
        const res = await fetch('/api/albums')
        if (res.ok) {
          this.albums = await res.json()
        }
      } catch (err) {
        console.error('Fetch albums error', err)
      } finally {
        this.loadingAlbums = false
      }
    },

    async fetchVaultStats() {
      try {
        const res = await fetch('/api/vault/stats')
        if (res.ok) {
          this.vaultStats = await res.json()
        }
      } catch (err) {
        console.error('Fetch vault stats error', err)
      }
    },

    async downloadAlbum(albumId) {
      try {
        const res = await fetch(`/api/albums/${albumId}/media`)
        if (!res.ok) return
        const media = await res.json()
        if (!media.length) {
          this.showNotice('Album has no media to download', 'info')
          return
        }
        const mediaIds = media.map(m => m.id)
        const downloadRes = await fetch('/api/media/batch-download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mediaIds })
        })
        if (downloadRes.ok) {
          const blob = await downloadRes.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `album-${albumId}-${Date.now()}.zip`
          document.body.appendChild(a)
          a.click()
          a.remove()
          window.URL.revokeObjectURL(url)
          this.showNotice('Album download started', 'success')
        }
      } catch (err) {
        this.showNotice('Failed to download album', 'error')
      }
    },

    async selectAlbum(album) {
      this.activeAlbum = album
      this.selectedMediaIds = []
      this.isBatchMode = false
      await this.fetchMedia(album.id)
    },

    async fetchMedia(albumId) {
      this.loadingMedia = true
      try {
        const res = await fetch(`/api/albums/${albumId}/media`)
        if (res.ok) {
          this.currentMedia = await res.json()
        }
      } catch (err) {
        console.error('Fetch media error', err)
      } finally {
        this.loadingMedia = false
      }
    },

    async createAlbum(title, description) {
      try {
        const res = await fetch('/api/albums', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, description })
        })
        if (res.ok) {
          await this.fetchAlbums()
          this.showNotice('Album created successfully', 'success')
          return true
        }
      } catch (err) {
        this.showNotice('Failed to create album', 'error')
      }
      return false
    },

    async updateAlbum(id, title, description, coverId) {
      try {
        const res = await fetch(`/api/albums/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, description, coverId })
        })
        if (res.ok) {
          await this.fetchAlbums()
          if (this.activeAlbum && this.activeAlbum.id === id) {
            this.activeAlbum = this.albums.find(a => a.id === id) || this.activeAlbum
          }
          this.showNotice('Album updated', 'success')
          return true
        }
      } catch (err) {
        this.showNotice('Failed to update album', 'error')
      }
      return false
    },

    async deleteAlbum(id) {
      try {
        const res = await fetch(`/api/albums/${id}`, { method: 'DELETE' })
        if (res.ok) {
          if (this.activeAlbum && this.activeAlbum.id === id) {
            this.activeAlbum = null
          }
          await this.fetchAlbums()
          this.showNotice('Album deleted', 'info')
          return true
        }
      } catch (err) {
        this.showNotice('Failed to delete album', 'error')
      }
      return false
    },

    async uploadFiles(albumId, fileList) {
      const formData = new FormData()
      for (let i = 0; i < fileList.length; i++) {
        formData.append('files', fileList[i])
      }
      try {
        const res = await fetch(`/api/albums/${albumId}/upload`, {
          method: 'POST',
          body: formData
        })
        if (res.ok) {
          await this.fetchMedia(albumId)
          await this.fetchAlbums()
          this.showNotice(`Uploaded ${fileList.length} files successfully`, 'success')
          return true
        }
      } catch (err) {
        this.showNotice('Upload failed', 'error')
      }
      return false
    },

    async setAlbumCover(albumId, mediaId) {
      try {
        const res = await fetch(`/api/albums/${albumId}/set-cover`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mediaId })
        })
        if (res.ok) {
          await this.fetchAlbums()
          if (this.activeAlbum && this.activeAlbum.id === albumId) {
            this.activeAlbum.coverId = mediaId
          }
          this.showNotice('Album cover updated', 'success')
          return true
        }
      } catch (err) {
        this.showNotice('Failed to set album cover', 'error')
      }
      return false
    },

    // Batch operations
    toggleSelect(mediaId) {
      const index = this.selectedMediaIds.indexOf(mediaId)
      if (index === -1) {
        this.selectedMediaIds.push(mediaId)
      } else {
        this.selectedMediaIds.splice(index, 1)
      }
    },

    selectRange(fromIndex, toIndex) {
      const start = Math.min(fromIndex, toIndex)
      const end = Math.max(fromIndex, toIndex)
      const idsToAdd = this.currentMedia.slice(start, end + 1).map(m => m.id)
      const set = new Set([...this.selectedMediaIds, ...idsToAdd])
      this.selectedMediaIds = Array.from(set)
    },

    selectAll() {
      this.selectedMediaIds = this.currentMedia.map(m => m.id)
    },

    clearSelection() {
      this.selectedMediaIds = []
    },

    async batchMove(targetAlbumId) {
      if (!this.selectedMediaIds.length) return
      try {
        const res = await fetch('/api/media/batch-move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mediaIds: this.selectedMediaIds,
            targetAlbumId
          })
        })
        if (res.ok) {
          await this.fetchMedia(this.activeAlbum.id)
          await this.fetchAlbums()
          this.showNotice(`Moved ${this.selectedMediaIds.length} items`, 'success')
          this.clearSelection()
          return true
        }
      } catch (err) {
        this.showNotice('Batch move failed', 'error')
      }
      return false
    },

    async batchCopy(targetAlbumId) {
      if (!this.selectedMediaIds.length) return
      try {
        const res = await fetch('/api/media/batch-copy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mediaIds: this.selectedMediaIds,
            targetAlbumId
          })
        })
        if (res.ok) {
          await this.fetchAlbums()
          this.showNotice(`Copied ${this.selectedMediaIds.length} items`, 'success')
          this.clearSelection()
          return true
        }
      } catch (err) {
        this.showNotice('Batch copy failed', 'error')
      }
      return false
    },

    async batchDelete() {
      if (!this.selectedMediaIds.length) return
      try {
        const res = await fetch('/api/media/batch-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mediaIds: this.selectedMediaIds })
        })
        if (res.ok) {
          await this.fetchMedia(this.activeAlbum.id)
          await this.fetchAlbums()
          this.showNotice(`Deleted ${this.selectedMediaIds.length} items`, 'info')
          this.clearSelection()
          return true
        }
      } catch (err) {
        this.showNotice('Batch delete failed', 'error')
      }
      return false
    },

    async batchDownload() {
      if (!this.selectedMediaIds.length) return
      try {
        const res = await fetch('/api/media/batch-download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mediaIds: this.selectedMediaIds })
        })
        if (res.ok) {
          const blob = await res.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `vault-export-${Date.now()}.zip`
          document.body.appendChild(a)
          a.click()
          a.remove()
          window.URL.revokeObjectURL(url)
          this.showNotice('Download initiated', 'success')
        }
      } catch (err) {
        this.showNotice('Download failed', 'error')
      }
    },

    // Viewer actions
    openViewer(index) {
      this.viewerActiveIndex = index
      this.viewerOpen = true
      this.slideshowPlaying = false
    },

    startSlideshow() {
      if (!this.currentMedia.length) return
      // If skip videos is on and current item is video, find first image
      if (this.skipVideosInSlideshow && this.currentMedia[this.viewerActiveIndex]?.isVideo) {
        const firstImgIndex = this.currentMedia.findIndex(m => !m.isVideo)
        if (firstImgIndex !== -1) {
          this.viewerActiveIndex = firstImgIndex
        }
      }
      this.viewerOpen = true
      this.slideshowPlaying = true
    },

    nextMedia() {
      if (!this.currentMedia.length) return
      let nextIndex = this.viewerActiveIndex + 1

      if (this.slideshowPlaying && this.skipVideosInSlideshow) {
        while (nextIndex < this.currentMedia.length && this.currentMedia[nextIndex].isVideo) {
          nextIndex++
        }
        if (nextIndex >= this.currentMedia.length) {
          // Loop back to first image
          nextIndex = this.currentMedia.findIndex(m => !m.isVideo)
          if (nextIndex === -1) nextIndex = 0
        }
      } else {
        if (nextIndex >= this.currentMedia.length) {
          nextIndex = 0
        }
      }
      this.viewerActiveIndex = nextIndex
    },

    prevMedia() {
      if (!this.currentMedia.length) return
      let prevIndex = this.viewerActiveIndex - 1

      if (this.slideshowPlaying && this.skipVideosInSlideshow) {
        while (prevIndex >= 0 && this.currentMedia[prevIndex].isVideo) {
          prevIndex--
        }
        if (prevIndex < 0) {
          // Loop to last image
          for (let i = this.currentMedia.length - 1; i >= 0; i--) {
            if (!this.currentMedia[i].isVideo) {
              prevIndex = i
              break
            }
          }
          if (prevIndex < 0) prevIndex = 0
        }
      } else {
        if (prevIndex < 0) {
          prevIndex = this.currentMedia.length - 1
        }
      }
      this.viewerActiveIndex = prevIndex
    },

    closeViewer() {
      this.viewerOpen = false
      this.slideshowPlaying = false
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
    }
  }
})
