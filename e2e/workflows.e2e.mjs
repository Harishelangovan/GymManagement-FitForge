// Admin → trainer → member business flows through the real UI: members, plans, payments, classes, bookings, workouts.
import { ADMIN_PASSWORD, APP, DEMO_PASSWORD, SHOTS, check, finish, launchBrowser } from './support.mjs'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const RUN = Date.now().toString().slice(-6)
const NEW_EMAIL = `neha.${RUN}@fitforge.test`
const PLAN = `Student ${RUN}`
const CLASS = `Evening Mobility ${RUN}`

const browser = await launchBrowser()
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1000 })
const consoleErrors = []
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))

// ---------- helpers ----------
const path = () => new URL(page.url()).pathname
const bodyText = () => page.evaluate(() => document.body.innerText)
const waitText = async (text, timeout = 10000) => {
  try { await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text); return true } catch { return false }
}
const fill = async (sel, v) => { await page.click(sel); await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control'); await page.keyboard.press('Backspace'); if (v) await page.type(sel, v) }
/** Click the first visible button/link whose text matches, optionally inside the open dialog. */
const click = async (text, { inDialog = false, exact = false } = {}) => {
  const ok = await page.evaluate((t, inD, ex) => {
    const root = inD ? document.querySelector('dialog[open]') : document
    const els = [...root.querySelectorAll('button, a, [role=option], [role=tab]')].filter((e) => e.offsetParent !== null && !e.disabled)
    const norm = (x) => x.trim().toLowerCase() // innerText reflects CSS text-transform
    const el = els.find((e) => (ex ? norm(e.innerText) === norm(t) : norm(e.innerText).includes(norm(t))))
    el?.click()
    return Boolean(el)
  }, text, inDialog, exact)
  if (!ok) throw new Error(`No clickable "${text}"`)
  await sleep(250)
}
/** Type into an EntityPicker and choose the first option containing `choose`. */
const pick = async (inputSel, term, choose) => {
  await page.click(inputSel); await page.type(inputSel, term)
  await page.waitForFunction((c) => [...document.querySelectorAll('[role=option]')].some((o) => o.innerText.includes(c)), { timeout: 8000 }, choose)
  await page.evaluate((c) => [...document.querySelectorAll('[role=option]')].find((o) => o.innerText.includes(c)).click(), choose)
  await sleep(200)
}
const signIn = async (email, password) => {
  await page.goto(`${APP}/login`, { waitUntil: 'networkidle0' })
  await fill('#email', email); await fill('#password', password)
  await page.click('button[type=submit]')
  await page.waitForFunction(() => !location.pathname.startsWith('/login'), { timeout: 10000 })
  await sleep(400)
}
const signOut = async () => {
  await page.click('button[aria-haspopup=menu]'); await page.waitForSelector('[role=menu]')
  await (await page.$$('[role=menu] button')).at(-1).click()
  await page.waitForFunction(() => location.pathname === '/login')
}
const go = async (p) => { await page.goto(`${APP}${p}`, { waitUntil: 'networkidle0' }); await sleep(300) }

// ======================= ADMIN =======================
console.log('== Admin ==')
await signIn('admin@fitforge.test', ADMIN_PASSWORD)

await go('/admin/plans')
await click('New plan')
await fill('#pl-name', PLAN); await fill('#pl-durationDays', '30'); await fill('#pl-price', '999')
await click('Save plan', { inDialog: true })
check('plan created and listed', true, await waitText(PLAN))

await go('/admin/members')
await click('Add member')
await fill('#cm-firstName', 'Neha'); await fill('#cm-lastName', 'Kapoor'); await fill('#cm-email', NEW_EMAIL)
await click('Generate', { inDialog: true })
const tempPassword = await page.$eval('#cm-temporaryPassword', (i) => i.value)
check('generated temporary password meets the rules', true, /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12}$/.test(tempPassword))
await pick('#cm-trainer', 'Arjun', 'Arjun Mehta')
await click('Create member', { inDialog: true })
await page.waitForFunction(() => /^\/admin\/members\/\d+$/.test(location.pathname), { timeout: 10000 })
const nehaId = Number(path().split('/').pop())
check('new member → detail page', true, await waitText('Neha Kapoor'))
check('  trainer assigned', 'Arjun Mehta', await page.$eval('#assign-trainer', () => 'x').catch(async () => (await bodyText()).includes('Arjun Mehta') ? 'Arjun Mehta' : ''))

await click('Sell membership')
await page.select('#sm-plan', await page.$eval('#sm-plan', (s, p) => [...s.options].find((o) => o.text.startsWith(p)).value, PLAN))
await click('Create membership', { inDialog: true })
check('membership sold → balance shown', true, await waitText('₹999 due'))
await click('₹999 due')
check('  payment amount prefilled with balance', '999', await page.$eval('#rp-amount', (i) => i.value))
await click('Record payment', { inDialog: true })
check('payment recorded → membership paid', true, await waitText('Paid'))
check('  payment listed on member page', true, (await bodyText()).includes('₹999'))

await fill('#p-weightKg', '61.5')
await click('Save changes')
check('admin edits member profile', true, await waitText('Profile saved.'))
await page.screenshot({ path: `${SHOTS}workflows-01-member-detail.png`, fullPage: true })

