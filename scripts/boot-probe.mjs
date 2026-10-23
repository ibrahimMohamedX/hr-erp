/**
 * Boot Probe — تشخيص واحد سريع لإقلاع التطبيق في متصفح حقيقي.
 * يُستخدم عند فشل ui-check في الوصول لأي عنصر: يكشف هل React أقلع أصلًا،
 * وما أخطاء الصفحة/الشبكة/الكونسول — قبل تشغيل أي فحوص.
 *
 * التشغيل: node scripts/boot-probe.mjs [baseUrl]
 * (الافتراضي http://localhost:4174 — يتطلب build + preview مرفوعين)
 */

import puppeteer from "puppeteer-core"

const BROWSER_PATH =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
const BASE_URL = process.argv[2] ?? "http://localhost:4174"
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: BROWSER_PATH,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--window-size=1440,900"],
})

const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })

const consoleMsgs = []
const pageErrors = []
const requestFailures = []
page.on("console", (m) => consoleMsgs.push(`[${m.type()}] ${m.text()}`))
page.on("pageerror", (e) =>
  pageErrors.push(
    `PAGEERROR: ${e.message}\n${(e.stack ?? "").split("\n").slice(1, 5).join("\n")}`,
  ),
)
page.on("requestfailed", (r) =>
  requestFailures.push(`${r.url()} → ${r.failure()?.errorText}`),
)

try {
  const resp = await page.goto(`${BASE_URL}/auth/login`, {
    waitUntil: "networkidle2",
    timeout: 30_000,
  })
  // نعطي React مهلة سخية قبل التصوير — نتأكد أنه ليس بطئًا بل فشل حقيقي
  await sleep(4_000)

  const state = await page.evaluate(() => ({
    url: window.location.href,
    title: document.title,
    lang: document.documentElement.lang,
    hasRoot: Boolean(document.getElementById("root")),
    rootChildren: document.getElementById("root")?.children.length ?? -1,
    hasThemeToggle: Boolean(
      document.querySelector('[data-testid="theme-toggle"]'),
    ),
    hasLoginForm: Boolean(document.querySelector("#login-email")),
    bodySnippet: (document.body.textContent ?? "")
      .replace(/\s+/g, " ")
      .slice(0, 400),
  }))

  console.log("HTTP status:", resp?.status())
  console.log("PAGE STATE:", JSON.stringify(state, null, 2))
  console.log(
    "PAGE ERRORS:",
    pageErrors.length ? pageErrors : "none",
  )
  console.log(
    "CONSOLE:",
    consoleMsgs.length ? consoleMsgs.slice(0, 15) : "none",
  )
  console.log(
    "REQUEST FAILURES:",
    requestFailures.length ? requestFailures.slice(0, 10) : "none",
  )
  await page.screenshot({ path: "design-review/boot-probe.png" })
  console.log("screenshot: design-review/boot-probe.png")
} catch (err) {
  console.error("BOOT PROBE CRASHED:", err.message)
  console.error("PAGE ERRORS so far:", pageErrors.length ? pageErrors : "none")
  console.error("CONSOLE so far:", consoleMsgs.length ? consoleMsgs : "none")
  console.error("REQUEST FAILURES so far:", requestFailures.length ? requestFailures : "none")
} finally {
  await browser.close()
}
