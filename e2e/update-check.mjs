/** 验证 GitHub Releases 内置更新的 Web 编排层：版本比较、提示、失败原因、回滚、启动静默检查。
 *  原生侧接口用 mock 注入（真实 Java 逻辑另行在模拟器验证）。 */
import { chromium } from "playwright";
const BASE = "http://127.0.0.1:8123/";
const GH = "**/api.github.com/repos/xiguabusgua/chatbot/releases/latest";
const out = [];
function log(name, ok, detail) {
  out.push({ name, ok });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? " → " + detail : ""}`);
}

// 注入一个 NativeUpdater mock：checkGithub 真去 fetch GitHub（被 route 拦截），
// 解析后回填 status，模拟原生 Java 的行为；install 直接标记 downloading→installing。
const MOCK = () => {
  let status = JSON.stringify({ phase: "idle" });
  const parseCode = (tag) => {
    const m = String(tag).match(/\d+/g) || [];
    return m.length ? parseInt(m[m.length - 1], 10) : 0;
  };
  window.NativeUpdater = {
    status: () => status,
    hasBackup: () => window.__mockBackup ? "1" : "0",
    checkGithub: async (repo) => {
      status = JSON.stringify({ phase: "checking" });
      try {
        const r = await fetch(`https://api.github.com/repos/${repo}/releases/latest`);
        if (!r.ok) throw new Error("HTTP " + r.status);
        const j = await r.json();
        const code = parseCode(j.tag_name || "");
        const apk = (j.assets || []).find((a) => (a.name || "").endsWith(".apk"));
        if (code > 44 && apk) {
          status = JSON.stringify({ phase: "available", versionCode: code,
            versionName: j.name, tag: j.tag_name, apkUrl: apk.browser_download_url,
            notes: j.body || "", localCode: 44 });
        } else {
          status = JSON.stringify({ phase: "uptodate", versionCode: code, localCode: 44 });
        }
      } catch (e) {
        status = JSON.stringify({ phase: "failed", error: "network", message: String(e) });
      }
    },
    check: () => {},
    install: () => { status = JSON.stringify({ phase: "installing" }); },
    rollback: () => { window.__rolledBack = true; status = JSON.stringify({ phase: "installing" }); }
  };
};

async function openSettings(page) {
  // 通过点击设置入口打开（与现有脚本一致）
  const entry = page.locator('div.item-ff6fc9:has-text("设置"), button:has-text("设置")');
  if (await entry.count()) await entry.last().click({ timeout: 5000 });
  await page.waitForSelector("#sk-settings", { timeout: 5000 });
}

const browser = await chromium.launch();

// 场景 1：有新版本 → 提示面板 + 徽标 + 更新说明
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-CN" });
  await ctx.addInitScript(() => localStorage.setItem("chat-demo:onboarded", "1"));
  await ctx.addInitScript(MOCK);
  const page = await ctx.newPage();
  await page.route(GH, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    tag_name: "v45", name: "0.1.1 (V45)", body: "• 修复更新逻辑\n• 新增回滚",
    assets: [{ name: "app-release.apk", browser_download_url: "https://example.com/app.apk" }]
  }) }));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await openSettings(page);
  await page.locator('#sk-settings [data-act="update"]').click();
  await page.waitForSelector("#sk-settings .sk-sheet", { timeout: 5000 });
  const title = await page.locator("#sk-settings .sk-sheet-title").innerText();
  log("发现新版本弹出面板", title.includes("V45"), title);
  const notes = await page.locator("#sk-settings .sk-sheet-notes").innerText().catch(() => "");
  log("显示更新说明", notes.includes("修复更新逻辑"), notes.slice(0, 40));
  await page.locator('#sk-settings .sk-cancel').click();
  await page.waitForTimeout(300);
  log("更新后出现徽标", (await page.locator("#sk-settings .sk-update-badge").count()) === 1);
  await ctx.close();
}

// 场景 2：已是最新（tag 版本低于本地）→ 提示已最新
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-CN" });
  await ctx.addInitScript(() => localStorage.setItem("chat-demo:onboarded", "1"));
  await ctx.addInitScript(MOCK);
  const page = await ctx.newPage();
  await page.route(GH, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    tag_name: "v44", name: "0.1.1 (V44)", body: "", assets: []
  }) }));
  const toasts = [];
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await openSettings(page);
  page.on("DOMNodeInserted", () => {});
  await page.locator('#sk-settings [data-act="update"]').click();
  await page.waitForTimeout(1200);
  const body = await page.locator("#sk-settings").innerText();
  log("低版本不提示更新", body.indexOf("发现新版本") === -1);
  await ctx.close();
}

// 场景 3：网络失败 → 友好提示，不崩溃
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-CN" });
  await ctx.addInitScript(() => localStorage.setItem("chat-demo:onboarded", "1"));
  await ctx.addInitScript(MOCK);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.route(GH, (r) => r.abort("failed"));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await openSettings(page);
  await page.locator('#sk-settings [data-act="update"]').click();
  await page.waitForTimeout(1500);
  log("网络失败无 JS 错误", errs.length === 0, errs.join(";").slice(0, 80));
  await ctx.close();
}

// 场景 4：回滚入口与执行
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-CN" });
  await ctx.addInitScript(() => { localStorage.setItem("chat-demo:onboarded", "1"); window.__mockBackup = true; });
  await ctx.addInitScript(MOCK);
  const page = await ctx.newPage();
  await page.route(GH, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    tag_name: "v45", name: "V45", body: "",
    assets: [{ name: "a.apk", browser_download_url: "https://example.com/a.apk" }]
  }) }));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await openSettings(page);
  log("有备份时显示回退行", (await page.locator('#sk-settings [data-act="rollback"]').count()) === 1);
  await page.locator('#sk-settings [data-act="rollback"]').click();
  await page.waitForSelector("#sk-settings .sk-sheet", { timeout: 5000 });
  await page.locator('#sk-settings [data-pick="0"]').click();
  await page.waitForTimeout(300);
  log("执行回滚", await page.evaluate(() => window.__rolledBack === true));
  await ctx.close();
}

// 场景 5：启动静默检查（4s 后触发，写检查时间）
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-CN" });
  await ctx.addInitScript(() => localStorage.setItem("chat-demo:onboarded", "1"));
  await ctx.addInitScript(MOCK);
  const page = await ctx.newPage();
  await page.route(GH, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    tag_name: "v44", name: "V44", body: "", assets: []
  }) }));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5200);
  const last = await page.evaluate(() => localStorage.getItem("chat-demo:last-update-check"));
  log("启动静默检查写入时间戳", !!last && parseInt(last, 10) > 0, last);
  await ctx.close();
}

await browser.close();
const failed = out.filter((x) => !x.ok);
console.log(`\n结果: ${out.length - failed.length}/${out.length} 通过`);
process.exit(failed.length ? 1 : 0);
