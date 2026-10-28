import { test, expect } from '@playwright/test'
import { signIn, createAlbum, uploadViaApi, makeImage, openAlbum, uniqueTitle, zoomValue } from './helpers.js'

const PRESETS = [10, 25, 50, 75, 100, 125, 150, 200, 400, 800]

// Opens the viewer on the image called `name` (an album holding a wide, a tall and a small image)
async function openViewerOn(page, name) {
  await signIn(page)
  const title = uniqueTitle('Viewer')
  const albumId = await createAlbum(page, title)
  await uploadViaApi(page, albumId, await makeImage(1, { width: 2400, height: 1200, name: 'wide.jpg' }))
  await uploadViaApi(page, albumId, await makeImage(2, { width: 900, height: 2400, name: 'tall.jpg' }))
  await uploadViaApi(page, albumId, await makeImage(3, { width: 640, height: 420, name: 'small.jpg' }))
  await openAlbum(page, title)
  await page.locator(`.tile[aria-label="${name.replace('.jpg', '')}"]`).click()
  await expect(page.locator('.viewer')).toBeVisible()
  await expect(page.locator('.layer.full.is-loaded')).toBeVisible()
  // The zoom field reports the fitted size once the image dimensions are known
  await expect.poll(() => zoomValue(page)).toBeGreaterThan(0)
}

test.describe('viewer zoom (desktop)', () => {
  test('double-click zooms in and a second double-click returns to the fitted size', async ({ page }) => {
    await openViewerOn(page, 'wide.jpg')
    const fit = await zoomValue(page)
    expect(fit).toBeLessThan(100)

    await page.locator('.stage').dblclick()
    await expect.poll(() => zoomValue(page)).toBeGreaterThan(fit * 1.5)

    await page.locator('.stage').dblclick()
    await expect.poll(() => zoomValue(page)).toBe(fit)
  })

  test('the zoom field accepts a typed percentage', async ({ page }) => {
    await openViewerOn(page, 'wide.jpg')
    const field = page.locator('.zoom-input')
    await field.click()
    await field.fill('150')
    await field.press('Enter')
    await expect.poll(() => zoomValue(page)).toBe(150)

    // Escape abandons what was typed
    await field.click()
    await field.fill('33')
    await field.press('Escape')
    await expect.poll(() => zoomValue(page)).toBe(150)
  })

  test('the menu lists the presets and applies one', async ({ page }) => {
    await openViewerOn(page, 'wide.jpg')
    await page.locator('.zoom-caret').click()
    const menu = page.locator('.zoom-menu')
    await expect(menu.locator('.ax-menu-item')).toHaveCount(2 + PRESETS.length)
    await expect(menu.getByText('Fit to width')).toBeVisible()
    await expect(menu.getByText('Fit to page')).toBeVisible()
    // click() fails if the menu were hidden behind the viewer
    await menu.locator('.ax-menu-item', { hasText: /^400%$/ }).click()
    await expect.poll(() => zoomValue(page)).toBe(400)
    await expect(menu).not.toBeVisible()

    await page.locator('.zoom-caret').click()
    await page.locator('.zoom-menu .ax-menu-item', { hasText: 'Fit to page' }).click()
    await expect.poll(() => zoomValue(page)).toBeLessThan(100)
  })

  test('Fit to width fills the stage width', async ({ page }) => {
    await openViewerOn(page, 'tall.jpg')
    const stageWidth = (await page.locator('.stage').boundingBox()).width
    await page.locator('.zoom-caret').click()
    await page.locator('.zoom-menu .ax-menu-item', { hasText: 'Fit to width' }).click()
    await expect.poll(() => zoomValue(page)).toBe(Math.round((stageWidth / 900) * 100))
  })

  test('plus and minus step through the preset sizes', async ({ page }) => {
    await openViewerOn(page, 'wide.jpg')
    const fit = await zoomValue(page)
    await page.getByTitle('Zoom in', { exact: true }).click()
    await expect.poll(() => zoomValue(page)).toBeGreaterThan(fit)
    expect(PRESETS).toContain(await zoomValue(page))
    const up = await zoomValue(page)
    await page.getByTitle('Zoom out', { exact: true }).click()
    await expect.poll(() => zoomValue(page)).toBeLessThan(up)
  })

  test('Z toggles the zoom and Escape closes the viewer', async ({ page }) => {
    await openViewerOn(page, 'wide.jpg')
    const fit = await zoomValue(page)
    await page.keyboard.press('z')
    await expect.poll(() => zoomValue(page)).toBeGreaterThan(fit)
    await page.keyboard.press('z')
    await expect.poll(() => zoomValue(page)).toBe(fit)
    await page.keyboard.press('Escape')
    await expect(page.locator('.viewer')).toHaveCount(0)
  })
})

test.describe('viewer controls (desktop)', () => {
  test('the seconds-per-slide button opens a menu and changes the interval', async ({ page }) => {
    await openViewerOn(page, 'wide.jpg')
    const button = page.getByLabel('Seconds per slide')
    await button.click()
    // Real click: proves the menu is on top of the viewer
    await page.locator('.ax-menu-item', { hasText: /^8s$/ }).click()
    await expect(button).toContainText('8s')
  })

  test('toolbars slide away when idle and the image area grows to the full screen', async ({ page }) => {
    await openViewerOn(page, 'wide.jpg')
    const stage = page.locator('.stage')
    const viewportHeight = page.viewportSize().height
    const withBars = (await stage.boundingBox()).height
    expect(withBars).toBeLessThan(viewportHeight - 40)

    await page.mouse.move(640, 400)
    await expect(page.locator('.bar.top')).toHaveClass(/is-hidden/, { timeout: 6000 })
    await expect.poll(async () => (await stage.boundingBox()).height, { timeout: 5000 }).toBeGreaterThanOrEqual(viewportHeight - 1)

    // Moving the mouse brings the toolbars back and the stage gives the space up again
    await page.mouse.move(700, 420)
    await expect(page.locator('.bar.top')).not.toHaveClass(/is-hidden/)
    await expect.poll(async () => (await stage.boundingBox()).height, { timeout: 5000 }).toBeLessThan(viewportHeight - 40)
  })

  test('the image fills the freed space (fit grows when the bars hide)', async ({ page }) => {
    await openViewerOn(page, 'tall.jpg')
    const fitWithBars = await zoomValue(page)
    await page.mouse.move(640, 400)
    await expect(page.locator('.bar.top')).toHaveClass(/is-hidden/, { timeout: 6000 })
    await expect.poll(() => zoomValue(page), { timeout: 5000 }).toBeGreaterThan(fitWithBars)
  })
})
