import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_DIR = path.join(__dirname, '..', 'data')
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

const defaultDB = {
  settings: {
    vaultPassword: process.env.VAULT_PASSWORD || 'secret123',
    resetToken: process.env.ADMIN_RESET_TOKEN || 'unlock123',
    slideshowInterval: 3,
    skipVideosInSlideshow: true,
    secretTriggerWord: 'guarantee',
    autoLockMinutes: 15
  },
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
  media: []
}

export function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    saveDB(defaultDB)
    return defaultDB
  }
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch (err) {
    console.error('Error reading db.json, using default', err)
    return defaultDB
  }
}

export function saveDB(data) {
  const tempPath = `${DB_PATH}.tmp`
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8')
  fs.renameSync(tempPath, DB_PATH)
}

export { DATA_DIR, UPLOADS_DIR, THUMBS_DIR }
