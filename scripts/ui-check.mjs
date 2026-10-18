/**
 * أداة التحقق العامل v2 — تشغيل التطبيق في متصفح حقيقي والتحقق من:
 *  1) قائمة المظهر: dark/light تعمل فعليًا (class على html + لون الخلفية)
 *  2) direction/lang مع اللغة + خطوط DS لكل لغة (Readex عربي / Sora إنجليزي)
 *  3) عنوان المتصفح يتحدث مع الصفحات
 *  4) الجداول والمسارات تعمل + console بدون أخطاء
 *  5) لقطات شاشة للمراجعة البصرية
 *
 * التشغيل: node scripts/ui-check.mjs [baseUrl]
 */

import puppeteer from "puppeteer-core"

const BROWSER_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
const BASE_URL = process.argv[2] ?? "http://localhost:4173"

const results = []
const log = (name, pass, details = "") => {
  results.push({ name, pass })
  console.log(`${pass ? "✓" : "✗"} ${name}${details ? ` — ${details}` : ""}`)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: BROWSER_PATH,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--window-size=1440,900"],
})

const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })

const consoleErrors = []
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text())
})
page.on("pageerror", (err) => consoleErrors.push(`PAGEERROR: ${err.message}`))

const readState = () =>
  page.evaluate(() => ({
    htmlClass: document.documentElement.className,
    dir: document.documentElement.dir,
    lang: document.documentElement.lang,
    title: document.title,
    bodyBg: getComputedStyle(document.body).backgroundColor,
  }))

