import { test, expect } from '@playwright/test'
import { signIn, createAlbum, uploadViaApi, makeImage, openAlbum, uniqueTitle, zoomValue } from './helpers.js'

async function openViewerOn(page, name) {
  await signIn(page)
  const title = uniqueTitle('Phone')
  const albumId = await createAlbum(page, title)
  await uploadViaApi(page, albumId, await makeImage(1, { width: 2400, height: 1200, name: 'wide.jpg' }))
  await uploadViaApi(page, albumId, await makeImage(2, { width: 900, height: 2400, name: 'tall.jpg' }))
  await openAlbum(page, title)
  await page.locator(`.tile[aria-label="${name.replace('.jpg', '')}"]`).tap()
  await expect(page.locator('.viewer')).toBeVisible()
  await expect(page.locator('.layer.full.is-loaded')).toBeVisible()
  await expect.poll(() => zoomValue(page)).toBeGreaterThan(0)
}

test.describe('viewer on a phone', () => {
  test('one tap hides the toolbars and the image takes the whole screen; another brings them back', async ({ page }) => {
    await openViewerOn(page, 'wide.jpg')
    const stage = page.locator('.stage')
    const height = page.viewportSize().height
    expect((await stage.boundingBox()).height).toBeLessThan(height - 40)

    await page.touchscreen.tap(190, 400)
    await expect(page.locator('.bar.top')).toHaveClass(/is-hidden/)
    await expect.poll(async () => (await stage.boundingBox()).height, { timeout: 5000 }).toBeGreaterThanOrEqual(height - 1)

    await page.touchscreen.tap(190, 400)
    await expect(page.locator('.bar.top')).not.toHaveClass(/is-hidden/)
    await expect.poll(async () => (await stage.boundingBox()).height, { timeout: 5000 }).toBeLessThan(height - 40)
    // Verify it stays visible and does not disappear after ~0.5s
    await page.waitForTimeout(2000)
    await expect(page.locator('.bar.top')).not.toHaveClass(/is-hidden/)
  })

  test('double-tap zooms in and a second double-tap zooms back out', async ({ page }) => {
    await openViewerOn(page, 'wide.jpg')
    const fit = await zoomValue(page)

    // Taps are swallowed while the open transition runs; wait until it has finished
    await expect(page.locator('html')).not.toHaveAttribute('data-vt', 'running')

    await page.touchscreen.tap(190, 400)
    await page.touchscreen.tap(191, 400)
    await expect.poll(() => zoomValue(page)).toBeGreaterThan(fit * 1.5)
    // Toolbars must not flicker away from a double-tap
    await expect(page.locator('.bar.top')).not.toHaveClass(/is-hidden/)

    // Works while zoomed in too, where a touch would otherwise start a drag
    await page.touchscreen.tap(190, 400)
    await page.touchscreen.tap(191, 400)
    await expect.poll(() => zoomValue(page)).toBe(fit)
  })

  test('zoom buttons, the editable size and its menu are available on a phone', async ({ page }) => {
    await openViewerOn(page, 'wide.jpg')
    const width = page.viewportSize().width
    for (const locator of [page.locator('.zoom-input'), page.getByTitle('Zoom in', { exact: true }), page.getByTitle('Zoom out', { exact: true }), page.locator('.zoom-caret')]) {
      await expect(locator).toBeVisible()
      const box = await locator.boundingBox()
      expect(box.x + box.width).toBeLessThanOrEqual(width)
    }
    const fit = await zoomValue(page)
    await page.getByTitle('Zoom in', { exact: true }).tap()
    await expect.poll(() => zoomValue(page)).toBeGreaterThan(fit)

    await page.locator('.zoom-caret').tap()
    await page.locator('.zoom-menu .ax-menu-item', { hasText: /^200%$/ }).tap()
    await expect.poll(() => zoomValue(page)).toBe(200)
  })

  test('the seconds-per-slide menu opens on a phone', async ({ page }) => {
    await openViewerOn(page, 'wide.jpg')
    const button = page.getByLabel('Seconds per slide')
    await expect(button).toBeVisible()
    await button.tap()
    await page.locator('.ax-menu-item', { hasText: /^5s$/ }).tap()
    await expect(button).toContainText('5s')
  })
})
