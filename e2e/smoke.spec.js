import { test, expect } from '@playwright/test'
import { PIN } from './helpers.js'

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

  test('clicking the word opens the sign-in dialog and the PIN unlocks the vault', async ({ page }) => {
    await page.goto('/')
    await page.locator('.trigger-term').click()
    await page.locator('#portal-pass').fill(PIN)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.locator('.topbar')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Collections' })).toBeVisible()
  })
})
