// The three dashboards against live seed data. Run first on a freshly seeded database: it asserts exact seed figures.
import { ADMIN_PASSWORD, APP, DEMO_PASSWORD, SHOTS, check, finish, launchBrowser } from './support.mjs'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await launchBrowser()
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1000 })
const consoleErrors = []
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
const requested = []
page.on('request', (r) => requested.push(r.url()))

const fill = async (sel, v) => { await page.click(sel); await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control'); await page.keyboard.press('Backspace'); await page.type(sel, v) }
const text = (sel) => page.$eval(sel, (el) => el.textContent.trim()).catch(() => '')
const statValue = (label) =>
  page.evaluate((l) => {
    const card = [...document.querySelectorAll('section[aria-label] p')].find((p) => p.textContent.trim() === l)?.closest('section.rounded-card, section')
    return card?.querySelector('p.text-3xl')?.textContent.trim() ?? ''
  }, label)
async function signIn(email, password, home) {
  await page.goto(`${APP}/login`, { waitUntil: 'networkidle0' })
  await fill('#email', email); await fill('#password', password)
  await page.click('button[type=submit]')
  await page.waitForFunction((h) => location.pathname === h, {}, home)
  await page.waitForSelector('section[aria-label] p.text-3xl', { timeout: 15000 })
  await sleep(600) // let charts lay out
}
async function signOut() {
  await page.click('button[aria-haspopup=menu]'); await page.waitForSelector('[role=menu]')
  await (await page.$$('[role=menu] button')).at(-1).click()
  await page.waitForFunction(() => location.pathname === '/login')
}

// ---------- Lazy loading ----------
console.log('== Code splitting ==')
await page.goto(`${APP}/login`, { waitUntil: 'networkidle0' })
check('login page does not load dashboard code', false, requested.some((u) => /Dashboard\.tsx|recharts/.test(u)))

// ---------- Admin ----------
console.log('== Admin dashboard ==')
await signIn('admin@fitforge.test', ADMIN_PASSWORD, '/admin')
check('admin dashboard code loaded after sign-in', true, requested.some((u) => u.includes('AdminDashboard.tsx')))
check('member dashboard code NOT loaded', false, requested.some((u) => u.includes('MemberDashboard.tsx')))
check('KPI: active members', '5', await statValue('Active members'))
check('KPI: revenue this month', '₹9,500', await statValue('Revenue this month'))
check('  delta vs last month shown', true, (await page.content()).includes('+72.7%'))
check('KPI: expiring in 7 days', '1', await statValue('Expiring in 7 days'))
check('KPI: active trainers', '2', await statValue('Active trainers'))
check('revenue chart: 12 month labels on the axis', 12, await page.$$eval('[aria-label^="Revenue column chart"] .recharts-xAxis .recharts-cartesian-axis-tick', (t) => t.length))
check('  bars only for months with revenue (Jul, Sep, Oct)', 3, await page.$$eval('[aria-label^="Revenue column chart"] .recharts-bar-rectangle', (b) => b.length))
check('  y-axis ticks are round numbers', '₹0,₹5K,₹10K,₹15K', await page.$$eval('[aria-label^="Revenue column chart"] .recharts-yAxis-tick-labels text', (t) => t.map((x) => x.textContent).join(',')))
check('attendance chart has legend with 2 series', 2, await page.$$eval('span.inline-flex.items-center.gap-2.text-xs', (s) => s.filter((x) => /Class visits|Gym check-ins/.test(x.textContent)).length))
check('membership status legend shows Lapsed = 1', '1', await page.evaluate(() => [...document.querySelectorAll('li')].find((li) => li.textContent.startsWith('Lapsed'))?.querySelector('.font-semibold')?.textContent))
check('expiring list shows Karthik', true, (await text('main')).includes('Karthik Raj'))
check('recent payments list has 5 rows', 5, await page.evaluate(() => [...document.querySelectorAll('h2')].find((h) => h.textContent === 'Recent payments')?.closest('section').querySelectorAll('li').length))

// Tooltip on hover
const bars = await page.$$('[aria-label^="Revenue column chart"] .recharts-bar-rectangle path')
const julyBar = bars[0] // first non-zero month
if (julyBar) { await julyBar.hover(); await sleep(400) }
check('hovering a bar shows a tooltip with the value', true, (await text('main')).includes('₹13,000'))
await page.screenshot({ path: `${SHOTS}dashboards-01-admin-dark.png`, fullPage: true })

// Table view
const revenueCard = await page.evaluateHandle(() => [...document.querySelectorAll('h2')].find((h) => h.textContent === 'Revenue').closest('section'))
await (await revenueCard.$('button[aria-pressed=false]')).click()
check('Table view lists months with values', true, await revenueCard.evaluate((el) => el.querySelector('table')?.textContent.includes('July 2026') && el.textContent.includes('₹13,000')))
check('  Chart/Table toggle reports pressed state', 'true', await revenueCard.evaluate((el) => [...el.querySelectorAll('button')].find((b) => b.textContent === 'Table').getAttribute('aria-pressed')))

// Light mode
await page.click('button[aria-label="Switch to light mode"]'); await sleep(500)
await page.screenshot({ path: `${SHOTS}dashboards-02-admin-light.png`, fullPage: true })
check('chart repaints with light-mode accent', true, await page.$$eval('.recharts-bar-rectangle path', (p) => p.some((x) => x.getAttribute('fill') === '#5f8a00')))
await page.click('button[aria-label="Switch to dark mode"]')
await signOut()

// ---------- Trainer ----------
console.log('== Trainer dashboard ==')
await signIn('arjun.trainer@fitforge.test', DEMO_PASSWORD, '/trainer')
check('KPI: assigned members', '3', await statValue('Assigned members'))
check('KPI: bookings next 7 days', '15', await statValue('Bookings, next 7 days'))
check('KPI: members without a plan', '2', await statValue('Members without a plan'))
check('upcoming sessions listed', 5, await page.evaluate(() => [...document.querySelectorAll('h2')].find((h) => h.textContent === 'Coming up')?.closest('section').querySelectorAll('li').length))
check('members without plan: Karthik + Vikram', true, await page.evaluate(() => { const t = document.querySelector('main').textContent; return t.includes('Karthik Raj') && t.includes('Vikram Singh') }))
await page.screenshot({ path: `${SHOTS}dashboards-03-trainer-dark.png`, fullPage: true })
await signOut()

// ---------- Member ----------
console.log('== Member dashboard ==')
await signIn('rahul.member@fitforge.test', DEMO_PASSWORD, '/member')
check('membership card shows Annual plan', true, (await text('main')).includes('Annual'))
check('  days left', true, (await text('main')).includes('244'))
check('  usage meter present', '33', await page.$eval('[role=meter]', (m) => m.getAttribute('aria-valuenow')))
check('trainer card shows Arjun', true, (await text('main')).includes('Arjun Mehta'))
check('KPI: visits this week', '3', await statValue('Visits this week'))
check('KPI: upcoming classes', '6', await statValue('Upcoming classes'))
check("today's workout shows rest day (Thursday)", true, (await text('main')).includes('Rest day'))
check('weekly visits chart: 8 week labels', 8, await page.$$eval('[aria-label^="Visits column chart"] .recharts-xAxis .recharts-cartesian-axis-tick', (t) => t.length))
check('diet summary shows calories', true, (await text('main')).includes('2,800'))
await page.screenshot({ path: `${SHOTS}dashboards-04-member-dark.png`, fullPage: true })

// Divya: part-paid → balance alert
await signOut()
await signIn('divya.member@fitforge.test', DEMO_PASSWORD, '/member')
check('member with balance sees amount due', true, (await text('main')).includes('₹3,500 due'))
await signOut()
await signIn('karthik.member@fitforge.test', DEMO_PASSWORD, '/member')
check('member with 4 days left sees "Renew soon"', true, (await text('main')).includes('Renew soon'))

// ---------- Mobile ----------
console.log('== Mobile ==')
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
await page.reload({ waitUntil: 'networkidle0' }); await sleep(800)
check('member dashboard: no horizontal scroll', true, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
await page.screenshot({ path: `${SHOTS}dashboards-05-member-mobile.png`, fullPage: true })
await signOut()
await signIn('admin@fitforge.test', ADMIN_PASSWORD, '/admin')
check('admin dashboard: no horizontal scroll', true, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
await page.screenshot({ path: `${SHOTS}dashboards-06-admin-mobile.png`, fullPage: true })

const unexpected = consoleErrors.filter((e) => !/status of (400|401)/.test(e))
check('no unexpected console errors', 0, unexpected.length)
unexpected.forEach((e) => console.log('      console:', e))
await browser.close()
finish()
