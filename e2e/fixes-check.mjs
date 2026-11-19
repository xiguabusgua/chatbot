/** 11.19 修复项验证：气泡预览配色不误伤容器 + 输入框角色标签 */
import { chromium } from "playwright";
const BASE = "http://127.0.0.1:8123/";
const browser = await chromium.launch();
const out = [];
function log(name, ok, detail) { out.push({ name, ok }); console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? " → " + detail : ""}`); }

// ===== 1. 气泡预览配色：容器不被染色 =====
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-CN" });
  const p = await ctx.newPage();
  await p.addInitScript(() => { try { localStorage.setItem("chat-demo:onboarded", "1"); localStorage.setItem("chat-demo:bubble-color", "sand"); } catch (e) {} });
  await p.route("**/api.deepseek.com/**", (r) => r.abort());
  await p.goto(BASE, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1200);
  await p.getByText("设置", { exact: true }).last().click({ timeout: 5000 });
  await p.waitForSelector("#sk-settings", { timeout: 5000 });
  for (let i = 0; i < 5; i++) { if (await p.locator('#sk-settings [data-act="account"]').count()) break; await p.locator("#sk-settings .sk-back").click().catch(()=>{}); await p.waitForTimeout(120); }
  await p.locator('#sk-settings [data-act="personalize"]').click();
  await p.waitForTimeout(200);
  const r = await p.evaluate(() => {
    const wrap = document.querySelector("#sk-settings .sk-bubble-preview");
    const bub = document.querySelector("#sk-settings .sk-bubble-demo");
    const wc = getComputedStyle(wrap).backgroundColor;
    const bc = getComputedStyle(bub).backgroundColor;
    return { wrapBg: wc, bubbleBg: bc };
  });
  const wrapTransparent = r.wrapBg === "rgba(0, 0, 0, 0)" || r.wrapBg === "transparent";
  log("气泡预览容器不被配色染色", wrapTransparent, JSON.stringify(r));
  log("气泡本身跟随配色(暖灰)", r.bubbleBg === "rgb(243, 236, 226)", r.bubbleBg);
  await ctx.close();
}

// ===== 2. 输入框角色标签 =====
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-CN" });
  const p = await ctx.newPage();
  await p.addInitScript(() => {
    try {
      localStorage.setItem("chat-demo:onboarded", "1");
      localStorage.setItem("chat-demo:characters", JSON.stringify([{ id: "c1", name: "小助手", persona: "友善", avatar: "" }]));
      if (!localStorage.getItem("__test_inited")) { localStorage.setItem("chat-demo:active-char", JSON.stringify({ id: "c1", name: "小助手" })); localStorage.setItem("__test_inited", "1"); }
    } catch (e) {}
  });
  await p.route("**/api.deepseek.com/**", (r) => r.abort());
  await p.goto(BASE, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1600);
  const badge = await p.locator("#sk-char-badge").count();
  log("输入框角色标签出现", badge > 0, "count=" + badge);
  if (badge) {
    const text = await p.locator("#sk-char-badge").textContent();
    log("角色标签显示角色名", text.includes("小助手"), text);
    const inWrapper = await p.evaluate(() => {
      const b = document.querySelector("#sk-char-badge");
      return !!(b && b.closest(".wrapper-ed6f47, .textareaWrapper-ed6f47"));
    });
    log("角色标签位于输入框容器内", inWrapper);
  }
  // 清除 active-char 后刷新，标签应消失
  await p.evaluate(() => localStorage.removeItem("chat-demo:active-char"));
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1400);
  log("清除角色后标签消失", (await p.locator("#sk-char-badge").count()) === 0);
  await ctx.close();
}

await browser.close();
const failed = out.filter(x => !x.ok);
console.log(`\n结果: ${out.length - failed.length}/${out.length} 通过`);
process.exit(failed.length ? 1 : 0);
