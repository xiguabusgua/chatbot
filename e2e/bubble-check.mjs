/**
 * 对话气泡定制验证：配色 / 圆角 / 宽度 / 预览 / 持久化 / 深色
 * 运行：node e2e/bubble-check.mjs
 */
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8123/";
const out = [];
const mark = (n, ok, d) => {
  out.push({ n, ok, d });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${n}${d ? "  → " + d : ""}`);
};

const SSE = [
  "event: message_start",
  'data: {"type":"message_start","message":{"id":"m1","type":"message","role":"assistant","model":"deepseek-chat","content":[]}}',
  "",
  "event: content_block_start",
  'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
  "",
  "event: content_block_delta",
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"收到，这是一条用于观察气泡的回复。"}}',
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
const ctx = await browser.newContext({ viewport: { width: 1180, height: 900 }, locale: "zh-CN" });
const page = await ctx.newPage();
await (page.context()).addInitScript(() => { try { localStorage.setItem("chat-demo:onboarded", "1"); } catch (e) {} });
const errs = [];
page.on("pageerror", (e) => errs.push(e.message.slice(0, 150)));

page.on("console", (m) => {
  if (m.type() === "error") errs.push(m.text().slice(0, 150));
});

await page.route("**/api.deepseek.com/**", (r) =>
  r.fulfill({ status: 200, headers: { "content-type": "text/event-stream; charset=utf-8", "access-control-allow-origin": "*" }, body: SSE })
);

await page.goto(BASE + "?bub=1", { waitUntil: "domcontentloaded" });
await page.waitForSelector("textarea", { timeout: 8000 });
await page.evaluate(() => localStorage.setItem("chat-demo:api-key", "sk-bubble"));
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("textarea", { timeout: 8000 });
await page.waitForTimeout(700);

// 造一条消息（用户 + 助手）
await page.fill("textarea", "这是一条用来观察气泡样式的消息");
await page.click('button[aria-label="发送"]');
await page.waitForFunction(() => document.body.innerText.includes("观察气泡"), null, { timeout: 10000 });
await page.waitForTimeout(1000);

const bubbleStyle = () =>
  page.evaluate(() => {
    const b = document.querySelector('[class*="bubble-"]');
    if (!b) return null;
    const cs = getComputedStyle(b);
    return { bg: cs.backgroundColor, r: cs.borderRadius, maxW: cs.maxWidth };
  });

const base = await bubbleStyle();
mark("默认气泡样式", !!base, `${base.bg} / 圆角 ${base.r}`);

// 打开个性化
await page.getByText("设置", { exact: true }).last().click({ timeout: 5000 });
await page.waitForSelector("#sk-settings", { timeout: 5000 });
await page.click('#sk-settings [data-act="personalize"]');
await page.waitForSelector("#sk-settings .sk-bubble-preview", { timeout: 3000 });
const rows = await page.locator('#sk-settings [data-act^="bubble-"]').count();
mark("个性化出现气泡定制区", rows === 3, `${rows} 个选项行`);

// 配色 → 薄荷
await page.click('#sk-settings [data-act="bubble-color"]');
await page.waitForSelector("#sk-settings .sk-sheet", { timeout: 3000 });
const colorOpts = await page.locator("#sk-settings .sk-opt").allInnerTexts();
await page.locator("#sk-settings .sk-opt").nth(1).click();
await page.waitForTimeout(400);
const previewBg = await page.evaluate(() => {
  const d = document.querySelector("#sk-settings .sk-bubble-demo");
  return d ? getComputedStyle(d).backgroundColor : null;
});
mark("配色可选（默认/薄荷/淡紫/暖灰）", colorOpts.length === 4 && previewBg === "rgb(220, 243, 230)", `${colorOpts.join("/")}，预览 ${previewBg}`);

// 圆角 → 方正
await page.click('#sk-settings [data-act="bubble-radius"]');
await page.waitForSelector("#sk-settings .sk-sheet");
await page.locator("#sk-settings .sk-opt").nth(2).click();
await page.waitForTimeout(400);

// 宽度 → 加宽
await page.click('#sk-settings [data-act="bubble-width"]');
await page.waitForSelector("#sk-settings .sk-sheet");
await page.locator("#sk-settings .sk-opt").nth(1).click();
await page.waitForTimeout(400);

const attrs = await page.evaluate(() => ({
  color: document.body.getAttribute("data-sk-bubble"),
  radius: document.body.getAttribute("data-sk-radius"),
  width: document.body.getAttribute("data-sk-width"),
  stored: {
    c: localStorage.getItem("chat-demo:bubble-color"),
    r: localStorage.getItem("chat-demo:bubble-radius"),
    w: localStorage.getItem("chat-demo:bubble-width")
  }
}));
mark("三项设置写入并持久化", attrs.color === "mint" && attrs.radius === "square" && attrs.width === "wide", JSON.stringify(attrs.stored));

// 关闭设置，检查真实气泡
for (let i = 0; i < 3; i++) {
  if (!(await page.locator("#sk-settings").count())) break;
  await page.locator("#sk-settings .sk-back").click().catch(() => {});
  await page.waitForTimeout(220);
}
await page.waitForTimeout(400);
const applied = await bubbleStyle();
mark(
  "应用内气泡应用了新样式",
  applied && applied.bg === "rgb(220, 243, 230)" && applied.r === "6px" && applied.maxW.indexOf("24px") > -1,
  `${applied.bg} / 圆角 ${applied.r} / 最大宽 ${applied.maxW}`
);
await page.screenshot({ path: "e2e/artifacts/bubble-light.png" });

// 刷新后保持
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("textarea", { timeout: 8000 });
await page.waitForTimeout(1200);
const afterReload = await page.evaluate(() => ({
  color: document.body.getAttribute("data-sk-bubble"),
  radius: document.body.getAttribute("data-sk-radius")
}));
mark("刷新后仍然生效", afterReload.color === "mint" && afterReload.radius === "square", JSON.stringify(afterReload));

// 深色模式下的配色
await page.evaluate(() => localStorage.setItem("chat-demo:theme-preference", "dark"));
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("textarea", { timeout: 8000 });
await page.waitForTimeout(1200);
await page.fill("textarea", "深色模式下再看一眼气泡");
await page.click('button[aria-label="发送"]');
await page.waitForFunction(() => document.body.innerText.includes("观察气泡"), null, { timeout: 10000 });
await page.waitForTimeout(900);
const dark = await page.evaluate(() => {
  const b = document.querySelector('[class*="bubble-"]');
  const attrOn = document.documentElement.hasAttribute("data-ds-dark-theme")
    ? "html"
    : document.body.hasAttribute("data-ds-dark-theme")
    ? "body"
    : document.body.className.includes("dark")
    ? "class"
    : "none";
  return { bg: b ? getComputedStyle(b).backgroundColor : null, attrOn };
});
mark("深色模式使用深色气泡", dark.bg === "rgb(31, 58, 49)", `${dark.bg}（主题标记在 ${dark.attrOn}）`);
await page.screenshot({ path: "e2e/artifacts/bubble-dark.png" });

mark("无 JS 运行时错误", errs.length === 0, errs.slice(0, 2).join(" | "));
await browser.close();
const failed = out.filter((o) => !o.ok);
console.log(`\n结果：${out.length - failed.length}/${out.length} 通过`);
process.exit(failed.length ? 1 : 0);
