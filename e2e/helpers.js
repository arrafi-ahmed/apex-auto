import sharp from 'sharp'
import { expect } from '@playwright/test'

export const PIN = 'e2e-pin-4821'

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
