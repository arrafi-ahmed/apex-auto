import { test, expect } from '@playwright/test'

test.describe('3 failed attempts lockout rule', () => {
  test('allows 2 failed attempts with inline feedback and locks with 503 on the 3rd attempt', async ({ page }) => {
    await page.goto('/')

    // Trigger sign in modal
    await page.locator('.trigger-term').click()
    await expect(page.locator('.ax-modal.portal')).toBeVisible()

    // 1st wrong attempt
    await page.locator('#portal-pass').fill('wrong-pass-1')
    await page.getByRole('button', { name: 'Sign in' }).click()

    // Should NOT be locked out, should show error message with 2 attempts remaining
    await expect(page.locator('.auth-error-msg')).toBeVisible()
    await expect(page.locator('.auth-error-msg')).toContainText('2 attempts remaining')
    await expect(page.locator('.camouflage-503-wrapper')).toHaveCount(0)

    // 2nd wrong attempt
    await page.locator('#portal-pass').fill('wrong-pass-2')
    await page.getByRole('button', { name: 'Sign in' }).click()

    // Should NOT be locked out, should show error message with 1 attempt remaining
    await expect(page.locator('.auth-error-msg')).toContainText('1 attempt remaining')
    await expect(page.locator('.camouflage-503-wrapper')).toHaveCount(0)

    // 3rd wrong attempt
    await page.locator('#portal-pass').fill('wrong-pass-3')
    await page.getByRole('button', { name: 'Sign in' }).click()

    // 3rd attempt: 503 Camouflage Lockout engaged!
    await expect(page.locator('.camouflage-503-wrapper')).toBeVisible()
    await expect(page.getByRole('heading', { name: '503 Service Temporarily Unavailable' })).toBeVisible()

    // Refreshing page while locked still returns 503
    await page.goto('/')
    await expect(page.getByRole('heading', { name: '503 Service Temporarily Unavailable' })).toBeVisible()

    // Emergency reset token restores access
    await page.goto('/?reset_vault_token=e2e-reset-token')
    await expect(page.locator('text=Vault Lockout Cleared')).toBeVisible()

    // Returning to site works again
    await page.goto('/')
    await expect(page.locator('.trigger-term')).toBeVisible()
  })
})
