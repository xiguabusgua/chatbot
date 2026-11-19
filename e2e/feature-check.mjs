/** 价格表 / URL 导入面板 验证 */
import { chromium } from "playwright";
const BASE = "http://127.0.0.1:8123/";
const browser = await chromium.launch();
const out = [];
function log(name, ok, detail) { out.push({ name, ok }); console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? " → " + detail : ""}`); }

async function openSettings(page) {
  await page.getByText("设置", { exact: true }).last().click({ timeout: 5000 });
  await page.waitForSelector("#sk-settings", { timeout: 5000 });
}

// ===== A. URL 导入：面板 / 校验 / 下载+DataTransfer 注入 =====
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-CN" });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem("chat-demo:onboarded", "1"); } catch (e) {} });
  await page.route("**/api.deepseek.com/**", (r) => r.abort());
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await openSettings(page);
  await page.locator('#sk-settings [data-act="data"]').click(); await page.waitForTimeout(150);
  log("数据页有从链接导入入口", (await page.locator('#sk-settings [data-act="import-url"]').count()) > 0);
  await page.locator('#sk-settings [data-act="import-url"]').click(); await page.waitForTimeout(150);
  log("URL 导入面板弹出", (await page.locator(".sk-iu-box").count()) > 0);
  log("URL 输入框存在", (await page.locator(".sk-iu-input").count()) > 0);
  await page.locator(".sk-iu-input").fill("not-a-url");
  await page.locator('[data-iu="go"]').click(); await page.waitForTimeout(150);
  log("非法 URL 被拒绝", (await page.locator(".sk-iu-box").count()) > 0);
  await page.locator('[data-iu="cancel"]').click(); await page.waitForTimeout(100);
  log("取消关闭面板", (await page.locator(".sk-iu-box").count()) === 0);

  const zipBytes = Buffer.from("PK0304mockzipbytes", "binary");
  await page.route("**/backup.zip", (r) => r.fulfill({ status: 200, headers: { "content-type": "application/zip", "access-control-allow-origin": "*" }, body: zipBytes }));
  await page.evaluate(() => {
    document.addEventListener("change", function (e) {
      if (e.target && e.target.type === "file" && e.target.files && e.target.files[0]) {
        window.__injectedFile = e.target.files[0].name;
        // 阻止原应用解析假 ZIP：把 files 置空不可行(只读)，直接移除监听无效；改为不抛错即可
      }
    }, true);
  });
  await page.locator('#sk-settings [data-act="import-url"]').click(); await page.waitForTimeout(100);
  await page.locator(".sk-iu-input").fill(BASE + "backup.zip");
  await page.locator('[data-iu="go"]').click(); await page.waitForTimeout(600);
  const injectedName = await page.evaluate(() => window.__injectedFile || "");
  log("合法URL下载并注入file input", injectedName.indexOf("backup.zip") > -1, injectedName);
  await ctx.close(); // 原应用随后解析假 ZIP 会崩，关闭即可
}

// ===== B. 价格表：渲染 / 真实价格 / 编辑保存 =====
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-CN" });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem("chat-demo:onboarded", "1"); localStorage.removeItem("chat-demo:api-prices"); } catch (e) {} });
  await page.route("**/api.deepseek.com/**", (r) => r.abort());
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await openSettings(page);
  await page.locator('#sk-settings [data-act="account"]').click(); await page.waitForTimeout(150);
  log("余额页有价格表入口", (await page.locator('#sk-settings [data-act="prices"]').count()) > 0);
  await page.locator('#sk-settings [data-act="prices"]').click(); await page.waitForTimeout(150);
  log("价格表渲染2个模型", (await page.locator("#sk-settings .sk-price-model").count()) === 2);
  const ptext = await page.locator("#sk-settings .sk-price-grid").first().textContent();
  log("价格表含官网真实价格", ptext.includes("0.006") && ptext.includes("1.2"), ptext.slice(0, 100));
  await page.locator('#sk-settings [data-act="price-edit"]').click(); await page.waitForTimeout(150);
  log("价格编辑页12个输入", (await page.locator("#sk-settings [data-price]").count()) === 12);
  await page.locator('#sk-settings [data-price="0-peak-hit"]').fill("0.009");
  await page.locator('#sk-settings [data-act="price-save"]').click(); await page.waitForTimeout(200);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("chat-demo:api-prices") || "{}"));
  log("价格编辑保存生效", saved.models && saved.models[0].peak.hit === 0.009, JSON.stringify(saved.models && saved.models[0].peak));
  await ctx.close();
}

await browser.close();
const failed = out.filter(x => !x.ok);
console.log(`\n结果: ${out.length - failed.length}/${out.length} 通过`);
process.exit(failed.length ? 1 : 0);
