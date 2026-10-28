import { test, expect } from '@playwright/test'
import { signIn, createAlbum, uploadViaApi, makeImage, openAlbum, uniqueTitle } from './helpers.js'

async function longPress(page, locator, ms = 650) {
  const b = await locator.boundingBox()
  expect(b).toBeTruthy()
  const pt = { x: b.x + b.width / 2, y: b.y + b.height / 2 }
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt] })
  await page.waitForTimeout(ms)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

test.describe('mobile gallery interactions', () => {
  test('2-column gallery grid layout on mobile', async ({ page }) => {
    await signIn(page)
    const title = uniqueTitle('Mobile Grid')
    const albumId = await createAlbum(page, title)
    await uploadViaApi(page, albumId, await makeImage(1, { width: 800, height: 800, name: 'img1.jpg' }))
    await uploadViaApi(page, albumId, await makeImage(2, { width: 800, height: 800, name: 'img2.jpg' }))

    await openAlbum(page, title)

    const tiles = page.locator('.tile')
    await expect(tiles).toHaveCount(2)

    const b0 = await tiles.nth(0).boundingBox()
    const b1 = await tiles.nth(1).boundingBox()
    const gridBox = await page.locator('.jgrid').boundingBox()

    expect(b0).toBeTruthy()
    expect(b1).toBeTruthy()
    expect(gridBox).toBeTruthy()

    // Same vertical top alignment
    expect(Math.abs(b0.y - b1.y)).toBeLessThanOrEqual(2)

    // Equal column widths (+/- 1px)
    expect(Math.abs(b0.width - b1.width)).toBeLessThanOrEqual(1.5)

    // Widths plus 4px gap match container width
    const totalW = b0.width + b1.width + 4
    expect(Math.abs(totalW - gridBox.width)).toBeLessThanOrEqual(2)
  })

  test('long-press selects tile, vibration triggered, subsequent tap opens viewer', async ({ page }) => {
    await signIn(page)
    const title = uniqueTitle('Mobile LongPress')
    const albumId = await createAlbum(page, title)
    await uploadViaApi(page, albumId, await makeImage(1, { width: 800, height: 800, name: 'img1.jpg' }))
    await uploadViaApi(page, albumId, await makeImage(2, { width: 800, height: 800, name: 'img2.jpg' }))

    await openAlbum(page, title)

    const tiles = page.locator('.tile')
    await expect(tiles).toHaveCount(2)

    // Long press tile 0
    await longPress(page, tiles.nth(0))

    // 1 selected, dock is visible, viewer is not open
    await expect(page.locator('.tile.is-selected')).toHaveCount(1)
    await expect(page.locator('.dock')).toBeVisible()
    await expect(page.locator('.viewer')).toHaveCount(0)

    // Tap tile 1 adds to selection
    await tiles.nth(1).tap()
    await expect(page.locator('.tile.is-selected')).toHaveCount(2)

    // Tap tile 0 deselects it
    await tiles.nth(0).tap()
    await expect(page.locator('.tile.is-selected')).toHaveCount(1)

    // Clear selection
    await page.locator('.dock').getByLabel('Clear selection').click()
    await expect(page.locator('.tile.is-selected')).toHaveCount(0)

    // Quick tap opens viewer
    await tiles.nth(0).tap()
    await expect(page.locator('.viewer')).toBeVisible()
  })

  test('pull to refresh and overscroll behavior containment', async ({ page }) => {
    // 1. Landing page check (overscroll-behavior-y is NOT contain)
    await page.goto('/')
    const publicOverscroll = await page.evaluate(() => getComputedStyle(document.documentElement).overscrollBehaviorY)
    expect(publicOverscroll).not.toBe('contain')

    // 2. Vault check
    await signIn(page)
    const title = uniqueTitle('Mobile PTR')
    const albumId = await createAlbum(page, title)
    await uploadViaApi(page, albumId, await makeImage(1, { width: 800, height: 800, name: 'img1.jpg' }))
    await openAlbum(page, title)

    const vaultOverscroll = await page.evaluate(() => getComputedStyle(document.documentElement).overscrollBehaviorY)
    expect(vaultOverscroll).toBe('contain')

    // 3. Pull gesture via CDP touch events starting on the grid
    const cdp = await page.context().newCDPSession(page)
    const grid = page.locator('.jgrid')
    await grid.waitFor()
    const box = await grid.boundingBox()
    expect(box).toBeTruthy()

    const x = Math.round(box.x + box.width / 2)
    const startY = Math.round(box.y + 10)
    const endY = startY + 220
    const steps = 8

    const reqPromise = page.waitForRequest(/\/api\/albums\/.+\/media/)

    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y: startY }]
    })

    for (let i = 1; i <= steps; i++) {
      const y = Math.round(startY + ((endY - startY) * i) / steps)
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y }]
      })
      await page.waitForTimeout(25)
    }

    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: []
    })

    await reqPromise

    // Indicator should be hidden after refresh completes
    await expect(page.locator('.ptr-chip')).toHaveCount(0)
  })
})
