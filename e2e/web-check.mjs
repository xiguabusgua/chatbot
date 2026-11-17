/**
 * Web 端功能验证（Playwright）
 * 覆盖：加载 / 设置页 / 主题 / 空状态 / 输入发送 / 接口契约 / 流式渲染 /
 *       Markdown / 导出 / 401 错误 / 删除 / 新对话 / 移动视口 / 控制台
 * 运行：node e2e/web-check.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";
import { PNG } from "pngjs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://127.0.0.1:8123/";
const OUT = path.join(process.cwd(), "e2e", "artifacts");
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const consoleErrors = [];
const failedRequests = [];
const apiCalls = [];
let shotIndex = 0;
let sseHits = 0;

function log(group, name, ok, detail) {
  results.push({ group, name, ok, detail });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${group} · ${name}${detail ? "  → " + detail : ""}`);
}

async function step(group, name, fn) {
  try {
    const detail = await fn();
    log(group, name, true, typeof detail === "string" ? detail : "");
  } catch (e) {
    log(group, name, false, e.message.split("\n")[0].slice(0, 220));
  }
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 860 },
  deviceScaleFactor: 1,
  locale: "zh-CN",
  acceptDownloads: true
});
const page = await context.newPage();
await (page.context()).addInitScript(() => { try { localStorage.setItem("chat-demo:onboarded", "1"); } catch (e) {} });

page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300));
});
page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message.slice(0, 300)));
page.on("requestfailed", (r) => {
  if (!r.url().startsWith("data:")) failedRequests.push(`${r.method()} ${r.url()} — ${r.failure()?.errorText}`);
});
page.on("request", (r) => {
  if (r.url().includes("api.deepseek.com")) {
    apiCalls.push({
      url: r.url(),
      method: r.method(),
      authPrefix: (r.headers()["x-api-key"] ? "x-api-key" : r.headers()["authorization"] ? "authorization" : "none"),
      body: r.postData() || ""
    });
  }
});

/* ---------------- 辅助 ---------------- */
async function shot(label) {
  shotIndex += 1;
  const file = path.join(OUT, `${String(shotIndex).padStart(2, "0")}-${label}.png`);
  await page.screenshot({ path: file });
  return file;
}

const hasSettings = () => page.locator("#sk-settings").count();

async function closeSettingsFully() {
  for (let i = 0; i < 4; i++) {
    if (!(await hasSettings())) return true;
    const back = page.locator("#sk-settings .sk-back");
    if (!(await back.count())) break;
    await back.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(280);
  }
  return !(await hasSettings());
}

async function openSettings() {
  if (await hasSettings()) await closeSettingsFully();
  await page.locator('main >> text=设置').count().catch(() => 0);
  await page.getByText("设置", { exact: true }).last().click({ timeout: 5000 });
  await page.waitForSelector("#sk-settings", { timeout: 5000 });
}

async function openDataPage() {
  await openSettings();
  const back = page.locator("#sk-settings .sk-back");
  if (await page.locator('#sk-settings [data-act="data"]').count()) {
    await page.click('#sk-settings [data-act="data"]');
  }
  await page.waitForSelector('#sk-settings [data-act="import"]', { timeout: 4000 });
}

/* 以截图中心区域的像素平均亮度作为真实观感指标 */
async function meanLum() {
  const buf = await page.screenshot({ clip: { x: 420, y: 260, width: 440, height: 260 } });
  const png = PNG.sync.read(buf);
  let sum = 0;
  let n = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    sum += 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
    n += 1;
  }
  return Math.round(sum / n);
}

const SSE = [
  "event: message_start",
  'data: {"type":"message_start","message":{"id":"msg_e2e","type":"message","role":"assistant","model":"deepseek-chat","content":[],"stop_reason":null,"usage":{"input_tokens":12,"output_tokens":0}}}',
  "",
  "event: content_block_start",
  'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
  "",
  "event: content_block_delta",
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"你好！"}}',
  "",
  "event: content_block_delta",
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"这是一条**模拟**响应，用于验证流式渲染与 Markdown。"}}',
  "",
  "event: content_block_stop",
  'data: {"type":"content_block_stop","index":0}',
  "",
  "event: message_delta",
  'data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":18}}',
  "",
  "event: message_stop",
  'data: {"type":"message_stop"}',
  "",
  ""
].join("\n");

