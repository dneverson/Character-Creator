// Visual smoke check: drive the dev server with Playwright, build a sample
// character, and capture desktop light/dark + mobile screenshots. Run the dev
// server first (`pnpm dev`), then `pnpm screenshots`. Output goes to
// `.local/screenshots/` (git-ignored; `CC_OUT` names another folder). Console/page
// errors are printed. `CC_LEG` picks what runs: `editor` (build a character by hand),
// `sheet` (open a ready-made character's sheet) or both (the default).

import { mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'

const URL = process.env.CC_URL ?? 'http://localhost:5173/'
const OUT = process.env.CC_OUT ?? '.local/screenshots'
const LEG = process.env.CC_LEG ?? 'all'
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

async function editorLeg() {
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
  await step('add class row', () =>
    page.getByRole('button', { name: /Add Class/ }).click(),
  )
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

  await step('open theme menu', () =>
    page.getByRole('button', { name: /^Theme:/ }).click(),
  )
  await step('choose dark', () => page.getByRole('button', { name: 'Dark' }).click())
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/03-editor-dark.png`, fullPage: true })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/04-editor-mobile.png`, fullPage: true })
}

if (LEG !== 'sheet') await editorLeg()

// The sheet leg: a ready-made character (an elf Druid 3 / Wizard 2 with gear), opened on
// its sheet. The character is seeded where an earlier version of the app kept characters,
// which the app brings over on load.
const BOOKS = ['PHB', 'XPHB', 'DMG', 'XDMG', 'MM']
const score = (base) => ({ base, other: 0 })
const gear = (name, source, extra = {}) => ({
  name,
  source,
  quantity: 1,
  equipped: true,
  ...extra,
})
const SHEET_CHARACTER = {
  id: 'sheet-demo',
  schemaVersion: 23,
  name: 'Thornbramble Oak',
  selectedBooks: BOOKS,
  race: {
    name: 'High Elf',
    baseName: 'Elf',
    subraceName: 'High',
    source: 'PHB',
    abilityFixed: { dex: 2, int: 1 },
    abilityChoices: {},
  },
  background: { name: 'Hermit', source: 'PHB', abilityChoices: {} },
  classes: [
    {
      name: 'Druid',
      source: 'PHB',
      level: 3,
      subclass: { name: 'Circle of the Land', shortName: 'Land', source: 'PHB' },
    },
    { name: 'Wizard', source: 'PHB', level: 2 },
  ],
  abilities: {
    str: score(8),
    dex: score(14),
    con: score(13),
    int: score(14),
    wis: score(16),
    cha: score(10),
  },
  statMethod: 'array',
  statPool: [],
  equipment: {
    items: [
      gear('Quarterstaff', 'PHB'),
      gear('Dagger', 'PHB', { quantity: 2, equipped: false }),
      gear('Leather Armor', 'PHB'),
    ],
    currency: { pp: 0, gp: 12, ep: 0, sp: 0, cp: 0 },
    starting: {},
  },
  createdAt: 500,
  updatedAt: 2000,
}

async function sheetLeg() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
  await page.goto(URL)
  await page.evaluate((character) => {
    localStorage.clear()
    localStorage.setItem(
      'cc-characters',
      JSON.stringify({
        state: {
          characters: { [character.id]: character },
          order: [character.id],
          activeId: null,
        },
        version: 17,
      }),
    )
  }, SHEET_CHARACTER)
  await page.reload({ waitUntil: 'networkidle' })

  async function setTheme(name) {
    await page.getByRole('button', { name: /^Theme:/ }).click()
    await page.getByRole('button', { name, exact: true }).click()
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
  }
  const shot = async (name) => {
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
    log('shot:', name)
  }

  await step('open the sheet', async () => {
    await page.getByRole('button', { name: 'Open' }).click()
    await page.getByRole('button', { name: 'Sheet', exact: true }).click()
    await page.getByRole('list', { name: 'Skills' }).waitFor({ timeout: 10000 })
  })
  await setTheme('Light')
  await shot('20-sheet-desktop-light')
  await setTheme('Dark')
  await shot('21-sheet-desktop-dark')
  await setTheme('Light')
  await page.setViewportSize({ width: 1024, height: 800 })
  await shot('22-sheet-tablet')
  await page.setViewportSize({ width: 390, height: 844 })
  await shot('23-sheet-phone')
  await page.setViewportSize({ width: 1280, height: 900 })
  // The sheet's looks (templates), each in light and dark, a phone and the chooser.
  const chooseLook = async (label) => {
    await page.getByRole('button', { name: /^Look:/ }).click()
    await page.getByRole('button', { name: new RegExp(`^${label}`) }).click()
    await page.waitForTimeout(300)
  }
  for (const look of ['App', 'Parchment']) {
    await chooseLook(look)
    for (const theme of ['Light', 'Dark']) {
      await setTheme(theme)
      await shot(`25-sheet-look-${look.toLowerCase()}-${theme.toLowerCase()}`)
    }
  }
  await setTheme('Light')
  await page.setViewportSize({ width: 390, height: 844 })
  await shot('26-sheet-look-parchment-phone')
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.getByRole('button', { name: /^Look:/ }).click()
  await shot('27-sheet-look-menu')
  await page.keyboard.press('Escape')
  await chooseLook('App')
  for (const tab of await page.getByRole('tab').allTextContents()) {
    await step(`tab ${tab}`, async () => {
      await page.getByRole('tab', { name: tab, exact: true }).click()
      await shot(`24-sheet-tab-${tab.toLowerCase().replace(/[^a-z]+/g, '-')}`)
    })
  }
  await ctx.close()
}

if (LEG !== 'editor') await sheetLeg()

console.log('\nCONSOLE/PAGE ERRORS (' + errors.length + '):')
for (const e of errors.slice(0, 20)) console.log('  -', e)

await browser.close()
if (errors.length > 0) process.exitCode = 1