await go('/admin/trainers')
await click('Add trainer')
await fill('#tr-firstName', 'Meera'); await fill('#tr-lastName', `Rao${RUN}`); await fill('#tr-email', `meera.${RUN}@fitforge.test`)
await fill('#tr-specialization', 'HIIT'); await fill('#tr-yearsOfExperience', '3')
await click('Generate', { inDialog: true })
await click('Create trainer', { inDialog: true })
check('trainer created', true, await waitText(`Rao${RUN}`))

await go('/admin/memberships?state=expiring')
check('memberships: expiring-soon filter shows Karthik', true, await waitText('Karthik Raj'))
await go('/admin/payments')
check('payments: newest payment is Neha’s', true, await page.evaluate(() => document.querySelector('tbody tr')?.innerText.includes('Neha Kapoor')))

await go('/admin/classes')
await click('Schedule class')
await fill('#cl-title', CLASS)
await pick('#cl-trainer', 'Arjun', 'Arjun Mehta')
await page.$eval('#cl-startTime', (i) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, '18:00'); i.dispatchEvent(new Event('input', { bubbles: true })) })
await fill('#cl-capacity', '2'); await fill('#cl-location', 'Studio B')
await click('Schedule', { inDialog: true, exact: true })
check('class scheduled and shown in week view', true, await waitText(CLASS))
await page.screenshot({ path: `${SHOTS}workflows-02-classes-admin.png`, fullPage: true })

await go('/admin/audit-logs')
check('audit log: membership.created entry', true, await waitText('membership · created'))
check('audit log: payment.recorded entry', true, (await bodyText()).includes('payment · recorded'))
await click('payment · recorded')
check('  expanding shows details JSON', true, await waitText('"Amount"'))
await page.screenshot({ path: `${SHOTS}workflows-03-audit.png`, fullPage: true })
await signOut()

// ======================= TRAINER =======================
console.log('== Trainer ==')
await signIn('arjun.trainer@fitforge.test', DEMO_PASSWORD)
await go('/trainer/members')
check('trainer sees new assigned member', true, await waitText('Neha Kapoor'))
await go(`/trainer/workouts?member=${nehaId}`)
await waitText('Neha Kapoor')
await click('New plan')
check('  editor pre-selects the filtered member', true, (await page.$eval('dialog[open]', (d) => d.innerText)).includes('Neha Kapoor'))
await fill('#wp-title', 'Starter Plan')
await fill('input[aria-label="Exercise 1 name"]', 'Goblet Squat')
await click('Add exercise', { inDialog: true })
await page.select('select[aria-label="Exercise 2 day"]', 'Thursday')
await fill('input[aria-label="Exercise 2 name"]', 'Push-up')
await click('Save plan', { inDialog: true })
check('workout plan created', true, await waitText('Starter Plan'))
check('  plan card lists exercises by day', true, (await bodyText()).includes('Goblet Squat 3×10'))

await go(`/trainer/diets?member=${nehaId}`)
await waitText('Neha Kapoor')
await click('New plan')
await fill('#dp-title', 'Balanced 1,900'); await fill('#dp-breakfast', 'Poha'); await fill('#dp-lunch', 'Rice, dal'); await fill('#dp-dinner', 'Roti, paneer')
await click('Save plan', { inDialog: true })
check('diet plan created', true, await waitText('Balanced 1,900'))

const snehaId = 2
await go(`/trainer/members/${snehaId}`)
check('trainer opening an unassigned member → "Member not found"', true, await waitText('Member not found'))
await signOut()

// ======================= MEMBER =======================
console.log('== New member ==')
await signIn(NEW_EMAIL, tempPassword)
check('new member signs in with temporary password', '/member', path())
check('dashboard shows the sold plan', true, await waitText(PLAN))
await go('/member/workouts')
check('workouts page shows the trainer’s plan', true, await waitText('Starter Plan'))
await go('/member/diet')
check('diet page shows meals', true, await waitText('Poha'))
await go('/member/payments')
check('payments page shows ₹999', true, await waitText('₹999'))

await go('/member/classes')
await waitText(CLASS)
await click(CLASS)
await click('Book a spot', { inDialog: true })
check('member books the class', true, await page.waitForFunction((t) => [...document.querySelectorAll('button')].some((b) => b.innerText.includes(t) && b.innerText.includes('Booked')), { timeout: 8000 }, CLASS).then(() => true).catch(() => false))
await page.keyboard.press('Escape'); await sleep(300)
await click('My bookings')
check('  booking listed under My bookings', true, await waitText(CLASS))
await click('Cancel', { exact: true })
check('member cancels the booking', true, await waitText('Booking cancelled.'))
await page.screenshot({ path: `${SHOTS}workflows-04-member-bookings.png`, fullPage: true })

await go('/settings')
await waitText('Your details')
await fill('#p-fitnessGoal', 'Run a 10K')
await click('Save changes')
check('member updates own details', true, await waitText('Your details were saved.'))

await go('/admin/members')
check('member opening an admin page → 403', '/403', path())

// ---------- Mobile ----------
console.log('== Mobile ==')
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
for (const p of ['/member/classes', '/member/workouts', '/settings']) {
  await go(p)
  check(`${p}: no horizontal scroll`, true, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
}
await page.screenshot({ path: `${SHOTS}workflows-05-workouts-mobile.png`, fullPage: true })

const unexpected = consoleErrors.filter((e) => !/status of (400|401|403|404|409)/.test(e))
check('no unexpected console errors', 0, unexpected.length)
unexpected.forEach((e) => console.log('      console:', e))
await browser.close()
finish()
