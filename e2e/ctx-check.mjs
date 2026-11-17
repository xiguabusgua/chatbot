/**
 * 右侧上下文边栏验证
 * 运行：node e2e/ctx-check.mjs
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

const ymd = (d) => d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
const today = new Date();
const y1 = ymd(new Date(today.getTime() - 86400000));
const y2 = ymd(new Date(today.getTime() - 2 * 86400000));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1240, height: 900 }, locale: "zh-CN" });
const page = await ctx.newPage();
await (page.context()).addInitScript(() => { try { localStorage.setItem("chat-demo:onboarded", "1"); } catch (e) {} });
const errs = [];
page.on("pageerror", (e) => errs.push((e.stack || e.message).slice(0, 300)));
page.on("console", (m) => {
  if (m.type() === "error") errs.push(m.text().slice(0, 160));
});
await page.route("**/api.deepseek.com/anthropic/v1/messages", (r) =>
  r.fulfill({ status: 200, headers: { "content-type": "text/event-stream; charset=utf-8", "access-control-allow-origin": "*" }, body: SSE })
);

await page.goto(BASE + "?ctx=1", { waitUntil: "domcontentloaded" });
await page.waitForSelector("textarea", { timeout: 8000 });
await page.evaluate(
  ({ d1, d2 }) => {
    localStorage.setItem("chat-demo:api-key", "sk-ctx");
    localStorage.setItem(
      "chat-demo:characters",
      JSON.stringify([{ id: "c1", name: "林工", persona: "资深冷轧工艺工程师，先给结论再给参数。" }])
    );
    localStorage.setItem("chat-demo:character-active", "c1");
    localStorage.setItem(
      "chat-demo:memory:c1",
      JSON.stringify(
        Array.from({ length: 8 }, (_, i) => ({ text: "记忆条目 " + (i + 1), at: Date.now() }))
      )
    );
    localStorage.setItem(
      "chat-demo:daily-index",
      JSON.stringify([
        { date: d1, chars: 180 },
        { date: d2, chars: 96 }
      ])
    );
    localStorage.removeItem("chat-demo:conv-char");
  },
  { d1: y1, d2: y2 }
);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("textarea", { timeout: 8000 });
await page.waitForTimeout(800);

/* 1. 按钮与打开 */
const btn = page.locator("#sk-ctx-btn");
mark("右侧有上下文入口", (await btn.count()) === 1, await btn.getAttribute("aria-label"));
await btn.click();
await page.waitForTimeout(400);
const open = await page.evaluate(() => {
  const p = document.querySelector("#sk-ctx");
  const r = p.getBoundingClientRect();
  return {
    hidden: p.classList.contains("is-hidden"),
    right: Math.round(window.innerWidth - r.right),
    width: Math.round(r.width),
    expand: document.querySelector("#sk-ctx-btn").getAttribute("aria-expanded")
  };
});
mark("点击后在右侧展开", !open.hidden && open.right === 0 && open.expand === "true", `宽 ${open.width}px，右贴边 ${open.right}px`);

/* 2. 首次未发消息时的空态 */
const beforeSend = await page.locator("#sk-ctx").innerText();
mark("未发消息时给出提示", /发一条消息后显示/.test(beforeSend), beforeSend.replace(/\s+/g, " ").slice(0, 40));

/* 3. 发送后刷新内容 */
await page.fill("textarea", "起浪怎么调");
await page.click('button[aria-label="发送"]');
await page.waitForTimeout(2000);
const body = await page.locator("#sk-ctx").innerText();
mark("显示当前角色", /林工/.test(body) && /资深冷轧工艺工程师/.test(body), "");
mark("长期记忆分组与计数", /长期记忆/.test(body) && /8\s*条/.test(body), body.match(/长期记忆[^]{0,12}/)?.[0] || "");
mark("超出 6 条折叠提示", /\+2\s*条/.test(body), "");
mark("按天记忆按日期列出", body.indexOf(y1) > -1 && body.indexOf(y2) > -1, "");
mark("注入概览显示 system 字数", /系统提示词/.test(body) && /[1-9]\d*\s*字/.test(body), body.match(/系统提示词\s*\n?\s*(\d+)\s*字/)?.[0] || "");

/* 4. 层级与去重：标题只出现一次 */
const secs = await page.locator("#sk-ctx .skc-sec").count();
mark("分组数量固定为 4", secs === 4, secs + " 个分组");

/* 5. 关闭 */
await page.click("#sk-ctx .skc-close");
await page.waitForTimeout(350);
const closed = await page.evaluate(() => ({
  hidden: document.querySelector("#sk-ctx").classList.contains("is-hidden"),
  expand: document.querySelector("#sk-ctx-btn").getAttribute("aria-expanded")
}));
mark("可关闭且状态同步", closed.hidden && closed.expand === "false", "");

/* 6. 打开设置时不会遮挡设置层 */
await page.getByText("设置", { exact: true }).last().click({ timeout: 5000 });
await page.waitForSelector("#sk-settings", { timeout: 4000 });
const zorder = await page.evaluate(() => {
  const s = document.querySelector("#sk-settings");
  const b = document.querySelector("#sk-ctx-btn");
  return {
    settingsZ: getComputedStyle(s).zIndex,
    btnZ: getComputedStyle(b).zIndex
  };
});
mark("设置层仍在上层", Number(zorder.settingsZ) > Number(zorder.btnZ), JSON.stringify(zorder));

mark("无 JS 运行时错误", errs.length === 0, errs.slice(0, 1).join(" | "));
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
await page.screenshot({ path: "e2e/artifacts/ctx-panel.png" });
await browser.close();
const failed = res.filter((r) => !r.ok);
console.log(`\n结果：${res.length - failed.length}/${res.length} 通过`);
process.exit(failed.length ? 1 : 0);
