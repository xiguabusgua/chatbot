/**
 * 余额查询 + 角色卡 + 对话记忆 验证
 * 运行：node e2e/role-check.mjs
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
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"好的，收到。"}}',
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
const ctx = await browser.newContext({ viewport: { width: 1180, height: 950 }, locale: "zh-CN" });
const page = await ctx.newPage();
await (page.context()).addInitScript(() => { try { localStorage.setItem("chat-demo:onboarded", "1"); } catch (e) {} });
const errs = [];
page.on("pageerror", (e) => errs.push(e.message.slice(0, 160)));
page.on("console", (m) => {
  if (m.type() === "error") errs.push(m.text().slice(0, 160));
});

let balanceMode = "ok";
const chatBodies = [];

await page.route("**/user/balance", (route) => {
  if (balanceMode === "401") {
    return route.fulfill({
      status: 401,
      headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
      body: JSON.stringify({ error: { message: "Authentication Fails" } })
    });
  }
  return route.fulfill({
    status: 200,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
    body: JSON.stringify({
      is_available: true,
      balance_infos: [
        { currency: "CNY", total_balance: "110.00", granted_balance: "10.00", topped_up_balance: "100.00" }
      ]
    })
  });
});

await page.route("**/api.deepseek.com/anthropic/v1/messages", async (route) => {
  chatBodies.push(JSON.parse(route.request().postData() || "{}"));
  await route.fulfill({
    status: 200,
    headers: { "content-type": "text/event-stream; charset=utf-8", "access-control-allow-origin": "*" },
    body: SSE
  });
});

await page.goto(BASE + "?role=1", { waitUntil: "domcontentloaded" });
await page.waitForSelector("textarea", { timeout: 8000 });
await page.evaluate(() => {
  localStorage.setItem("chat-demo:api-key", "sk-role-test");
  localStorage.removeItem("chat-demo:characters");
  localStorage.removeItem("chat-demo:character-active");
});
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("textarea", { timeout: 8000 });
await page.waitForTimeout(700);

