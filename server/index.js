import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import net from 'net'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { ZipArchive } = require('archiver')
import sharp from 'sharp'
import { loadDB, saveDB, hashSecret, verifySecret, UPLOADS_DIR, THUMBS_DIR } from './db.js'
import { seedInitialData } from './seed.js'
import { startNewsScheduler, listNews, valuePicks, getNewsItem, newsImageFile } from './news.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Auto-load root .env file if present
const rootEnvPath = path.join(__dirname, '..', '.env')
if (fs.existsSync(rootEnvPath)) {
  try {
    const envLines = fs.readFileSync(rootEnvPath, 'utf-8').split('\n')
    for (const rawLine of envLines) {
      const line = rawLine.trim()
      if (line && !line.startsWith('#') && line.includes('=')) {
        const eqIdx = line.indexOf('=')
        const k = line.slice(0, eqIdx).trim()
        const v = line.slice(eqIdx + 1).trim().replace(/^['"](.*)['"]$/, '$1')
        if (k && !process.env[k]) {
          process.env[k] = v
        }
      }
    }
  } catch (err) {
    console.warn('[ENV] Note: Could not read root .env file:', err.message)
  }
}

const app = express()
const PORT = process.env.PORT || 3000

// Reverse-proxy trust: only the local Nginx hop is trusted. Trusting private ranges
// (uniquelocal/linklocal) lets any LAN/VPC host forge X-Forwarded-For. Override with
// TRUST_PROXY (e.g. "2" if another trusted hop such as a CDN sits in front of Nginx).
const TRUST_PROXY = process.env.TRUST_PROXY
app.set('trust proxy', TRUST_PROXY === undefined ? 'loopback' : (/^\d+$/.test(TRUST_PROXY) ? Number(TRUST_PROXY) : TRUST_PROXY))

// Stealth Camouflage: Disable X-Powered-By header so Express is never leaked
app.disable('x-powered-by')

// In-memory sliding session store: Map<token, { createdAt, lastActive, ip }>
const activeSessions = new Map()
const SESSION_MAX_IDLE_MS = 60 * 60 * 1000 // 60-minute sliding idle window

// In-memory lockout tracking: Map<ip, { attempts, lockedUntil, permanent }>
const lockedClients = new Map()
const MAX_FAILED_ATTEMPTS = 3
const ATTEMPT_WINDOW_MS = 60 * 1000 // 1-minute session window for failed attempts
const LOCKOUT_DURATION_MS = (Number(process.env.LOCKOUT_DURATION_MINUTES) || 1) * 60 * 1000 // Locked out for at least 1 min session

// Periodic Session & Lockout Sweeper (Runs every 60 seconds)
setInterval(() => {
  const now = Date.now()
  for (const [token, session] of activeSessions.entries()) {
    if (now - session.lastActive > SESSION_MAX_IDLE_MS) {
      activeSessions.delete(token)
    }
  }
  for (const [ip, lock] of lockedClients.entries()) {
    if (!lock.permanent && lock.lockedUntil && now >= lock.lockedUntil) {
      lockedClients.delete(ip)
    } else if (!lock.lockedUntil) {
      lock.attempts = (lock.attempts || []).filter(t => (now - t) < ATTEMPT_WINDOW_MS)
      if (lock.attempts.length === 0) {
        lockedClients.delete(ip)
      }
    }
  }
}, 60 * 1000)

// Seed demo data if database is fresh
seedInitialData()

// Daily car-news digest for the public landing page (NEWS_DISABLED=1 turns the fetcher off, e.g. in tests)
if (!process.env.NEWS_DISABLED) startNewsScheduler()

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

// Helper: Get Client IP (uses Express trust proxy to prevent header spoofing)
// The result is validated as a real IP literal so it is safe to use as a Map key,
// in audit logs and in HTML, whatever the headers contained.
function getClientIp(req) {
  let ip = req.ip || req.socket.remoteAddress || ''
  if (ip.startsWith('::ffff:')) ip = ip.slice(7)
  return net.isIP(ip) ? ip : '0.0.0.0'
}

// Whitelist of settings that may ever leave the server. Never spread db.settings:
// it also holds vaultPasswordHash and resetTokenHash.
function publicSettings(s = {}) {
  return {
    slideshowInterval: s.slideshowInterval || 3,
    skipVideosInSlideshow: s.skipVideosInSlideshow !== false,
    secretTriggerWord: s.secretTriggerWord || 'guarantee',
    autoLockMinutes: s.autoLockMinutes || 15
  }
}

// Global Camouflage Lockout Middleware
app.use((req, res, next) => {
  const clientIp = getClientIp(req)
  const resetQueryToken = req.query.reset_vault_token

  // Check if admin emergency reset is requested
  const db = loadDB()
  if (resetQueryToken && verifySecret(resetQueryToken, db.settings.resetTokenHash)) {
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
  if (lock && lock.lockedUntil) {
    if (lock.permanent || Date.now() < lock.lockedUntil) {
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
  // -480 is the legacy square crop; -640 is the aspect-preserving thumbnail
  for (const size of ['480', '640']) {
    const thumbPath = path.join(THUMBS_DIR, `${mediaId}-${size}.webp`)
    if (fs.existsSync(thumbPath)) {
      try { fs.unlinkSync(thumbPath) } catch (e) { /* ignore */ }
    }
  }
}

// ---- Media probing & video posters (ffmpeg is optional) ----
const execFileP = promisify(execFile)
let ffmpegAvailable = null
async function hasFfmpeg() {
  if (ffmpegAvailable === null) {
    try {
      await execFileP('ffprobe', ['-version'], { timeout: 5000 })
      await execFileP('ffmpeg', ['-version'], { timeout: 5000 })
      ffmpegAvailable = true
    } catch {
      ffmpegAvailable = false
    }
  }
  return ffmpegAvailable
}

// Returns { width, height, duration? } for a media record; {} when it cannot be determined.
async function probeMedia(item) {
  try {
    const filePath = getSafeUploadPath(item.filename)
    if (!item.isVideo) {
      const meta = await sharp(filePath).metadata()
      let { width, height } = meta
      if (meta.orientation >= 5) [width, height] = [height, width]
      return width && height ? { width, height } : {}
    }
    if (!(await hasFfmpeg())) return {}
    const { stdout } = await execFileP('ffprobe', [
      '-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height:format=duration', '-of', 'json', filePath
    ], { timeout: 15000 })
    const info = JSON.parse(stdout)
    const stream = info.streams?.[0] || {}
    const duration = Number(info.format?.duration)
    return {
      ...(stream.width && stream.height ? { width: stream.width, height: stream.height } : {}),
      ...(duration > 0 ? { duration } : {})
    }
  } catch {
    return {}
  }
}

// Extracts one frame from a video into a 640px WebP poster. Returns true on success.
async function generateVideoPoster(rawFilePath, thumbPath) {
  if (!(await hasFfmpeg())) return false
  const tmpPng = `${thumbPath}.tmp.png`
  for (const seek of ['1', '0']) {
    try {
      await execFileP('ffmpeg', ['-v', 'error', '-y', '-ss', seek, '-i', rawFilePath, '-frames:v', '1', tmpPng], { timeout: 30000 })
      if (!fs.existsSync(tmpPng)) continue
      await sharp(tmpPng).resize(640, 640, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toFile(thumbPath)
      return true
    } catch { /* try next seek position */ } finally {
      try { fs.unlinkSync(tmpPng) } catch { /* ignore */ }
    }
  }
  return false
}

// Soft-deleted media (undo window): hidden from every listing, purged for good after this delay.
const TRASH_GRACE_MS = 30 * 1000
const isLive = (m) => !m.trashedAt

function purgeExpiredTrash() {
  const db = loadDB()
  const now = Date.now()
  const expired = db.media.filter(m => m.trashedAt && now - new Date(m.trashedAt).getTime() > TRASH_GRACE_MS)
  if (!expired.length) return
  for (const m of expired) {
    try {
      const filePath = getSafeUploadPath(m.filename)
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    } catch { /* ignore */ }
    removeThumbnail(m.id)
  }
  const ids = new Set(expired.map(m => m.id))
  db.media = db.media.filter(m => !ids.has(m.id))
  saveDB(db)
}
purgeExpiredTrash()
setInterval(purgeExpiredTrash, 15 * 1000)

// Helper: Parse User-Agent for device, platform, browser details
function parseUserAgent(uaString = '') {
  const ua = (uaString || '').trim()
  if (!ua) {
    return {
      browser: 'Unknown Browser',
      browserVersion: '',
      os: 'Unknown OS',
      deviceType: 'Unknown',
      raw: ''
    }
  }

  // OS & Device Type
  let os = 'Unknown OS'
  let deviceType = 'Desktop'

  if (/iPhone/i.test(ua)) {
    os = 'iOS (iPhone)'
    deviceType = 'Mobile'
  } else if (/iPad/i.test(ua)) {
    os = 'iPadOS'
    deviceType = 'Tablet'
  } else if (/Android/i.test(ua)) {
    deviceType = /Mobile/i.test(ua) ? 'Mobile' : 'Tablet'
    const match = ua.match(/Android\s+([0-9.]+)/i)
    os = match ? `Android ${match[1]}` : 'Android'
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    const match = ua.match(/Mac OS X\s+([0-9_]+)/i)
    os = match ? `macOS ${match[1].replace(/_/g, '.')}` : 'macOS'
  } else if (/Windows NT/i.test(ua)) {
    const match = ua.match(/Windows NT\s+([0-9.]+)/i)
    const ver = match ? match[1] : ''
    const verMap = { '10.0': 'Windows 10/11', '6.3': 'Windows 8.1', '6.2': 'Windows 8', '6.1': 'Windows 7' }
    os = verMap[ver] || `Windows ${ver}`
  } else if (/CrOS/i.test(ua)) {
    os = 'ChromeOS'
  } else if (/Linux/i.test(ua)) {
    os = 'Linux'
  }

  // Browser & Version
  let browser = 'Unknown Browser'
  let browserVersion = ''

  if (/Edg(?:e|A|iOS)?\/([0-9.]+)/i.test(ua)) {
    browser = 'Microsoft Edge'
    browserVersion = RegExp.$1
  } else if (/OPR\/([0-9.]+)/i.test(ua) || /Opera/i.test(ua)) {
    browser = 'Opera'
    browserVersion = RegExp.$1
  } else if (/SamsungBrowser\/([0-9.]+)/i.test(ua)) {
    browser = 'Samsung Internet'
    browserVersion = RegExp.$1
  } else if (/Chrome\/([0-9.]+)/i.test(ua)) {
    browser = 'Chrome'
    browserVersion = RegExp.$1
  } else if (/Firefox\/([0-9.]+)/i.test(ua)) {
    browser = 'Firefox'
    browserVersion = RegExp.$1
  } else if (/Version\/([0-9.]+).*Safari/i.test(ua)) {
    browser = 'Safari'
    browserVersion = RegExp.$1
  }

  return {
    browser,
    browserVersion: browserVersion ? browserVersion.split('.')[0] : '',
    os,
    deviceType,
    raw: ua
  }
}

// ================= AUTH ROUTES =================

// Check auth status
app.get('/api/auth/status', (req, res) => {
  const clientIp = getClientIp(req)
  const lock = lockedClients.get(clientIp)
  if (lock && lock.lockedUntil) {
    if (lock.permanent || Date.now() < lock.lockedUntil) {
      return sendCamouflage503(res)
    } else {
      lockedClients.delete(clientIp)
    }
  }
  res.json({
    authenticated: isAuthenticated(req)
  })
})

// Login endpoint with timing-safe comparison, audit logging, and lockout escalation
app.post('/api/auth/login', (req, res) => {
  const clientIp = getClientIp(req)
  const lock = lockedClients.get(clientIp)
  if (lock && lock.lockedUntil) {
    if (lock.permanent || Date.now() < lock.lockedUntil) {
      return sendCamouflage503(res)
    } else {
      lockedClients.delete(clientIp)
    }
  }

  const { password } = req.body
  const db = loadDB()
  const uaInfo = parseUserAgent(req.headers['user-agent'])

  if (password && verifySecret(password, db.settings.vaultPasswordHash)) {
    // Reset any failed attempts on success
    lockedClients.delete(clientIp)

    const sessionToken = crypto.randomBytes(32).toString('hex')
    activeSessions.set(sessionToken, {
      createdAt: Date.now(),
      lastActive: Date.now(),
      ip: clientIp
    })

    // Record successful login in audit log
    const nowIso = new Date().toISOString()
    const logEntry = {
      id: 'log-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex'),
      timestamp: nowIso,
      ip: clientIp,
      status: 'success',
      os: uaInfo.os,
      deviceType: uaInfo.deviceType,
      browser: uaInfo.browser,
      browserVersion: uaInfo.browserVersion,
      userAgent: req.headers['user-agent'] || 'Unknown'
    }

    db.auditLogs = db.auditLogs || []
    db.auditLogs.unshift(logEntry)
    if (db.auditLogs.length > 500) db.auditLogs.pop()
    db.lastLogin = nowIso
    saveDB(db)

    res.cookie('vault_token', sessionToken, {
      httpOnly: true,
      sameSite: 'lax'
      // Omitted maxAge: strictly valid for current browser session only!
    })

    return res.json({
      success: true,
      token: sessionToken,
      lastLogin: nowIso,
      settings: publicSettings(db.settings)
    })
  } else {
    // WRONG PASSWORD -> FAILED ATTEMPTS IN 1 MIN SESSION
    const now = Date.now()
    const record = lockedClients.get(clientIp) || { attempts: [], lockedUntil: null, permanent: false }

    // Prune attempts older than ATTEMPT_WINDOW_MS (1 min session)
    record.attempts = (record.attempts || []).filter(t => (now - t) < ATTEMPT_WINDOW_MS)
    record.attempts.push(now)

    const count = record.attempts.length
    const isLockedOut = count >= MAX_FAILED_ATTEMPTS

    if (isLockedOut) {
      record.lockedUntil = now + LOCKOUT_DURATION_MS
      record.permanent = false
      record.attempts = []
      lockedClients.set(clientIp, record)
      console.warn(`[SECURITY] Intruder / ${count} failed password attempts reached from IP: ${clientIp}. Engaging camouflage mode for ${LOCKOUT_DURATION_MS / 1000}s.`)
    } else {
      lockedClients.set(clientIp, record)
      console.warn(`[SECURITY] Failed password attempt (${count}/${MAX_FAILED_ATTEMPTS}) from IP: ${clientIp}.`)
    }

    // Record failed attempt in audit log
    const logEntry = {
      id: 'log-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex'),
      timestamp: new Date().toISOString(),
      ip: clientIp,
      status: 'failed',
      note: isLockedOut ? `Camouflage 503 lockout engaged (${MAX_FAILED_ATTEMPTS} failed attempts)` : `Failed attempt ${count} of ${MAX_FAILED_ATTEMPTS}`,
      os: uaInfo.os,
      deviceType: uaInfo.deviceType,
      browser: uaInfo.browser,
      browserVersion: uaInfo.browserVersion,
      userAgent: req.headers['user-agent'] || 'Unknown'
    }
    db.auditLogs = db.auditLogs || []
    db.auditLogs.unshift(logEntry)
    if (db.auditLogs.length > 500) db.auditLogs.pop()
    saveDB(db)

    if (isLockedOut) {
      return sendCamouflage503(res)
    } else {
      return res.status(401).json({
        error: 'Invalid passphrase',
        remainingAttempts: MAX_FAILED_ATTEMPTS - count
      })
    }
  }
})

// Logout / Panic Lock endpoint (Supports standard JSON and navigator.sendBeacon)
app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies['vault_token'] || req.headers['x-vault-token']
  if (token) activeSessions.delete(token)
  res.clearCookie('vault_token')
  res.status(200).send('OK')
})

// ================= AUDIT LOG ROUTES =================

// Get audit log history & last login stats
app.get('/api/admin/logs', requireAuth, (req, res) => {
  const db = loadDB()
  const clientIp = getClientIp(req)
  const logs = db.auditLogs || []

  // Extract successful logins
  const successLogins = logs.filter(l => l.status === 'success')
  const lastLogin = successLogins.length > 0 ? successLogins[0].timestamp : (db.lastLogin || null)
  const previousLogin = successLogins.length > 1 ? successLogins[1].timestamp : lastLogin

  res.json({
    currentIp: clientIp,
    lastLogin,
    previousLogin,
    totalLogins: successLogins.length,
    failedAttempts: logs.filter(l => l.status === 'failed').length,
    logs
  })
})

// Clear audit logs
app.post('/api/admin/logs/clear', requireAuth, (req, res) => {
  const db = loadDB()
  db.auditLogs = []
  saveDB(db)
  res.json({ success: true, message: 'Audit logs cleared' })
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
    const albumMedia = db.media.filter(m => m.albumId === album.id && isLive(m))
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
  const live = db.media.filter(isLive)
  const totalBytes = live.reduce((acc, m) => acc + (m.size || 0), 0)
  res.json({
    totalAlbums: db.albums.length,
    totalMedia: live.length,
    totalImages: live.filter(m => !m.isVideo).length,
    totalVideos: live.filter(m => m.isVideo).length,
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

app.get('/api/albums/:albumId/media', requireAuth, async (req, res) => {
  const { albumId } = req.params
  const items = loadDB().media.filter(m => m.albumId === albumId && isLive(m))

  // Backfill dimensions/duration for items uploaded before probing existed. Probing is
  // async, so results are applied to a freshly loaded DB to avoid clobbering other writes.
  const pending = items.filter(m => !m.probed).slice(0, 60)
  if (pending.length) {
    const results = new Map(await Promise.all(pending.map(async m => [m.id, await probeMedia(m)])))
    const db = loadDB()
    for (const m of db.media) {
      if (results.has(m.id)) Object.assign(m, results.get(m.id), { probed: true })
    }
    saveDB(db)
    return res.json(db.media.filter(m => m.albumId === albumId && isLive(m)))
  }
  res.json(items)
})

// SHA-256 of a file on disk (streamed, so large videos are fine)
function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    fs.createReadStream(filePath)
      .on('data', chunk => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject)
  })
}

// Uploads skip anything already in the album: identical content (SHA-256, with file size as a
// cheap pre-filter) is a duplicate whatever it is called. That also makes client retries safe.
app.post('/api/albums/:albumId/upload', requireAuth, upload.array('files', 50), async (req, res) => {
  const { albumId } = req.params
  const files = req.files || []
  const discard = (file) => { try { fs.unlinkSync(file.path) } catch { /* already gone */ } }

  if (!loadDB().albums.some(a => a.id === albumId)) {
    files.forEach(discard)
    return res.status(404).json({ error: 'Album not found' })
  }

  try {
    const hashes = await Promise.all(files.map(f => sha256File(f.path)))

    // Older uploads have no stored hash: compute it for same-sized files only, then remember it
    const sizes = new Set(files.map(f => f.size))
    const legacy = loadDB().media.filter(m => m.albumId === albumId && isLive(m) && !m.hash && sizes.has(m.size))
    if (legacy.length) {
      const found = new Map(await Promise.all(legacy.map(async (m) => {
        try { return [m.id, await sha256File(getSafeUploadPath(m.filename))] } catch { return [m.id, null] }
      })))
      const snapshot = loadDB()
      for (const m of snapshot.media) if (found.get(m.id)) m.hash = found.get(m.id)
      saveDB(snapshot)
    }

    // Build the records (probing is async), then do the check-and-save in one synchronous step
    const prepared = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const item = {
        id: `media-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        albumId,
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        hash: hashes[i],
        isVideo: file.mimetype.startsWith('video/'),
        title: path.parse(file.originalname).name,
        createdAt: new Date().toISOString()
      }
      Object.assign(item, await probeMedia(item), { probed: true })
      prepared.push({ file, item })
    }

    const db = loadDB()
    const album = db.albums.find(a => a.id === albumId)
    if (!album) {
      files.forEach(discard)
      return res.status(404).json({ error: 'Album not found' })
    }
    const known = new Map(db.media.filter(m => m.albumId === albumId && isLive(m) && m.hash).map(m => [m.hash, m]))
    const added = []
    const skipped = []
    for (const { file, item } of prepared) {
      const duplicate = known.get(item.hash)
      if (duplicate) {
        skipped.push({ name: file.originalname, duplicateOf: duplicate.id })
        discard(file)
        continue
      }
      known.set(item.hash, item)
      added.push(item)
    }

    if (added.length) {
      db.media.unshift(...added)
      if (!album.coverId) album.coverId = added[0].id
      album.updatedAt = new Date().toISOString()
      saveDB(db)
    }
    res.json({ success: true, count: added.length, media: added, skipped })
  } catch (err) {
    files.forEach(discard)
    console.error('[UPLOAD] Failed:', err.message)
    res.status(500).json({ error: 'Upload failed' })
  }
})

// Soft delete with undo: items are hidden immediately and purged after TRASH_GRACE_MS
app.post('/api/media/trash', requireAuth, (req, res) => {
  const { mediaIds } = req.body
  if (!Array.isArray(mediaIds)) return res.status(400).json({ error: 'Invalid parameters' })
  const db = loadDB()
  const now = new Date().toISOString()
  let count = 0
  for (const m of db.media) {
    if (mediaIds.includes(m.id) && isLive(m)) { m.trashedAt = now; count++ }
  }
  saveDB(db)
  res.json({ success: true, count })
})

app.post('/api/media/restore', requireAuth, (req, res) => {
  const { mediaIds } = req.body
  if (!Array.isArray(mediaIds)) return res.status(400).json({ error: 'Invalid parameters' })
  const db = loadDB()
  let count = 0
  for (const m of db.media) {
    if (mediaIds.includes(m.id) && m.trashedAt) { delete m.trashedAt; count++ }
  }
  saveDB(db)
  res.json({ success: true, count })
})

app.post('/api/media/favorite', requireAuth, (req, res) => {
  const { mediaIds, value } = req.body
  if (!Array.isArray(mediaIds)) return res.status(400).json({ error: 'Invalid parameters' })
  const db = loadDB()
  for (const m of db.media) {
    if (mediaIds.includes(m.id)) m.favorite = Boolean(value)
  }
  saveDB(db)
  res.json({ success: true })
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
    if (mediaIds.includes(m.id) && isLive(m)) {
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
    if (mediaIds.includes(m.id) && isLive(m)) {
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

// On-the-fly WebP thumbnails (640px, aspect ratio preserved, cached on disk).
// Videos get a real poster frame when ffmpeg is installed, otherwise a generic SVG.
const thumbJobs = new Map()

app.get('/thumb/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  const db = loadDB()
  const item = db.media.find(m => m.id === id)
  if (!item) return res.status(404).send('Not Found')

  let rawFilePath
  try {
    rawFilePath = getSafeUploadPath(item.filename)
  } catch (err) {
    return res.status(400).send('Invalid path')
  }
  if (!fs.existsSync(rawFilePath)) return res.status(404).send('Raw file missing')

  const thumbPath = path.join(THUMBS_DIR, `${item.id}-640.webp`)
  const sendThumb = () => {
    res.setHeader('Content-Type', 'image/webp')
    res.setHeader('Cache-Control', 'private, max-age=604800, immutable')
    return fs.createReadStream(thumbPath).pipe(res)
  }
  if (fs.existsSync(thumbPath)) return sendThumb()

  try {
    if (!thumbJobs.has(item.id)) {
      const job = (async () => {
        if (item.isVideo) return generateVideoPoster(rawFilePath, thumbPath)
        await sharp(rawFilePath)
          .rotate() // auto-orient by EXIF
          .resize(640, 640, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 82, effort: 4 })
          .toFile(thumbPath)
        return true
      })().finally(() => thumbJobs.delete(item.id))
      thumbJobs.set(item.id, job)
    }
    if (await thumbJobs.get(item.id)) return sendThumb()
  } catch (err) {
    console.error(`Thumbnail generation error for ${item.filename}:`, err.message)
  }

  if (item.isVideo) {
    res.setHeader('Content-Type', 'image/svg+xml')
    res.setHeader('Cache-Control', 'private, max-age=300')
    return res.send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="640" height="360">
      <rect width="100%" height="100%" fill="#18181b"/>
      <circle cx="320" cy="180" r="44" fill="#6d7bff" fill-opacity="0.22"/>
      <polygon points="306,158 342,180 306,202" fill="#a5b4fc"/>
    </svg>`)
  }
  // Fallback to the raw file if sharp could not decode it
  res.setHeader('Content-Type', item.mimeType || 'image/jpeg')
  return fs.createReadStream(rawFilePath).pipe(res)
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
  res.json(publicSettings(db.settings))
})

app.post('/api/settings', requireAuth, (req, res) => {
  const { slideshowInterval, skipVideosInSlideshow, newPassword, secretTriggerWord, autoLockMinutes } = req.body
  const db = loadDB()

  if (slideshowInterval !== undefined) db.settings.slideshowInterval = Number(slideshowInterval)
  if (skipVideosInSlideshow !== undefined) db.settings.skipVideosInSlideshow = Boolean(skipVideosInSlideshow)
  if (typeof secretTriggerWord === 'string' && secretTriggerWord.trim()) db.settings.secretTriggerWord = secretTriggerWord.trim()
  if (autoLockMinutes !== undefined) db.settings.autoLockMinutes = Number(autoLockMinutes)
  if (typeof newPassword === 'string' && newPassword.length >= 4) {
    db.settings.vaultPasswordHash = hashSecret(newPassword)
  }

  saveDB(db)
  res.json({ success: true, settings: publicSettings(db.settings) })
})

// ================= PUBLIC NEWS (landing page) =================

app.get('/api/news', (req, res) => {
  const { page, pageSize, topic, model, q } = req.query
  res.setHeader('Cache-Control', 'no-cache')
  res.json(listNews({ page, pageSize, topic, model, q }))
})

app.get('/api/news/picks', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache')
  res.json({ items: valuePicks(4) })
})

app.get('/api/news/:id', (req, res) => {
  const item = getNewsItem(req.params.id)
  if (!item) return res.status(404).json({ error: 'Not Found' })
  res.setHeader('Cache-Control', 'public, max-age=300')
  res.json(item)
})

app.get('/news-img/:file', (req, res) => {
  const file = newsImageFile(req.params.file)
  if (!file) return res.status(404).send('Not Found')
  res.setHeader('Cache-Control', 'public, max-age=86400')
  res.sendFile(file)
})

// In production, serve the built Vite app
const DIST_PATH = path.join(__dirname, '..', 'dist')
if (fs.existsSync(DIST_PATH)) {
  app.use(express.static(DIST_PATH))
  app.use((req, res) => {
    res.sendFile(path.join(DIST_PATH, 'index.html'))
  })
}

// Bind to loopback by default so the app is only reachable through Nginx; port 3000
// exposed directly would let clients send arbitrary forwarded headers.
const HOST = process.env.HOST || '127.0.0.1'
app.listen(PORT, HOST, () => {
  console.log(`[VAULT SERVER] Running on port ${PORT}`)
})
