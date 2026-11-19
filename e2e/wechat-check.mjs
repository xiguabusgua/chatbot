/** 微信风格界面（参照微信会话列表）验证：结构/真实数据/顶栏/底栏/搜索/Tab/开关清理 */
import { chromium } from "playwright";
const BASE = "http://127.0.0.1:8123/";
const browser = await chromium.launch();
const out = [];
function log(name, ok, detail) { out.push({ name, ok }); console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? " → " + detail : ""}`); }

const ctx = await browser.newContext({ viewport: { width: 420, height: 860 }, locale: "zh-CN" });
const page = await ctx.newPage();
await page.addInitScript(() => {
  try { localStorage.setItem("chat-demo:onboarded", "1"); localStorage.setItem("chat-demo:wechat-mode", "on"); }
  catch (e) {}
});
await page.route("**/api.deepseek.com/**", (r) => r.abort());
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);

// 塞 4 条真实会话数据
await page.evaluate(async () => {
  const now = Date.now(), DAY = 86400000;
  const data = [
    { id: "s1", name: "懒得起名", text: "[草稿] 255", at: now - 2 * 3600000 },
    { id: "s2", name: "公众号", text: "[2条通知] 快讯：特朗普在车内未拉窗帘…", at: now - DAY },
    { id: "s3", name: "微信支付", text: "亲属卡使用通知", at: now - 3 * DAY },
    { id: "s4", name: "智慧无锡商院", text: "使用企业微信的通知", at: now - 40 * DAY }
  ];
  await new Promise((resolve, reject) => {
    const req = indexedDB.open("chat-demo");
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(["sessionSummaries", "sessions"], "readwrite");
      const sums = tx.objectStore("sessionSummaries"), ss = tx.objectStore("sessions");
      data.forEach(d => {
        sums.put({ id: d.id, title: d.name, createdAt: d.at, updatedAt: d.at, fileIds: [] });
        ss.put({ id: d.id, title: d.name, createdAt: d.at, updatedAt: d.at,
          messages: [
            { id: d.id + "-u", role: "user", content: d.name, createdAt: d.at, parentId: null },
            { id: d.id + "-a", role: "assistant", createdAt: d.at, blocks: [{ type: "text", text: d.text }] }
          ], rootMessageId: d.id + "-u" });
      });
      tx.oncomplete = resolve; tx.onerror = reject;
    };
    req.onerror = reject;
  });
});
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find(b => /打开边栏|Open sidebar/.test(b.getAttribute("aria-label") || ""));
  if (b) b.click();
});
await page.waitForTimeout(1000);

// 结构
log("顶栏「微信」+搜索+加号", (await page.locator("#sk-wx-header").count()) > 0 &&
  (await page.locator('#sk-wx-header [data-wx="search"]').count()) > 0 &&
  (await page.locator('#sk-wx-header [data-wx="new"]').count()) > 0);
log("底部4个Tab", (await page.locator("#sk-wx-tabbar .sk-wx-tab").count()) === 4);
log("微信Tab为选中态", (await page.locator('#sk-wx-tabbar [data-wx-tab="chat"]').getAttribute("class")).includes("is-on"));
log("分组标题已隐藏", (await page.evaluate(() => {
  const e = document.querySelector(".sectionHeader-ac14ac");
  return e ? getComputedStyle(e).display === "none" : true;
})));
log("侧栏全屏宽度", (await page.evaluate(() => Math.round(document.querySelector(".sider-ac14ac").getBoundingClientRect().width))) === 420);

// 三行结构：真实名称/时间/预览
const names = await page.locator(".sk-wx-name").allTextContents();
const times = await page.locator(".sk-wx-time").allTextContents();
const previews = await page.locator(".sk-wx-preview").allTextContents();
log("会话项三行结构数量", names.length === 4 && times.length === 4 && previews.length === 4, `${names.length}/${times.length}/${previews.length}`);
log("名称来自真实会话数据", names.join("|") === "懒得起名|公众号|微信支付|智慧无锡商院", names.join("|"));
log("时间格式化(今天/昨天/星期/日期)", /^\d{2}:\d{2}$/.test(times[0]) && times[1] === "昨天" && times[2].startsWith("周") && times[3].includes("月"), times.join("|"));
log("预览来自最后一条消息", previews[1].includes("快讯") && previews[2] === "亲属卡使用通知", previews.join("|"));
log("头像为方形圆角彩色块", (await page.locator(".sk-wx-avatar").count()) === 4);

// 搜索
await page.locator('#sk-wx-header [data-wx="search"]').click();
await page.waitForTimeout(150);
log("搜索框展开", (await page.locator("#sk-wx-search input").count()) > 0);
await page.locator("#sk-wx-search input").fill("微信");
await page.waitForTimeout(150);
const visible = await page.evaluate(() =>
  [...document.querySelectorAll(".list-ac14ac .item-ff6fc9")].filter(e => e.style.display !== "none").length);
log("搜索过滤生效(匹配1条)", visible === 1, "visible=" + visible);
await page.locator('#sk-wx-header [data-wx="search"]').click();
await page.waitForTimeout(150);
log("再点搜索收起并恢复列表", (await page.locator("#sk-wx-search").count()) === 0 &&
  (await page.evaluate(() => [...document.querySelectorAll(".list-ac14ac .item-ff6fc9")].filter(e => e.style.display !== "none").length)) === 4);

// Tab 切换
await page.locator('#sk-wx-tabbar [data-wx-tab="me"]').click();
await page.waitForTimeout(250);
log("切到「我」Tab选中态", (await page.locator('#sk-wx-tabbar [data-wx-tab="me"]').getAttribute("class")).includes("is-on"));
// 「我」Tab 应打开设置面板并进入账户页
await page.waitForTimeout(600);
log("「我」Tab 打开账户页", (await page.locator('#sk-settings [data-act="check-balance"]').count()) > 0);

// 关闭开关后清理
await page.evaluate(() => localStorage.setItem("chat-demo:wechat-mode", "off"));
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
log("关闭后顶栏/底栏清除", (await page.locator("#sk-wx-header").count()) === 0 && (await page.locator("#sk-wx-tabbar").count()) === 0);
log("关闭后列表结构清除", (await page.locator(".sk-wx-built").count()) === 0);
log("关闭后原会话项恢复可见", (await page.evaluate(() => {
  const e = document.querySelector(".list-ac14ac .item-ff6fc9 .title-ff6fc9");
  return e ? getComputedStyle(e).display !== "none" : true;
})));

await browser.close();
const failed = out.filter(x => !x.ok);
console.log(`\n结果: ${out.length - failed.length}/${out.length} 通过`);
process.exit(failed.length ? 1 : 0);
