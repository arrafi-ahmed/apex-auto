// Starts the app for the e2e suite: fresh temp database, known credentials, no news fetching.
import fs from 'fs'
import os from 'os'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = path.join(os.tmpdir(), 'apex-auto-e2e-data')

fs.rmSync(dataDir, { recursive: true, force: true })
fs.mkdirSync(dataDir, { recursive: true })

// Values set here win over anything in the developer's own .env (the server never overrides)
Object.assign(process.env, {
  NODE_ENV: 'test',
  PORT: process.env.E2E_PORT || '4317',
  DATA_DIR: dataDir,
  VAULT_PIN: 'e2e-pin-4821',
  ADMIN_RESET_TOKEN: 'e2e-reset-token',
  TRIGGER_WORD: 'guarantee',
  AUTO_LOCK_MINUTES: '15',
  SLIDESHOW_INTERVAL: '3',
  NEWS_DISABLED: '1'
})

execSync('npx vite build', { cwd: root, stdio: 'inherit' })
process.chdir(root)
await import('../server/index.js')
