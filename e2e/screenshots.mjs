// Captures the README screenshots into assets/screenshots/. Run against a freshly seeded database so the
// figures match the demo data: `npm run screenshots` (same environment variables as the test suites).
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ADMIN_PASSWORD, APP, DEMO_PASSWORD, launchBrowser } from './support.mjs'

const OUT = fileURLToPath(new URL('../assets/screenshots/', import.meta.url))
mkdirSync(OUT, { recursive: true })
const API = process.env.FITFORGE_API_URL ?? 'http://localhost:5080'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await launchBrowser()

/** A fresh, isolated browser context (own cookies and storage) per role, with the chosen theme preset. */
async function session({ theme = 'dark', width = 1440, height = 900, mobile = false } = {}) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.setViewport({ width, height, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile })
  await page.evaluateOnNewDocument((t) => localStorage.setItem('fitforge-theme', t), theme)
  return { context, page }
}

async function signIn(page, email, password, home) {
  await page.goto(`${APP}/login`, { waitUntil: 'networkidle0' })
  await page.type('#email', email)
  await page.type('#password', password)
  await page.click('button[type=submit]')
  await page.waitForFunction((h) => location.pathname === h, {}, home)
  // Let the "Welcome back" toast leave the frame.
  await page.waitForFunction(() => !document.querySelector('[data-sonner-toast]'), { timeout: 10000 }).catch(() => {})
  await settle(page)
}

/** Calls the API directly (no UI) as the given user. */
async function api(method, path, body, token) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return response.status === 204 ? null : response.json().catch(() => null)
}

async function settle(page) {
  await page.waitForNetworkIdle({ idleTime: 400 }).catch(() => {})
  await page.waitForFunction(() => !document.querySelector('.animate-pulse'), { timeout: 10000 }).catch(() => {})
  await sleep(700) // chart animations
}

async function shot(page, name, path) {
  if (path) {
    await page.goto(`${APP}${path}`, { waitUntil: 'networkidle0' })
    await settle(page)
  }
  await page.screenshot({ path: `${OUT}${name}.png` })
  console.log(`saved ${name}.png`)
}

// ---------- Visitor ----------
{
  const { context, page } = await session()
  await page.goto(`${APP}/login`, { waitUntil: 'networkidle0' })
  await shot(page, '01-login')
  await context.close()
}

// ---------- Admin ----------
{
  const { context, page } = await session()
  await signIn(page, 'admin@fitforge.test', ADMIN_PASSWORD, '/admin')
  await shot(page, '02-admin-dashboard')
  await shot(page, '04-members', '/admin/members')
  await shot(page, '05-member-detail', '/admin/members/1')
  await shot(page, '06-memberships', '/admin/memberships')
  await shot(page, '07-classes-week', '/admin/classes')
  await context.close()
}
{
  const { context, page } = await session({ theme: 'light' })
  await signIn(page, 'admin@fitforge.test', ADMIN_PASSWORD, '/admin')
  await shot(page, '03-admin-dashboard-light')
  await context.close()
}

// ---------- Trainer ----------
{
  const { context, page } = await session()
  await signIn(page, 'arjun.trainer@fitforge.test', DEMO_PASSWORD, '/trainer')
  await shot(page, '09-trainer-dashboard')
  await page.goto(`${APP}/trainer/workouts`, { waitUntil: 'networkidle0' })
  await settle(page)
  for (const button of await page.$$('button')) {
    if ((await button.evaluate((b) => b.textContent.trim())) === 'New plan') { await button.click(); break }
  }
  await page.waitForSelector('#wp-member')
  await page.type('#wp-member', 'Rahul')
  // Wait for the search to narrow the list (the picker shows all members before the debounced search lands).
  await page.waitForFunction(() => {
    const options = [...document.querySelectorAll('[role=option]')]
    return options.length > 0 && options.every((o) => o.textContent.includes('Rahul'))
  })
  await page.click('[role=option]')
  await page.type('#wp-title', 'Strength foundation')
  await page.type('#wp-goal', 'Build a base for compound lifts')
  const exercises = [
    ['Back squat', '5', '5', '60', '120'],
    ['Bench press', '5', '5', '45', '120'],
    ['Plank', '3', '1', '', '60'],
  ]
  for (const [index, [name, sets, reps, kg, rest]] of exercises.entries()) {
    if (index > 0) {
      for (const button of await page.$$('button')) {
        if ((await button.evaluate((b) => b.textContent.trim())) === 'Add exercise') { await button.click(); break }
      }
      await page.waitForSelector(`[aria-label="Exercise ${index + 1} name"]`)
    }
    const row = async (label, value) => {
      const inputs = await page.$$(`[aria-label="${label}"]`)
      const input = inputs[label.startsWith('Exercise') ? 0 : index]
      // Ctrl+A, not triple-click: triple-click does not select the value of a number input.
      await input.click()
      await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control')
      await page.keyboard.press('Backspace')
      if (value) await input.type(value)
    }
    await row(`Exercise ${index + 1} name`, name)
    await row('Sets', sets)
    await row('Reps', reps)
    await row('Weight (kg)', kg)
    await row('Rest (seconds)', rest)
  }
  // Show the dialog from the top, without a focus ring.
  await page.evaluate(() => {
    document.activeElement?.blur()
    let el = document.querySelector('#workout-form')
    while (el && !(el.scrollHeight > el.clientHeight && getComputedStyle(el).overflowY !== 'visible')) el = el.parentElement
    el?.scrollTo(0, 0)
  })
  await sleep(400)
  await shot(page, '10-workout-editor')
  await context.close()
}

// ---------- Member ----------
{
  const { context, page } = await session()
  await signIn(page, 'rahul.member@fitforge.test', DEMO_PASSWORD, '/member')
  await shot(page, '11-member-dashboard')
  await shot(page, '12-member-classes', '/member/classes')
  await context.close()
}
{
  const { context, page } = await session({ width: 390, height: 844, mobile: true })
  await signIn(page, 'rahul.member@fitforge.test', DEMO_PASSWORD, '/member')
  await shot(page, '13-member-mobile')
  await context.close()
}

// ---------- API ----------
{
  const { context, page } = await session({ theme: 'light' })
  await page.goto(`${API}/swagger`, { waitUntil: 'networkidle0' })
  await sleep(800)
  await shot(page, '14-swagger')
  await context.close()
}

// ---------- Audit log ----------
// A freshly seeded database has no audit entries, so create a few real ones first through the API:
// a failed sign-in (security event), a new plan and a payment. This changes the demo data slightly,
// which is why this runs last.
{
  await api('POST', '/api/auth/login', { email: 'rahul.member@fitforge.test', password: 'not-the-password' })
  const { accessToken } = await api('POST', '/api/auth/login', { email: 'admin@fitforge.test', password: ADMIN_PASSWORD })
  await api('POST', '/api/membership-plans', { name: 'Student Monthly', description: 'Valid student ID required.', durationDays: 30, price: 1499, isActive: true }, accessToken)
  const memberships = await api('GET', '/api/memberships?pageSize=100', null, accessToken)
  const owing = memberships?.items?.find((m) => m.balance > 0)
  if (owing) await api('POST', '/api/payments', { membershipId: owing.id, amount: 1000, method: 'Upi', referenceNumber: 'UPI-DEMO-1' }, accessToken)

  const { context, page } = await session()
  await signIn(page, 'admin@fitforge.test', ADMIN_PASSWORD, '/admin')
  await shot(page, '08-audit-log', '/admin/audit-logs')
  await context.close()
}

await browser.close()
