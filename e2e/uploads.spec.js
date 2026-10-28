import { test, expect } from '@playwright/test'
import { signIn, createAlbum, makeImage, openAlbum, albumMedia, uploadViaApi, uniqueTitle } from './helpers.js'

async function openEmptyAlbum(page) {
  await signIn(page)
  const title = uniqueTitle('Uploads')
  const albumId = await createAlbum(page, title)
  await openAlbum(page, title)
  return albumId
}

const pick = (page, files) => page.locator('input[type="file"]').setInputFiles(files)
const panel = (page) => page.locator('.uploads')
const headline = (page) => page.locator('.uploads-title')

// Slows every upload request down so the queue stays busy long enough to interact with it
async function slowUploads(page, ms) {
  await page.route('**/api/albums/*/upload', async (route) => {
    await new Promise((r) => setTimeout(r, ms))
    await route.continue().catch(() => {})
  })
}

test.describe('uploads', () => {
  test('a batch uploads completely and the panel reports every file', async ({ page }) => {
    const albumId = await openEmptyAlbum(page)
    const files = await Promise.all(Array.from({ length: 12 }, (_, i) => makeImage(i)))
    await pick(page, files)

    await expect(headline(page)).toHaveText('12 uploaded', { timeout: 30_000 })
    await expect(page.locator('.uploads .item.is-queued')).toHaveCount(0)
    await expect(page.locator('.uploads .item.is-done')).toHaveCount(12)
    expect(await albumMedia(page, albumId)).toHaveLength(12)
    await expect(page.locator('.tile')).toHaveCount(12)
  })

  test('identical content is skipped even under a new name; different content with the same name is kept', async ({ page }) => {
    const albumId = await openEmptyAlbum(page)
    const originals = await Promise.all([0, 1, 2].map((i) => makeImage(i)))
    await pick(page, originals)
    await expect(headline(page)).toHaveText('3 uploaded', { timeout: 20_000 })
    await page.getByTitle('Close', { exact: true }).click()
    await expect(panel(page)).toHaveCount(0)

    const renamedCopy = { ...originals[0], name: 'renamed-copy.jpg' }
    const sameNameNewContent = await makeImage(50, { name: 'img-1.jpg' })
    await pick(page, [renamedCopy, sameNameNewContent])

    await expect(headline(page)).toHaveText('1 uploaded · 1 already there', { timeout: 20_000 })
    await expect(page.locator('.uploads .item.is-skipped')).toHaveCount(1)
    expect(await albumMedia(page, albumId)).toHaveLength(4)
  })

  test('a file picked twice in one selection is stored once', async ({ page }) => {
    const albumId = await openEmptyAlbum(page)
    const file = await makeImage(7)
    await pick(page, [file, file])
    await expect(panel(page)).toBeVisible()
    await expect.poll(async () => (await albumMedia(page, albumId)).length, { timeout: 20_000 }).toBe(1)
    await page.waitForTimeout(1500)
    expect(await albumMedia(page, albumId)).toHaveLength(1)
  })

  test('the panel can be minimised and expanded while uploading, and closed afterwards', async ({ page }) => {
    await openEmptyAlbum(page)
    await slowUploads(page, 900)
    await pick(page, await Promise.all(Array.from({ length: 6 }, (_, i) => makeImage(i))))
    await expect(panel(page)).toBeVisible()
    await expect(page.locator('.uploads-list')).toBeVisible()

    await page.getByTitle('Minimize', { exact: true }).click()
    await expect(page.locator('.uploads-list')).toBeHidden()
    await page.getByTitle('Expand', { exact: true }).click()
    await expect(page.locator('.uploads-list')).toBeVisible()

    await expect(headline(page)).toHaveText('6 uploaded', { timeout: 30_000 })
    await page.getByTitle('Close', { exact: true }).click()
    await expect(panel(page)).toHaveCount(0)
  })

  test('Cancel all stops the queue and clears the panel', async ({ page }) => {
    const albumId = await openEmptyAlbum(page)
    await slowUploads(page, 1500)
    await pick(page, await Promise.all(Array.from({ length: 14 }, (_, i) => makeImage(i + 100))))
    await expect(panel(page)).toBeVisible()

    await page.getByTitle('Cancel all uploads', { exact: true }).click()
    await expect(panel(page)).toHaveCount(0)

    // Nothing new may start afterwards: the number of stored files settles and stays well short of 14
    await page.waitForTimeout(3500)
    const settled = (await albumMedia(page, albumId)).length
    await page.waitForTimeout(2500)
    expect(await albumMedia(page, albumId)).toHaveLength(settled)
    expect(settled).toBeLessThan(14)
    await expect(panel(page)).toHaveCount(0)
  })

  test('a lost reply is retried automatically and never creates duplicates', async ({ page }) => {
    const albumId = await openEmptyAlbum(page)
    // The first three uploads reach the server, but the browser never hears back
    let lost = 0
    await page.route('**/api/albums/*/upload', async (route) => {
      if (lost < 3) {
        lost++
        await route.fetch()
        await route.abort('failed')
      } else {
        await route.continue()
      }
    })
    await pick(page, await Promise.all(Array.from({ length: 6 }, (_, i) => makeImage(i + 200))))

    await expect(headline(page)).toContainText('already there', { timeout: 30_000 })
    await expect(page.locator('.uploads .item.is-error')).toHaveCount(0)
    expect(await albumMedia(page, albumId)).toHaveLength(6)
  })

  test('a failed upload can be retried from the panel', async ({ page }) => {
    const albumId = await openEmptyAlbum(page)
    // Server errors are not retried automatically for 4xx; use a 400 to land in the failed state
    let rejected = 0
    await page.route('**/api/albums/*/upload', async (route) => {
      if (rejected < 1) {
        rejected++
        await route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"bad"}' })
      } else {
        await route.continue()
      }
    })
    await pick(page, [await makeImage(300)])
    await expect(headline(page)).toHaveText('1 failed', { timeout: 15_000 })
    await page.getByTitle('Retry', { exact: true }).first().click()
    await expect(headline(page)).toHaveText('1 uploaded', { timeout: 15_000 })
    expect(await albumMedia(page, albumId)).toHaveLength(1)
  })
})

test.describe('upload API', () => {
  test('the same content is stored once per album but can live in two albums', async ({ page }) => {
    await signIn(page)
    const a = await createAlbum(page, uniqueTitle('API A'))
    const b = await createAlbum(page, uniqueTitle('API B'))
    const file = await makeImage(9)

    const first = await uploadViaApi(page, a, file)
    expect(first.count).toBe(1)
    expect(first.skipped).toHaveLength(0)

    const second = await uploadViaApi(page, a, { ...file, name: 'another-name.jpg' })
    expect(second.count).toBe(0)
    expect(second.skipped).toHaveLength(1)
    expect(await albumMedia(page, a)).toHaveLength(1)

    const elsewhere = await uploadViaApi(page, b, file)
    expect(elsewhere.count).toBe(1)
  })

  test('a deleted photo can be uploaded again', async ({ page }) => {
    await signIn(page)
    const album = await createAlbum(page, uniqueTitle('API trash'))
    const file = await makeImage(11)
    const first = await uploadViaApi(page, album, file)
    const trash = await page.request.post('/api/media/trash', { data: { mediaIds: [first.media[0].id] } })
    expect(trash.ok()).toBeTruthy()
    const again = await uploadViaApi(page, album, file)
    expect(again.count).toBe(1)
  })
})
