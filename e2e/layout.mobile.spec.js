import { test, expect } from '@playwright/test'
import { signIn, createAlbum, uploadViaApi, makeImage, openAlbum, uniqueTitle } from './helpers.js'

async function checkNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => {
    const docW = document.documentElement.scrollWidth
    const bodyW = document.body.scrollWidth
    const winW = window.innerWidth
    return {
      overflow: docW > winW || bodyW > winW,
      docW,
      bodyW,
      winW
    }
  })
  expect(overflow.overflow, `Horizontal overflow detected: docW=${overflow.docW}, bodyW=${overflow.bodyW}, winW=${overflow.winW}`).toBe(false)
}

async function checkTouchTargets(page) {
  const violations = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('button, a, input, select, textarea, [role="button"], [role="tab"]'))
    const issues = []

    for (const el of candidates) {
      if (!el.isConnected || el.offsetParent === null) continue
      const style = window.getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0' || style.pointerEvents === 'none') continue

      // Exemptions
      if (el.classList.contains('trigger-term') || el.closest('.trigger-term')) continue
      if (el.classList.contains('tile-check') || el.classList.contains('tile-more')) continue
      if (el.classList.contains('copy') || el.classList.contains('is-current')) continue
      if (el.tagName === 'A' && el.closest('p, dd, .body, footer, .footer')) continue
      if (el.tagName === 'INPUT' && (el.type === 'file' || el.type === 'hidden' || el.type === 'checkbox')) continue

      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) continue

      if (rect.width < 30 || rect.height < 30) {
        issues.push({
          tag: el.tagName,
          id: el.id,
          class: el.className,
          text: el.textContent?.trim().slice(0, 30),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        })
      }
    }
    return issues
  })
  expect(violations).toEqual([])
}

test.describe('Mobile layout, responsive containers, and touch targets', () => {
  test('1. Public decoy landing page has no overflow and adequate touch targets', async ({ page }) => {
    await page.goto('/')
    await page.locator('.hero').waitFor()

    await checkNoHorizontalOverflow(page)
    await checkTouchTargets(page)

    // Test on narrow 360px viewport as well
    await page.setViewportSize({ width: 360, height: 740 })
    await checkNoHorizontalOverflow(page)
    await checkTouchTargets(page)
  })

  test('2. Public news article view has no horizontal overflow', async ({ page }) => {
    await page.route('**/api/news/0123456789ab', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          item: {
            id: '0123456789ab',
            title: 'Indonesia Car Guide: Best City Cars 2026',
            source: 'Apex Auto',
            publishedAt: new Date().toISOString(),
            summary: 'A detailed breakdown of budget runabouts in Jakarta and beyond.',
            image: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=1600&auto=format&fit=crop&q=80',
            link: 'https://example.com/article',
            models: ['Honda Brio', 'Toyota Agya'],
            tags: ['budget', 'tips']
          },
          related: []
        })
      })
    })

    await page.goto('/news/0123456789ab')
    await page.locator('.article').waitFor()

    await checkNoHorizontalOverflow(page)
    await checkTouchTargets(page)

    await page.setViewportSize({ width: 360, height: 740 })
    await checkNoHorizontalOverflow(page)
    await checkTouchTargets(page)
  })

  test('3. Private collections view (album cards) has no overflow', async ({ page }) => {
    await signIn(page)
    const title = uniqueTitle('MobileColl')
    await createAlbum(page, title)

    await page.goto('/')
    await page.locator('.topbar').waitFor()

    await checkNoHorizontalOverflow(page)
    await checkTouchTargets(page)

    await page.setViewportSize({ width: 360, height: 740 })
    await checkNoHorizontalOverflow(page)
    await checkTouchTargets(page)
  })

  test('4. Private album view (2-column image grid) has no overflow', async ({ page }) => {
    await signIn(page)
    const title = uniqueTitle('MobileGrid')
    const albumId = await createAlbum(page, title)
    for (let i = 1; i <= 4; i++) {
      await uploadViaApi(page, albumId, await makeImage(i, { width: 800, height: 600, name: `img-${i}.jpg` }))
    }

    await openAlbum(page, title)
    await expect(page.locator('.tile')).toHaveCount(4)

    await checkNoHorizontalOverflow(page)
    await checkTouchTargets(page)

    await page.setViewportSize({ width: 360, height: 740 })
    await checkNoHorizontalOverflow(page)
    await checkTouchTargets(page)
  })

  test('5. Album manager table view has no overflow on mobile', async ({ page }) => {
    await signIn(page)
    const title = uniqueTitle('MobileMgr')
    await createAlbum(page, title)

    await page.goto('/')
    await page.locator('.topbar').waitFor()

    // Switch to Manage view
    await page.locator('.ax-seg button', { hasText: 'Manage' }).click()
    await expect(page.locator('.manager-table')).toBeVisible()

    await checkNoHorizontalOverflow(page)
    await checkTouchTargets(page)

    await page.setViewportSize({ width: 360, height: 740 })
    await checkNoHorizontalOverflow(page)
    await checkTouchTargets(page)
  })

  test('6. Access logs view has no overflow on mobile', async ({ page }) => {
    await signIn(page)
    await page.goto('/')
    await page.locator('.topbar').waitFor()

    // Switch to Logs view
    await page.locator('.ax-seg button', { hasText: 'Logs' }).click()
    await expect(page.locator('.logs')).toBeVisible()

    await checkNoHorizontalOverflow(page)
    await checkTouchTargets(page)

    await page.setViewportSize({ width: 360, height: 740 })
    await checkNoHorizontalOverflow(page)
    await checkTouchTargets(page)
  })
})
