import { test, expect } from '@playwright/test'
import { signIn, createAlbum, uploadViaApi, makeImage, openAlbum, uniqueTitle } from './helpers.js'

test.describe('Theme system and stealth invariants', () => {
  test.afterEach(async ({ page }) => {
    // Reset theme preference
    await page.evaluate(() => {
      try { localStorage.removeItem('ax-theme') } catch {}
    })
  })

  test('respects system light mode preference when no saved preference exists', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')

    const vApp = page.locator('.v-application')
    await expect(vApp).toBeVisible()
    await expect(vApp).toHaveClass(/v-theme--apexLight/)

    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content')
    expect(themeColor).toBe('#fafafa')
  })

  test('switches between system, light, and dark via Preferences appearance tab', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await signIn(page)
    await page.goto('/')
    await page.locator('.topbar').waitFor()

    // Open preferences
    await page.getByTitle('Preferences').click()
    await expect(page.locator('.ax-modal-title', { hasText: 'Preferences' })).toBeVisible()

    // Ensure Appearance tab is active
    const appTab = page.getByRole('tab', { name: 'Appearance' }).or(page.locator('.ax-tabs button', { hasText: 'Appearance' }))
    await appTab.click()

    // Click 'Dark' button in segmented control
    const darkBtn = page.locator('.ax-seg button', { hasText: 'Dark' })
    await darkBtn.click()

    // Check that Vuetify application immediately switched to apexDark
    const vApp = page.locator('.v-application')
    await expect(vApp).toHaveClass(/v-theme--apexDark/)

    let themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content')
    expect(themeColor).toBe('#09090b')

    const savedPref = await page.evaluate(() => localStorage.getItem('ax-theme'))
    expect(savedPref).toBe('dark')

    // Click 'Light' button in segmented control
    const lightBtn = page.locator('.ax-seg button', { hasText: 'Light' })
    await lightBtn.click()

    await expect(vApp).toHaveClass(/v-theme--apexLight/)
    themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content')
    expect(themeColor).toBe('#fafafa')

    const savedLightPref = await page.evaluate(() => localStorage.getItem('ax-theme'))
    expect(savedLightPref).toBe('light')
  })

  test('media viewer remains darkroom theater mode when light theme is active', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await signIn(page)
    const title = uniqueTitle('ThemeViewer')
    const albumId = await createAlbum(page, title)
    await uploadViaApi(page, albumId, await makeImage(1, { width: 800, height: 600, name: 'img1.jpg' }))

    await openAlbum(page, title)

    // Ensure light theme
    const vApp = page.locator('.v-application')
    await expect(vApp).toHaveClass(/v-theme--apexLight/)

    // Open first image
    const firstTile = page.locator('.tile').first()
    await expect(firstTile).toBeVisible()
    await firstTile.click()

    const viewer = page.locator('.viewer')
    await expect(viewer).toBeVisible()

    // Verify viewer has dark color scheme and dark computed background
    const viewerColorScheme = await viewer.evaluate((el) => getComputedStyle(el).colorScheme)
    expect(viewerColorScheme).toBe('dark')

    const topBarBg = await page.locator('.bar.top').evaluate((el) => getComputedStyle(el).backgroundColor)
    // Should be dark: rgba(9, 9, 11, ...) or rgb(9, 9, 11)
    expect(topBarBg).toMatch(/rgba?\(9,\s*9,\s*11/)

    // Close viewer
    await page.keyboard.press('Escape')
    await expect(viewer).not.toBeVisible()
  })

  test('stealth 503 camouflage page strictly maintains white background invariant', async ({ page }) => {
    // Emulate dark mode
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')

    // Trigger modal and fail 3 times
    await page.locator('.trigger-term').click()
    for (let i = 1; i <= 3; i++) {
      await page.locator('#portal-pass').fill(`wrong-${i}`)
      await page.getByRole('button', { name: 'Sign in' }).click()
      if (i < 3) {
        await expect(page.locator('.auth-error-msg')).toBeVisible()
      }
    }

    const camo = page.locator('.camouflage-503-wrapper')
    await expect(camo).toBeVisible()

    // Must be plain white nginx background
    const camoBg = await camo.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(camoBg).toBe('rgb(255, 255, 255)')

    // Restore via emergency reset token
    await page.goto('/?reset_vault_token=e2e-reset-token')
    await expect(page.locator('text=Vault Lockout Cleared')).toBeVisible()
  })
})
