/**
 * 设置项补齐后的功能验证：字号 / 个性化 / 检查更新 / 服务协议 / 帮助与反馈 / 退出登录
 * 运行：node e2e/settings-check.mjs
 */
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8123/";
const results = [];
const logs = [];
function mark(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? "  → " + detail : ""}`);
}

const SSE = [
  "event: message_start",
  'data: {"type":"message_start","message":{"id":"m1","type":"message","role":"assistant","model":"deepseek-chat","content":[]}}',
  "",
  "event: content_block_start",
  'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
  "",
  "event: content_block_delta",
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"## 标题\\n\\n这是一段用来测字号的正文字。"}}',
  "",
  "event: content_block_stop",
  'data: {"type":"content_block_stop","index":0}',
  "",
  "event: message_stop",
  'data: {"type":"message_stop"}',
  "",
  ""
].join("\n");

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  locale: "zh-CN",
  permissions: ["clipboard-read", "clipboard-write"]
});
const page = await ctx.newPage();
await (page.context()).addInitScript(() => { try { localStorage.setItem("chat-demo:onboarded", "1"); } catch (e) {} });
page.on("pageerror", (e) => logs.push(e.message.slice(0, 160)));
page.on("console", (m) => {
  if (m.type() === "error") logs.push(m.text().slice(0, 160));
});

async function openSettings() {
  if (!(await page.locator("#sk-settings").count())) {
    await page.getByText("设置", { exact: true }).last().click({ timeout: 5000 });
    await page.waitForSelector("#sk-settings", { timeout: 5000 });
  }
  // 回到主设置页
  for (let i = 0; i < 4; i++) {
    if (await page.locator('#sk-settings [data-act="account"]').count()) break;
    await page.locator("#sk-settings .sk-back").click().catch(() => {});
    await page.waitForTimeout(220);
  }
}

async function closeSettings() {
  for (let i = 0; i < 4; i++) {
    if (!(await page.locator("#sk-settings").count())) return;
    await page.locator("#sk-settings .sk-back").click().catch(() => {});
    await page.waitForTimeout(220);
  }
}

await page.route("**/api.deepseek.com/**", (r) =>
  r.fulfill({ status: 200, headers: { "content-type": "text/event-stream; charset=utf-8", "access-control-allow-origin": "*" }, body: SSE })
);

await page.goto(BASE + "?set=1", { waitUntil: "domcontentloaded" });
await page.waitForSelector("textarea", { timeout: 8000 });
await page.evaluate(() => localStorage.setItem("chat-demo:api-key", "sk-settings-test"));
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("textarea", { timeout: 8000 });
await page.waitForTimeout(700);

// 先造一条消息，便于观测字号
await page.fill("textarea", "生成一段正文");
await page.click('button[aria-label="发送"]');
await page.waitForFunction(() => document.body.innerText.includes("正文"), null, { timeout: 10000 });
await page.waitForTimeout(1200);

await openSettings();
mark("设置页可打开", await page.locator("#sk-settings").count() > 0, "");

/* 1. 字体大小 */
await page.click('#sk-settings [data-act="fontsize"]');
await page.waitForSelector("#sk-settings .sk-sheet", { timeout: 3000 });
const fsOptions = await page.locator("#sk-settings .sk-opt").allInnerTexts();
await page.locator("#sk-settings .sk-opt").nth(3).click();
await page.waitForTimeout(500);
const fsState = await page.evaluate(() => ({
  attr: document.body.getAttribute("data-sk-fs"),
  stored: localStorage.getItem("chat-demo:font-size")
}));
mark("字体大小可选并持久化", fsOptions.length === 4 && fsState.attr === "xl" && fsState.stored === "xl", `选项 ${fsOptions.join("/")}，attr=${fsState.attr}`);

await closeSettings();
await page.waitForTimeout(400);
const paraFs = await page.evaluate(() => {
  const p = document.querySelector('[class*="ds-markdown"] .ds-markdown-paragraph');
  return p ? getComputedStyle(p).fontSize : null;
});
mark("正文字号实际生效", paraFs === "20px", "段落字号 " + paraFs);

/* 2. 个性化 */
await openSettings();
await page.click('#sk-settings [data-act="personalize"]');
await page.waitForSelector('#sk-settings [data-act="toggle-density"]', { timeout: 3000 });
const beforeDensity = await page.evaluate(() => {
  const b = document.querySelector('[class*="bubble-"]');
  return b ? getComputedStyle(b).paddingBottom : null;
});
await page.click('#sk-settings [data-act="toggle-density"]');
await page.waitForTimeout(400);
const densityState = await page.evaluate(() => ({
  attr: document.body.getAttribute("data-sk-density"),
  stored: localStorage.getItem("chat-demo:density"),
  pb: getComputedStyle(document.querySelector('[class*="bubble-"]')).paddingBottom
}));
mark("紧凑模式生效", densityState.attr === "compact" && densityState.stored === "compact", `气泡内边距 ${beforeDensity} → ${densityState.pb}`);

await page.click('#sk-settings [data-act="toggle-caveat"]');
await page.waitForTimeout(300);
await closeSettings();
const caveatHidden = await page.evaluate(() => {
  const c = document.querySelector('[class*="caveat-"]');
  if (!c) return null;
  const cs = getComputedStyle(c);
  return { display: cs.display, attr: document.body.getAttribute("data-sk-caveat") };
});
mark("AI 提示可关闭", caveatHidden && caveatHidden.display === "none", JSON.stringify(caveatHidden));

/* 3. 检查更新 */
await openSettings();
await page.click('#sk-settings [data-act="update"]');
await page.waitForTimeout(1200);
const updateToast = await page.evaluate(() => {
  const t = document.querySelector(".sk-toast");
  return t ? t.textContent.trim() : null;
});
mark("检查更新有结果反馈", !!updateToast && /最新版本|新版本|失败/.test(updateToast), updateToast || "无提示");

const verRow = await page.evaluate(() => {
  const r = [...document.querySelectorAll("#sk-settings .sk-row")].find((n) => n.getAttribute("data-act") === "update");
  return r ? r.innerText.replace(/\s+/g, " ").trim() : "";
});
mark("版本号显示为 0.1.1（Vxx）", /0\.1\.1（V\d+）/.test(verRow), verRow);

/* 4. 服务协议 */
await page.click('#sk-settings [data-act="terms"]');
await page.waitForSelector("#sk-settings .sk-doc-block", { timeout: 3000 });
const terms = await page.evaluate(() => ({
  blocks: document.querySelectorAll("#sk-settings .sk-doc-block").length,
  title: document.querySelector("#sk-settings .sk-header h1").textContent
}));
mark("服务协议页可读", terms.blocks >= 4, `${terms.title}，${terms.blocks} 节`);

/* 4b. 项目来源 */
await page.locator("#sk-settings .sk-back").click();
await page.waitForSelector('#sk-settings [data-act="source"]', { timeout: 3000 });
const src = await page.evaluate(() => {
  const row = [...document.querySelectorAll("#sk-settings .sk-row")].find((n) =>
    (n.textContent || "").includes("项目来源")
  );
  const a = document.querySelector('#sk-settings .sk-footer a[href*="github"]');
  return { row: !!row, href: a ? a.href : null, footer: a ? a.textContent : null };
});
mark(
  "关于分组标注项目来源",
  src.row && /github\.com\/[\w.-]+\/[\w.-]+/.test(src.href || ""),
  `${src.footer} → ${src.href}`
);

/* 5. 帮助与反馈 */
await page.waitForSelector('#sk-settings [data-act="help"]', { timeout: 3000 });
await page.click('#sk-settings [data-act="help"]');
await page.waitForSelector("#sk-settings .sk-faq", { timeout: 3000 });
const faqCount = await page.locator("#sk-settings .sk-faq").count();
await page.click("#sk-settings .sk-faq summary");
await page.waitForTimeout(300);
const opened = await page.locator("#sk-settings .sk-faq[open]").count();
await page.click('#sk-settings [data-act="copy-diag"]');
await page.waitForTimeout(600);
const diagToast = await page.evaluate(() => {
  const t = document.querySelector(".sk-toast");
  return t ? t.textContent.trim() : null;
});
const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ""));
mark("帮助页 FAQ 可展开", faqCount >= 3 && opened === 1, `${faqCount} 条，展开 ${opened}`);
mark("诊断信息可复制", /已复制/.test(diagToast || "") && /version=/.test(clip), `${diagToast}；内容 ${clip.slice(0, 24)}…`);

/* 6. 退出登录 */
await page.locator("#sk-settings .sk-back").click();
await page.waitForSelector('#sk-settings [data-act="logout"]', { timeout: 3000 });
await page.click('#sk-settings [data-act="logout"]');
await page.waitForSelector("#sk-settings .sk-sheet", { timeout: 3000 });
const logoutTitle = await page.locator("#sk-settings .sk-sheet-title").innerText();
await page.click("#sk-settings .sk-opt[data-pick='0']");
await page.waitForTimeout(2500);
const afterLogout = await page.evaluate(() => ({
  key: localStorage.getItem("chat-demo:api-key"),
  fs: localStorage.getItem("chat-demo:font-size"),
  settingsOpen: !!document.querySelector("#sk-settings"),
  text: document.body.innerText.replace(/\s+/g, " ").slice(0, 60)
}));
mark("退出登录清除本机数据", !afterLogout.key && !afterLogout.fs, `confirm=「${logoutTitle.slice(0, 18)}…」 key=${afterLogout.key}`);

await page.screenshot({ path: "e2e/artifacts/settings-after-logout.png" });
mark("无 JS 运行时错误", logs.length === 0, logs.slice(0, 2).join(" | "));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n结果：${results.length - failed.length}/${results.length} 通过`);
process.exit(failed.length ? 1 : 0);
