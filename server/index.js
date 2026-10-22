import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { ZipArchive } = require('archiver')
import sharp from 'sharp'
import { loadDB, saveDB, UPLOADS_DIR, THUMBS_DIR } from './db.js'
import { seedInitialData } from './seed.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000

// Stealth Camouflage: Disable X-Powered-By header so Express is never leaked
app.disable('x-powered-by')

// In-memory sliding session store: Map<token, { createdAt, lastActive, ip }>
const activeSessions = new Map()
const SESSION_MAX_IDLE_MS = 60 * 60 * 1000 // 60-minute sliding idle window

// In-memory lockout tracking: Map<ip, { failedAttempts, lockedUntil, permanent }>
const lockedClients = new Map()
const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 30 * 60 * 1000 // 30 minutes lockout

// Periodic Session & Lockout Sweeper (Runs every 60 seconds)
setInterval(() => {
  const now = Date.now()
  for (const [token, session] of activeSessions.entries()) {
    if (now - session.lastActive > SESSION_MAX_IDLE_MS) {
      activeSessions.delete(token)
    }
  }
  for (const [ip, lock] of lockedClients.entries()) {
    if (!lock.permanent && lock.lockedUntil && now > lock.lockedUntil) {
      lockedClients.delete(ip)
    }
  }
}, 60 * 1000)

// Seed demo data if database is fresh
seedInitialData()

app.use(cors({
  origin: true,
  credentials: true
}))
app.use(express.json())
app.use(cookieParser())

