/** 基础项验证：内存缓存层 / 角色性格+头像字段 / 点击头像进详情 / system 注入 */
import { chromium } from "playwright";
const BASE = "http://127.0.0.1:8123/";
const browser = await chromium.launch();
const out = [];
function log(name, ok, detail) { out.push({ name, ok }); console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? " → " + detail : ""}`); }

const SSE_BODY = [
  'event: message_start',
  'data: {"type":"message_start","message":{"id":"m1","type":"message","role":"assistant","model":"deepseek-flash","content":[]}}',
  '',
  'event: content_block_start',
  'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
  '',
  'event: content_block_delta',
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"ok"}}',
  '',
  'event: content_block_stop',
  'data: {"type":"content_block_stop","index":0}',
  '',
  'event: message_stop',
  'data: {"type":"message_stop"}',
  '', ''
].join("\n");

// ===== A. 角色字段 UI 与存储 =====
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-CN" });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try { localStorage.setItem("chat-demo:onboarded", "1"); localStorage.removeItem("chat-demo:characters"); }
    catch (e) {}
  });
  await page.route("**/api.deepseek.com/**", (r) => r.abort());
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await page.getByText("设置", { exact: true }).last().click({ timeout: 5000 });
  await page.waitForSelector("#sk-settings", { timeout: 5000 });
  await page.locator('#sk-settings [data-act="data"]').click(); await page.waitForTimeout(150);
  await page.locator('#sk-settings [data-act="characters"]').click(); await page.waitForTimeout(150);
  await page.locator('#sk-settings [data-act="char-new"]').click(); await page.waitForTimeout(150);
  await page.locator('#sk-settings [data-field="name"]').fill("测试角色");
  await page.locator('#sk-settings [data-field="personality"]').fill("外向、毒舌");
  await page.locator('#sk-settings [data-field="persona"]').fill("你是一名工程师");
  await page.locator('#sk-settings [data-act="char-save"]').click(); await page.waitForTimeout(200);
  const chars = await page.evaluate(() => JSON.parse(localStorage.getItem("chat-demo:characters") || "[]"));
  log("角色卡保存性格字段", chars.length === 1 && chars[0].personality === "外向、毒舌", JSON.stringify(chars[0]));
  log("角色列表带头像占位", (await page.locator('#sk-settings .sk-char-row .sk-char-avatar').count()) > 0);
  await page.locator('#sk-settings .sk-char-row .sk-char-avatar').first().click(); await page.waitForTimeout(200);
  log("点击头像进入详情页", (await page.locator('#sk-settings [data-field="personality"]').count()) > 0);
  const loaded = await page.locator('#sk-settings [data-field="personality"]').inputValue();
  log("详情页回显性格", loaded === "外向、毒舌", loaded);
  await ctx.close();
}

// ===== B. system 注入 + 角色标签 + 缓存命中 =====
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-CN" });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try {
      localStorage.setItem("chat-demo:onboarded", "1");
      localStorage.setItem("chat-demo:characters", JSON.stringify([
        { id: "cx", name: "注入测试", personality: "外向、毒舌", persona: "工程师", greeting: "", avatar: "" }
      ]));
      localStorage.setItem("chat-demo:character-active", "cx");
      localStorage.setItem("chat-demo:active-char", JSON.stringify({ id: "cx", name: "注入测试" }));
      localStorage.setItem("chat-demo:api-key", "sk-base-test");
    } catch (e) {}
  });
  let systemText = "";
  await page.route("**/api.deepseek.com/**", (r) => r.abort());
  await page.route("**/anthropic/v1/messages", (route) => {
    systemText = JSON.parse(route.request().postData() || "{}").system || "";
    route.fulfill({ status: 200, headers: { "content-type": "text/event-stream", "access-control-allow-origin": "*" }, body: SSE_BODY });
  });
  await page.goto(BASE + "?role=1", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1400);
  log("输入框显示角色标签", (await page.locator("#sk-char-badge").count()) > 0);
  await page.fill("textarea", "你好");
  await page.click('button[aria-label="发送"]');
  await page.waitForTimeout(1800);
  log("system 注入性格字段", systemText.includes("性格特点") && systemText.includes("外向、毒舌"), systemText.slice(0, 110));
  await page.evaluate(() => { const b = document.querySelector("#sk-ctx-btn"); if (b) b.click(); });
  await page.waitForTimeout(250);
  const cacheTxt = await page.locator("#sk-ctx").textContent();
  log("上下文边栏显示缓存命中", /缓存命中|Cache hits/.test(cacheTxt), (cacheTxt.match(/.{0,6}命中.{0,6}/) || [""])[0]);
  await ctx.close();
}

await browser.close();
const failed = out.filter(x => !x.ok);
console.log(`\n结果: ${out.length - failed.length}/${out.length} 通过`);
process.exit(failed.length ? 1 : 0);