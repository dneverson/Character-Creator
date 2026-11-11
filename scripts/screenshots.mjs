// Visual smoke check: drive the dev server with Playwright, build a sample
// character, and capture desktop light/dark + mobile screenshots. Run the dev
// server first (`pnpm dev`), then `pnpm screenshots`. Output goes to
// `.local/screenshots/` (git-ignored). Console/page errors are printed.

import { mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'

const URL = process.env.CC_URL ?? 'http://localhost:5173/'
const OUT = '.local/screenshots'
mkdirSync(OUT, { recursive: true })

const log = (...a) => console.log('•', ...a)

async function step(name, fn) {
  try {
    await fn()
    log('ok:', name)
  } catch (e) {
    log('WARN:', name, '->', e.message.split('\n')[0])
  }
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

await page.goto(URL, { waitUntil: 'networkidle' })
await page.getByText('My Characters').waitFor({ timeout: 10000 })
await page.screenshot({ path: `${OUT}/01-list-light.png`, fullPage: true })

await step('new character', async () => {
  await page.getByRole('button', { name: '+ New Character' }).click()
  await page.getByText('Class & Level').waitFor({ timeout: 10000 })
})
await step('name', () => page.getByLabel('Character name').fill('Thornbramble Oak'))
await step('roll stats', () =>
  page.getByRole('button', { name: 'Roll', exact: true }).first().click(),
)
await step('add class row', () => page.getByRole('button', { name: /Add Class/ }).click())
await step('class druid', () =>
  page.getByLabel('Class 1', { exact: true }).selectOption('Druid|PHB'),
)
await step('level 6', () => page.getByLabel('Level for class 1').fill('6'))
await step('subclass', () =>
  page.getByLabel('Subclass for class 1').selectOption({ index: 1 }),
)
await step('race', () =>
  page.getByLabel('Race', { exact: true }).selectOption({ index: 1 }),
)
await step('background', () =>
  page.getByLabel('Background', { exact: true }).selectOption({ index: 1 }),
)

await page.waitForTimeout(4000)
await page.screenshot({ path: `${OUT}/02-editor-light.png`, fullPage: true })

await step('open theme menu', () => page.getByRole('button', { name: /^Theme:/ }).click())
await step('choose dark', () => page.getByRole('button', { name: 'Dark' }).click())
await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/03-editor-dark.png`, fullPage: true })

await page.setViewportSize({ width: 390, height: 844 })
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/04-editor-mobile.png`, fullPage: true })

console.log('\nCONSOLE/PAGE ERRORS (' + errors.length + '):')
for (const e of errors.slice(0, 20)) console.log('  -', e)

await browser.close()
if (errors.length > 0) process.exitCode = 1
