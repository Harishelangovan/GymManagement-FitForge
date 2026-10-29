// Auth flows in the real UI: sign-in, guards, registration, password change/reset, session refresh (headless browser).
import { ADMIN_PASSWORD, APP, SHOTS, check, finish, launchBrowser } from './support.mjs'

const ADMIN = { email: 'admin@fitforge.test', password: ADMIN_PASSWORD }
const NEW_EMAIL = `ui.${Date.now()}@fitforge.test`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await launchBrowser()
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })

const consoleErrors = []
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
let refreshCalls = 0
page.on('request', (r) => r.url().endsWith('/api/auth/refresh') && r.method() === 'POST' && refreshCalls++)
page.on('response', async (r) => { if (process.env.TRACE && r.url().includes('/api/')) console.log('      [api]', r.request().method(), new URL(r.url()).pathname, r.status(), r.status() >= 400 ? (await r.text().catch(() => '')).slice(0, 160) : '') })

const path = () => new URL(page.url()).pathname
const text = (sel) => page.$eval(sel, (el) => el.textContent.trim()).catch(() => '')
const waitPath = async (p, timeout = 8000) => {
  const start = Date.now()
  while (Date.now() - start < timeout) { if (path() === p) return true; await sleep(100) }
  return false
}
// Clear with Ctrl+A + Backspace (triple-click doesn't select text in password fields), then type like a user.
const fill = async (sel, value) => { await page.click(sel); await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control'); await page.keyboard.press('Backspace'); await page.type(sel, value) }
const login = async ({ email, password }) => {
  await page.goto(`${APP}/login`, { waitUntil: 'networkidle0' })
  await fill('#email', email); await fill('#password', password)
  await page.click('button[type=submit]')
}
const shot = (name) => page.screenshot({ path: `${SHOTS}${name}.png` })

// ---------- Anonymous ----------
console.log('== Anonymous visitor ==')
await page.goto(APP, { waitUntil: 'networkidle0' })
check('/ redirects to /login', true, await waitPath('/login'))
check('page title', 'FitForge', await page.title())
await shot('01-login-dark')

await page.click('button[type=submit]')
await sleep(300)
check('empty submit shows email error', 'Email is required.', await text('#email-error'))
check('  and password error', 'Password is required.', await text('#password-error'))
check('  email input marked invalid', 'true', await page.$eval('#email', (el) => el.getAttribute('aria-invalid')))

await fill('#email', ADMIN.email); await fill('#password', 'Wrong!Pass1')
await page.click('button[type=submit]')
await page.waitForSelector('[role=alert]')
check('wrong password shows API message', 'Invalid email or password.', await text('form [role=alert] .text-muted'))

// ---------- Admin session ----------
console.log('== Admin session ==')
refreshCalls = 0
await login(ADMIN)
check('admin lands on /admin', true, await waitPath('/admin'))
await page.waitForSelector('h1')
check('greeting shows first name', true, (await text('h1')).endsWith('FitForge'))
check('admin sidebar has Audit log', true, (await page.$$eval('nav[aria-label=Main] a', (a) => a.map((x) => x.textContent))).includes('Audit log'))
const storage = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }))
check('no JWT in localStorage/sessionStorage', false, storage.includes('eyJ'))
check('refresh cookie not readable by JavaScript', false, (await page.evaluate(() => document.cookie)).includes('fitforge_refresh'))
const cookies = await browser.cookies()
const refreshCookie = cookies.find((c) => c.name === 'fitforge_refresh')
check('refresh cookie exists, HttpOnly', true, refreshCookie?.httpOnly)
check('  SameSite=Strict', 'Strict', refreshCookie?.sameSite)
check('  scoped to /api/auth', '/api/auth', refreshCookie?.path)
await shot('02-admin-home-dark')

refreshCalls = 0
await page.reload({ waitUntil: 'networkidle0' })
check('reload keeps the session', '/admin', path())
check('  exactly ONE refresh call on reload (StrictMode-safe)', 1, refreshCalls)
check('  still signed in', true, (await text('h1')).includes('FitForge'))

await page.goto(`${APP}/member`, { waitUntil: 'networkidle0' })
check('admin opening member area → 403 page', '/403', path())
check('  403 message', "You don't have access to this page", await text('main h3'))

await page.goto(`${APP}/admin/members`, { waitUntil: 'networkidle0' })
await page.waitForSelector('main table tbody tr')
check('module page renders the real Members screen', 'Members', await text('main h1'))
check('  active nav item highlighted', 'Members', await page.$eval('nav[aria-label=Main] a[aria-current=page]', (a) => a.textContent))

await page.goto(`${APP}/nope`, { waitUntil: 'networkidle0' })
check('unknown route → 404 page', 'Page not found', await text('h3'))

// Theme
await page.goto(`${APP}/admin`, { waitUntil: 'networkidle0' })
await page.click('button[aria-label="Switch to light mode"]')
check('theme toggles to light', 'light', await page.evaluate(() => document.documentElement.dataset.theme))
await page.reload({ waitUntil: 'networkidle0' })
check('light theme persists after reload', 'light', await page.evaluate(() => document.documentElement.dataset.theme))
await shot('03-admin-home-light')
await page.click('button[aria-label="Switch to dark mode"]')

// Logout
await page.click('button[aria-haspopup=menu]')
await page.waitForSelector('[role=menu]')
await shot('04-user-menu')
const menuButtons = await page.$$('[role=menu] button')
await menuButtons[menuButtons.length - 1].click()
check('sign out → /login', true, await waitPath('/login'))
const afterLogout = await page.evaluate(async () => (await fetch('/api/auth/refresh', { method: 'POST', headers: { 'X-FitForge-Client': 'web' } })).status)
check('refresh after logout rejected by API', 401, afterLogout)
await page.goto(`${APP}/admin`, { waitUntil: 'networkidle0' })
check('protected page after logout → /login', '/login', path())

