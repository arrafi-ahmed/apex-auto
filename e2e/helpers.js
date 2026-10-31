import sharp from 'sharp'
import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { expect } from '@playwright/test'

const execFileP = promisify(execFile)

export const PIN = 'e2e-pin-4821'

// Triple-clicks the stealth trigger word on the decoy landing page to open the disguised dialog
export async function openAuthDialog(page) {
  const trigger = page.locator('.trigger-term')
  await trigger.click({ clickCount: 3, delay: 40 })
}

// Generates a tiny valid WebM video for viewer playback/loop testing
export async function makeVideo(index = 1, { name } = {}) {
  const tmpFile = path.join(os.tmpdir(), `ax-e2e-vid-${process.pid}-${Date.now()}-${index}.webm`)
  try {
    await execFileP('ffmpeg', [
      '-y', '-f', 'lavfi', '-i', 'color=c=blue:s=320x240:d=0.6',
      '-c:v', 'libvpx', '-b:v', '128k', '-an', tmpFile
    ])
    const buffer = fs.readFileSync(tmpFile)
    return { name: name || `vid-${index}.webm`, mimeType: 'video/webm', buffer }
  } finally {
    try { fs.unlinkSync(tmpFile) } catch {}
  }
}

// A distinct JPEG per index (different colour => different bytes => different content hash)
export async function makeImage(index, { width = 800, height = 600, name } = {}) {
  const buffer = await sharp({
    create: { width, height, channels: 3, background: { r: (index * 47) % 256, g: (index * 89 + 30) % 256, b: (index * 131 + 60) % 256 } }
  })
    .composite([{ input: Buffer.from(`<svg width="${width}" height="${height}"><text x="40" y="140" font-size="120" fill="white">${index}</text></svg>`) }])
    .jpeg({ quality: 88 })
    .toBuffer()
  return { name: name || `img-${index}.jpg`, mimeType: 'image/jpeg', buffer }
}

// Signs in through the API; the session cookie lands in the page's browser context.
// (The app logs the session out whenever the page unloads, so call this before every goto.)
export async function signIn(page) {
  const res = await page.request.post('/api/auth/login', { data: { password: PIN } })
  expect(res.ok(), 'login with the e2e PIN').toBeTruthy()
}

export async function createAlbum(page, title) {
  const res = await page.request.post('/api/albums', { data: { title } })
  expect(res.ok()).toBeTruthy()
  return (await res.json()).id
}

export async function uploadViaApi(page, albumId, file) {
  const res = await page.request.post(`/api/albums/${albumId}/upload`, {
    multipart: { files: { name: file.name, mimeType: file.mimeType, buffer: file.buffer } }
  })
  expect(res.ok()).toBeTruthy()
  return res.json()
}

export async function albumMedia(page, albumId) {
  const res = await page.request.get(`/api/albums/${albumId}/media`)
  expect(res.ok()).toBeTruthy()
  return res.json()
}

export async function setSettings(page, settings) {
  const res = await page.request.post('/api/settings', { data: settings })
  expect(res.ok()).toBeTruthy()
}

let counter = 0
export const uniqueTitle = (label) => `${label} ${Date.now()}-${++counter}`

// Signs in, opens the app and enters the album (by clicking its card)
export async function openAlbum(page, title) {
  await page.goto('/')
  await page.locator('.topbar').waitFor()
  await page.locator('.album', { hasText: title }).first().click()
  await page.locator('.jgrid, .dropzone').first().waitFor()
}

// Percentage currently shown in the viewer's zoom field
export const zoomValue = async (page) => Number(await page.locator('.zoom-input').inputValue())
