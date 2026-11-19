/** 世界书群聊场景 / 微信风格界面 验证 */
import { chromium } from "playwright";
const BASE = "http://127.0.0.1:8123/";
const browser = await chromium.launch();
const out = [];
function log(name, ok, detail) { out.push({ name, ok }); console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? " → " + detail : ""}`); }
const SSE = [
  'event: message_start', 'data: {"type":"message_start","message":{"id":"m1","type":"message","role":"assistant","model":"deepseek-flash","content":[]}}', '',
  'event: content_block_start', 'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}', '',
  'event: content_block_delta', 'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"ok"}}', '',
  'event: content_block_stop', 'data: {"type":"content_block_stop","index":0}', '',
  'event: message_stop', 'data: {"type":"message_stop"}', '', ''
].join("\n");

async function openSettings(page) {
  await page.getByText("设置", { exact: true }).last().click({ timeout: 5000 });
  await page.waitForSelector("#sk-settings", { timeout: 5000 });
  for (let i = 0; i < 5; i++) {
    if (await page.locator('#sk-settings [data-act="account"]').count()) break;
    await page.locator("#sk-settings .sk-back").click().catch(()=>{});
    await page.waitForTimeout(150);
  }
}

// ===== A. 世界书：自动创建 / 编辑 / system 注入在场成员 =====
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-CN" });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try {
      localStorage.setItem("chat-demo:onboarded", "1");
      localStorage.setItem("chat-demo:api-key", "sk-world");
      localStorage.removeItem("chat-demo:characters");
      localStorage.removeItem("chat-demo:worlds");
      localStorage.removeItem("chat-demo:character-active");
    } catch (e) {}
  });
  await page.route("**/api.deepseek.com/**", (r) => r.abort());
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await openSettings(page);
  await page.locator('#sk-settings [data-act="data"]').click(); await page.waitForTimeout(120);
  await page.locator('#sk-settings [data-act="characters"]').click(); await page.waitForTimeout(120);
  // 建角色 A
  await page.locator('#sk-settings [data-act="char-new"]').click(); await page.waitForTimeout(120);
  await page.locator('#sk-settings [data-field="name"]').fill("小林");
  await page.locator('#sk-settings [data-field="personality"]').fill("外向");
  await page.locator('#sk-settings [data-act="char-save"]').click(); await page.waitForTimeout(200);
  let worlds = await page.evaluate(() => JSON.parse(localStorage.getItem("chat-demo:worlds") || "[]"));
  log("建角色自动创建世界书", worlds.length === 1 && worlds[0].memberIds.length === 1, JSON.stringify(worlds));

  // 建角色 B
  await page.locator('#sk-settings [data-act="char-new"]').click(); await page.waitForTimeout(120);
  await page.locator('#sk-settings [data-field="name"]').fill("阿珍");
  await page.locator('#sk-settings [data-field="personality"]').fill("内向");
  await page.locator('#sk-settings [data-act="char-save"]').click(); await page.waitForTimeout(200);
  worlds = await page.evaluate(() => JSON.parse(localStorage.getItem("chat-demo:worlds") || "[]"));
  log("每个角色各有世界书", worlds.length === 2, "worlds=" + worlds.length);

  // 打开小林详情，编辑世界：加阿珍为成员 + 背景
  await page.locator('#sk-settings .sk-char-row').first().click(); await page.waitForTimeout(150);
  log("角色详情显示世界书编辑区", (await page.locator('#sk-settings [data-act="world-save"]').count()) > 0);
  await page.locator('#sk-settings [data-world-field="name"]').fill("深夜实验室");
  await page.locator('#sk-settings [data-world-field="background"]').fill("一间还亮着灯的材料实验室");
  // 勾选所有成员（含主角色）
  const boxes = page.locator("#sk-settings [data-world-member]");
  const cnt = await boxes.count();
  for (let i = 0; i < cnt; i++) await boxes.nth(i).check().catch(()=>{});
  await page.locator('#sk-settings [data-act="world-save"]').click(); await page.waitForTimeout(200);
  worlds = await page.evaluate(() => JSON.parse(localStorage.getItem("chat-demo:worlds") || "[]"));
  const wx = worlds.find(w => w.name === "深夜实验室");
  log("世界书编辑保存生效", !!wx && wx.background === "一间还亮着灯的材料实验室" && wx.memberIds.length === 2, JSON.stringify(wx));

  // 用小林作为主角色发消息，验证 system 注入场景 + 在场成员
  await page.evaluate(() => {
    const chars = JSON.parse(localStorage.getItem("chat-demo:characters") || "[]");
    const lin = chars.find(c => c.name === "小林");
    localStorage.setItem("chat-demo:character-active", lin.id);
  });
  let sys = "";
  await page.route("**/anthropic/v1/messages", (r) => { sys = JSON.parse(r.request().postData() || "{}").system || ""; r.fulfill({ status:200, headers:{"content-type":"text/event-stream","access-control-allow-origin":"*"}, body:SSE }); });
  for (let i = 0; i < 6; i++) { if (!(await page.locator('#sk-settings').count())) break; await page.locator('#sk-settings .sk-back').click().catch(()=>{}); await page.waitForTimeout(150); }
  await page.waitForTimeout(200);
  // 若设置仍在，点 close
  if (await page.locator('#sk-settings').count()) await page.evaluate(()=>{document.querySelector('#sk-settings [data-act="close"]')?.click();});
  await page.waitForTimeout(200);
  await page.fill("textarea", "在吗"); await page.click('button[aria-label="发送"]').catch(()=>{});
  await page.waitForTimeout(1500);
  log("system 注入群聊场景", sys.includes("群聊场景") && sys.includes("深夜实验室"), sys.slice(0, 80));
  log("system 注入在场成员设定", sys.includes("在场的其他成员") && sys.includes("阿珍"), sys.includes("阿珍") ? "含阿珍" : "缺阿珍");
  await ctx.close();
}

// ===== B. 微信风格开关 =====
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-CN" });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem("chat-demo:onboarded", "1"); } catch (e) {} });
  await page.route("**/api.deepseek.com/**", (r) => r.abort());
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await openSettings(page);
  await page.locator('#sk-settings [data-act="personalize"]').click(); await page.waitForTimeout(120);
  log("个性化页有微信风格开关", (await page.locator('#sk-settings [data-act="toggle-wechat"]').count()) > 0);
  await page.locator('#sk-settings [data-act="toggle-wechat"]').click(); await page.waitForTimeout(150);
  log("开启后 body 带标记", (await page.evaluate(() => document.body.getAttribute("data-sk-wechat"))) === "on");
  const on = await page.evaluate(() => !!localStorage.getItem("chat-demo:wechat-mode"));
  log("微信模式持久化", on);
  await page.locator('#sk-settings [data-act="toggle-wechat"]').click(); await page.waitForTimeout(150);
  log("关闭后移除标记", (await page.evaluate(() => document.body.getAttribute("data-sk-wechat"))) === null);
  await ctx.close();
}

await browser.close();
const failed = out.filter(x => !x.ok);
console.log(`\n结果: ${out.length - failed.length}/${out.length} 通过`);
process.exit(failed.length ? 1 : 0);