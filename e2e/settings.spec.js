import { test, expect } from '@playwright/test'
import { signIn, setSettings } from './helpers.js'

test.describe('vault settings persistence and validation', () => {
  test.afterEach(async ({ page }) => {
    try {
      await signIn(page)
      await setSettings(page, { tabSwitchLock: true })
    } catch {
      // ignore cleanup failure if server is unavailable
    }
  })

  test('API persists and returns tabSwitchLock setting', async ({ page }) => {
    await signIn(page)
    await setSettings(page, { tabSwitchLock: false })

    const res = await page.request.get('/api/settings')
    expect(res.ok()).toBeTruthy()
    const settings = await res.json()
    expect(settings.tabSwitchLock).toBe(false)
  })

  test('UI toggles Lock on tab switch and persists across reload', async ({ page }) => {
    await signIn(page)
    await page.goto('/')
    await page.locator('.topbar').waitFor()

    // Open preferences
    await page.getByTitle('Preferences').click()
    await expect(page.locator('.ax-modal-title', { hasText: 'Preferences' })).toBeVisible()

    // Switch to Security tab
    await page.getByRole('tab', { name: 'Security' }).or(page.locator('.ax-tabs button', { hasText: 'Security' })).click()

    // Find the checkbox for tab switch lock
    const switchLabel = page.locator('label.ax-switch', { hasText: 'Lock on tab switch' })
    const checkbox = switchLabel.locator('input[type="checkbox"]')
    await expect(checkbox).toBeChecked()

    // Untick
    await switchLabel.click()
    await expect(checkbox).not.toBeChecked()

    // Save
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.locator('.toast', { hasText: 'Settings saved successfully' })).toBeVisible()

    // Reload page, sign in again via UI modal, and re-verify
    await page.goto('/')
    await page.locator('.trigger-term').click()
    await page.locator('#portal-pass').fill('e2e-pin-4821')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.locator('.topbar').waitFor()
    await page.getByTitle('Preferences').click()
    await page.getByRole('tab', { name: 'Security' }).or(page.locator('.ax-tabs button', { hasText: 'Security' })).click()
    const checkboxAfter = page.locator('label.ax-switch', { hasText: 'Lock on tab switch' }).locator('input[type="checkbox"]')
    await expect(checkboxAfter).not.toBeChecked()
  })

  test('rejects new passphrase under 4 characters with inline error', async ({ page }) => {
    await signIn(page)
    await page.goto('/')
    await page.locator('.topbar').waitFor()

    await page.getByTitle('Preferences').click()
    await page.getByRole('tab', { name: 'Security' }).or(page.locator('.ax-tabs button', { hasText: 'Security' })).click()

    await page.locator('#newpass').fill('abc')
    await page.getByRole('button', { name: 'Save changes' }).click()

    // Validation alert is shown and dialog remains open
    const errorMsg = page.locator('.auth-error-msg')
    await expect(errorMsg).toBeVisible()
    await expect(errorMsg).toContainText('Use at least 4 characters')
    await expect(page.locator('#newpass')).toHaveClass(/has-error/)
    await expect(page.locator('.ax-modal-title', { hasText: 'Preferences' })).toBeVisible()
  })
})