async function openSettings() {
  if (!(await page.locator("#sk-settings").count())) {
    await page.getByText("设置", { exact: true }).last().click({ timeout: 5000 });
    await page.waitForSelector("#sk-settings", { timeout: 5000 });
  }
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

/* 1. 余额 */
await openSettings();
await page.click('#sk-settings [data-act="account"]');
await page.waitForSelector('#sk-settings [data-act="check-balance"]', { timeout: 3000 });
await page.click('#sk-settings [data-act="check-balance"]');
await page.waitForTimeout(900);
const bal = await page.evaluate(() => {
  const root = document.querySelector("#sk-settings");
  return {
    text: root.innerText.replace(/\s+/g, " ").slice(0, 160),
    amount: root.querySelector(".sk-bal-num")?.textContent
  };
});
mark("余额查询成功并展示金额", bal.amount === "¥110.00", bal.text.slice(0, 70));

/* 2. 余额 401 */
balanceMode = "401";
await page.click('#sk-settings [data-act="check-balance"]');
await page.waitForTimeout(900);
const balErr = await page.evaluate(() => document.querySelector("#sk-settings .sk-err")?.textContent || "");
mark("密钥无效时给出错误提示", /无效|过期/.test(balErr), balErr);
balanceMode = "ok";

/* 3. 新建角色卡 */
await page.locator("#sk-settings .sk-back").click();
await page.waitForTimeout(250);
await page.click('#sk-settings [data-act="data"]');
await page.waitForSelector('#sk-settings [data-act="characters"]', { timeout: 3000 });
await page.click('#sk-settings [data-act="characters"]');
await page.waitForSelector('#sk-settings [data-act="char-new"]', { timeout: 3000 });
const emptyText = await page.locator("#sk-settings").innerText();
await page.click('#sk-settings [data-act="char-new"]');
await page.waitForSelector('#sk-settings [data-field="name"]', { timeout: 3000 });
await page.fill('#sk-settings [data-field="name"]', "林工");
await page.fill('#sk-settings [data-field="persona"]', "你是资深冷轧工艺工程师，说话简短，先给结论再给参数。");
await page.fill('#sk-settings [data-field="greeting"]', "说吧，这次遇到什么问题？");
await page.click('#sk-settings [data-act="char-save"]');
await page.waitForTimeout(500);
const listText = await page.locator("#sk-settings").innerText();
mark("可新建角色卡", /林工/.test(listText) && /还没有角色卡/.test(emptyText), listText.replace(/\s+/g, " ").slice(0, 50));

/* 4. 设为当前角色 */
await page.getByText("林工", { exact: true }).first().click();
await page.waitForSelector('#sk-settings [data-act="char-use"]', { timeout: 3000 });
await page.click('#sk-settings [data-act="char-use"]');
await page.waitForTimeout(400);
const activeId = await page.evaluate(() => localStorage.getItem("chat-demo:character-active"));
mark("可设为当前角色", !!activeId, "active=" + activeId);

/* 5. 注入角色设定 */
await page.locator("#sk-settings .sk-back").click();
await page.waitForTimeout(300);
await closeSettings();
await page.waitForTimeout(300);
await page.fill("textarea", "这批 0.5mm 冷轧板起浪怎么调");
await page.click('button[aria-label="发送"]');
await page.waitForTimeout(1800);
const sys1 = chatBodies.length ? chatBodies[chatBodies.length - 1].system || "" : "";
mark(
  "角色设定注入请求 system",
  /角色设定/.test(sys1) && /林工/.test(sys1) && /冷轧工艺工程师/.test(sys1),
  sys1.replace(/\n/g, " ").slice(0, 60)
);

/* 6. 添加记忆并注入 */
await openSettings();
await page.click('#sk-settings [data-act="data"]');
await page.waitForTimeout(250);
await page.click('#sk-settings [data-act="memory"]');
await page.waitForSelector('#sk-settings [data-field="memory"]', { timeout: 3000 });
await page.fill('#sk-settings [data-field="memory"]', "用户做冷轧板材生意，关心报价与账期");
await page.click('#sk-settings [data-act="mem-add"]');
await page.waitForTimeout(500);
const memCount = await page.evaluate(
  () => JSON.parse(localStorage.getItem("chat-demo:memory:" + localStorage.getItem("chat-demo:character-active")) || "[]").length
);
mark("可添加记忆条目", memCount === 1, memCount + " 条");

await closeSettings();
await page.waitForTimeout(300);
await page.fill("textarea", "再报一次价");
await page.click('button[aria-label="发送"]');
await page.waitForTimeout(1800);
const sys2 = chatBodies.length ? chatBodies[chatBodies.length - 1].system || "" : "";
mark("记忆注入请求 system", /长期记忆/.test(sys2) && /报价与账期/.test(sys2), sys2.replace(/\n/g, " ").slice(-60));

/* 7. 自动记录 */
await openSettings();
await page.click('#sk-settings [data-act="data"]');
await page.waitForTimeout(250);
await page.click('#sk-settings [data-act="memory"]');
await page.waitForSelector('#sk-settings [data-act="mem-auto"]', { timeout: 3000 });
await page.click('#sk-settings [data-act="mem-auto"]');
await page.waitForTimeout(300);
await closeSettings();
await page.waitForTimeout(300);
await page.fill("textarea", "记一下：下周要交 20 吨");
await page.click('button[aria-label="发送"]');
await page.waitForTimeout(1800);
const memAfter = await page.evaluate(
  () => JSON.parse(localStorage.getItem("chat-demo:memory:" + localStorage.getItem("chat-demo:character-active")) || "[]").length
);
mark("自动记录对话进记忆", memAfter === 2, memAfter + " 条");

/* 8. 取消角色后不再注入 */
await openSettings();
await page.click('#sk-settings [data-act="data"]');
await page.waitForTimeout(250);
await page.click('#sk-settings [data-act="characters"]');
await page.getByText("林工", { exact: true }).first().click();
await page.waitForSelector('#sk-settings [data-act="char-use"]', { timeout: 3000 });
await page.click('#sk-settings [data-act="char-use"]');
await page.waitForTimeout(300);
await closeSettings();
await page.waitForTimeout(300);
await page.fill("textarea", "普通提问");
await page.click('button[aria-label="发送"]');
await page.waitForTimeout(1800);
const sys3 = chatBodies.length ? chatBodies[chatBodies.length - 1].system || "" : "";
mark("取消角色后恢复默认提示词", !/角色设定/.test(sys3), "system 长度 " + sys3.length);

const realErrs = errs.filter((e) => !/status of 401/i.test(e));
mark("无 JS 运行时错误", realErrs.length === 0, realErrs.slice(0, 2).join(" | "));
await page.screenshot({ path: "e2e/artifacts/role-final.png" });
await browser.close();
const failed = res.filter((r) => !r.ok);
console.log(`\n结果：${res.length - failed.length}/${res.length} 通过`);
process.exit(failed.length ? 1 : 0);