/* ---------------- 1. 加载 ---------------- */
await step("加载", "首页返回 200 并渲染", async () => {
  const resp = await page.goto(BASE + "?e2e=1", { waitUntil: "domcontentloaded" });
  if (!resp || resp.status() !== 200) throw new Error("HTTP " + (resp && resp.status()));
  await page.waitForSelector("#root > *", { timeout: 8000 });
  await page.waitForTimeout(900);
  const title = await page.title();
  if (title !== "chatbot") throw new Error("标题不符：" + title);
  return "200，标题「" + title + "」";
});

await step("加载", "关键静态资源均加载成功", async () => {
  const bad = failedRequests.filter((u) => /static\/|settings-skin/.test(u));
  if (bad.length) throw new Error(bad.join("; "));
  return "入口 / CSS / 分包无失败请求";
});

await step("加载", "核心骨架存在", async () => {
  const ta = await page.locator("textarea").count();
  const send = await page.locator('button[aria-label="发送"]').count();
  const side = await page.getByText("开启新对话").count();
  if (!ta || !send || !side) throw new Error(`textarea=${ta} send=${send} 侧栏=${side}`);
  return `textarea=${ta}，发送=${send}，侧栏=${side}`;
});

await shot("home-with-settings");

/* ---------------- 2. 设置页 ---------------- */
await step("设置", "首次进入对话界面，手动可打开改造版设置页", async () => {
  if (await hasSettings()) throw new Error("首次打开不应自动弹出设置页");
  await page.getByText("设置", { exact: true }).last().click({ timeout: 5000 });
  await page.waitForSelector("#sk-settings", { timeout: 5000 });
  const groups = await page.locator("#sk-settings .sk-group").allInnerTexts();
  const rows = await page.locator("#sk-settings .sk-row").count();
  for (const g of ["账户", "应用", "语音", "关于"]) {
    if (!groups.includes(g)) throw new Error("缺少分组 " + g);
  }
  if (rows !== 12) throw new Error("条目数应为 12，实际 " + rows);
  return `${groups.join("/")}，${rows} 条`;
});

await step("设置", "行高满足触控要求", async () => {
  const h = await page.evaluate(() =>
    Math.round(document.querySelector("#sk-settings .sk-row").getBoundingClientRect().height)
  );
  if (h < 48) throw new Error("行高 " + h);
  return h + "px";
});

await shot("settings");

/* ---------------- 3. 主题 ---------------- */
let lightLum = 255;
await step("设置", "记录浅色画面亮度基线", async () => {
  lightLum = await meanLum();
  if (lightLum < 120) throw new Error("浅色画面偏暗：" + lightLum);
  return "平均亮度 " + lightLum;
});

await step("设置", "切换深色后页面确实变暗", async () => {
  await page.click('#sk-settings [data-act="appearance"]');
  await page.waitForSelector("#sk-settings .sk-sheet", { timeout: 3000 });
  await page.click("#sk-settings .sk-opt:nth-of-type(2)");
  await page.waitForTimeout(700);
  const darkLum = await meanLum();
  if (darkLum > lightLum - 100) {
    throw new Error(`画面未明显变暗：${lightLum} → ${darkLum}`);
  }
  return `画面平均亮度 ${lightLum} → ${darkLum}`;
});

await shot("settings-dark");

await step("设置", "切回跟随系统", async () => {
  await page.click('#sk-settings [data-act="appearance"]');
  await page.waitForSelector("#sk-settings .sk-sheet");
  await page.click("#sk-settings .sk-opt:nth-of-type(3)");
  await page.waitForTimeout(600);
  const label = await page.locator('#sk-settings [data-act="appearance"] .sk-val').innerText();
  if (label !== "系统") throw new Error("外观值未刷新：" + label);
  return "已回到「系统」";
});

/* ---------------- 4. 空状态 ---------------- */
await step("空状态", "关闭设置后展示问候语", async () => {
  const closed = await closeSettingsFully();
  if (!closed) throw new Error("设置页未能关闭");
  const greet = await page.getByText("今天有什么可以帮到你？").count();
  if (!greet) throw new Error("未见问候语");
  return "问候语可见";
});

await shot("empty-state");

/* ---------------- 5. 无 Key 发送 ---------------- */
await step("对话", "输入后发送按钮可用", async () => {
  await page.fill("textarea", "帮我写一句自我介绍");
  await page.waitForTimeout(250);
  const d = await page.locator('button[aria-label="发送"]').getAttribute("aria-disabled");
  if (d === "true") throw new Error("发送仍禁用");
  return "发送已激活";
});