// Return-to after login
await fill('#email', ADMIN.email); await fill('#password', ADMIN.password)
await page.goto(`${APP}/admin/payments`, { waitUntil: 'networkidle0' })
await fill('#email', ADMIN.email); await fill('#password', ADMIN.password)
await page.click('button[type=submit]')
check('after login, returns to the page that required it', true, await waitPath('/admin/payments'))
await page.click('button[aria-haspopup=menu]'); await page.waitForSelector('[role=menu]')
await (await page.$$('[role=menu] button')).at(-1).click(); await waitPath('/login')

// ---------- Registration ----------
console.log('== Registration and password change ==')
await page.goto(`${APP}/register`, { waitUntil: 'networkidle0' })
await shot('05-register')
await fill('#firstName', 'Ui'); await fill('#lastName', 'Tester'); await fill('#email', NEW_EMAIL)
await fill('#password', 'weak')
check('password checklist updates live', 'true', await page.$eval('[aria-label="Password requirements"] li:first-child', (li) => String(!li.className.includes('text-success'))))
await fill('#password', 'Str0ng!Pass'); await fill('#confirmPassword', 'Str0ng!Pass')
check('  all rules met', 5, await page.$$eval('[aria-label="Password requirements"] li.text-success', (l) => l.length))
await page.click('button[type=submit]')
const landed = await waitPath('/member')
if (!landed) {
  console.log('      DEBUG path=', path(), 'alerts=', await page.$$eval('[role=alert]', (e) => e.map((x) => x.textContent)))
  await shot('debug-register-failed')
}
check('new account lands on /member', true, landed)
check('member sidebar has no admin items', false, (await page.$$eval('nav[aria-label=Main] a', (a) => a.map((x) => x.textContent))).includes('Audit log'))

await page.goto(`${APP}/register`, { waitUntil: 'networkidle0' })
check('signed-in user visiting /register → own dashboard', '/member', path())

await page.goto(`${APP}/settings`, { waitUntil: 'networkidle0' })
await fill('#currentPassword', 'Not!MyPass1'); await fill('#newPassword', 'N3w!Passw0rd'); await fill('#confirmNewPassword', 'N3w!Passw0rd')
await page.click('form button[type=submit]')
await page.waitForSelector('#currentPassword-error')
check('wrong current password → field error from API', 'Current password is incorrect.', await text('#currentPassword-error'))
await shot('06-settings-error')
await fill('#currentPassword', 'Str0ng!Pass')
await page.click('form button[type=submit]')
check('password change → back to /login', true, await waitPath('/login'))
await login({ email: NEW_EMAIL, password: 'N3w!Passw0rd' })
// The session ended while the user was on /settings, so after signing in they return there.
check('sign in with the new password → back to Account settings', true, await waitPath('/settings'))

// ---------- Mobile ----------
console.log('== Mobile (390 × 844) ==')
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
await page.reload({ waitUntil: 'networkidle0' })
check('desktop sidebar hidden', false, await page.$eval('aside.fixed', (a) => a.offsetParent !== null))
check('no horizontal page scroll', true, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
await shot('07-member-mobile')
await page.click('button[aria-label="Open menu"]')
await page.waitForSelector('[role=dialog][aria-label=Navigation]')
await shot('08-mobile-drawer')
await page.evaluate(() => [...document.querySelectorAll('[role=dialog] nav a')].find((a) => a.textContent === 'Classes').click())
check('drawer link navigates', true, await waitPath('/member/classes'))
check('  and drawer closes', null, await page.$('[role=dialog][aria-label=Navigation]'))

await page.click('button[aria-haspopup=menu]'); await page.waitForSelector('[role=menu]')
await (await page.$$('[role=menu] button')).at(-1).click(); await waitPath('/login')
check('login page has no horizontal scroll on mobile', true, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
await shot('09-login-mobile')

// ---------- Password recovery pages ----------
console.log('== Password recovery ==')
await page.setViewport({ width: 1440, height: 900 })
await page.goto(`${APP}/forgot-password`, { waitUntil: 'networkidle0' })
await fill('#email', 'nobody@fitforge.test'); await page.click('button[type=submit]')
await page.waitForFunction(() => document.querySelector('h1')?.textContent === 'Check your email', { timeout: 8000 }).catch(async () => {
  console.log('      DEBUG path=', path(), 'h1=', await text('h1'), 'alerts=', await page.$$eval('[role=alert]', (e) => e.map((x) => x.textContent)))
  await shot('debug-forgot')
})
check('forgot password → generic confirmation', 'Check your email', await text('h1'))
await page.goto(`${APP}/reset-password`, { waitUntil: 'networkidle0' })
check('reset page without token → invalid link', 'Invalid reset link', await text('h1'))
await page.goto(`${APP}/reset-password?email=a%40b.test&token=bad`, { waitUntil: 'networkidle0' })
await fill('#newPassword', 'Str0ng!Pass'); await fill('#confirmNewPassword', 'Str0ng!Pass'); await page.click('button[type=submit]')
await page.waitForSelector('form [role=alert]')
check('bad token → API message shown', true, (await text('form [role=alert]')).includes('invalid or has expired'))

// ---------- Console ----------
// A 401 from the first /auth/refresh is expected for a visitor with no session, and the deliberate wrong-password
// and bad-token submissions log failed requests too. Anything else is a real problem.
const unexpected = consoleErrors.filter((e) => !/status of (400|401)/.test(e))
check('no unexpected console errors', 0, unexpected.length)
unexpected.forEach((e) => console.log('      console:', e))

await browser.close()
finish()
