import { defineStore } from 'pinia'

// File handles and XHRs are kept out of reactive state
const uploadFilesById = new Map()
const uploadXhrById = new Map()
const MAX_PARALLEL_UPLOADS = 2
let uploadSeq = 0
let undoTimer = null

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

    // Album view filters (what the grid shows is also what the viewer/slideshow steps through)
    mediaFilter: 'all', // all | images | videos | favorites
    mediaSort: 'newest', // newest | oldest | size-desc | name-asc
    mediaQuery: '',

    // Batch Operations State
    isBatchMode: false,
    selectedMediaIds: [],

    // Viewer & Slideshow State
    viewerOpen: false,
    viewerActiveIndex: 0,
    slideshowPlaying: false,
    slideshowInterval: 3, // seconds
    slideshowShuffle: false,
    skipVideosInSlideshow: true,
    isFullscreen: false,

    // Admin & UI View Mode ('gallery' | 'manager' | 'logs')
    adminViewMode: 'gallery',
    vaultStats: null,

    // Audit Logs & Sign-in Tracking
    auditLogs: [],
    lastLoginTime: null,
    previousLoginTime: null,
    currentClientIp: '',
    totalLogins: 0,
    failedAttempts: 0,
    loadingLogs: false,

    // Security & Inactivity Lockout State
    autoLockMinutes: 5,
    tabSwitchLock: true,
    lastActivityTimestamp: Date.now(),
    secondsRemainingUntilAutoLock: 300,

    // Upload queue: { id, albumId, name, size, progress (0-1), status: queued|uploading|done|error }
    uploads: [],

    // Error and Notice (an optional action renders as a button, e.g. Undo)
    noticeMessage: '',
    noticeColor: 'info',
    noticeAction: null,
    noticeSeq: 0
  }),

  getters: {
    selectedCount: (state) => state.selectedMediaIds.length,
    displayMedia: (state) => {
      let list = state.currentMedia
      if (state.mediaFilter === 'images') list = list.filter(m => !m.isVideo)
      else if (state.mediaFilter === 'videos') list = list.filter(m => m.isVideo)
      else if (state.mediaFilter === 'favorites') list = list.filter(m => m.favorite)

      const q = state.mediaQuery.trim().toLowerCase()
      if (q) {
        list = list.filter(m =>
          (m.title && m.title.toLowerCase().includes(q)) ||
          (m.originalName && m.originalName.toLowerCase().includes(q))
        )
      }

      const time = (m) => new Date(m.createdAt || 0).getTime()
      const name = (m) => m.title || m.originalName || ''
      const sorters = {
        newest: (a, b) => time(b) - time(a),
        oldest: (a, b) => time(a) - time(b),
        'size-desc': (a, b) => (b.size || 0) - (a.size || 0),
        'name-asc': (a, b) => name(a).localeCompare(name(b))
      }
      return [...list].sort(sorters[state.mediaSort] || sorters.newest)
    },
    activeMediaItem() {
      const list = this.displayMedia
      if (!list.length || this.viewerActiveIndex < 0) return null
      return list[this.viewerActiveIndex] || null
    }
  },

  actions: {
    showNotice(msg, color = 'info', action = null) {
      this.noticeMessage = msg
      this.noticeColor = color
      this.noticeAction = action
      this.noticeSeq++
    },

    // ---- Browser history: Back closes the viewer, then the album, instead of leaving the app.
    // Entries carry state only (the URL never changes), so nothing reveals the vault.
    pushNav(kind) {
      try { history.pushState({ ax: kind }, '') } catch { /* ignore */ }
    },

    handlePopState() {
      if (!this.isAuthenticated) return
      if (this.viewerOpen) {
        this.finishCloseViewer()
      } else if (this.activeAlbum) {
        this.activeAlbum = null
        this.selectedMediaIds = []
      }
    },

    leaveAlbum() {
      if (history.state?.ax === 'album') {
        history.back()
      } else {
        this.activeAlbum = null
        this.selectedMediaIds = []
      }
    },

    // Pulls the saved preferences so the auto-lock countdown and slideshow match the server
    async fetchSettings() {
      try {
        const res = await fetch('/api/settings')
        if (!res.ok) return
        const data = await res.json()
        this.slideshowInterval = data.slideshowInterval || this.slideshowInterval
        this.skipVideosInSlideshow = data.skipVideosInSlideshow !== false
        this.autoLockMinutes = data.autoLockMinutes || this.autoLockMinutes
        this.triggerWord = data.secretTriggerWord || this.triggerWord
        this.registerActivity()
        this.updateInactivityCountdown()
      } catch (err) {
        console.error('Fetch settings error', err)
      }
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
            await Promise.all([
              this.fetchSettings(),
              this.fetchAlbums(),
              this.fetchAuditLogs()
            ])
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
          if (data.lastLogin) {
            this.lastLoginTime = data.lastLogin
          }
          if (data.settings) {
            this.slideshowInterval = data.settings.slideshowInterval || 3
            this.skipVideosInSlideshow = data.settings.skipVideosInSlideshow !== false
            this.autoLockMinutes = data.settings.autoLockMinutes || this.autoLockMinutes
          }
          this.registerActivity()
          this.updateInactivityCountdown()
          await Promise.all([
            this.fetchSettings(),
            this.fetchAlbums(),
            this.fetchAuditLogs()
          ])
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
      this.cancelAllUploads()
      this.noticeMessage = ''
      this.noticeAction = null
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
      this.currentMedia = []
      this.selectedMediaIds = []
      this.isBatchMode = false
      this.pushNav('album')
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

    // ---- Upload queue (per-file progress, 2 in parallel, retry on failure) ----
    uploadFiles(albumId, fileList) {
      for (const file of Array.from(fileList)) {
        const id = `up-${++uploadSeq}`
        uploadFilesById.set(id, file)
        this.uploads.push({ id, albumId, name: file.name, size: file.size, progress: 0, status: 'queued' })
      }
      this.processUploads()
      return true
    },

    processUploads() {
      let running = this.uploads.filter(u => u.status === 'uploading').length
      for (const u of this.uploads) {
        if (running >= MAX_PARALLEL_UPLOADS) break
        if (u.status === 'queued') {
          this.startUpload(u.id)
          running++
        }
      }
      const busy = this.uploads.some(u => u.status === 'queued' || u.status === 'uploading')
      if (!busy && this.uploads.length && !this._uploadBatchSettled) {
        this._uploadBatchSettled = true
        this.finishUploadBatch()
      }
    },

    startUpload(id) {
      const u = this.uploads.find(x => x.id === id)
      const file = uploadFilesById.get(id)
      if (!u || !file) return
      this._uploadBatchSettled = false
      u.status = 'uploading'
      u.progress = 0

      const xhr = new XMLHttpRequest()
      uploadXhrById.set(id, xhr)
      const form = new FormData()
      form.append('files', file)
      xhr.open('POST', `/api/albums/${u.albumId}/upload`)
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) u.progress = e.loaded / e.total
      }
      const settle = (ok) => {
        uploadXhrById.delete(id)
        if (u.status === 'canceled') { this.processUploads(); return }
        u.status = ok ? 'done' : 'error'
        if (ok) { u.progress = 1; uploadFilesById.delete(id) }
        this.processUploads()
      }
      xhr.onload = () => settle(xhr.status >= 200 && xhr.status < 300)
      xhr.onerror = () => settle(false)
      xhr.onabort = () => settle(false)
      xhr.send(form)
    },

    async finishUploadBatch() {
      const done = this.uploads.filter(u => u.status === 'done').length
      const failed = this.uploads.filter(u => u.status === 'error').length
      const albumIds = new Set(this.uploads.filter(u => u.status === 'done').map(u => u.albumId))
      if (this.activeAlbum && albumIds.has(this.activeAlbum.id)) await this.fetchMedia(this.activeAlbum.id)
      await Promise.all([this.fetchAlbums(), this.fetchVaultStats()])
      if (failed) this.showNotice(`${done} uploaded, ${failed} failed`, 'error')
      else if (done) this.showNotice(`Uploaded ${done} ${done === 1 ? 'file' : 'files'}`, 'success')
    },

    retryUpload(id) {
      const u = this.uploads.find(x => x.id === id)
      if (u && u.status === 'error' && uploadFilesById.has(id)) {
        u.status = 'queued'
        u.progress = 0
        this.processUploads()
      }
    },

    retryFailedUploads() {
      this.uploads.filter(u => u.status === 'error').forEach(u => this.retryUpload(u.id))
    },

    cancelUpload(id) {
      const u = this.uploads.find(x => x.id === id)
      if (!u) return
      if (u.status === 'uploading') {
        u.status = 'canceled'
        uploadXhrById.get(id)?.abort()
      }
      uploadFilesById.delete(id)
      this.uploads = this.uploads.filter(x => x.id !== id)
      this.processUploads()
    },

    cancelAllUploads() {
      for (const xhr of uploadXhrById.values()) { try { xhr.abort() } catch { /* ignore */ } }
      uploadXhrById.clear()
      uploadFilesById.clear()
      this.uploads = []
      this._uploadBatchSettled = false
    },

    dismissUploads() {
      this.uploads = this.uploads.filter(u => u.status === 'queued' || u.status === 'uploading')
    },

    // ---- Delete with undo: items vanish at once and are only purged server-side after 30s ----
    async trashMedia(ids) {
      if (!ids.length) return false
      const removed = this.currentMedia.filter(m => ids.includes(m.id))
      try {
        const res = await fetch('/api/media/trash', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mediaIds: ids })
        })
        if (!res.ok) throw new Error('trash failed')
      } catch (err) {
        this.showNotice('Delete failed', 'error')
        return false
      }
      this.currentMedia = this.currentMedia.filter(m => !ids.includes(m.id))
      this.selectedMediaIds = this.selectedMediaIds.filter(id => !ids.includes(id))
      this.fetchAlbums()
      this.fetchVaultStats()
      const n = removed.length || ids.length
      this.showNotice(`${n} ${n === 1 ? 'item' : 'items'} deleted`, 'info', {
        label: 'Undo',
        run: () => this.restoreMedia(ids)
      })
      return true
    },

    async restoreMedia(ids) {
      try {
        await fetch('/api/media/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mediaIds: ids })
        })
        if (this.activeAlbum) await this.fetchMedia(this.activeAlbum.id)
        this.fetchAlbums()
        this.fetchVaultStats()
        this.showNotice('Restored', 'success')
      } catch (err) {
        this.showNotice('Could not restore items', 'error')
      }
    },

    async toggleFavorite(ids, value) {
      const set = new Set(ids)
      this.currentMedia.forEach(m => { if (set.has(m.id)) m.favorite = value })
      try {
        await fetch('/api/media/favorite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mediaIds: ids, value })
        })
      } catch (err) {
        this.currentMedia.forEach(m => { if (set.has(m.id)) m.favorite = !value })
        this.showNotice('Could not update favourite', 'error')
      }
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
      const idsToAdd = this.displayMedia.slice(start, end + 1).map(m => m.id)
      const set = new Set([...this.selectedMediaIds, ...idsToAdd])
      this.selectedMediaIds = Array.from(set)
    },

    selectAll() {
      this.selectedMediaIds = this.displayMedia.map(m => m.id)
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
      return this.trashMedia([...this.selectedMediaIds])
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
      if (!this.viewerOpen) this.pushNav('viewer')
      this.viewerOpen = true
      this.slideshowPlaying = false
    },

    startSlideshow() {
      if (!this.displayMedia.length) return
      // If skip videos is on and current item is video, find first image
      if (this.skipVideosInSlideshow && this.displayMedia[this.viewerActiveIndex]?.isVideo) {
        const firstImgIndex = this.displayMedia.findIndex(m => !m.isVideo)
        if (firstImgIndex !== -1) {
          this.viewerActiveIndex = firstImgIndex
        }
      }
      if (!this.viewerOpen) this.pushNav('viewer')
      this.viewerOpen = true
      this.slideshowPlaying = true
    },

    nextMedia() {
      if (!this.displayMedia.length) return
      let nextIndex = this.viewerActiveIndex + 1

      if (this.slideshowPlaying && this.slideshowShuffle && this.displayMedia.length > 1) {
        const pool = this.displayMedia
          .map((m, i) => ({ m, i }))
          .filter(({ m, i }) => i !== this.viewerActiveIndex && !(this.skipVideosInSlideshow && m.isVideo))
        if (pool.length) {
          this.viewerActiveIndex = pool[Math.floor(Math.random() * pool.length)].i
          return
        }
      }

      if (this.slideshowPlaying && this.skipVideosInSlideshow) {
        while (nextIndex < this.displayMedia.length && this.displayMedia[nextIndex].isVideo) {
          nextIndex++
        }
        if (nextIndex >= this.displayMedia.length) {
          // Loop back to first image
          nextIndex = this.displayMedia.findIndex(m => !m.isVideo)
          if (nextIndex === -1) nextIndex = 0
        }
      } else {
        if (nextIndex >= this.displayMedia.length) {
          nextIndex = 0
        }
      }
      this.viewerActiveIndex = nextIndex
    },

    prevMedia() {
      if (!this.displayMedia.length) return
      let prevIndex = this.viewerActiveIndex - 1

      if (this.slideshowPlaying && this.skipVideosInSlideshow) {
        while (prevIndex >= 0 && this.displayMedia[prevIndex].isVideo) {
          prevIndex--
        }
        if (prevIndex < 0) {
          // Loop to last image
          for (let i = this.displayMedia.length - 1; i >= 0; i--) {
            if (!this.displayMedia[i].isVideo) {
              prevIndex = i
              break
            }
          }
          if (prevIndex < 0) prevIndex = 0
        }
      } else {
        if (prevIndex < 0) {
          prevIndex = this.displayMedia.length - 1
        }
      }
      this.viewerActiveIndex = prevIndex
    },

    closeViewer() {
      if (!this.viewerOpen) return
      // Pop our history entry; handlePopState finishes the close
      if (history.state?.ax === 'viewer') history.back()
      else this.finishCloseViewer()
    },

    finishCloseViewer() {
      this.viewerOpen = false
      this.slideshowPlaying = false
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
    },

    async fetchAuditLogs() {
      this.loadingLogs = true
      try {
        const res = await fetch('/api/admin/logs')
        if (res.ok) {
          const data = await res.json()
          this.auditLogs = data.logs || []
          this.lastLoginTime = data.lastLogin || null
          this.previousLoginTime = data.previousLogin || null
          this.currentClientIp = data.currentIp || ''
          this.totalLogins = data.totalLogins || 0
          this.failedAttempts = data.failedAttempts || 0
        }
      } catch (err) {
        console.error('Failed to fetch audit logs', err)
      } finally {
        this.loadingLogs = false
      }
    },

    async clearAuditLogs() {
      try {
        const res = await fetch('/api/admin/logs/clear', { method: 'POST' })
        if (res.ok) {
          this.auditLogs = []
          this.failedAttempts = 0
          this.showNotice('Access logs cleared', 'success')
        }
      } catch (err) {
        this.showNotice('Failed to clear logs', 'error')
      }
    }
  }
})
