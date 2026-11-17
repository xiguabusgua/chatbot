/**
 * 新对话选角色 + 记忆按角色隔离 + 会话级绑定
 * 运行：node e2e/card-bind-check.mjs
 */
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8123/";
const res = [];
const mark = (n, ok, d) => {
  res.push({ n, ok, d });
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
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"收到。"}}',
  "",
  "event: message_stop",
  'data: {"type":"message_stop"}',
  "",
  ""
].join("\n");

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1200, height: 950 }, locale: "zh-CN" });
const page = await ctx.newPage();
await (page.context()).addInitScript(() => { try { localStorage.setItem("chat-demo:onboarded", "1"); } catch (e) {} });
const errs = [];
page.on("pageerror", (e) => errs.push((e.stack || e.message).slice(0, 300)));
page.on("console", (m) => {
  if (m.type() === "error") errs.push(m.text().slice(0, 160));
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

await page.goto(BASE + "?cb=1", { waitUntil: "domcontentloaded" });
await page.waitForSelector("textarea", { timeout: 8000 });
await page.evaluate(() => {
  localStorage.setItem("chat-demo:api-key", "sk-card-bind");
  localStorage.setItem(
    "chat-demo:characters",
    JSON.stringify([
      { id: "c1", name: "林工", persona: "你是冷轧工艺工程师，回答先给结论。", greeting: "" },
      { id: "c2", name: "报价助手", persona: "你只谈价格与账期。", greeting: "" }
    ])
  );
  localStorage.setItem("chat-demo:memory:c1", JSON.stringify([{ text: "林工记忆：上次报 5200 元每吨" }]));
  localStorage.setItem("chat-demo:memory:c2", JSON.stringify([{ text: "报价记忆：客户要 20 吨" }]));
  localStorage.removeItem("chat-demo:character-active");
  localStorage.removeItem("chat-demo:conv-char");
});
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("textarea", { timeout: 8000 });
await page.waitForTimeout(700);

const lastSystem = () => (bodies.length ? bodies[bodies.length - 1].system || "" : "");

async function newChat(pickId) {
  await page.getByText("开启新对话").first().click({ timeout: 5000 });
  await page.waitForSelector(".skp-sheet", { timeout: 4000 });
  await page.click(`.skp-opt[data-pick="${pickId}"]`);
  await page.waitForTimeout(700);
}

async function send(text) {
  const before = bodies.length;
  await page.fill("textarea", text);
  await page.click('button[aria-label="发送"]');
  await page.waitForFunction((n) => true, null, { timeout: 1000 }).catch(() => {});
  for (let i = 0; i < 40 && bodies.length === before; i++) await page.waitForTimeout(150);
  await page.waitForTimeout(600);
  return lastSystem();
}

/* 1. 新对话弹出角色选择 */
await page.getByText("开启新对话").first().click({ timeout: 5000 });
await page.waitForSelector(".skp-sheet", { timeout: 4000 });
const opts = await page.locator(".skp-opt").allInnerTexts();
mark(
  "新对话时弹出角色选择",
  opts.length === 3 && opts.some((o) => o.includes("林工")) && opts.some((o) => o.includes("不使用角色")),
  opts.map((o) => o.replace(/\s+/g, " ")).join(" / ")
);

/* 2. 选林工开新对话 */
await page.click('.skp-opt[data-pick="c1"]');
await page.waitForTimeout(800);
const sys1 = await send("林工你好，报个价");
mark(
  "选角色后注入该角色设定与记忆",
  /林工/.test(sys1) && /冷轧工艺工程师/.test(sys1) && /5200/.test(sys1),
  sys1.replace(/\n/g, " ").slice(0, 70)
);
mark("不串入其他角色记忆", !/20 吨/.test(sys1), "未包含报价助手的记忆");

/* 3. 换一个角色开新对话 */
await newChat("c2");
const sys2 = await send("报价助手，客户要 20 吨");
mark(
  "不同角色记忆相互隔离",
  /报价助手/.test(sys2) && /20 吨/.test(sys2) && !/5200/.test(sys2),
  sys2.replace(/\n/g, " ").slice(0, 70)
);

/* 4. 回到第一个对话，绑定应恢复 */
const items = page.locator(".sider-ac14ac .item-ff6fc9");
const count = await items.count();
mark("侧栏存在多个会话", count >= 2, count + " 个");
await items.nth(count - 1).click();
await page.waitForTimeout(1200);
const sys3 = await send("再确认一下价格");
mark(
  "回到旧对话恢复原角色",
  /林工/.test(sys3) && /5200/.test(sys3) && !/20 吨/.test(sys3),
  sys3.replace(/\n/g, " ").slice(0, 70)
);

/* 5. 新增记忆在新对话生效 */
const map = await page.evaluate(() => JSON.parse(localStorage.getItem("chat-demo:conv-char") || "{}"));
const vals = Object.values(map);
mark("会话与角色的绑定已持久化", vals.length >= 2 && vals.indexOf("c1") > -1 && vals.indexOf("c2") > -1, JSON.stringify(vals));

await page.evaluate(() => {
  const mem = JSON.parse(localStorage.getItem("chat-demo:memory:c1") || "[]");
  mem.push({ text: "新增记忆：账期改为 45 天" });
  localStorage.setItem("chat-demo:memory:c1", JSON.stringify(mem));
});
await newChat("c1");
const sys4 = await send("账期多少");
mark(
  "新增记忆在后续对话生效",
  /45 天/.test(sys4) && /5200/.test(sys4),
  sys4.replace(/\n/g, " ").slice(-60)
);

/* 6. 不使用角色 */
await newChat("");
const sys5 = await send("随便聊聊");
mark("可选不使用角色", !/角色设定/.test(sys5), "system 长度 " + sys5.length);

mark("无 JS 运行时错误", errs.length === 0, errs.slice(0, 1).join(" | "));
await page.screenshot({ path: "e2e/artifacts/card-bind.png" });
await browser.close();
const failed = res.filter((r) => !r.ok);
console.log(`\n结果：${res.length - failed.length}/${res.length} 通过`);
process.exit(failed.length ? 1 : 0);