await step("对话", "未配置 Key 时引导到设置", async () => {
  await page.click('button[aria-label="发送"]');
  await page.waitForTimeout(1200);
  const dialog = await hasSettings();
  if (!dialog) throw new Error("未弹出设置页");
  return "自动打开设置页要求配置 Key";
});

await shot("no-api-key");

/* ---------------- 6. 模拟正常接口 ---------------- */
await page.evaluate(() => localStorage.setItem("chat-demo:api-key", "sk-e2e-test-key"));
await page.route("**/api.deepseek.com/**", async (route) => {
  sseHits += 1;
  await route.fulfill({
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      "access-control-allow-origin": "http://127.0.0.1:8123"
    },
    body: SSE
  });
});

await step("对话", "配置 Key 后不再强制弹设置", async () => {
  await page.goto(BASE + "?e2e=2", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("textarea", { timeout: 8000 });
  await page.waitForTimeout(900);
  if (await hasSettings()) throw new Error("仍弹出设置页");
  return "直接进入对话";
});

await step("接口", "发送触发 /anthropic/v1/messages 且含 model/stream", async () => {
  apiCalls.length = 0;
  await page.fill("textarea", "你好");
  await page.waitForTimeout(200);
  await page.click('button[aria-label="发送"]');
  await page.waitForTimeout(1500);
  if (!apiCalls.length) throw new Error("未捕获接口请求");
  const c = apiCalls[0];
  if (c.method !== "POST") throw new Error("方法 " + c.method);
  if (!/anthropic\/v1\/messages/.test(c.url)) throw new Error("路径 " + c.url);
  if (!c.body.includes("model")) throw new Error("缺少 model");
  if (!/"stream"\s*:\s*true/.test(c.body)) throw new Error("缺少 stream:true");
  if (!c.body.includes("messages")) throw new Error("缺少 messages");
  return `${c.method} ${c.url.replace("https://api.deepseek.com", "")}，鉴权头 ${c.authPrefix}…`;
});

await step("对话", "流式内容渲染为助手消息", async () => {
  await page.waitForFunction(() => document.body.innerText.includes("这是一条"), null, { timeout: 10000 });
  await page.waitForTimeout(1600);
  const info = await page.evaluate(() => ({
    text: document.querySelector("main").innerText.replace(/\s+/g, " ").slice(0, 100),
    user: document.querySelectorAll('[class*="bubble-"]').length,
    assistant: document.querySelectorAll('[class*="message-"]').length
  }));
  if (!info.text.includes("这是一条")) throw new Error("正文缺失");
  return `用户气泡 ${info.user}，助手节点 ${info.assistant}`;
});

await step("对话", "Markdown 加粗渲染为 strong", async () => {
  const info = await page.evaluate(() => ({
    strong: document.querySelectorAll("main strong").length,
    literal: document.querySelector("main").innerText.includes("**模拟**")
  }));
  if (!info.strong) throw new Error("未解析 Markdown，字面量残留=" + info.literal);
  return `strong ${info.strong} 处`;
});

await shot("chat-streaming");

/* ---------------- 7. 导出 ---------------- */
await step("数据", "导出历史对话触发下载", async () => {
  await openDataPage();
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 10000 }).catch(() => null),
    page.click('#sk-settings [data-act="export"]')
  ]);
  if (!download) throw new Error("未触发下载");
  const file = path.join(OUT, "export-" + download.suggestedFilename());
  await download.saveAs(file);
  const size = fs.statSync(file).size;
  if (!size) throw new Error("导出文件为空");
  return `${download.suggestedFilename()}，${size} 字节`;
});

/* ---------------- 8. 接口 401 ---------------- */
await step("接口", "401 时给出可读错误提示", async () => {
  await page.unroute("**/api.deepseek.com/**");
  await page.route("**/api.deepseek.com/**", (route) =>
    route.fulfill({
      status: 401,
      headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
      body: JSON.stringify({ error: { message: "Authentication Fails", type: "authentication_error" } })
    })
  );
  const closed = await closeSettingsFully();
  if (!closed) throw new Error("设置页未能关闭");
  await page.fill("textarea", "这条应该失败");
  await page.waitForTimeout(200);
  await page.click('button[aria-label="发送"]');
  await page.waitForTimeout(2800);
  const txt = await page.locator("main").innerText();
  if (!/API Key|无效|错误|失败|重试/.test(txt)) throw new Error("未见错误文案");
  return "错误提示已展示";
});

await shot("api-401");

