import fs from 'fs'
import crypto from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// DATA_DIR lets the e2e suite run against a throw-away database instead of ./data
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, '..', 'data')
const DB_PATH = path.join(DATA_DIR, 'db.json')
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')
const THUMBS_DIR = path.join(UPLOADS_DIR, 'thumbs')

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}
if (!fs.existsSync(THUMBS_DIR)) {
  fs.mkdirSync(THUMBS_DIR, { recursive: true })
}

// ---- Secret hashing (scrypt) ----
// Stored format: scrypt$N$r$p$saltB64$hashB64 so cost parameters can change later.
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 }

export function hashSecret(secret) {
  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(String(secret), salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p })
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), hash.toString('base64')].join('$')
}

export function verifySecret(candidate, stored) {
  if (typeof candidate !== 'string' || typeof stored !== 'string') return false
  const [scheme, N, r, p, saltB64, hashB64] = stored.split('$')
  if (scheme !== 'scrypt' || !hashB64) return false
  try {
    const expected = Buffer.from(hashB64, 'base64')
    const actual = crypto.scryptSync(candidate, Buffer.from(saltB64, 'base64'), expected.length, {
      N: Number(N), r: Number(r), p: Number(p)
    })
    return crypto.timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

function envPin() {
  return process.env.VAULT_PIN || process.env.VAULT_PASSWORD
}

function getEnvDefaults() {
  return {
    vaultPasswordHash: hashSecret(envPin() || 'secret123'),
    resetTokenHash: hashSecret(process.env.ADMIN_RESET_TOKEN || 'unlock123'),
    slideshowInterval: Number(process.env.SLIDESHOW_INTERVAL) || 3,
    skipVideosInSlideshow: true,
    secretTriggerWord: process.env.TRIGGER_WORD || 'guarantee',
    autoLockMinutes: Number(process.env.AUTO_LOCK_MINUTES) || 15
  }
}

// Runs once per process, on the first loadDB() (after .env has been loaded):
//  1. migrates legacy plaintext vaultPassword/resetToken to hashes and removes the plaintext
//  2. applies VAULT_PIN / ADMIN_RESET_TOKEN from the environment when they differ from the
//     stored hash (the env remains the source of truth at startup, as before). Doing this
//     once instead of per request avoids a scrypt run on every call; a password changed in
//     the UI persists until the next restart.
// Returns true when settings were modified.
function secureSettings(settings) {
  let changed = false

  for (const [plainKey, hashKey] of [['vaultPassword', 'vaultPasswordHash'], ['resetToken', 'resetTokenHash']]) {
    if (typeof settings[plainKey] === 'string') {
      if (!settings[hashKey]) settings[hashKey] = hashSecret(settings[plainKey])
      delete settings[plainKey]
      changed = true
    }
  }

  const envSecrets = [
    ['vaultPasswordHash', envPin()],
    ['resetTokenHash', process.env.ADMIN_RESET_TOKEN]
  ]
  for (const [hashKey, envValue] of envSecrets) {
    if (envValue && !verifySecret(envValue, settings[hashKey])) {
      settings[hashKey] = hashSecret(envValue)
      changed = true
    }
  }

  const envTrigger = process.env.TRIGGER_WORD
  if (envTrigger && settings.secretTriggerWord !== envTrigger) {
    settings.secretTriggerWord = envTrigger
    changed = true
  }

  if (!settings.vaultPasswordHash) { settings.vaultPasswordHash = hashSecret('secret123'); changed = true }
  if (!settings.resetTokenHash) { settings.resetTokenHash = hashSecret('unlock123'); changed = true }
  return changed
}

let secretsSynced = false

const defaultDB = {
  settings: null, // filled per call by loadDB() via getEnvDefaults()
  albums: [
    {
      id: 'album-default-1',
      title: 'Classics & Prototypes',
      description: 'Vintage high-performance vehicle archives and track photography.',
      coverId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'album-default-2',
      title: 'Private Vault Alpha',
      description: 'Confidential personal collection and high-res media.',
      coverId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  media: [],
  auditLogs: [],
  lastLogin: null
}

export function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    const fresh = { ...defaultDB, settings: getEnvDefaults() }
    saveDB(fresh)
    secretsSynced = true
    return fresh
  }
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8')
    const parsed = JSON.parse(raw)
    if (!parsed.auditLogs) parsed.auditLogs = []
    if (!parsed.settings) parsed.settings = {}

    if (!secretsSynced) {
      secretsSynced = true
      if (secureSettings(parsed.settings)) saveDB(parsed)
    }
    return parsed
  } catch (err) {
    console.error('Error reading db.json, using default', err)
    return { ...defaultDB, settings: getEnvDefaults() }
  }
}

export function saveDB(data) {
  const tempPath = `${DB_PATH}.tmp`
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8')
  fs.renameSync(tempPath, DB_PATH)
}

export { DATA_DIR, UPLOADS_DIR, THUMBS_DIR }
