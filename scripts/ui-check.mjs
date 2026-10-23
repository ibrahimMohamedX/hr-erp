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

  // ── كشف وضع live قبل أي فحص سلوكي ────────────────────────────────
  // نص login.liveNotice يظهر فقط عندما VITE_PLATFORM_SUPABASE_* مضبوطة.
  // سيناريوهات إنشاء/تشغيل الموارد (توفير شركة، دورة حياة، تكرار slug)
  // في live تلمس مشاريع Supabase حقيقية → تُتخطى كاملة (خارج النتائج).
  const IS_LIVE = await page.evaluate(
    () => (document.body.textContent ?? "").includes("مرتبط بمشروع المنصة"),
  )
  if (IS_LIVE) {
    console.log(
      "⏭ live mode detected — resource-creating scenarios will be SKIPPED (not counted in results)",
    )
  }

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

    // ── 5.5) وحدة الموظفين: ترتيب + فلترة + إضافة + تعديل + ملف ──────
    const firstCellText = () =>
      page.evaluate(
        () => document.querySelector("table tbody tr td")?.textContent ?? "",
      )
    const rowsCount = () =>
      page.evaluate(() => document.querySelectorAll("table tbody tr").length)
    const findButton = (text) =>
      page.evaluateHandle((txt) => {
        const buttons = [...document.querySelectorAll("button")]
        return buttons.find((b) => b.textContent?.includes(txt)) ?? null
      }, text)
    const clickRadixOption = async (triggerHandle, optionText) => {
      if (!triggerHandle?.asElement()) return false
      await triggerHandle.asElement().click()
      await sleep(400)
      const opt = await page.evaluateHandle(
        (txt) =>
          [...document.querySelectorAll('[role="option"]')].find((o) =>
            o.textContent?.includes(txt),
          ) ?? null,
        optionText,
      )
      if (!opt?.asElement()) return false
      await opt.asElement().click()
      await sleep(400)
      return true
    }

    // 5.5a) الترتيب بالنقر على رأس عمود الموظف
    const codeBeforeSort = await firstCellText()
    const nameHeader = await page.evaluateHandle(() =>
      [...document.querySelectorAll("th")].find((el) =>
        el.textContent?.includes("الموظف"),
      ),
    )
    if (nameHeader?.asElement()) {
      await nameHeader.asElement().click()
      await sleep(600)
      const codeAfterSort = await firstCellText()
      const hasAscending = await page.evaluate(
        () =>
          document.querySelector('th[aria-sort="ascending"]') !== null,
      )
      log(
        "employees: click header sorts ascending",
        hasAscending && codeBeforeSort !== codeAfterSort,
        `${codeBeforeSort} → ${codeAfterSort}`,
      )
    } else {
      log("employees: sortable name header found", false)
    }

    // 5.5b) فلترة الحالة: «تحت التجربة» في الـ seed بالضبط 3 موظفين
    // (تحت سقف صفحة الـ 8) → توكيد لا لبس فيه، ثم إعادة «الكل» لاحقًا
    const rowsBeforeFilter = await rowsCount()
    const statusTrigger = await page.evaluateHandle(
      () => document.querySelectorAll('[data-slot="select-trigger"]')[1],
    )
    let filterWorked = false
    if (statusTrigger?.asElement()) {
      filterWorked = await clickRadixOption(statusTrigger, "تحت التجربة")
      const rowsAfterFilter = await rowsCount()
      log(
        "employees: status filter narrows rows",
        filterWorked && rowsAfterFilter === 3,
        `${rowsBeforeFilter} → ${rowsAfterFilter} (expected 3)`,
      )
      // إعادة الكل للفحوص التالية
      const statusTrigger2 = await page.evaluateHandle(
        () => document.querySelectorAll('[data-slot="select-trigger"]')[1],
      )
      await clickRadixOption(statusTrigger2, "الكل")
      await sleep(400)
    } else {
      log("employees: status filter trigger found", false)
    }

    // 5.5c) إضافة موظف عبر النموذج المشترك (هاتف + قسم + حالة افتراضية)
    const addEmployeeBtn = await findButton("إضافة موظف")
    if (addEmployeeBtn?.asElement()) {
      await addEmployeeBtn.asElement().click()
      await sleep(700)
      await page.type("#emp-name", "موظف الاختبار الآلي")
      await page.type("#emp-email", "qa.employee@nawa-tech.demo")
      await page.type("#emp-phone", "+20 10 9999 8888")
      const depTrigger = await page.evaluateHandle(
        () =>
          document
            .querySelector('[data-slot="dialog-content"]')
            ?.querySelectorAll('[data-slot="select-trigger"]')[0],
      )
      await clickRadixOption(depTrigger, "هندسة البرمجيات")
      await page.type("#emp-title", "مهندس اختبار آلي")
      const submitBtn = await page.evaluateHandle(
        () =>
          document.querySelector(
            '[data-slot="dialog-content"] button[type="submit"]',
          ),
      )
      if (submitBtn?.asElement()) {
        await submitBtn.asElement().click()
        const created = await page
          .waitForFunction(
            () => document.body.textContent?.includes("تمت إضافة الموظف") ?? false,
            { timeout: 15_000, polling: 400 },
          )
          .then(() => true)
          .catch(() => false)
        log("employees: create saves via shared form", created)
        await sleep(500)
        await page.screenshot({ path: "design-review/15-employees-after-create.png" })
      } else {
        log("employees: create submit button found", false)
      }
    } else {
      log("employees: add button found", false)
    }

    // 5.5d) تعديل الموظف الأول وحفظ التغيير
    const editBtn = await page.evaluateHandle(
      () => document.querySelector('button[aria-label="تعديل"]'),
    )
    if (editBtn?.asElement()) {
      await editBtn.asElement().click()
      await sleep(700)
      await page.evaluate(() => {
        const el = document.querySelector("#emp-name")
        if (el) el.value = ""
      })
      await page.type("#emp-name", "أحمد سامي المعدّل")
      const saveBtn = await page.evaluateHandle(
        () =>
          document.querySelector(
            '[data-slot="dialog-content"] button[type="submit"]',
          ),
      )
      if (saveBtn?.asElement()) {
        await saveBtn.asElement().click()
        const edited = await page
          .waitForFunction(
            () =>
              document.body.textContent?.includes("تم تحديث بيانات الموظف") ??
              false,
            { timeout: 15_000, polling: 400 },
          )
          .then(() => true)
          .catch(() => false)
        log("employees: edit saves and toasts", edited)
        await sleep(500)
      }
    } else {
      log("employees: edit button found", false)
    }

    // 5.5e) النقر على الصف يفتح الملف الشخصي
    const firstRow = await page.evaluateHandle(
      () => document.querySelector("table tbody tr"),
    )
    if (firstRow?.asElement()) {
      await firstRow.asElement().click()
      const onProfile = await page
        .waitForFunction(
          () => window.location.pathname.startsWith("/app/m/employees/"),
          { timeout: 10_000 },
        )
        .then(() => true)
        .catch(() => false)
      await sleep(800)
      const profileState = await page.evaluate(() => {
        const text = document.body.textContent ?? ""
        return {
          onProfile: window.location.pathname.startsWith("/app/m/employees/"),
          hasContact: text.includes("بيانات التواصل"),
          hasEmployment: text.includes("بيانات الوظيفة"),
          hasBack: text.includes("الرجوع إلى الموظفين"),
        }
      })
      log(
        "employees: row click opens profile page",
        profileState.onProfile &&
          profileState.hasContact &&
          profileState.hasEmployment,
        JSON.stringify(profileState),
      )
      await page.screenshot({ path: "design-review/16-employee-profile.png" })
      await page.goto(`${BASE_URL}/app/m/employees`, {
        waitUntil: "networkidle2",
      })
      await sleep(600)
    } else {
      log("employees: first row found", false)
    }

    // ── 5.6) الأقسام والمناصب: جدول المناصب + منع حذف قسم به موظفون ──
    await page.goto(`${BASE_URL}/app/m/departments`, {
      waitUntil: "networkidle2",
    })
    await sleep(1_000)
    const depState = await page.evaluate(() => {
      const text = document.body.textContent ?? ""
      return {
        hasPositions: text.includes("المناصب الوظيفية"),
        posRows: document.querySelectorAll("table tbody tr").length,
      }
    })
    log(
      "departments: positions section renders with rows",
      depState.hasPositions && depState.posRows > 0,
      `${depState.posRows} positions`,
    )
    await page.screenshot({ path: "design-review/17-departments-positions.png" })

    // حذف قسم به موظفون → رسالة المنع الواضحة (حوار يبقى مفتوحًا)
    const deleteDepBtn = await page.evaluateHandle(
      () => document.querySelector('button[aria-label="حذف"]'),
    )
    if (deleteDepBtn?.asElement()) {
      await deleteDepBtn.asElement().click()
      await sleep(500)
      // زر التأكيد الفعلي: AlertDialogAction الذي نصه يضم «حذف»
      // (وليس «إلغاء») وليس معطلًا — شرط واحد واضح بلا التباس
      const confirmDel = await page.evaluateHandle(
        () =>
          [...document.querySelectorAll('[role="alertdialog"] button')].find(
            (b) =>
              b.textContent?.includes("حذف") &&
              !b.textContent?.includes("إلغاء") &&
              !b.hasAttribute("disabled"),
          ) ?? null,
      )
      if (confirmDel?.asElement()) {
        await confirmDel.asElement().click()
        const blocked = await page
          .waitForFunction(
            () =>
              document.body.textContent?.includes(
                "لا يمكن حذف إدارة بها موظفون",
              ) ??
              false,
            { timeout: 15_000, polling: 400 },
          )
          .then(() => true)
          .catch(() => false)
        log("departments: delete blocked for occupied department", blocked)
        await page.screenshot({ path: "design-review/18-dept-delete-blocked.png" })
        await page.keyboard.press("Escape")
        await sleep(400)
      } else {
        log("departments: delete confirm button found", false)
      }
    } else {
      log("departments: delete button found", false)
    }

    // ── 5.7) الحضور والانصراف (Attendance) ─────────────────────────
    // فحصا القراءة الأساسيان (تحميل + تقارير) مشتركان للوضعين — في live
    // الجداول غير المهيأة تعرض أصفارًا نظيفة بلا بيانات وهمية ولا أخطاء.
    // الأرقام المقفلة خاصة ببذرة demo، وكل سيناريوهات الكتابة demo فقط —
    // خلف نفس نمط SKIPPED غير المحسوبة: لا كتابة في live أبدًا.
    await page.goto(`${BASE_URL}/app/m/attendance`, { waitUntil: "networkidle2" })
    await sleep(1_500)

    /** صفوف جدول السجلات تحديدًا (الأول في الصفحة — التقارير جدول ثانٍ) */
    const attRows = () =>
      page.evaluate(
        () =>
          document.querySelector("table")?.querySelectorAll("tbody tr").length ?? 0,
      )
    /** نص قيمة مؤشر KPI — داخل span[dir="ltr"] في بطاقة KpiCard */
    const attKpi = (tid) =>
      page.evaluate((t) => {
        const el = document.querySelector(`[data-testid="${t}"] span[dir="ltr"]`)
        return el ? (el.textContent ?? "").trim() : null
      }, tid)
    /** تعيين قيمة حقل إدخال عبر الـ native setter (يعمل مع React/RHF) */
    const setNativeValue = (sel, value) =>
      page.evaluate(
        (s, v) => {
          const el = document.querySelector(s)
          if (!el) return false
          const proto =
            el instanceof HTMLTextAreaElement
              ? window.HTMLTextAreaElement.prototype
              : window.HTMLInputElement.prototype
          Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, v)
          el.dispatchEvent(new Event("input", { bubbles: true }))
          el.dispatchEvent(new Event("change", { bubbles: true }))
          return true
        },
        sel,
        value,
      )

    // تحميل الصفحة: العنوان + المؤشرات الخمسة [مشترك للوضعين]
    const attState1 = await readState()
    const kpiPresence = await page.evaluate(() => ({
      present: Boolean(document.querySelector('[data-testid="att-kpi-present"]')),
      late: Boolean(document.querySelector('[data-testid="att-kpi-late"]')),
      absent: Boolean(document.querySelector('[data-testid="att-kpi-absent"]')),
      leave: Boolean(document.querySelector('[data-testid="att-kpi-leave"]')),
      avg: Boolean(document.querySelector('[data-testid="att-kpi-avg"]')),
    }))
    // القيم الفعلية في التفاصيل — شفافية كاملة لسلوك كل وضع
    // (demo: بذرة 10/2/3/1 · live: أصفار لو الجداول غير مهيأة)
    const kpiVals = `${await attKpi("att-kpi-present")}/${await attKpi("att-kpi-late")}/${await attKpi("att-kpi-absent")}/${await attKpi("att-kpi-leave")}`
    log(
      "attendance: page loads with 5 KPI cards",
      attState1.title.includes("الحضور") &&
        Object.values(kpiPresence).every(Boolean),
      `title="${attState1.title}" · kpis=${Object.values(kpiPresence).filter(Boolean).length}/5 · vals(p/l/a/iv)=${kpiVals}`,
    )
    await page.screenshot({ path: "design-review/19-attendance.png" })

    if (IS_LIVE) {
      console.log("⏭ SKIPPED (live mode): attendance seed assertions + all record write scenarios (check-in/out, manual records, settings) — no writes in live, seeded numbers are demo-only")
    } else {
      // أرقام اليوم المقفلة من البذرة: حاضر 10 · متأخر 2 · غائب 3 · إجازة 1
      const k = {
        present: Number(await attKpi("att-kpi-present")),
        late: Number(await attKpi("att-kpi-late")),
        absent: Number(await attKpi("att-kpi-absent")),
        leave: Number(await attKpi("att-kpi-leave")),
      }
      log(
        "attendance: today KPIs match locked seed (10/2/3/1)",
        k.present === 10 && k.late === 2 && k.absent === 3 && k.leave === 1,
        `present=${k.present} late=${k.late} absent=${k.absent} on_leave=${k.leave}`,
      )

      // نطاق «آخر 7 أيام»: السجل التاريخي يرفع «حاضر» فوق قيمة اليوم
      const rangeHandle = await page.$('[data-testid="att-range"]')
      const switchedLast7 = await clickRadixOption(rangeHandle, "آخر 7 أيام")
      await sleep(700)
      const last7Present = Number(await attKpi("att-kpi-present"))
      log(
        "attendance: last-7 range includes history (present > today)",
        switchedLast7 && last7Present > 10,
        `present(last7)=${last7Present}`,
      )
      const rangeHandle2 = await page.$('[data-testid="att-range"]')
      await clickRadixOption(rangeHandle2, "اليوم")
      await sleep(700)

      // البحث باسم موظف يضيّق جدول اليوم لصفه وحده
      await setNativeValue('[data-testid="table-search"]', "خالد")
      await sleep(600)
      const khRows = await attRows()
      log(
        "attendance: search narrows today table to 1 row",
        khRows === 1,
        `${khRows} rows`,
      )
      await setNativeValue('[data-testid="table-search"]', "")
      await sleep(500)

      // فلتر الحالة «متأخر» في نطاق اليوم: صفان بالضبط (زياد + مصطفى)
      // — الفلاتر في dataTable بعد select النطاق: [0]=النطاق [1]=الإدارة [2]=الحالة
      const attStatusTrigger = await page.evaluateHandle(
        () => document.querySelectorAll('[data-slot="select-trigger"]')[2],
      )
      let lateFilterWorked = false
      if (attStatusTrigger?.asElement()) {
        lateFilterWorked = await clickRadixOption(attStatusTrigger, "متأخر")
        await sleep(600)
        const lateRows = await attRows()
        log(
          "attendance: late status filter shows exactly 2 today",
          lateFilterWorked && lateRows === 2,
          `${lateRows} rows (expected 2)`,
        )
        const attStatusTrigger2 = await page.evaluateHandle(
          () => document.querySelectorAll('[data-slot="select-trigger"]')[2],
        )
        await clickRadixOption(attStatusTrigger2, "الكل")
        await sleep(500)
      } else {
        log("attendance: status filter trigger found", false)
      }

      // فلتر الإدارة «هندسة البرمجيات» في نطاق اليوم: 4 صفوف (موظفو ENG)
      const attDepTrigger = await page.evaluateHandle(
        () => document.querySelectorAll('[data-slot="select-trigger"]')[1],
      )
      let depFilterWorked = false
      if (attDepTrigger?.asElement()) {
        depFilterWorked = await clickRadixOption(attDepTrigger, "هندسة البرمجيات")
        await sleep(600)
        const engRows = await attRows()
        log(
          "attendance: department filter shows 4 ENG rows today",
          depFilterWorked && engRows === 4,
          `${engRows} rows (expected 4)`,
        )
        const attDepTrigger2 = await page.evaluateHandle(
          () => document.querySelectorAll('[data-slot="select-trigger"]')[1],
        )
        await clickRadixOption(attDepTrigger2, "الكل")
        await sleep(500)
      } else {
        log("attendance: department filter trigger found", false)
      }

      // تسجيل حضور سريع من الصف: هدى (غائبة اليوم بلا حضور) →
      // الغياب 3→2 وحاضر+متأخر يزيد 1 (الحالة مشتقة من الوقت الحالي)
      await setNativeValue('[data-testid="table-search"]', "هدى")
      await sleep(600)
      const hodaRows = await attRows()
      const before = {
        present: Number(await attKpi("att-kpi-present")),
        late: Number(await attKpi("att-kpi-late")),
        absent: Number(await attKpi("att-kpi-absent")),
      }
      const quickIn = await page.$('[data-testid="att-quick-in-att-9"]')
      if (quickIn && hodaRows === 1) {
        await quickIn.click()
        const checkedIn = await page
          .waitForFunction(
            () => (document.body.textContent ?? "").includes("تم تسجيل الحضور"),
            { timeout: 15_000, polling: 400 },
          )
          .then(() => true)
          .catch(() => false)
        await sleep(1_000)
        const after = {
          present: Number(await attKpi("att-kpi-present")),
          late: Number(await attKpi("att-kpi-late")),
          absent: Number(await attKpi("att-kpi-absent")),
        }
        log(
          "attendance: quick check-in flips KPIs (absent -1, present+late +1)",
          checkedIn &&
            after.absent === before.absent - 1 &&
            after.present + after.late === before.present + before.late + 1,
          `absent ${before.absent}→${after.absent} · present+late ${before.present + before.late}→${after.present + after.late}`,
        )
        await page.screenshot({ path: "design-review/19b-attendance-after-checkin.png" })
      } else {
        log(
          "attendance: quick check-in button found (row visible)",
          Boolean(quickIn) && hodaRows === 1,
        )
      }
      await setNativeValue('[data-testid="table-search"]', "")
      await sleep(500)

      // تسجيل انصراف سريع: زياد (متأخر 09:24 بلا انصراف) → الخلية تمتلئ
      await setNativeValue('[data-testid="table-search"]', "زياد")
      await sleep(600)
      const ziadRows = await attRows()
      const quickOut = await page.$('[data-testid="att-quick-out-att-3"]')
      if (quickOut && ziadRows === 1) {
        await quickOut.click()
        const checkedOut = await page
          .waitForFunction(
            () => (document.body.textContent ?? "").includes("تم تسجيل الانصراف"),
            { timeout: 15_000, polling: 400 },
          )
          .then(() => true)
          .catch(() => false)
        await sleep(1_000)
        const cellAfter = await page.evaluate(() => {
          const row = document.querySelector("table tbody tr")
          return row ? (row.querySelectorAll("td")[4]?.textContent ?? "") : ""
        })
        log(
          "attendance: quick check-out fills the checkout cell",
          checkedOut && cellAfter.trim() !== "—" && /\d{2}:\d{2}/.test(cellAfter),
          `checkout cell="${cellAfter.trim()}"`,
        )
      } else {
        log(
          "attendance: quick check-out button found (row visible)",
          Boolean(quickOut) && ziadRows === 1,
        )
      }
      await setNativeValue('[data-testid="table-search"]', "")
      await sleep(500)

      // سجل مكرر (خالد له سجل اليوم) → رسالة عقد الخطأ الموحدة
      const addRecBtn = await page.$('[data-testid="att-btn-add"]')
      if (addRecBtn) {
        await addRecBtn.click()
        await sleep(700)
        const empTrigger = await page.$('[data-testid="att-form-employee"]')
        const picked = await clickRadixOption(empTrigger, "خالد الشاذلي")
        await sleep(300)
        const submitRec = await page.$('[data-testid="att-form-submit"]')
        if (picked && submitRec) {
          await submitRec.click()
          const rejected = await page
            .waitForFunction(
              () =>
                (document.body.textContent ?? "").includes(
                  "سجل حضور لهذا الموظف في هذا اليوم موجود بالفعل",
                ),
              { timeout: 15_000, polling: 400 },
            )
            .then(() => true)
            .catch(() => false)
          log(
            "attendance: duplicate record rejected with contract message",
            rejected,
          )
        } else {
          log(
            "attendance: duplicate form controls found",
            Boolean(picked && submitRec),
          )
        }
        await page.keyboard.press("Escape")
        await sleep(400)
      } else {
        log("attendance: add record button found", false)
      }

      // سجل يدوي لتاريخ مستقبلي: يظهر في نطاق مخصص → تعديله → حذفه
      const tomorrowLocal = await page.evaluate(() => {
        const d = new Date()
        d.setDate(d.getDate() + 1)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      })
      const addRecBtn2 = await page.$('[data-testid="att-btn-add"]')
      if (addRecBtn2) {
        await addRecBtn2.click()
        await sleep(700)
        const empTrigger2 = await page.$('[data-testid="att-form-employee"]')
        const picked2 = await clickRadixOption(empTrigger2, "طارق بدوي")
        await sleep(300)
        await setNativeValue('[data-testid="att-form-date"]', tomorrowLocal)
        await setNativeValue('[data-testid="att-form-checkin"]', "09:00")
        await setNativeValue('[data-testid="att-form-checkout"]', "17:00")
        const submitRec2 = await page.$('[data-testid="att-form-submit"]')
        if (picked2 && submitRec2) {
          await submitRec2.click()
          const created2 = await page
            .waitForFunction(
              () =>
                (document.body.textContent ?? "").includes("تمت إضافة سجل الحضور"),
              { timeout: 15_000, polling: 400 },
            )
            .then(() => true)
            .catch(() => false)
          await sleep(600)
          // نطاق مخصص = الغد فقط → السجل الجديد صف وحيد في جدول السجلات
          const rangeC = await page.$('[data-testid="att-range"]')
          await clickRadixOption(rangeC, "نطاق مخصص")
          await sleep(600)
          await setNativeValue('[data-testid="att-range-from"]', tomorrowLocal)
          await setNativeValue('[data-testid="att-range-to"]', tomorrowLocal)
          await sleep(700)
          const customRows = await attRows()
          log(
            "attendance: manual future record appears in custom range",
            created2 && customRows === 1,
            `date=${tomorrowLocal} · ${customRows} rows`,
          )
          await page.screenshot({ path: "design-review/19c-attendance-manual.png" })

          // تعديل السجل (تغيير الملاحظة) من زر الصف
          const editTid = await page.evaluate(
            () =>
              document
                .querySelector('button[data-testid^="att-edit-"]')
                ?.getAttribute("data-testid") ?? null,
          )
          if (editTid) {
            await page.click(`[data-testid="${editTid}"]`)
            await sleep(700)
            await setNativeValue(
              '[data-testid="att-form-note"]',
              "ملاحظة فحص آلي",
            )
            const saveBtn = await page.$('[data-testid="att-form-submit"]')
            if (saveBtn) {
              await saveBtn.click()
              const edited2 = await page
                .waitForFunction(
                  () =>
                    (document.body.textContent ?? "").includes(
                      "تم تحديث سجل الحضور",
                    ),
                  { timeout: 15_000, polling: 400 },
                )
                .then(() => true)
                .catch(() => false)
              log("attendance: edit record saves with toast", edited2)
            }
            await sleep(600)
          } else {
            log("attendance: row edit button found", false)
          }

          // حذف السجل من الصف + تأكيد → يختفي (تنظيف أثر الفحص كاملًا)
          const delTid = await page.evaluate(
            () =>
              document
                .querySelector('button[data-testid^="att-delete-"]')
                ?.getAttribute("data-testid") ?? null,
          )
          if (delTid) {
            await page.click(`[data-testid="${delTid}"]`)
            await sleep(600)
            const confirmDel2 = await page.$('[data-testid="att-confirm-delete"]')
            if (confirmDel2) {
              await confirmDel2.click()
              const deleted2 = await page
                .waitForFunction(
                  () =>
                    (document.body.textContent ?? "").includes(
                      "تم حذف سجل الحضور",
                    ),
                  { timeout: 15_000, polling: 400 },
                )
                .then(() => true)
                .catch(() => false)
              await sleep(800)
              const emptyRowText = await page.evaluate(() => {
                const row = document.querySelector("table tbody tr")
                return row ? (row.textContent ?? "") : ""
              })
              log(
                "attendance: delete record removes it (cleanup complete)",
                deleted2 && emptyRowText.includes("لا توجد بيانات"),
                `row text="${emptyRowText.trim().slice(0, 20)}"`,
              )
            }
          }
        } else {
          log(
            "attendance: future form controls found",
            Boolean(picked2 && submitRec2),
          )
        }
      }

      // إغلاق أي حوارية متبقية احتياطًا + إعادة النطاق إلى «اليوم»
      await page.keyboard.press("Escape").catch(() => {})
      await sleep(300)
      const rangeBack = await page.$('[data-testid="att-range"]')
      if (rangeBack) {
        await clickRadixOption(rangeBack, "اليوم")
        await sleep(600)
      }

      // إعدادات قواعد الحضور: تغيير فترة السماح + حفظ + تثبيت بعد الفتح
      const settingsBtn = await page.$('[data-testid="att-btn-settings"]')
      if (settingsBtn) {
        await settingsBtn.click()
        await sleep(700)
        const graceBefore = await page.evaluate(
          () =>
            document.querySelector('[data-testid="att-settings-grace"]')?.value ??
            null,
        )
        await setNativeValue('[data-testid="att-settings-grace"]', "25")
        const saveSet = await page.$('[data-testid="att-settings-save"]')
        if (saveSet) {
          await saveSet.click()
          const saved = await page
            .waitForFunction(
              () =>
                (document.body.textContent ?? "").includes(
                  "تم حفظ قواعد الحضور",
                ),
              { timeout: 15_000, polling: 400 },
            )
            .then(() => true)
            .catch(() => false)
          await sleep(700)
          // إعادة الفتح — القيمة المحفوظة يجب أن تكون 25
          await settingsBtn.click()
          await sleep(700)
          const graceAfter = await page.evaluate(
            () =>
              document.querySelector('[data-testid="att-settings-grace"]')?.value ??
              null,
          )
          log(
            "attendance: settings persist (grace minutes)",
            saved && graceAfter === "25",
            `${graceBefore} → ${graceAfter}`,
          )
          await page.keyboard.press("Escape")
          await sleep(400)
        }
      } else {
        log("attendance: settings button found", false)
      }
    } // ── نهاية حارس live لفحوص الحضور (demo فقط) ──

    // قسم التقارير + زر تصدير CSV [مشترك للوضعين — في live قد يكون فارغًا/معطلًا لكنه يُعرض]
    const attReports = await page.evaluate(() => ({
      hasReports: Boolean(document.querySelector('[data-testid="att-reports"]')),
      hasCsv: Boolean(document.querySelector('[data-testid="att-export-csv"]')),
      tables: document.querySelectorAll("table").length,
      recordRows:
        document.querySelector("table")?.querySelectorAll("tbody tr").length ?? 0,
      reportRows:
        document.querySelectorAll("table")[1]?.querySelectorAll("tbody tr")
          .length ?? 0,
    }))
    log(
      "attendance: reports section + CSV export render",
      attReports.hasReports && attReports.hasCsv,
      JSON.stringify(attReports),
    )
    await page.screenshot({ path: "design-review/20-attendance-reports.png" })

    // ── 5.8) الإجازات (Leaves) ─────────────────────────────────────
    // فحص القراءة الأساسي (تحميل + تقارير + CSV) مشترك للوضعين — في
    // live الجداول غير المهيأة تعرض أصفارًا نظيفة + تنبيه تهيئة صادقًا.
    // الأرقام المقفلة (3 معلق/3 معتمد/1 مرفوض/1 ملغى) خاصة ببذرة demo،
    // وكل سيناريوهات الكتابة demo فقط — خلف نفس نمط SKIPPED غير المحسوبة.
    await page.goto(`${BASE_URL}/app/m/leaves`, { waitUntil: "networkidle2" })
    await sleep(1_500)

    /** قيمة مؤشر KPI — داخل span[dir="ltr"] في بطاقة KpiCard */
    const lvKpi = (tid) =>
      page.evaluate(
        (t) => {
          const el = document.querySelector(`[data-testid="${t}"] span[dir="ltr"]`)
          return el ? (el.textContent ?? "").trim() : null
        },
        tid,
      )
    /** انتظار نص toast في الصفحة */
    const lvToast = (text) =>
      page
        .waitForFunction(
          (s) => (document.body.textContent ?? "").includes(s),
          { timeout: 15_000, polling: 400 },
          text,
        )
        .then(() => true)
        .catch(() => false)
    /** testid لزر داخل صف نوع إجازة باسم النوع (محصّن ضد الترتيب) */
    const lvTypeBtnId = (name, prefix) =>
      page.evaluate(
        (n, p) => {
          const rows = [
            ...document.querySelectorAll(
              '[data-testid="lv-types-table"] table tbody tr',
            ),
          ]
          const row = rows.find((r) => (r.textContent ?? "").includes(n))
          const btn = row?.querySelector(`button[data-testid^="${p}"]`)
          return btn?.getAttribute("data-testid") ?? null
        },
        name,
        prefix,
      )

    // أدوات تاريخ محلية — مطابقة محرك leave-rules (getDay، الأسبوع 0..4)
    const lvIso = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    const lvOffset = (n) => {
      const d = new Date()
      d.setDate(d.getDate() + n)
      return lvIso(d)
    }
    const lvWorkingDays = (fromIso, toIso) => {
      let count = 0
      const d = new Date(`${fromIso}T00:00:00`)
      const end = new Date(`${toIso}T00:00:00`)
      while (d.getTime() <= end.getTime()) {
        if ([0, 1, 2, 3, 4].includes(d.getDay())) count += 1
        d.setDate(d.getDate() + 1)
      }
      return count
    }
    /** صفوف جدول الطلبات تحديدًا (الأول في الصفحة) */
    const lvRows = () =>
      page.evaluate(
        () =>
          document.querySelector("table")?.querySelectorAll("tbody tr").length ??
          0,
      )

    // تحميل الصفحة: العنوان + المؤشرات الخمسة + التقارير [مشترك للوضعين]
    const lvState1 = await readState()
    const lvPresence = await page.evaluate(() => ({
      pending: Boolean(document.querySelector('[data-testid="lv-kpi-pending"]')),
      approved: Boolean(document.querySelector('[data-testid="lv-kpi-approved"]')),
      rejected: Boolean(document.querySelector('[data-testid="lv-kpi-rejected"]')),
      cancelled: Boolean(
        document.querySelector('[data-testid="lv-kpi-cancelled"]'),
      ),
      upcoming: Boolean(document.querySelector('[data-testid="lv-kpi-upcoming"]')),
      reports: Boolean(document.querySelector('[data-testid="lv-reports"]')),
      csv: Boolean(document.querySelector('[data-testid="lv-export-csv"]')),
    }))
    const lvKpiVals = `${await lvKpi("lv-kpi-pending")}/${await lvKpi("lv-kpi-approved")}/${await lvKpi("lv-kpi-rejected")}/${await lvKpi("lv-kpi-cancelled")}/${await lvKpi("lv-kpi-upcoming")}`
    log(
      "leaves: page loads with 5 KPI cards + reports + CSV",
      lvState1.title.includes("الإجازات") &&
        Object.values(lvPresence).every(Boolean),
      `title="${lvState1.title}" · kpis(p/a/r/c/u)=${lvKpiVals}`,
    )
    await page.screenshot({ path: "design-review/21-leaves.png" })

    if (IS_LIVE) {
      console.log("⏭ SKIPPED (live mode): leave seed assertions + all leave write scenarios (requests, decisions, types CRUD, sync to attendance) — no writes in live, seeded numbers are demo-only")
    } else {
      // أرقام البذرة المقفلة: 3 معلق · 3 معتمد · 1 مرفوض · 1 ملغى
      const lvk = {
        pending: Number(await lvKpi("lv-kpi-pending")),
        approved: Number(await lvKpi("lv-kpi-approved")),
        rejected: Number(await lvKpi("lv-kpi-rejected")),
        cancelled: Number(await lvKpi("lv-kpi-cancelled")),
      }
      log(
        "leaves: KPIs match locked seed (3/3/1/1)",
        lvk.pending === 3 &&
          lvk.approved === 3 &&
          lvk.rejected === 1 &&
          lvk.cancelled === 1,
        `pending=${lvk.pending} approved=${lvk.approved} rejected=${lvk.rejected} cancelled=${lvk.cancelled}`,
      )

      // «الأيام القادمة» = أيام عمل الطلب المعتمد المستقبلي (leave-7: +21..+24)
      const lvUpcomingExpected = lvWorkingDays(lvOffset(21), lvOffset(24))
      const lvUpcomingActual = Number(await lvKpi("lv-kpi-upcoming"))
      log(
        "leaves: upcoming KPI equals engine working-days value",
        lvUpcomingActual === lvUpcomingExpected,
        `expected=${lvUpcomingExpected} actual=${lvUpcomingActual}`,
      )

      // فلتر الحالة «معلق»: 3 صفوف بالضبط — الفلاتر: [0]=النوع [1]=الحالة
      const lvStatusTrigger = await page.evaluateHandle(
        () => document.querySelectorAll('[data-slot="select-trigger"]')[1],
      )
      let lvStatusFilterWorked = false
      if (lvStatusTrigger?.asElement()) {
        lvStatusFilterWorked = await clickRadixOption(lvStatusTrigger, "معلق")
        await sleep(600)
        const lvPendingRows = await lvRows()
        log(
          "leaves: status filter shows exactly 3 pending rows",
          lvStatusFilterWorked && lvPendingRows === 3,
          `${lvPendingRows} rows (expected 3)`,
        )
        const lvStatusTrigger2 = await page.evaluateHandle(
          () => document.querySelectorAll('[data-slot="select-trigger"]')[1],
        )
        await clickRadixOption(lvStatusTrigger2, "الكل")
        await sleep(500)
      } else {
        log("leaves: status filter trigger found", false)
      }

      // فلتر النوع «إجازة سنوية»: 3 صفوف (leave-1/4/6)
      const lvTypeTrigger = await page.evaluateHandle(
        () => document.querySelectorAll('[data-slot="select-trigger"]')[0],
      )
      let lvTypeFilterWorked = false
      if (lvTypeTrigger?.asElement()) {
        lvTypeFilterWorked = await clickRadixOption(lvTypeTrigger, "إجازة سنوية")
        await sleep(600)
        const lvAnnualRows = await lvRows()
        log(
          "leaves: type filter shows exactly 3 annual rows",
          lvTypeFilterWorked && lvAnnualRows === 3,
          `${lvAnnualRows} rows (expected 3)`,
        )
        const lvTypeTrigger2 = await page.evaluateHandle(
          () => document.querySelectorAll('[data-slot="select-trigger"]')[0],
        )
        await clickRadixOption(lvTypeTrigger2, "الكل")
        await sleep(500)
      } else {
        log("leaves: type filter trigger found", false)
      }

      // إنشاء طلب: خالد الشاذلي (بلا طلبات في البذرة) · سنوي · من +10 إلى +14
      const lvNewDays = lvWorkingDays(lvOffset(10), lvOffset(14))
      const lvNewBtn = await page.$('[data-testid="lv-btn-new"]')
      if (lvNewBtn) {
        await lvNewBtn.click()
        await sleep(700)
        const lvEmpTrigger = await page.$('[data-testid="lv-form-employee"]')
        const lvPickedEmp = await clickRadixOption(lvEmpTrigger, "خالد الشاذلي")
        const lvTypeFormTrigger = await page.$('[data-testid="lv-form-type"]')
        const lvPickedType = await clickRadixOption(lvTypeFormTrigger, "إجازة سنوية")
        await setNativeValue('[data-testid="lv-form-from"]', lvOffset(10))
        await setNativeValue('[data-testid="lv-form-to"]', lvOffset(14))
        await sleep(400)
        const lvPreview = await page.evaluate(() => ({
          days:
            document.querySelector('[data-testid="lv-form-days"]')?.value ?? null,
          balance:
            document.querySelector('[data-testid="lv-form-balance"]')
              ?.textContent ?? "",
        }))
        log(
          "leaves: form previews engine working days + remaining balance",
          lvPickedEmp &&
            lvPickedType &&
            lvPreview.days === String(lvNewDays) &&
            lvPreview.balance.trim() === "21",
          `days=${lvPreview.days} (expected ${lvNewDays}) · balance=${lvPreview.balance.trim()} (expected 21)`,
        )
        await setNativeValue(
          '[data-testid="lv-form-reason"]',
          "فحص آلي — إجازة تجريبية",
        )
        const lvSubmit = await page.$('[data-testid="lv-form-submit"]')
        if (lvPickedEmp && lvPickedType && lvSubmit) {
          await lvSubmit.click()
          const lvCreated = await lvToast("تم تسجيل طلب الإجازة")
          await sleep(600)
          const lvPendingAfterCreate = Number(await lvKpi("lv-kpi-pending"))
          log(
            "leaves: create request adds pending row (3→4)",
            lvCreated && lvPendingAfterCreate === 4,
            `pending=${lvPendingAfterCreate} (expected 4)`,
          )
          await page.screenshot({ path: "design-review/22-leave-created.png" })
        } else {
          log("leaves: create form controls found", false)
        }
      } else {
        log("leaves: new request button found", false)
      }

      // تعديل الطلب المعلق الجديد (أول زر تعديل في الجدول)
      const lvEditBtn = await page.evaluateHandle(() =>
        document.querySelector('button[data-testid^="lv-edit-"]'),
      )
      if (lvEditBtn?.asElement()) {
        await lvEditBtn.asElement().click()
        await sleep(700)
        await setNativeValue(
          '[data-testid="lv-form-reason"]',
          "فحص آلي — سبب محدث",
        )
        const lvSave = await page.$('[data-testid="lv-form-submit"]')
        if (lvSave) {
          await lvSave.click()
          const lvEdited = await lvToast("تم تحديث طلب الإجازة")
          log("leaves: edit pending request saves with toast", lvEdited)
          await sleep(600)
        }
      } else {
        log("leaves: row edit button found", false)
      }

      // اعتماد الطلب الجديد (أول زر اعتماد) → معتمد 3→4 · معلق → 3
      const lvApproveBtn = await page.evaluateHandle(() =>
        document.querySelector('button[data-testid^="lv-approve-"]'),
      )
      if (lvApproveBtn?.asElement()) {
        await lvApproveBtn.asElement().click()
        await sleep(600)
        const lvConfirmApprove = await page.$('[data-testid="lv-decision-confirm"]')
        if (lvConfirmApprove) {
          await lvConfirmApprove.click()
          const lvApproved = await lvToast("تم اعتماد طلب الإجازة")
          await sleep(600)
          const lvApprovedKpi = Number(await lvKpi("lv-kpi-approved"))
          const lvPendingKpi = Number(await lvKpi("lv-kpi-pending"))
          log(
            "leaves: approve pending request (approved 3→4)",
            lvApproved && lvApprovedKpi === 4 && lvPendingKpi === 3,
            `approved=${lvApprovedKpi} pending=${lvPendingKpi}`,
          )
        } else {
          log("leaves: approve confirm button found", false)
        }
      } else {
        log("leaves: row approve button found", false)
      }

      // رفض أول طلب معلق (leave-3: طارق بدوي) بسبب إلزامي → مرفوض 1→2
      const lvRejectBtn = await page.evaluateHandle(() =>
        document.querySelector('button[data-testid^="lv-reject-"]'),
      )
      if (lvRejectBtn?.asElement()) {
        await lvRejectBtn.asElement().click()
        await sleep(600)
        await setNativeValue(
          '[data-testid="lv-reject-reason"]',
          "ضغط العمل — فحص آلي",
        )
        const lvConfirmReject = await page.$('[data-testid="lv-decision-confirm"]')
        if (lvConfirmReject) {
          await lvConfirmReject.click()
          const lvRejected = await lvToast("تم رفض طلب الإجازة")
          await sleep(600)
          const lvRejectedKpi = Number(await lvKpi("lv-kpi-rejected"))
          log(
            "leaves: reject pending request records reason (rejected 1→2)",
            lvRejected && lvRejectedKpi === 2,
            `rejected=${lvRejectedKpi}`,
          )
        } else {
          log("leaves: reject confirm button found", false)
        }
      } else {
        log("leaves: row reject button found", false)
      }

      // الربط الآمن بالحضور للطلب المعتمد الجديد: عدد السجلات = أيام عمل المحرك
      const lvSyncBtn = await page.evaluateHandle(() =>
        document.querySelector('button[data-testid^="lv-sync-"]'),
      )
      if (lvSyncBtn?.asElement()) {
        await lvSyncBtn.asElement().click()
        await sleep(600)
        const lvConfirmSync = await page.$('[data-testid="lv-sync-confirm"]')
        if (lvConfirmSync) {
          await lvConfirmSync.click()
          const lvSynced = await lvToast(
            `تم إنشاء ${lvNewDays} سجل إجازة في الحضور`,
          )
          log(
            "leaves: sync creates on_leave records matching engine count",
            lvSynced,
            `expected ${lvNewDays} record(s)`,
          )
          await sleep(500)
        } else {
          log("leaves: sync confirm button found", false)
        }
      } else {
        log("leaves: row sync button found", false)
      }

      // إلغاء الطلب المعتمد الجديد (أول زر إلغاء) → ملغى 1→2 · معتمد → 3
      const lvCancelBtn = await page.evaluateHandle(() =>
        document.querySelector('button[data-testid^="lv-cancel-"]'),
      )
      if (lvCancelBtn?.asElement()) {
        await lvCancelBtn.asElement().click()
        await sleep(600)
        const lvConfirmCancel = await page.$('[data-testid="lv-confirm-cancel"]')
        if (lvConfirmCancel) {
          await lvConfirmCancel.click()
          const lvCancelled = await lvToast("تم إلغاء طلب الإجازة")
          await sleep(600)
          const lvCancelledKpi = Number(await lvKpi("lv-kpi-cancelled"))
          const lvApprovedKpi2 = Number(await lvKpi("lv-kpi-approved"))
          log(
            "leaves: cancel approved request (cancelled 1→2, approved→3)",
            lvCancelled && lvCancelledKpi === 2 && lvApprovedKpi2 === 3,
            `cancelled=${lvCancelledKpi} approved=${lvApprovedKpi2}`,
          )
        } else {
          log("leaves: cancel confirm button found", false)
        }
      } else {
        log("leaves: row cancel button found", false)
      }

      // التحقق البيني: سجلات on_leave المنشأة تظهر في نطاق حضور مخصص
      await page.goto(`${BASE_URL}/app/m/attendance`, {
        waitUntil: "networkidle2",
      })
      await sleep(1_500)
      const lvAttRange = await page.$('[data-testid="att-range"]')
      if (lvAttRange) {
        await clickRadixOption(lvAttRange, "نطاق مخصص")
        await sleep(600)
        await setNativeValue('[data-testid="att-range-from"]', lvOffset(10))
        await setNativeValue('[data-testid="att-range-to"]', lvOffset(14))
        await sleep(800)
        const lvSyncedRows = await lvRows()
        log(
          "leaves: synced on_leave records appear in attendance range",
          lvSyncedRows === lvNewDays,
          `${lvSyncedRows} rows (expected ${lvNewDays})`,
        )
        await page.screenshot({
          path: "design-review/23-leave-synced-attendance.png",
        })
        const lvRangeBack = await page.$('[data-testid="att-range"]')
        if (lvRangeBack) {
          await clickRadixOption(lvRangeBack, "اليوم")
          await sleep(500)
        }
      } else {
        log("leaves: attendance range selector found", false)
      }

      // العودة للإجازات: طلب متداخل مع بذرة (هدى شريف +6..+7 يعترض leave-4)
      await page.goto(`${BASE_URL}/app/m/leaves`, { waitUntil: "networkidle2" })
      await sleep(1_500)
      const lvNewBtn2 = await page.$('[data-testid="lv-btn-new"]')
      if (lvNewBtn2) {
        await lvNewBtn2.click()
        await sleep(700)
        const lvEmpTrigger2 = await page.$('[data-testid="lv-form-employee"]')
        const lvPickedEmp2 = await clickRadixOption(lvEmpTrigger2, "هدى شريف")
        const lvTypeFormTrigger2 = await page.$('[data-testid="lv-form-type"]')
        const lvPickedType2 = await clickRadixOption(
          lvTypeFormTrigger2,
          "إجازة سنوية",
        )
        await setNativeValue('[data-testid="lv-form-from"]', lvOffset(6))
        await setNativeValue('[data-testid="lv-form-to"]', lvOffset(7))
        await setNativeValue('[data-testid="lv-form-reason"]', "فحص تداخل آلي")
        const lvSubmit2 = await page.$('[data-testid="lv-form-submit"]')
        if (lvPickedEmp2 && lvPickedType2 && lvSubmit2) {
          await lvSubmit2.click()
          const lvOverlapBlocked = await lvToast(
            "يتعارض المدى مع طلب إجازة قائم لنفس الموظف",
          )
          await sleep(600)
          const lvPendingAfterOverlap = Number(await lvKpi("lv-kpi-pending"))
          log(
            "leaves: overlapping request rejected with clear error (KPI unchanged)",
            lvOverlapBlocked && lvPendingAfterOverlap === 2,
            `pending=${lvPendingAfterOverlap} (expected 2)`,
          )
        } else {
          log("leaves: overlap form controls found", false)
        }
        await page.keyboard.press("Escape").catch(() => {})
        await sleep(400)
      } else {
        log("leaves: new request button (overlap) found", false)
      }

      // إدارة الأنواع: إضافة (4→5) → تعديل (90→100) → حذف (5→4) → منع المحجوب
      const lvTypesBtn = await page.$('[data-testid="lv-btn-types"]')
      if (lvTypesBtn) {
        await lvTypesBtn.click()
        await sleep(800)
        const lvTypeRows = () =>
          page.evaluate(
            () =>
              document
                .querySelector('[data-testid="lv-types-table"] table')
                ?.querySelectorAll("tbody tr").length ?? 0,
          )
        const lvTypesRows0 = await lvTypeRows()
        const lvTypeAddBtn = await page.$('[data-testid="lv-type-add"]')
        if (lvTypeAddBtn) {
          await lvTypeAddBtn.click()
          await sleep(700)
          await setNativeValue('[data-testid="lv-type-name"]', "إجازة أمومة")
          await setNativeValue('[data-testid="lv-type-days"]', "90")
          const lvTypeSubmitBtn = await page.$('[data-testid="lv-type-submit"]')
          if (lvTypeSubmitBtn) {
            await lvTypeSubmitBtn.click()
            const lvTypeAdded = await lvToast("تمت إضافة نوع الإجازة")
            await sleep(700)
            const lvTypesRows1 = await lvTypeRows()
            log(
              "leaves: add leave type (4→5 rows)",
              lvTypeAdded && lvTypesRows0 === 4 && lvTypesRows1 === 5,
              `${lvTypesRows0} → ${lvTypesRows1} rows`,
            )

            // تعديل النوع الجديد عبر استهداف صفه بالاسم
            const lvEditTid = await lvTypeBtnId("إجازة أمومة", "lv-row-edit-")
            if (lvEditTid) {
              await page.click(`[data-testid="${lvEditTid}"]`)
              await sleep(700)
              await setNativeValue('[data-testid="lv-type-days"]', "100")
              const lvTypeSubmitBtn2 = await page.$(
                '[data-testid="lv-type-submit"]',
              )
              if (lvTypeSubmitBtn2) {
                await lvTypeSubmitBtn2.click()
                const lvTypeEdited = await lvToast("تم تحديث نوع الإجازة")
                log("leaves: edit leave type saves (90→100)", lvTypeEdited)
                await sleep(600)
              }
            } else {
              log("leaves: new type edit button found", false)
            }

            // حذف النوع الجديد (بلا طلبات)
            const lvDeleteTid = await lvTypeBtnId("إجازة أمومة", "lv-row-delete-")
            if (lvDeleteTid) {
              await page.click(`[data-testid="${lvDeleteTid}"]`)
              await sleep(600)
              const lvConfirmTypeDel = await page.$(
                '[data-testid="lv-confirm-delete-type"]',
              )
              if (lvConfirmTypeDel) {
                await lvConfirmTypeDel.click()
                const lvTypeDeleted = await lvToast("تم حذف نوع الإجازة")
                await sleep(700)
                const lvTypesRows2 = await lvTypeRows()
                log(
                  "leaves: delete type without requests (5→4 rows)",
                  lvTypeDeleted && lvTypesRows2 === 4,
                  `${lvTypesRows1} → ${lvTypesRows2} rows`,
                )
              }
            } else {
              log("leaves: new type delete button found", false)
            }

            // حذف نوع له طلبات (إجازة سنوية) → مرفوض برسالة العقد
            const lvDeleteBlockedTid = await lvTypeBtnId(
              "إجازة سنوية",
              "lv-row-delete-",
            )
            if (lvDeleteBlockedTid) {
              await page.click(`[data-testid="${lvDeleteBlockedTid}"]`)
              await sleep(600)
              const lvConfirmTypeDel2 = await page.$(
                '[data-testid="lv-confirm-delete-type"]',
              )
              if (lvConfirmTypeDel2) {
                await lvConfirmTypeDel2.click()
                const lvTypeBlocked = await lvToast(
                  "لا يمكن حذف نوع إجازة له طلبات",
                )
                await sleep(500)
                const lvTypesRows3 = await lvTypeRows()
                log(
                  "leaves: delete blocked for type with requests",
                  lvTypeBlocked && lvTypesRows3 === 4,
                  `${lvTypesRows3} rows remain`,
                )
                await page.keyboard.press("Escape").catch(() => {})
                await sleep(400)
              }
            }
          } else {
            log("leaves: type submit button found", false)
          }
        } else {
          log("leaves: add type button found", false)
        }
        await page.keyboard.press("Escape").catch(() => {})
        await sleep(500)
      } else {
        log("leaves: types manager button found", false)
      }

      // الأرصدة: قيم المحرك المقفلة — المستهلك المعتمد يخصم، والملغى يُعاد
      const lvBalancesBtn = await page.$('[data-testid="lv-btn-balances"]')
      if (lvBalancesBtn) {
        await lvBalancesBtn.click()
        await sleep(1_000)
        const lv1Used =
          new Date(`${lvOffset(-3)}T00:00:00`).getFullYear() ===
          new Date().getFullYear()
            ? lvWorkingDays(lvOffset(-3), lvOffset(0))
            : 0
        const lvBalExpected7 = 21 - lv1Used
        const lvBalanceVals = await page.evaluate(() => ({
          e7: document
            .querySelector('[data-testid="lv-balance-emp-007-lt-annual"]')
            ?.textContent?.trim(),
          e1: document
            .querySelector('[data-testid="lv-balance-emp-001-lt-annual"]')
            ?.textContent?.trim(),
        }))
        log(
          "leaves: balances lock engine values (used consumed, cancelled restored)",
          lvBalanceVals.e7 === String(lvBalExpected7) &&
            lvBalanceVals.e1 === "21",
          `emp-007=${lvBalanceVals.e7} (expected ${lvBalExpected7}) · emp-001=${lvBalanceVals.e1} (expected 21 — cancelled request restored)`,
        )
        await page.screenshot({ path: "design-review/24-leave-balances.png" })
        await page.keyboard.press("Escape").catch(() => {})
        await sleep(400)
      } else {
        log("leaves: balances button found", false)
      }

      // جدول التقارير: 4 أنواع بعد دورة الإضافة/الحذف المتعادلة
      const lvReportsRows = await page.evaluate(
        () =>
          document.querySelectorAll("table")[1]?.querySelectorAll("tbody tr")
            .length ?? 0,
      )
      log(
        "leaves: reports table shows 4 type rows",
        lvReportsRows === 4,
        `${lvReportsRows} rows (expected 4)`,
      )
    } // ── نهاية حارس live لفحوص الإجازات (demo فقط) ──

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
    // ── حارس live: سيناريو التوفير/دورة الحياة/التكرار أدناه ينشئ
    // مشاريع Supabase حقيقية في الوضع live → يُتخطى كاملًا.
    // أسطر SKIPPED لا تدخل مصفوفة النتائج إطلاقًا (لا نجاح ولا فشل).
    if (IS_LIVE) {
      console.log("⏭ SKIPPED (live mode): provisioning + lifecycle + idempotency scenarios — would create/operate real Supabase projects")
    } else {
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

        // 1) توكيد عرض فقط: أيقونات الخطوات تُرسم داخل الحوار أثناء التنفيذ.
        //    ⚠️ قد يمرّ هذا الفحص حتى لو فشلت المهمة لاحقًا — نجاح المهمة
        //    نفسه تلتقطه فحوص auto-close و verified-company أدناه.
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

        // ── 7.6) دورة حياة الشركة: المدير المدعو + pause/resume ───────
        // استخرج رابط تفاصيل الشركة الجديدة من صفها
        const detailHref = await page.evaluate(() => {
          const row = [...document.querySelectorAll("table tbody tr")].find(
            (tr) => tr.textContent?.includes("شركة الاختبار الآلي"),
          )
          const link = row?.querySelector("a[href*='/platform/companies/']")
          return link ? link.getAttribute("href") : null
        })
        log("lifecycle: company detail link exists", Boolean(detailHref))

        if (detailHref) {
          await page.goto(`${BASE_URL}${detailHref}`, { waitUntil: "networkidle2" })
          await sleep(1_000)

          // create_admin خطوة فعلية: المدير مدعو ومسجل
          const adminInvited = await page.evaluate(
            () => document.body.textContent?.includes("دعوة مُرسلة") ?? false,
          )
          log("lifecycle: first admin invited (create_admin step)", adminInvited)

          // ── pause: يتحقق من حالة "موقوفة" — لا من نجاح الاتصال ──
          const pauseBtn = await page.evaluateHandle(() => {
            const buttons = [...document.querySelectorAll("button")]
            return buttons.find((b) => b.textContent?.includes("إيقاف البنية مؤقتًا"))
          })
          if (pauseBtn?.asElement()) {
            await pauseBtn.asElement().click()
            const pausedOk = await page
              .waitForFunction(
                () => document.body.textContent?.includes("موقوفة مؤقتًا") ?? false,
                { timeout: 25_000, polling: 500 },
              )
              .then(() => true)
              .catch(() => false)
            log("lifecycle: pause infra → verified paused state", pausedOk)
            await page.screenshot({ path: "design-review/12-paused.png" })

            // ── resume: استئناف + انتظار صحوة المشروع + تحقق اتصال ──
            const resumeBtn = await page.evaluateHandle(() => {
              const buttons = [...document.querySelectorAll("button")]
              return buttons.find((b) => b.textContent?.includes("تشغيل البنية"))
            })
            let resumedOk = false
            if (resumeBtn?.asElement()) {
              await resumeBtn.asElement().click()
              resumedOk = await page
                .waitForFunction(
                  () => {
                    const text = document.body.textContent ?? ""
                    return text.includes("يعمل") && !text.includes("موقوفة مؤقتًا")
                  },
                  { timeout: 25_000, polling: 500 },
                )
                .then(() => true)
                .catch(() => false)
            }
            log("lifecycle: resume infra → verified healthy", resumedOk)
            await page.screenshot({ path: "design-review/13-resumed.png" })

            // ── اشتراك العميل (منفصل عن البنية): تفعيل ثم تعليق ──
            const activateBtn = await page.evaluateHandle(() => {
              const buttons = [...document.querySelectorAll("button")]
              return buttons.find((b) => b.textContent?.trim() === "تفعيل")
            })
            let subActivated = false
            if (activateBtn?.asElement()) {
              await activateBtn.asElement().click()
              subActivated = await page
                .waitForFunction(
                  () => document.body.textContent?.includes("تم تحديث الاشتراك") ?? false,
                  { timeout: 8_000, polling: 400 },
                )
                .then(() => true)
                .catch(() => false)
              log("lifecycle: subscription activated (gated by verified connection)", subActivated)

              const suspendBtn = await page.evaluateHandle(() => {
                const buttons = [...document.querySelectorAll("button")]
                return buttons.find((b) => b.textContent?.trim() === "تعليق")
              })
              let subSuspended = false
              let infraUntouched = false
              if (suspendBtn?.asElement()) {
                await suspendBtn.asElement().click()
                await sleep(1_200)
                const state = await page.evaluate(() => {
                  const text = document.body.textContent ?? ""
                  return {
                    suspended: text.includes("موقوف"),
                    infraRunning: text.includes("يعمل"),
                  }
                })
                subSuspended = state.suspended
                infraUntouched = state.infraRunning
                log(
                  "lifecycle: subscription suspended while infra stays running (separation)",
                  subSuspended && infraUntouched,
                  JSON.stringify(state),
                )
                await page.screenshot({ path: "design-review/14-subscription-suspended.png" })
              }
            }
          } else {
            log("lifecycle: pause button found", false)
          }
        }

        // ── 7.7) Idempotency: slug مكرر يُرفض برسالة واضحة ────────────
        await page.goto(`${BASE_URL}/platform/companies`, { waitUntil: "networkidle2" })
        await sleep(800)
        const addBtn2 = await page.evaluateHandle(() => {
          const buttons = [...document.querySelectorAll("button")]
          return buttons.find((b) => b.textContent?.includes("إضافة شركة"))
        })
        if (addBtn2?.asElement()) {
          await addBtn2.asElement().click()
          await sleep(400)
          await page.type("#company-name", "شركة تكرار الاختبار")
          await page.type("#company-slug", "nawa-tech") // slug موجود بالفعل
          await page.type("#company-email", "admin@dup-test.demo")
          const startBtn2 = await page.evaluateHandle(() => {
            const buttons = [...document.querySelectorAll("button")]
            return buttons.find((b) => b.textContent?.includes("بدء التوفير"))
          })
          if (startBtn2?.asElement()) {
            await startBtn2.asElement().click()
            await sleep(1_800)
            const rejected = await page.evaluate(() => {
              const stillOnForm = Boolean(document.querySelector("#company-name"))
              const toastShown = document.body.textContent?.includes("مستخدم بالفعل") ?? false
              return { stillOnForm, toastShown }
            })
            log(
              "idempotency: duplicate slug rejected with clear message",
              rejected.stillOnForm && rejected.toastShown,
              JSON.stringify(rejected),
            )
            await page.keyboard.press("Escape") // إغلاق الـ dialog
            await sleep(400)
          }
        }
      } else {
        log("provisioning: start button found", false)
      }
    } else {
      log("provisioning: add company button found", false)
    }
    } // ── نهاية حارس live (سيناريو الموارد — demo فقط) ──
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
  // ── تشخيص الانهيار: كل ما جُمع حتى اللحظة + حالة الصفحة الحالية ──
  // (بدون هذا يبقى سبب أي انهيار في الإقلاع مخفيًا — أخطاء الصفحة نفسها)
  try {
    const crashState = await page.evaluate(() => ({
      url: window.location.href,
      title: document.title,
      lang: document.documentElement.lang,
      hasRoot: Boolean(document.getElementById("root")),
      rootChildren: document.getElementById("root")?.children.length ?? -1,
      hasThemeToggle: Boolean(
        document.querySelector('[data-testid="theme-toggle"]'),
      ),
      bodySnippet: (document.body.textContent ?? "")
        .replace(/\s+/g, " ")
        .slice(0, 300),
    }))
    console.error("CRASH STATE:", JSON.stringify(crashState, null, 2))
    console.error(
      "PAGE ERRORS:",
      consoleErrors.length ? consoleErrors : "none",
    )
    await page.screenshot({ path: "design-review/99-crash-state.png" })
    console.error("screenshot: design-review/99-crash-state.png")
  } catch (dumpErr) {
    console.error("CRASH DUMP FAILED:", dumpErr.message)
  }
  process.exitCode = 1
} finally {
  await browser.close()
}
