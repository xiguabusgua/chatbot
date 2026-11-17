/**
 * 按天记忆验证：跨天加载 / 当天落盘 / 页面浏览 / 关闭记录
 * 运行：node e2e/daily-check.mjs
 */
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8123/";
const res = [];
const mark = (n, ok, d) => {
  res.push({ n, ok, d });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${n}${d ? "  → " + d : ""}`);
};

const ymd = (d) =>
  d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
const today = new Date();
const todayKey = ymd(today);
const y1 = new Date(today.getTime() - 86400000);
const y2 = new Date(today.getTime() - 2 * 86400000);
const y1Key = ymd(y1);
const y2Key = ymd(y2);

const SSE = [
  "event: message_start",
  'data: {"type":"message_start","message":{"id":"m1","type":"message","role":"assistant","model":"deepseek-chat","content":[]}}',
  "",
  "event: content_block_start",
  'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
  "",
  "event: content_block_delta",
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"好的，我记得上次的价格。"}}',
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
const ctx = await browser.newContext({ viewport: { width: 1180, height: 950 }, locale: "zh-CN", acceptDownloads: true });
const page = await ctx.newPage();
await (page.context()).addInitScript(() => { try { localStorage.setItem("chat-demo:onboarded", "1"); } catch (e) {} });
const errs = [];
page.on("pageerror", (e) => errs.push((e.stack || e.message).slice(0, 400)));
page.on("console", (m) => {
  if (m.type() === "error") errs.push(m.text().slice(0, 200));
});

const bodies = [];
await page.route("**/api.deepseek.com/anthropic/v1/messages", async (route) => {
  bodies.push(JSON.parse(route.request().postData() || "{}"));
  await route.fulfill({
    status: 200,
    headers: { "content-type": "text/event-stream; charset=utf-8", "access-control-allow-origin": "*" },
    body: SSE
  });
});

await page.goto(BASE + "?daily=1", { waitUntil: "domcontentloaded" });
await page.waitForSelector("textarea", { timeout: 8000 });
await page.evaluate(
  ({ k1, k2 }) => {
    localStorage.setItem("chat-demo:api-key", "sk-daily");
    localStorage.removeItem("chat-demo:characters");
    localStorage.removeItem("chat-demo:character-active");
    localStorage.setItem(
      "chat-demo:daily:" + k1,
      "# " + k1 + " 对话记忆\n\n## 09:30 · 用户\n昨天的 0.5mm 报价多少\n\n## 09:30 · 助手\n报 5200 元/吨，账期 30 天。\n"
    );
    localStorage.setItem(
      "chat-demo:daily:" + k2,
      "# " + k2 + " 对话记忆\n\n## 14:00 · 用户\n客户要 20 吨\n\n## 14:00 · 助手\n已排产，下周三交货。\n"
    );
    localStorage.setItem(
      "chat-demo:daily-index",
      JSON.stringify([
        { date: k1, chars: 60 },
        { date: k2, chars: 50 }
      ])
    );
  },
  { k1: y1Key, k2: y2Key }
);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("textarea", { timeout: 8000 });
await page.waitForTimeout(1000);

/* 1. 跨天上下文注入 */
await page.fill("textarea", "上次报的多少钱来着");
await page.click('button[aria-label="发送"]');
await page.waitForTimeout(1800);
const sys = bodies.length ? bodies[bodies.length - 1].system || "" : "";
mark(
  "新一天自动加载前几天记忆",
  /此前几天的对话记忆/.test(sys) && /5200 元\/吨/.test(sys) && sys.indexOf(y1Key) > -1,
  sys.replace(/\n/g, " ").slice(0, 80)
);
mark("按日期从近到远串联", sys.indexOf(y1Key) > -1 && sys.indexOf(y2Key) > -1 && sys.indexOf(y1Key) < sys.indexOf(y2Key), "两条历史均在上下文中");

/* 2. 当天落盘 */
await page.waitForTimeout(1200);
const dailyToday = await page.evaluate((k) => localStorage.getItem("chat-demo:daily:" + k) || "", todayKey);
mark(
  "当天对话写入 md",
  /# \d{4}-\d{2}-\d{2} 对话记忆/.test(dailyToday) && /· 用户/.test(dailyToday) && /· 助手/.test(dailyToday) && /上次报的多少钱来着/.test(dailyToday),
  dailyToday.replace(/\n/g, " ").slice(0, 70)
);
mark("写入内容含助手回复", /我记得上次的价格/.test(dailyToday), "");

/* 3. 页面查看 */
await page.getByText("设置", { exact: true }).last().click({ timeout: 5000 });
await page.waitForSelector("#sk-settings", { timeout: 5000 });
await page.click('#sk-settings [data-act="data"]');
await page.waitForTimeout(300);
await page.click('#sk-settings [data-act="daily"]');
await page.waitForSelector("#sk-settings .sk-md, #sk-settings [data-act='daily-open']", { timeout: 3000 });
const listText = await page.locator("#sk-settings").innerText();
mark("记忆文件按日期列出", listText.indexOf(todayKey) > -1 && listText.indexOf(y1Key) > -1, listText.replace(/\s+/g, " ").slice(0, 70));

await page.locator(`#sk-settings [data-date="${y1Key}"]`).click();
await page.waitForSelector("#sk-settings .sk-md", { timeout: 3000 });
const preview = await page.locator("#sk-settings .sk-md").innerText();
mark("可查看某天 md 原文", /5200 元\/吨/.test(preview), preview.replace(/\s+/g, " ").slice(0, 50));

const [download] = await Promise.all([
  page.waitForEvent("download", { timeout: 8000 }).catch(() => null),
  page.click('#sk-settings [data-act="daily-export"]')
]);
mark("可导出为 md 文件", !!download && /\.md$/.test(download.suggestedFilename()), download ? download.suggestedFilename() : "未触发下载");

/* 4. 关闭记录 */
await page.locator("#sk-settings .sk-back").click();
await page.waitForTimeout(250);
await page.click('#sk-settings [data-act="daily-toggle"]');
await page.waitForTimeout(300);
const off = await page.evaluate(() => localStorage.getItem("chat-demo:daily-on"));
const before = await page.evaluate((k) => (localStorage.getItem("chat-demo:daily:" + k) || "").length, todayKey);

for (let i = 0; i < 4; i++) {
  if (!(await page.locator("#sk-settings").count())) break;
  await page.locator("#sk-settings .sk-back").click().catch(() => {});
  await page.waitForTimeout(220);
}
await page.waitForTimeout(300);
await page.fill("textarea", "这条不该被记录");
await page.click('button[aria-label="发送"]');
await page.waitForTimeout(2000);
const after = await page.evaluate((k) => (localStorage.getItem("chat-demo:daily:" + k) || "").length, todayKey);
mark("关闭后不再写入", off === "off" && after === before, `开关=${off}，长度 ${before} → ${after}`);

/* 5. 重新开启后恢复 */
await page.getByText("设置", { exact: true }).last().click({ timeout: 5000 });
await page.waitForSelector("#sk-settings", { timeout: 5000 });
await page.click('#sk-settings [data-act="data"]');
await page.waitForTimeout(250);
await page.click('#sk-settings [data-act="daily"]');
await page.waitForTimeout(250);
await page.click('#sk-settings [data-act="daily-toggle"]');
await page.waitForTimeout(250);
const on = await page.evaluate(() => localStorage.getItem("chat-demo:daily-on"));
mark("可重新开启记录", on === "on", "开关=" + on);

mark("无 JS 运行时错误", errs.length === 0, errs.slice(0, 1).join(" | "));
await page.screenshot({ path: "e2e/artifacts/daily-page.png" });
await browser.close();
const failed = res.filter((r) => !r.ok);
console.log(`\n结果：${res.length - failed.length}/${res.length} 通过`);
process.exit(failed.length ? 1 : 0);