/* ---------------- 9. 删除 ---------------- */
await step("数据", "删除对话需二次确认且生效", async () => {
  await page.unroute("**/api.deepseek.com/**");
  await openDataPage();
  await page.click('#sk-settings [data-act="delete"]');
  await page.waitForSelector("#sk-settings .sk-sheet", { timeout: 3000 });
  const title = await page.locator("#sk-settings .sk-sheet-title").innerText();
  if (!/清空|无法找回/.test(title)) throw new Error("缺少风险提示");
  await page.click("#sk-settings .sk-opt[data-pick='0']");
  await page.waitForTimeout(2800);
  const bubbles = (await page.locator('[class*="bubble-"]').count()) + (await page.locator("main strong").count());
  if (bubbles !== 0) throw new Error("删除后仍有内容：" + bubbles);
  return "确认后会话清空";
});

/* ---------------- 10. 新对话 ---------------- */
await step("导航", "开启新对话清空输入与消息", async () => {
  const closed = await closeSettingsFully();
  if (!closed) throw new Error("设置页未能关闭");
  await page.getByText("开启新对话").first().click({ timeout: 5000 });
  await page.waitForTimeout(1000);
  const bubbles = await page.locator('[class*="bubble-"]').count();
  const val = await page.inputValue("textarea");
  if (bubbles !== 0 || val !== "") throw new Error(`残留气泡 ${bubbles}，输入 ${JSON.stringify(val)}`);
  return "已清空";
});

await shot("new-chat");

/* ---------------- 11. 数据管理页 ---------------- */
await step("设置", "数据管理三项操作齐备", async () => {
  await openDataPage();
  const rows = await page.locator("#sk-settings .sk-row .sk-label").allInnerTexts();
  for (const k of ["导入历史对话", "导出所有历史对话", "删除所有对话"]) {
    if (!rows.includes(k)) throw new Error("缺少 " + k);
  }
  return rows.join(" / ");
});

await step("设置", "两级返回均可退出", async () => {
  const closed = await closeSettingsFully();
  if (!closed) throw new Error("返回后仍在设置页");
  return "已退出设置";
});

/* ---------------- 12. 移动视口 ---------------- */
await step("响应式", "390×844 无横向溢出", async () => {
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    locale: "zh-CN"
  });
  const mp = await mobile.newPage();
await mp.context().addInitScript(() => { try { localStorage.setItem("chat-demo:onboarded", "1"); } catch (e) {} });
  mp.on("pageerror", (e) => consoleErrors.push("mobile pageerror: " + e.message.slice(0, 200)));
  await mp.goto(BASE + "?e2e=3", { waitUntil: "domcontentloaded" });
  await mp.waitForSelector("textarea", { timeout: 8000 });
  await mp.waitForTimeout(1000);
  if (await mp.locator("#sk-settings").count()) {
    await mp.click("#sk-settings .sk-back");
    await mp.waitForTimeout(400);
  }
  const m = await mp.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    iw: window.innerWidth,
    sidebar: !!document.querySelector(".sider-ac14ac"),
    openBtn: !!document.querySelector('[aria-label="打开边栏"]')
  }));
  shotIndex += 1;
  await mp.screenshot({ path: path.join(OUT, `${String(shotIndex).padStart(2, "0")}-mobile.png`) });
  await mobile.close();
  if (m.sw > m.iw + 1) throw new Error(`横向溢出 ${m.sw}>${m.iw}`);
  return `无溢出（${m.sw}/${m.iw}），侧栏折叠=${!m.sidebar}，抽屉入口=${m.openBtn}`;
});

/* ---------------- 13. 稳定性 ---------------- */
await step("稳定性", "无 JS 运行时错误", async () => {
  const errs = consoleErrors.filter(
    (e) => !/favicon|status of 404|status of 401/i.test(e)
  );
  if (errs.length) throw new Error(errs.slice(0, 3).join(" | "));
  return "控制台干净";
});

await browser.close();

const failed = results.filter((r) => !r.ok);
fs.writeFileSync(
  path.join(OUT, "result.json"),
  JSON.stringify(
    {
      base: BASE,
      time: new Date().toISOString(),
      total: results.length,
      passed: results.length - failed.length,
      failed: failed.length,
      sseHits,
      apiCalls,
      consoleErrors,
      results
    },
    null,
    2
  )
);

console.log("\n================ 汇总 ================");
console.log(`用例 ${results.length} 条，通过 ${results.length - failed.length} 条，失败 ${failed.length} 条`);
for (const f of failed) console.log(`  ✗ ${f.group} · ${f.name}：${f.detail}`);
console.log("产物：" + OUT);
process.exit(failed.length ? 1 : 0);
