import { test, expect } from '@playwright/test'
import { PIN, openAuthDialog } from './helpers.js'

test.describe('public site and sign-in', () => {
  test('landing page shows the news site with the sign-in word in the hero', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1')).toContainText('Buy smarter')
    // The trigger word sits in the upper part of the page
    const trigger = page.locator('.trigger-term')
    await expect(trigger).toHaveText('guarantee')
    const box = await trigger.boundingBox()
    expect(box.y).toBeLessThan(800)
  })

  test('single or double clicks do nothing; triple-clicking opens the disguised dialog and unlocks the vault', async ({ page }) => {
    await page.goto('/')
    const trigger = page.locator('.trigger-term')

    // Single click must NOT open dialog
    await trigger.click()
    await page.waitForTimeout(800)
    await expect(page.locator('.ax-modal.otr-lookup')).toHaveCount(0)

    // Double click must NOT open dialog
    await trigger.dblclick()
    await page.waitForTimeout(800)
    await expect(page.locator('.ax-modal.otr-lookup')).toHaveCount(0)

    // Quick triple-click opens disguised dialog with unrelated car-pricing copy
    await openAuthDialog(page)
    const modal = page.locator('.ax-modal.otr-lookup')
    await expect(modal).toBeVisible()
    await expect(modal).toContainText('Regional OTR lookup')
    await expect(modal).not.toContainText(/sign in|passphrase|password|portal/i)

    await page.locator('#otr-region-code').fill(PIN)
    await page.getByRole('button', { name: 'Check pricing' }).click()
    await expect(page.locator('.topbar')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Collections' })).toBeVisible()
  })
})