// Camouflage 503 HTML Template (Pixel-identical to Ubuntu Nginx default)
const CAMOUFLAGE_503_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>503 Service Temporarily Unavailable</title>
  <style>
    body { width: 45em; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; padding-top: 80px; color: #222; }
    h1 { font-size: 26px; font-weight: 500; margin-bottom: 8px; color: #111; }
    p { font-size: 14px; line-height: 1.6; color: #555; }
    hr { border: 0; height: 1px; background: #e2e8f0; margin: 24px 0 16px 0; }
    .server { font-size: 13px; color: #718096; font-style: italic; }
  </style>
</head>
<body>
  <h1>503 Service Temporarily Unavailable</h1>
  <p>The server is currently unable to handle the request due to temporary maintenance or capacity issues.</p>
  <p>Please try again in a few moments. If the problem persists, contact your infrastructure administrator.</p>
  <hr>
  <div class="server">nginx/1.24.0 (Ubuntu)</div>
</body>
</html>`

// Helper: Send Genuine 503 Camouflage Response with Nginx Server Header
function sendCamouflage503(res) {
  res.status(503)
  res.setHeader('Server', 'nginx/1.24.0 (Ubuntu)')
  res.setHeader('Date', new Date().toUTCString())
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Connection', 'keep-alive')
  return res.send(CAMOUFLAGE_503_HTML)
}

// Helper: Constant-time string comparison against side-channel timing attacks
function safeCompare(inputStr, targetStr) {
  if (typeof inputStr !== 'string' || typeof targetStr !== 'string') return false
  const hashA = crypto.createHash('sha256').update(inputStr).digest()
  const hashB = crypto.createHash('sha256').update(targetStr).digest()
  return crypto.timingSafeEqual(hashA, hashB)
}

// Helper: Get Client IP
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1'
}

// Global Camouflage Lockout Middleware
app.use((req, res, next) => {
  const clientIp = getClientIp(req)
  const resetQueryToken = req.query.reset_vault_token

  // Check if admin emergency reset is requested
  const db = loadDB()
  if (resetQueryToken && safeCompare(resetQueryToken, db.settings.resetToken)) {
    lockedClients.delete(clientIp)
    return res.status(200).send(`
      <html><body style="font-family:sans-serif;padding:40px;background:#0f172a;color:#38bdf8;">
        <h2>Vault Lockout Cleared</h2>
        <p>Client ${clientIp} has been restored. You may now return to the landing page.</p>
        <a href="/" style="color:#60a5fa;">Back to Site</a>
      </body></html>
    `)
  }

  // If locked, return genuine 503
  const lock = lockedClients.get(clientIp)
  if (lock) {
    if (lock.permanent || !lock.lockedUntil || Date.now() < lock.lockedUntil) {
      return sendCamouflage503(res)
    } else {
      lockedClients.delete(clientIp)
    }
  }

  next()
})

// Authentication Verification Helper with Sliding Window
function isAuthenticated(req) {
  const token = req.cookies['vault_token'] || req.headers['x-vault-token']
  if (!token || !activeSessions.has(token)) return false

  const session = activeSessions.get(token)
  const now = Date.now()
  if (now - session.lastActive > SESSION_MAX_IDLE_MS) {
    activeSessions.delete(token)
    return false
  }

  // Slide activity timestamp
  session.lastActive = now
  return true
}

function requireAuth(req, res, next) {
  if (!isAuthenticated(req)) {
    // Return 404 to avoid revealing protected endpoints existence
    return res.status(404).json({ error: 'Not Found' })
  }
  next()
}

// Multer Storage Configuration with strict filename sanitization
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '')
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, `${uniqueSuffix}${ext}`)
  }
})
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB max
})

// Path Traversal Guard
function getSafeUploadPath(filename) {
  const safeName = path.basename(filename)
  const resolved = path.resolve(UPLOADS_DIR, safeName)
  if (!resolved.startsWith(path.resolve(UPLOADS_DIR))) {
    throw new Error('Access denied: Invalid file path')
  }
  return resolved
}

// Helper: Remove thumbnail for media ID
function removeThumbnail(mediaId) {
  const thumbPath = path.join(THUMBS_DIR, `${mediaId}-480.webp`)
  if (fs.existsSync(thumbPath)) {
    try { fs.unlinkSync(thumbPath) } catch (e) { /* ignore */ }
  }
}

// ================= AUTH ROUTES =================

// Check auth status
app.get('/api/auth/status', (req, res) => {
  const clientIp = getClientIp(req)
  const lock = lockedClients.get(clientIp)
  if (lock && (lock.permanent || !lock.lockedUntil || Date.now() < lock.lockedUntil)) {
    return sendCamouflage503(res)
  }
  res.json({
    authenticated: isAuthenticated(req)
  })
})

// Login endpoint with timing-safe comparison and lockout escalation
app.post('/api/auth/login', (req, res) => {
  const clientIp = getClientIp(req)
  const { password } = req.body
  const db = loadDB()

  if (password && safeCompare(password, db.settings.vaultPassword)) {
    // Reset any failed attempts on success
    lockedClients.delete(clientIp)

    const sessionToken = crypto.randomBytes(32).toString('hex')
    activeSessions.set(sessionToken, {
      createdAt: Date.now(),
      lastActive: Date.now(),
      ip: clientIp
    })

    res.cookie('vault_token', sessionToken, {
      httpOnly: true,
      sameSite: 'lax'
      // Omitted maxAge: strictly valid for current browser session only!
    })

    return res.json({
      success: true,
      token: sessionToken,
      settings: {
        slideshowInterval: db.settings.slideshowInterval || 3,
        skipVideosInSlideshow: db.settings.skipVideosInSlideshow !== false,
        autoLockMinutes: db.settings.autoLockMinutes || 5
      }
    })
  } else {
    // WRONG PASSWORD -> ENGAGE CAMOUFLAGE LOCKOUT
    console.warn(`[SECURITY] Intruder / Wrong password attempt from IP: ${clientIp}. Engaging camouflage mode.`)
    const current = lockedClients.get(clientIp) || { failedAttempts: 0, lockedUntil: null, permanent: true }
    current.failedAttempts += 1
    current.lockedUntil = Date.now() + LOCKOUT_DURATION_MS
    current.permanent = true // Hard lockout until reset or 30 min expiration
    lockedClients.set(clientIp, current)

    return sendCamouflage503(res)
  }
})

// Logout / Panic Lock endpoint (Supports standard JSON and navigator.sendBeacon)
app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies['vault_token'] || req.headers['x-vault-token']
  if (token) activeSessions.delete(token)
  res.clearCookie('vault_token')
  res.status(200).send('OK')
})

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// ================= ALBUM ROUTES =================

app.get('/api/albums', requireAuth, (req, res) => {
  const db = loadDB()
  const albumsWithStats = db.albums.map(album => {
    const albumMedia = db.media.filter(m => m.albumId === album.id)
    const coverMedia = albumMedia.find(m => m.id === album.coverId) || albumMedia[0] || null
    const totalBytes = albumMedia.reduce((acc, m) => acc + (m.size || 0), 0)
    return {
      ...album,
      mediaCount: albumMedia.length,
      imageCount: albumMedia.filter(m => !m.isVideo).length,
      videoCount: albumMedia.filter(m => m.isVideo).length,
      coverUrl: coverMedia ? `/thumb/${coverMedia.id}` : null,
      totalBytes,
      totalSizeFormatted: formatBytes(totalBytes)
    }
  })
  res.json(albumsWithStats)
})

app.get('/api/vault/stats', requireAuth, (req, res) => {
  const db = loadDB()
  const totalBytes = db.media.reduce((acc, m) => acc + (m.size || 0), 0)
  res.json({
    totalAlbums: db.albums.length,
    totalMedia: db.media.length,
    totalImages: db.media.filter(m => !m.isVideo).length,
    totalVideos: db.media.filter(m => m.isVideo).length,
    totalBytes,
    totalSizeFormatted: formatBytes(totalBytes)
  })
})

app.post('/api/albums', requireAuth, (req, res) => {
  const { title, description } = req.body
  if (!title) return res.status(400).json({ error: 'Title is required' })

  const db = loadDB()
  const newAlbum = {
    id: `album-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    title: title.trim(),
    description: (description || '').trim(),
    coverId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  db.albums.unshift(newAlbum)
  saveDB(db)
  res.json(newAlbum)
})

app.put('/api/albums/:id', requireAuth, (req, res) => {
  const { id } = req.params
  const { title, description, coverId } = req.body
  const db = loadDB()
  const album = db.albums.find(a => a.id === id)
  if (!album) return res.status(404).json({ error: 'Album not found' })

  if (title) album.title = title.trim()
  if (description !== undefined) album.description = description.trim()
  if (coverId !== undefined) album.coverId = coverId
  album.updatedAt = new Date().toISOString()

  saveDB(db)
  res.json(album)
})

// Set specific media item as album cover
app.post('/api/albums/:id/set-cover', requireAuth, (req, res) => {
  const { id } = req.params
  const { mediaId } = req.body
  const db = loadDB()
  const album = db.albums.find(a => a.id === id)
  if (!album) return res.status(404).json({ error: 'Album not found' })

  const media = db.media.find(m => m.id === mediaId && m.albumId === id)
  if (!media) return res.status(404).json({ error: 'Media not found in this album' })

  album.coverId = mediaId
  album.updatedAt = new Date().toISOString()
  saveDB(db)
  res.json({ success: true, coverId: mediaId })
})

app.delete('/api/albums/:id', requireAuth, (req, res) => {
  const { id } = req.params
  const db = loadDB()
  const albumIndex = db.albums.findIndex(a => a.id === id)
  if (albumIndex === -1) return res.status(404).json({ error: 'Album not found' })

  // Find all media in this album and clean up raw files and thumbnails
  const mediaToDelete = db.media.filter(m => m.albumId === id)
  for (const m of mediaToDelete) {
    try {
      const filePath = getSafeUploadPath(m.filename)
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    } catch (e) { /* ignore */ }
    removeThumbnail(m.id)
  }

  db.media = db.media.filter(m => m.albumId !== id)
  db.albums.splice(albumIndex, 1)
  saveDB(db)
  res.json({ success: true, deletedMediaCount: mediaToDelete.length })
})

// ================= MEDIA ROUTES =================

app.get('/api/albums/:albumId/media', requireAuth, (req, res) => {
  const { albumId } = req.params
  const db = loadDB()
  const items = db.media.filter(m => m.albumId === albumId)
  res.json(items)
})

app.post('/api/albums/:albumId/upload', requireAuth, upload.array('files', 50), (req, res) => {
  const { albumId } = req.params
  const db = loadDB()
  const album = db.albums.find(a => a.id === albumId)
  if (!album) return res.status(404).json({ error: 'Album not found' })

  const uploadedMedia = []
  for (const file of req.files) {
    const isVideo = file.mimetype.startsWith('video/')
    const item = {
      id: `media-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      albumId,
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      isVideo,
      title: path.parse(file.originalname).name,
      createdAt: new Date().toISOString()
    }
    db.media.unshift(item)
    uploadedMedia.push(item)
  }

  if (!album.coverId && uploadedMedia.length > 0) {
    album.coverId = uploadedMedia[0].id
  }
  album.updatedAt = new Date().toISOString()
  saveDB(db)

  res.json({ success: true, count: uploadedMedia.length, media: uploadedMedia })
})

// Batch Move
app.post('/api/media/batch-move', requireAuth, (req, res) => {
  const { mediaIds, targetAlbumId } = req.body
  if (!mediaIds || !Array.isArray(mediaIds) || !targetAlbumId) {
    return res.status(400).json({ error: 'Invalid parameters' })
  }
  const db = loadDB()
  const targetAlbum = db.albums.find(a => a.id === targetAlbumId)
  if (!targetAlbum) return res.status(404).json({ error: 'Target album not found' })

  let movedCount = 0
  db.media.forEach(m => {
    if (mediaIds.includes(m.id)) {
      m.albumId = targetAlbumId
      movedCount++
    }
  })
  targetAlbum.updatedAt = new Date().toISOString()
  saveDB(db)
  res.json({ success: true, movedCount })
})

// Batch Copy
app.post('/api/media/batch-copy', requireAuth, (req, res) => {
  const { mediaIds, targetAlbumId } = req.body
  if (!mediaIds || !Array.isArray(mediaIds) || !targetAlbumId) {
    return res.status(400).json({ error: 'Invalid parameters' })
  }
  const db = loadDB()
  const targetAlbum = db.albums.find(a => a.id === targetAlbumId)
  if (!targetAlbum) return res.status(404).json({ error: 'Target album not found' })

  const copiedItems = []
  db.media.forEach(m => {
    if (mediaIds.includes(m.id)) {
      try {
        const srcPath = getSafeUploadPath(m.filename)
        const ext = path.extname(m.filename)
        const newFilename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`
        const dstPath = path.join(UPLOADS_DIR, newFilename)

        if (fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, dstPath)
        }

        const duplicate = {
          ...m,
          id: `media-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          albumId: targetAlbumId,
          filename: newFilename,
          title: `${m.title} (Copy)`,
          createdAt: new Date().toISOString()
        }
        copiedItems.push(duplicate)
      } catch (e) { /* ignore */ }
    }
  })

  db.media.push(...copiedItems)
  targetAlbum.updatedAt = new Date().toISOString()
  saveDB(db)
  res.json({ success: true, copiedCount: copiedItems.length })
})

// Batch Delete
app.post('/api/media/batch-delete', requireAuth, (req, res) => {
  const { mediaIds } = req.body
  if (!mediaIds || !Array.isArray(mediaIds)) {
    return res.status(400).json({ error: 'Invalid parameters' })
  }
  const db = loadDB()
  let deletedCount = 0

  const remaining = []
  db.media.forEach(m => {
    if (mediaIds.includes(m.id)) {
      deletedCount++
      try {
        const filePath = getSafeUploadPath(m.filename)
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      } catch (e) { /* ignore */ }
      removeThumbnail(m.id)
    } else {
      remaining.push(m)
    }
  })

  db.media = remaining
  saveDB(db)
  res.json({ success: true, deletedCount })
})

// Batch Download (Zip archive stream of raw original files)
app.post('/api/media/batch-download', requireAuth, (req, res) => {
  const { mediaIds } = req.body
  if (!mediaIds || !Array.isArray(mediaIds)) {
    return res.status(400).json({ error: 'Invalid parameters' })
  }
  const db = loadDB()
  const items = db.media.filter(m => mediaIds.includes(m.id))
  if (items.length === 0) return res.status(404).json({ error: 'No media found to download' })

  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', `attachment; filename="vault-export-${Date.now()}.zip"`)

  const archive = new ZipArchive({ zlib: { level: 6 } })
  archive.on('error', err => {
    res.status(500).send({ error: err.message })
  })

  archive.pipe(res)
  items.forEach(item => {
    try {
      const filePath = getSafeUploadPath(item.filename)
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: item.originalName || item.filename })
      }
    } catch (e) { /* ignore */ }
  })
  archive.finalize()
})

// High-Performance On-The-Fly WebP Thumbnail Route (480x480 cached)
app.get('/thumb/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  const db = loadDB()
  const item = db.media.find(m => m.id === id)
  if (!item) return res.status(404).send('Not Found')

  // Return clean SVG poster for video files
  if (item.isVideo) {
    res.setHeader('Content-Type', 'image/svg+xml')
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable')
    return res.send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" width="480" height="480">
      <defs>
        <linearGradient id="vbg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#1e1b4b"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#vbg)"/>
      <circle cx="240" cy="240" r="56" fill="#6366f1" fill-opacity="0.2"/>
      <circle cx="240" cy="240" r="44" fill="#4f46e5" fill-opacity="0.4"/>
      <polygon points="230,215 264,240 230,265" fill="#a5b4fc"/>
    </svg>`)
  }

  let rawFilePath
  try {
    rawFilePath = getSafeUploadPath(item.filename)
  } catch (err) {
    return res.status(400).send('Invalid path')
  }

  if (!fs.existsSync(rawFilePath)) return res.status(404).send('Raw file missing')

  const thumbFilename = `${item.id}-480.webp`
  const thumbPath = path.join(THUMBS_DIR, thumbFilename)

  res.setHeader('Content-Type', 'image/webp')
  res.setHeader('Cache-Control', 'private, max-age=604800, immutable')

  // Stream cached thumbnail if already generated
  if (fs.existsSync(thumbPath)) {
    return fs.createReadStream(thumbPath).pipe(res)
  }

  // Generate 480x480 WebP thumbnail using sharp
  try {
    await sharp(rawFilePath)
      .rotate() // auto-orient by EXIF
      .resize(480, 480, {
        fit: 'cover',
        position: 'centre'
      })
      .webp({ quality: 82, effort: 4 })
      .toFile(thumbPath)

    return fs.createReadStream(thumbPath).pipe(res)
  } catch (err) {
    console.error(`Thumbnail generation error for ${item.filename}:`, err.message)
    // Fallback to streaming raw file if sharp encountered an unexpected format
    res.setHeader('Content-Type', item.mimeType || 'image/jpeg')
    return fs.createReadStream(rawFilePath).pipe(res)
  }
})

// Secure Streaming Route with Range Request Support (Full-Size Original)
app.get('/media-stream/:id', requireAuth, (req, res) => {
  const { id } = req.params
  const db = loadDB()
  const item = db.media.find(m => m.id === id)
  if (!item) return res.status(404).send('Not Found')

  let filePath
  try {
    filePath = getSafeUploadPath(item.filename)
  } catch (err) {
    return res.status(400).send('Invalid path')
  }

  if (!fs.existsSync(filePath)) return res.status(404).send('File missing on disk')

  const stat = fs.statSync(filePath)
  const fileSize = stat.size
  const range = req.headers.range

  res.setHeader('Cache-Control', 'private, max-age=86400')
  res.setHeader('Content-Disposition', 'inline')

  if (range && item.isVideo) {
    const parts = range.replace(/bytes=/, '').split('-')
    const start = parseInt(parts[0], 10)
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
    const chunksize = end - start + 1
    const file = fs.createReadStream(filePath, { start, end })
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': item.mimeType
    }
    res.writeHead(206, head)
    file.pipe(res)
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': item.mimeType
    }
    res.writeHead(200, head)
    fs.createReadStream(filePath).pipe(res)
  }
})

// ================= SETTINGS =================

app.get('/api/settings', requireAuth, (req, res) => {
  const db = loadDB()
  res.json({
    slideshowInterval: db.settings.slideshowInterval || 3,
    skipVideosInSlideshow: db.settings.skipVideosInSlideshow !== false,
    secretTriggerWord: db.settings.secretTriggerWord || 'guarantee',
    autoLockMinutes: db.settings.autoLockMinutes || 15
  })
})

app.post('/api/settings', requireAuth, (req, res) => {
  const { slideshowInterval, skipVideosInSlideshow, newPassword, secretTriggerWord, autoLockMinutes } = req.body
  const db = loadDB()

  if (slideshowInterval !== undefined) db.settings.slideshowInterval = Number(slideshowInterval)
  if (skipVideosInSlideshow !== undefined) db.settings.skipVideosInSlideshow = Boolean(skipVideosInSlideshow)
  if (secretTriggerWord) db.settings.secretTriggerWord = secretTriggerWord.trim()
  if (autoLockMinutes !== undefined) db.settings.autoLockMinutes = Number(autoLockMinutes)
  if (newPassword && newPassword.length >= 4) {
    db.settings.vaultPassword = newPassword
  }

  saveDB(db)
  res.json({ success: true, settings: db.settings })
})

// In production, serve the built Vite app
const DIST_PATH = path.join(__dirname, '..', 'dist')
if (fs.existsSync(DIST_PATH)) {
  app.use(express.static(DIST_PATH))
  app.use((req, res) => {
    res.sendFile(path.join(DIST_PATH, 'index.html'))
  })
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[VAULT SERVER] Running on port ${PORT}`)
})