try {
  // ── 0) بيئة عربية داكنة ─────────────────────────────────────────
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem("i18nextLng", "ar")
    localStorage.removeItem("theme")
  })

  // ── 1) الصفحة الأولية ───────────────────────────────────────────
  await page.goto(`${BASE_URL}/auth/login`, {
    waitUntil: "networkidle2",
    timeout: 30_000,
  })
  await page.waitForSelector('[data-testid="theme-toggle"]', { timeout: 10_000 })

  const initial = await readState()
  log(
    "initial: dark + RTL + Arabic",
    initial.htmlClass.includes("dark") &&
      initial.dir === "rtl" &&
      initial.lang === "ar",
    `class="${initial.htmlClass}" dir=${initial.dir} lang=${initial.lang}`,
  )
  log(
    "initial: title localized",
    initial.title.includes("أركاي") || initial.title.includes("Archai"),
    initial.title,
  )
  await page.screenshot({ path: "design-review/01-login-dark-ar.png" })

  // ── 2) قائمة المظهر: light ثم رجوع dark ────────────────────────
  await page.click('[data-testid="theme-toggle"]')
  await sleep(400)
  const lightOption = await page.$('[data-testid="theme-option-light"]')
  log("theme menu opens with options", Boolean(lightOption))
  if (lightOption) {
    await lightOption.click()
    await sleep(500)
    const afterLight = await readState()
    const lightWorks =
      afterLight.htmlClass.includes("light") &&
      !afterLight.htmlClass.includes("dark") &&
      afterLight.bodyBg !== initial.bodyBg
    log(
      "theme: selecting light actually switches theme",
      lightWorks,
      `class="${afterLight.htmlClass}" bg=${afterLight.bodyBg}`,
    )
    await page.screenshot({ path: "design-review/02-login-light.png" })

    // رجوع إلى الداكن
    await page.click('[data-testid="theme-toggle"]')
    await sleep(400)
    const darkOption = await page.$('[data-testid="theme-option-dark"]')
    if (darkOption) {
      await darkOption.click()
      await sleep(500)
      const backDark = await readState()
      log(
        "theme: back to dark persists",
        backDark.htmlClass.includes("dark") && backDark.bodyBg === initial.bodyBg,
      )
    }
  }

  // ── 3) اللغة: EN → خطوط DS + dir ──────────────────────────────
  await page.click('[data-testid="language-toggle"]')
  await sleep(800)
  const afterEn = await readState()
  log(
    "language: switches to LTR + English",
    afterEn.dir === "ltr" && afterEn.lang === "en",
    `dir=${afterEn.dir} lang=${afterEn.lang}`,
  )
  const h1FontEn = await page.evaluate(() => {
    const title = document.querySelector("h1, [data-slot='card-title']")
    return title ? getComputedStyle(title).fontFamily : "—"
  })
  log(
    "fonts: English display uses Sora (DS rule)",
    h1FontEn.includes("Sora"),
    h1FontEn,
  )
  await page.screenshot({ path: "design-review/03-login-ltr-en.png" })

  // ارجع للعربي
  await page.click('[data-testid="language-toggle"]')
  await sleep(800)
  const h1FontAr = await page.evaluate(() => {
    const title = document.querySelector("h1, [data-slot='card-title']")
    return title ? getComputedStyle(title).fontFamily : "—"
  })
  log(
    "fonts: Arabic display uses Readex Pro (DS rule)",
    h1FontAr.includes("Readex Pro"),
    h1FontAr,
  )

  // ── 4) دخول Company Admin + لوحة الشركة ───────────────────────
  const adminBtn = await page.evaluateHandle(() => {
    const buttons = [...document.querySelectorAll("button")]
    return buttons.find((b) => b.textContent?.includes("Company Admin"))
  })
  if (adminBtn?.asElement()) {
    await adminBtn.asElement().click()
    await page.waitForFunction(() => window.location.pathname === "/app", {
      timeout: 10_000,
    })
    await sleep(1_400)

    const dashState = await readState()
    log(
      "demo company admin: lands on /app with localized title",
      dashState.title.includes("أركاي") || dashState.title.includes("Archai"),
      `"${dashState.title}"`,
    )
    await page.screenshot({ path: "design-review/04-company-dashboard.png" })

    // ── 4.5) الـ Sidebar يتبع الاتجاه (RTL ← يمين · LTR ← يسار) ──
    const sidebarState = () =>
      page.evaluate(() => {
        const el = document.querySelector('[data-slot="sidebar-container"]')
        if (!el) return { dataSide: null, left: "none", right: "none" }
        const cs = getComputedStyle(el)
        return {
          dataSide: el.parentElement?.getAttribute("data-side"),
          left: cs.left,
          right: cs.right,
        }
      })

    const rtlSide = await sidebarState()
    log(
      "sidebar: pinned RIGHT in RTL (Arabic)",
      rtlSide.dataSide === "right" || (parseFloat(rtlSide.right) === 0 && rtlSide.left === "auto"),
      JSON.stringify(rtlSide),
    )

    await page.click('[data-testid="language-toggle"]')
    await sleep(900)
    const ltrSide = await sidebarState()
    log(
      "sidebar: flips LEFT in LTR (English)",
      ltrSide.dataSide === "left" || (parseFloat(ltrSide.left) === 0 && ltrSide.right === "auto"),
      JSON.stringify(ltrSide),
    )
    await page.screenshot({ path: "design-review/09-sidebar-ltr-en.png" })

    // ارجع للعربي
    await page.click('[data-testid="language-toggle"]')
    await sleep(900)
    const backRtl = await sidebarState()
    log(
      "sidebar: back to RIGHT after switching back to Arabic",
      backRtl.dataSide === "right" || parseFloat(backRtl.right) === 0,
    )

    // ── 5) قسم الموظفين ─────────────────────────────────────────
    await page.goto(`${BASE_URL}/app/m/employees`, { waitUntil: "networkidle2" })
    await sleep(1_000)
    const empRows = await page.evaluate(
      () => document.querySelectorAll("table tbody tr").length,
    )
    const empTitle = await readState()
    log(
      "employees: table + page title",
      empRows > 0,
      `${empRows} rows · title="${empTitle.title}"`,
    )
    await page.screenshot({ path: "design-review/05-employees.png" })

    // ── 6) تبديل الثيم داخل الشل عبر القائمة ───────────────────
    await page.click('[data-testid="theme-toggle"]')
    await sleep(400)
    const lightOpt2 = await page.$('[data-testid="theme-option-light"]')
    if (lightOpt2) {
      await lightOpt2.click()
      await sleep(600)
      const shellLight = await readState()
      log(
        "theme: works inside company shell",
        shellLight.htmlClass.includes("light"),
        `class="${shellLight.htmlClass}"`,
      )
      await page.screenshot({ path: "design-review/06-employees-light.png" })
      // رجوع للداكن
      await page.click('[data-testid="theme-toggle"]')
      await sleep(400)
      const darkOpt2 = await page.$('[data-testid="theme-option-dark"]')
      if (darkOpt2) {
        await darkOpt2.click()
        await sleep(500)
      }
    }
  } else {
    log("demo company admin button found", false)
  }

  // ── 7) المنصة ──────────────────────────────────────────────────
  await page.evaluate(() => sessionStorage.clear())
  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: "networkidle2" })
  await page.click('[data-testid="language-toggle"]') // عربي مرة أخرى لو انقلبت
  await sleep(300)
  const platformBtn = await page.evaluateHandle(() => {
    const buttons = [...document.querySelectorAll("button")]
    return buttons.find((b) => b.textContent?.includes("Platform Super Admin"))
  })
  if (platformBtn?.asElement()) {
    await platformBtn.asElement().click()
    await page.waitForFunction(() => window.location.pathname === "/platform", {
      timeout: 10_000,
    })
    await sleep(1_400)
    const pltState = await readState()
    log(
      "platform admin: lands on /platform",
      pltState.title.length > 0,
      `title="${pltState.title}"`,
    )
    await page.screenshot({ path: "design-review/07-platform-dashboard.png" })

    await page.goto(`${BASE_URL}/platform/companies`, { waitUntil: "networkidle2" })
    await sleep(1_000)
    const companyRows = await page.evaluate(
      () => document.querySelectorAll("table tbody tr").length,
    )
    log("platform companies table renders", companyRows > 0, `${companyRows} rows`)
    await page.screenshot({ path: "design-review/08-platform-companies.png" })

    // ── 7.5) تدفق توفير شركة جديدة (demo) بتقدم مباشر ────────────────
    const addBtn = await page.evaluateHandle(() => {
      const buttons = [...document.querySelectorAll("button")]
      return buttons.find((b) => b.textContent?.includes("إضافة شركة"))
    })
    if (addBtn?.asElement()) {
      await addBtn.asElement().click()
      await sleep(500)

      await page.type("#company-name", "شركة الاختبار الآلي")
      await page.type("#company-slug", "qa-test-co")
      await page.type("#company-email", "admin@qa-test.demo")

      const startBtn = await page.evaluateHandle(() => {
        const buttons = [...document.querySelectorAll("button")]
        return buttons.find((b) => b.textContent?.includes("بدء التوفير"))
      })
      if (startBtn?.asElement()) {
        await startBtn.asElement().click()

        // 1) خطوات الـ pipeline تظهر أثناء التنفيذ (خطوتان على الأقل خلال 1.6s)
        await sleep(1_600)
        const stepIcons = await page.evaluate(() => {
          const dialog = document.querySelector("[data-slot='dialog-content']")
          if (!dialog) return 0
          return dialog.querySelectorAll("svg").length
        })
        log(
          "provisioning: pipeline steps render live during job",
          stepIcons >= 2,
          `${stepIcons} step icons`,
        )
        await page.screenshot({ path: "design-review/10-provisioning-progress.png" })

        // 2) الـ dialog يُغلق تلقائيًا — فقط بعد اكتمال المهمة ونجاحها
        const dialogClosed = await page
          .waitForFunction(
            () => !document.querySelector("[data-slot='dialog-content']"),
            { timeout: 30_000, polling: 400 },
          )
          .then(() => true)
          .catch(() => false)
        log("provisioning: dialog auto-closes after pipeline completes", dialogClosed)

        // 3) الشركة الجديدة ظاهرة بالبحث مع مشروع مُوفَّر فعليًا (ref demo-*)
        await sleep(1_000)
        const searchInput = await page.$('[data-testid="table-search"]')
        if (searchInput) {
          await searchInput.type("شركة الاختبار الآلي")
          await sleep(700)
          const provisioned = await page.evaluate(() => {
            const text = document.body.textContent ?? ""
            const hasCompany = text.includes("شركة الاختبار الآلي")
            const hasProjectRef = /demo-[a-z0-9]+/i.test(text)
            return { hasCompany, hasProjectRef }
          })
          log(
            "provisioning: new company + provisioned project visible (verified)",
            provisioned.hasCompany && provisioned.hasProjectRef,
            JSON.stringify(provisioned),
          )
        }
        await page.screenshot({ path: "design-review/11-companies-after-provision.png" })
      } else {
        log("provisioning: start button found", false)
      }
    } else {
      log("provisioning: add company button found", false)
    }
  }

  // ── 8) Console ──────────────────────────────────────────────────
  const meaningful = consoleErrors.filter(
    (e) => !e.includes("favicon") && !e.includes("React DevTools"),
  )
  log(
    "no console errors during interaction",
    meaningful.length === 0,
    meaningful.slice(0, 2).join(" | ") || "clean",
  )

  const passed = results.filter((r) => r.pass).length
  console.log(`\n=== ${passed}/${results.length} checks passed ===`)
  process.exitCode = passed === results.length ? 0 : 1
} catch (err) {
  console.error("CHECK CRASHED:", err.message)
  process.exitCode = 1
} finally {
  await browser.close()
}
