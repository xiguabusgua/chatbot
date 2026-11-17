/** 验证 DSH 风格首次引导：分步渲染、外观/配色切换、Key 保存、跳过、不再重复 */
import { chromium } from "playwright";
const BASE = "http://127.0.0.1:8123/";
const out = [];
function log(name, ok, detail) {
  out.push({ name, ok });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? " → " + detail : ""}`);
}

const browser = await chromium.launch();

// ---- 场景 1：完整走一遍引导 ----
{
  const ctx = await browser.newContext({ viewport: { width: 420, height: 860 }, locale: "zh-CN" });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);

  log("首次打开显示引导层", (await page.locator("#sk-ob").count()) === 1);
  log("第 1 步欢迎标题", (await page.locator("#sk-ob .sk-ob-head h1").innerText()).includes("欢迎使用"));

  // 下一步 → 外观
  await page.locator('#sk-ob [data-ob="next"]').click();
  await page.waitForTimeout(200);
  log("第 2 步外观选择", (await page.locator("#sk-ob .sk-ob-choice").count()) === 3);
  await page.locator('#sk-ob [data-ob="theme"][data-value="dark"]').click();
  await page.waitForTimeout(150);
  log("切深色即时生效", (await page.evaluate(() => localStorage.getItem("chat-demo:theme-preference"))) === "dark");
  log("引导层跟到深色", (await page.locator("#sk-ob.sk-ob-dark").count()) === 1);
  await page.locator('#sk-ob [data-ob="color"][data-value="mint"]').click();
  await page.waitForTimeout(150);
  log("主题配色写入", (await page.evaluate(() => localStorage.getItem("chat-demo:bubble-color"))) === "mint");

  // 下一步 → 连接
  await page.locator('#sk-ob [data-ob="next"]').click();
  await page.waitForTimeout(200);
  log("第 3 步连接标题", (await page.locator("#sk-ob .sk-ob-head h1").innerText()).includes("连接"));
  await page.locator('#sk-ob [data-ob="key"]').fill("sk-test123456");
  await page.locator('#sk-ob [data-ob="save-key"]').click();
  await page.waitForTimeout(200);
  log("API Key 保存", (await page.evaluate(() => localStorage.getItem("chat-demo:api-key"))) === "sk-test123456");

  // 第 4 步 → 完成
  log("第 4 步准备就绪", (await page.locator("#sk-ob .sk-ob-head h1").innerText()).includes("准备就绪"));
  await page.locator('#sk-ob [data-ob="finish"]').click();
  await page.waitForTimeout(1600); // 等 reload
  log("完成后引导层消失", (await page.locator("#sk-ob").count()) === 0);
  log("记录已完成标记", (await page.evaluate(() => localStorage.getItem("chat-demo:onboarded"))) === "1");

  // 刷新不再出现
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  log("再次打开不再显示引导", (await page.locator("#sk-ob").count()) === 0);
  await ctx.close();
}

// ---- 场景 2：跳过引导 ----
{
  const ctx = await browser.newContext({ viewport: { width: 420, height: 860 }, locale: "en-US" });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  log("英文欢迎文案", (await page.locator("#sk-ob .sk-ob-head h1").innerText()).includes("Welcome"));
  await page.locator('#sk-ob [data-ob="skip"]').first().click();
  await page.waitForTimeout(500);
  log("跳过后引导消失", (await page.locator("#sk-ob").count()) === 0);
  log("跳过也记录标记", (await page.evaluate(() => localStorage.getItem("chat-demo:onboarded"))) === "1");
  await ctx.close();
}

await browser.close();
const failed = out.filter((x) => !x.ok);
console.log(`\n结果: ${out.length - failed.length}/${out.length} 通过`);
process.exit(failed.length ? 1 : 0);
