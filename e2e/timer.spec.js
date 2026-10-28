import { test, expect } from '@playwright/test'
import { signIn, setSettings } from './helpers.js'

// The auto-lock countdown starts from the minutes the admin chose, but is only shown at the end.
test.describe('auto-lock timer', () => {
  test.afterEach(async ({ page }) => {
    await signIn(page)
    await setSettings(page, { autoLockMinutes: 15 })
  })

  test('is hidden while plenty of time is left', async ({ page }) => {
    await signIn(page)
    await setSettings(page, { autoLockMinutes: 15 })
    await page.goto('/')
    await page.locator('.topbar').waitFor()
    await page.waitForTimeout(2500)
    await expect(page.locator('.lock-chip')).toHaveCount(0)
  })

  test('counts down from the admin-set minutes and appears in the last two minutes', async ({ page }) => {
    await signIn(page)
    await setSettings(page, { autoLockMinutes: 2 })
    await page.goto('/')
    const chip = page.locator('.lock-chip')
    await expect(chip).toBeVisible({ timeout: 8000 })
    // 2 minutes minus a few seconds
    await expect(chip).toHaveText(/^1:5\d$/)
  })

  test('turns red when it is shown', async ({ page }) => {
    await signIn(page)
    await setSettings(page, { autoLockMinutes: 1 })
    await page.goto('/')
    const chip = page.locator('.lock-chip')
    await expect(chip).toBeVisible({ timeout: 8000 })
    await expect(chip).toHaveText(/^0:[0-5]\d$/)
    await expect(chip).toHaveCSS('color', 'rgb(244, 85, 90)')
  })
})
