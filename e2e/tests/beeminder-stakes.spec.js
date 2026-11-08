import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { expect, test } from '../fixtures/auth.js'
import { API_URL } from '../global-setup.js'

// Beeminder stakes need a backend with `beeminder.enabled: true` and a
// Beeminder (real or fake) that accepts E2E_BEEMINDER_TOKEN. Set
// E2E_BEEMINDER_EDIT_WINDOW_SECONDS to the server's edit window (30 or less)
// to also check that a staked task locks.
const BEEMINDER_TOKEN = process.env.E2E_BEEMINDER_TOKEN
const EDIT_WINDOW_SECONDS = Number(
  process.env.E2E_BEEMINDER_EDIT_WINDOW_SECONDS || 0,
)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const storedToken = () => {
  const state = JSON.parse(
    readFileSync(path.join(__dirname, '..', '.auth', 'state.json'), 'utf8'),
  )
  return state.origins[0].localStorage.find(item => item.name === 'token').value
}

const api = async (method, route, body) => {
  const res = await fetch(`${API_URL}/api/v1${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${storedToken()}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { ok: res.ok, status: res.status, body: await res.json() }
}

const findChore = async name => {
  const { body } = await api('GET', '/chores/')
  return body.res.find(chore => chore.name === name)
}

const openQuickAdd = async page => {
  await page.goto('/chores')
  await page.getByTestId('open-add-task-modal').click()
  const dialog = page.getByRole('dialog', { name: 'Create new task' })
  await expect(dialog).toBeVisible()
  return dialog
}

test.describe('Beeminder stakes', () => {
  test.skip(!BEEMINDER_TOKEN, 'set E2E_BEEMINDER_TOKEN to run stake tests')
  test.use({ storageState: '.auth/state.json' })

  test.beforeAll(async () => {
    const linked = await api('PUT', '/beeminder/account', {
      authToken: BEEMINDER_TOKEN,
    })
    expect(linked.ok, JSON.stringify(linked.body)).toBe(true)
  })

  test('$5 without a due date stays text and the stake button is disabled', async ({
    page,
  }) => {
    const name = `e2e no date ${Date.now()}`
    const dialog = await openQuickAdd(page)
    const input = dialog.locator('textarea')
    await input.fill(`${name} $5`)

    await expect(dialog.getByTestId('stake-picker')).toBeDisabled()
    await expect(dialog.locator('.highlight-stake')).toHaveCount(0)

    await input.press('Enter')
    await expect(dialog).toBeHidden()
    await expect
      .poll(async () => (await findChore(`${name} $5`))?.stake ?? 'none')
      .toBe('none')
  })

  test('$5.50 with a due date places a stake', async ({ page }) => {
    const name = `e2e staked ${Date.now()}`
    const dialog = await openQuickAdd(page)
    const input = dialog.locator('textarea')
    await input.fill(`${name} $5.50 tomorrow`)

    await expect(dialog.locator('.highlight-stake')).toHaveText('$5.50')
    await expect(dialog.getByTestId('stake-picker')).toContainText('$5.50')

    await input.press('Enter')
    await expect(dialog).toBeHidden()
    await expect
      .poll(async () => (await findChore(name))?.stake?.amountCents)
      .toBe(550)

    // `$5.50` was not read as a time: no time given means end of day
    const chore = await findChore(name)
    const due = new Date(chore.nextDueDate)
    expect(`${due.getHours()}:${due.getMinutes()}`).toBe('23:59')

    // The list shows the stake badge with an open padlock
    await page.goto('/chores')
    await expect(page.getByText(name)).toBeVisible()
    await expect(
      page.getByTestId('stake-badge').filter({ hasText: '$5.50' }).first(),
    ).toBeVisible()
  })

  test('the place stake button sets a stake once there is a due date', async ({
    page,
  }) => {
    const name = `e2e button ${Date.now()}`
    const dialog = await openQuickAdd(page)
    const input = dialog.locator('textarea')
    await input.fill(name)
    await expect(dialog.getByTestId('stake-picker')).toBeDisabled()

    await input.fill(`${name} tomorrow`)
    const picker = dialog.getByTestId('stake-picker')
    await expect(picker).toBeEnabled()
    await picker.click()
    await page.getByTestId('stake-amount-input').fill('7')
    await page.getByRole('button', { name: 'Place stake' }).last().click()
    await expect(picker).toContainText('$7.00')

    await input.press('Enter')
    await expect(dialog).toBeHidden()
    await expect
      .poll(async () => (await findChore(name))?.stake?.amountCents)
      .toBe(700)
  })

  test('a staked task climbs above an unstaked P1 near its deadline', async ({
    page,
  }) => {
    const stamp = Date.now()
    const soon = new Date(Date.now() + 60 * 60 * 1000)
    test.skip(
      soon.getDate() !== new Date().getDate(),
      'needs an hour left in the day so both tasks land in Today',
    )
    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 0, 0)
    const p1 = `e2e p1 ${stamp}`
    const staked = `e2e urgent stake ${stamp}`
    const base = {
      frequencyType: 'once',
      assignStrategy: 'no_assignee',
      labelsV2: [],
    }
    expect(
      (
        await api('POST', '/chores/', {
          ...base,
          name: p1,
          priority: 1,
          nextDueDate: endOfDay.toISOString(),
        })
      ).ok,
    ).toBe(true)
    expect(
      (
        await api('POST', '/chores/', {
          ...base,
          name: staked,
          priority: 0,
          nextDueDate: soon.toISOString(),
          stake: { amountCents: 500 },
        })
      ).ok,
    ).toBe(true)

    await page.goto('/chores')
    await expect(page.getByText(staked)).toBeVisible()
    const names = await page
      .locator('text=/e2e (p1|urgent stake) ' + stamp + '/')
      .allInnerTexts()
    expect(names.findIndex(n => n.includes(staked))).toBeLessThan(
      names.findIndex(n => n.includes(p1)),
    )
  })

  test('a staked task locks after the edit window', async ({ page }) => {
    test.skip(
      !EDIT_WINDOW_SECONDS || EDIT_WINDOW_SECONDS > 30,
      'set E2E_BEEMINDER_EDIT_WINDOW_SECONDS (30 or less) to check locking',
    )
    test.setTimeout((EDIT_WINDOW_SECONDS + 30) * 1000)
    const name = `e2e lock ${Date.now()}`
    const created = await api('POST', '/chores/', {
      name,
      frequencyType: 'daily',
      assignStrategy: 'no_assignee',
      labelsV2: [],
      nextDueDate: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      stake: { amountCents: 300 },
    })
    expect(created.ok).toBe(true)
    const id = created.body.res

    await page.goto(`/chores/${id}`)
    await expect(page.getByTestId('stake-banner')).toContainText('Editable for')
    await expect(page.getByRole('button', { name: 'Edit' })).toBeEnabled()

    await page.waitForTimeout((EDIT_WINDOW_SECONDS + 2) * 1000)
    await expect(page.getByTestId('stake-banner')).toContainText('Locked')
    await expect(page.getByRole('button', { name: 'Edit' })).toBeDisabled()
    expect((await api('DELETE', `/chores/${id}`)).status).toBe(423)
  })
})
