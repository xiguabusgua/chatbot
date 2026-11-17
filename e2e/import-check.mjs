/**
 * 「导入历史对话」回归测试：造对话 → 导出 → 删除 → 导入 → 确认 → 校验恢复
 * 运行：node e2e/import-check.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://127.0.0.1:8123/";
const OUT = path.join(process.cwd(), "e2e", "artifacts");
fs.mkdirSync(OUT, { recursive: true });

const steps = [];
function mark(name, ok, detail) {
  steps.push({ name, ok, detail });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? "  → " + detail : ""}`);
}

const SSE = [
  "event: message_start",
  'data: {"type":"message_start","message":{"id":"m1","type":"message","role":"assistant","model":"deepseek-chat","content":[],"stop_reason":null,"usage":{"input_tokens":5,"output_tokens":0}}}',
  "",
  "event: content_block_start",
  'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
  "",
  "event: content_block_delta",
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"这是一条用于导出测试的回复。"}}',
  "",
  "event: content_block_stop",
  'data: {"type":"content_block_stop","index":0}',
  "",
  "event: message_delta",
  'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":9}}',
  "",
  "event: message_stop",
  'data: {"type":"message_stop"}',
  "",
  ""
].join("\n");

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 860 },
  locale: "zh-CN",
  acceptDownloads: true
});
const page = await ctx.newPage();
await (page.context()).addInitScript(() => { try { localStorage.setItem("chat-demo:onboarded", "1"); } catch (e) {} });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));

async function openData() {
  if (await page.locator("#sk-settings").count()) {
    // 退到主设置页
    for (let i = 0; i < 3; i++) {
      if (await page.locator('#sk-settings [data-act="account"]').count()) break;
      await page.locator("#sk-settings .sk-back").click().catch(() => {});
      await page.waitForTimeout(250);
    }
  } else {
    await page.getByText("设置", { exact: true }).last().click({ timeout: 5000 });
    await page.waitForSelector("#sk-settings", { timeout: 5000 });
  }
  if (await page.locator('#sk-settings [data-act="data"]').count()) {
    await page.click('#sk-settings [data-act="data"]');
  }
  await page.waitForSelector('#sk-settings [data-act="import"]', { timeout: 4000 });
}

await page.route("**/api.deepseek.com/**", (route) =>
  route.fulfill({
    status: 200,
    headers: { "content-type": "text/event-stream; charset=utf-8", "access-control-allow-origin": "*" },
    body: SSE
  })
);

await page.goto(BASE + "?import=1", { waitUntil: "domcontentloaded" });
await page.waitForSelector("textarea", { timeout: 8000 });
await page.evaluate(() => localStorage.setItem("chat-demo:api-key", "sk-import-test"));
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("textarea", { timeout: 8000 });
await page.waitForTimeout(1000);

/* 1. 造一条对话 */
await page.fill("textarea", "这条对话用于导入回归测试");
await page.waitForTimeout(200);
await page.click('button[aria-label="发送"]');
await page.waitForFunction(() => document.body.innerText.includes("导出测试的回复"), null, { timeout: 10000 });
await page.waitForTimeout(800);
mark("准备：生成一条对话", true, "助手回复已渲染");

/* 2. 导出 */
await openData();
const [download] = await Promise.all([
  page.waitForEvent("download", { timeout: 10000 }),
  page.click('#sk-settings [data-act="export"]')
]);
const zip = path.join(OUT, "import-roundtrip-" + download.suggestedFilename());
await download.saveAs(zip);
mark("导出 ZIP", fs.statSync(zip).size > 0, `${path.basename(zip)}，${fs.statSync(zip).size} 字节`);

/* 3. 删除全部对话 */
await page.click('#sk-settings [data-act="delete"]');
await page.waitForSelector("#sk-settings .sk-sheet", { timeout: 3000 });
await page.click("#sk-settings .sk-opt[data-pick='0']");
await page.waitForTimeout(3000);
const afterDelete = await page.locator('[class*="bubble-"]').count();
mark("删除全部对话", afterDelete === 0, `剩余气泡 ${afterDelete}`);

/* 4. 导入 */
await openData();
const chooserPromise = page.waitForEvent("filechooser", { timeout: 5000 });
await page.click('#sk-settings [data-act="import"]');
const chooser = await chooserPromise;
mark("点击导入弹出文件选择", !!chooser, "filechooser 已触发");

await chooser.setFiles(zip);
await page.waitForTimeout(1200);

/* 5. 确认框必须可见且可点（本次修复的重点） */
const confirmState = await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find(
    (b) => (b.textContent || "").trim() === "确认导入"
  );
  if (!btn) return { found: false };
  const r = btn.getBoundingClientRect();
  const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return {
    found: true,
    rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
    topEl: top ? top.tagName.toLowerCase() + "." + ((top.getAttribute("class") || "").slice(0, 30)) : null,
    clickable: !!(top && (btn === top || btn.contains(top)))
  };
});
mark(
  "确认导入按钮可点击",
  confirmState.found && confirmState.clickable,
  confirmState.found ? `命中元素 ${confirmState.topEl}` : "未出现确认框"
);

await page.screenshot({ path: path.join(OUT, "import-confirm.png") });

/* 6. 确认导入并校验恢复 */
if (confirmState.found) {
  await page.getByRole("button", { name: "确认导入" }).click({ timeout: 5000 });
  await page.waitForTimeout(1200);
  const toastText = await page.evaluate(() => {
    const t = document.querySelector('.sk-toast, [class*="toast-"]');
    if (!t) return null;
    const r = t.getBoundingClientRect();
    const cs = getComputedStyle(t);
    return { text: t.textContent.trim().slice(0, 40), z: cs.zIndex, visible: r.width > 0 && r.height > 0, top: Math.round(r.top) };
  });
  mark("出现可见的导入提示条", !!(toastText && toastText.visible && /已导入|导入/.test(toastText.text)), toastText ? `「${toastText.text}」 z=${toastText.z}` : "无 toast 节点");
  await page.waitForTimeout(2300);
  const body = await page.locator("body").innerText();
  const toastOk = /已导入|导入完成|正在导入/.test(body);

  // 关闭设置，打开导入的会话，验证内容真的回来了
  for (let i = 0; i < 3; i++) {
    if (!(await page.locator("#sk-settings").count())) break;
    await page.locator("#sk-settings .sk-back").click().catch(() => {});
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(800);

  const entry = page.locator(".sider-ac14ac").getByText("新对话", { exact: true }).first();
  const hasEntry = await entry.count();
  if (hasEntry) {
    await entry.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }
  const restored = await page.evaluate(() => ({
    text: document.querySelector("main").innerText.replace(/\s+/g, " ").slice(0, 160),
    bubbles: document.querySelectorAll('[class*="bubble-"]').length
  }));
  const ok = hasEntry && /导入回归测试|导出测试的回复|导入后应能看到的回复/.test(restored.text);
  mark(
    "导入后会话与消息可正常打开",
    ok,
    `会话项=${hasEntry} 气泡=${restored.bubbles} 正文=${restored.text.slice(0, 60)}`
  );
  await page.screenshot({ path: path.join(OUT, "import-done.png") });
}

mark("无 JS 运行时错误", errors.length === 0, errors.slice(0, 2).join(" | "));

await browser.close();
const failed = steps.filter((s) => !s.ok);
console.log(`\n结果：${steps.length - failed.length}/${steps.length} 通过`);
process.exit(failed.length ? 1 : 0);
