// Shared setup for the browser end-to-end suites: configuration from environment variables (no passwords in
// code), a headless Chromium-family browser via puppeteer-core, and a tiny PASS/FAIL reporter.
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

function required(name) {
  const value = process.env[name]
  if (!value) {
    console.error(`Missing environment variable ${name}. It must match the seed password configured for the API (see e2e/README.md).`)
    process.exit(2)
  }
  return value
}

export const APP = (process.env.FITFORGE_APP_URL ?? 'http://localhost:5173').replace(/\/$/, '')
export const ADMIN_PASSWORD = required('FITFORGE_ADMIN_PASSWORD')
export const DEMO_PASSWORD = required('FITFORGE_DEMO_PASSWORD')

/** Screenshots land in e2e/shots/ (gitignored). */
export const SHOTS = fileURLToPath(new URL('./shots/', import.meta.url))
mkdirSync(SHOTS, { recursive: true })

const BROWSER_CANDIDATES = [
  process.env.BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/microsoft-edge',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean)

export function launchBrowser() {
  const executablePath = BROWSER_CANDIDATES.find((p) => existsSync(p))
  if (!executablePath) {
    console.error('No Edge/Chrome found. Set BROWSER_PATH to a Chromium-based browser executable.')
    process.exit(2)
  }
  return puppeteer.launch({
    executablePath,
    headless: process.env.HEADED ? false : true,
    // Site isolation off: puppeteer-core's input events are unreliable across Edge's out-of-process frames.
    args: ['--no-first-run', '--disable-features=IsolateOrigins,site-per-process,msEdgeSidebarV2', '--disable-site-isolation-trials'],
  })
}

let pass = 0
let fail = 0

export function check(name, expected, actual) {
  const ok = expected === actual
  ok ? pass++ : fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? ` (${actual})` : `  expected=[${expected}] got=[${actual}]`}`)
}

/** Prints the summary and makes the process exit non-zero when anything failed (so CI notices). */
export function finish() {
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
  process.exitCode = fail === 0 ? 0 : 1
}
