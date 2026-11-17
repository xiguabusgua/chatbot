/** 验证自定义聊天背景：预设/遮罩/持久化/注入点 + 相册选图→调整显示区域→应用/取消 */
import { chromium } from "playwright";
import { writeFileSync } from "fs";
const BASE = "http://127.0.0.1:8123/";
const browser = await chromium.launch();
const out = [];
function log(name, ok, detail) { out.push({ name, ok }); console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? " → " + detail : ""}`); }

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-CN" });
const page = await ctx.newPage();
await page.addInitScript(() => { try { localStorage.setItem("chat-demo:onboarded", "1"); } catch (e) {} });
await page.route("**/api.deepseek.com/**", (r) => r.abort());

async function openSettings() {
  if (!(await page.locator("#sk-settings").count())) {
    await page.getByText("设置", { exact: true }).last().click({ timeout: 5000 });
    await page.waitForSelector("#sk-settings", { timeout: 5000 });
  }
  for (let i = 0; i < 5; i++) {
    if (await page.locator('#sk-settings [data-act="account"]').count()) break;
    await page.locator("#sk-settings .sk-back").click().catch(() => {});
    await page.waitForTimeout(200);
  }
}
async function gotoBgPage() {
  await openSettings();
  await page.locator('#sk-settings [data-act="personalize"]').click();
  await page.waitForTimeout(180);
  await page.locator('#sk-settings [data-act="chatbg"]').click();
  await page.waitForTimeout(220);
}

const pngPath = "/tmp/bg-test-image.png";
const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR42mP8z8DAwMDAxAADCBwYNADnHwP9AAAAAElFTkSuQmCC", "base64");
writeFileSync(pngPath, tinyPng);

await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1400);
await gotoBgPage();

log("聊天背景页渲染", await page.locator('#sk-settings .sk-bg-grid').count() > 0);
log("预设数量=6", await page.locator('#sk-settings .sk-bg-preset').count() === 6);
log("遮罩滑块存在", await page.locator('#sk-settings [data-act="bg-opacity"]').count() > 0);

await page.locator('#sk-settings [data-preset="mint"]').click();
await page.waitForTimeout(200);
let picked = await page.evaluate(() => JSON.parse(localStorage.getItem("chat-demo:chat-bg") || "{}"));
log("点选预设写入存储", picked.type === "preset" && picked.preset === "mint", JSON.stringify(picked));

await page.locator('#sk-settings [data-act="bg-opacity"]').fill("60");
await page.waitForTimeout(150);
let op = await page.evaluate(() => JSON.parse(localStorage.getItem("chat-demo:chat-bg") || "{}").opacity);
log("遮罩浓度写入=60", op === 60, "opacity=" + op);

const inject = await page.evaluate(() => ({
  flag: document.body.getAttribute("data-sk-chatbg"),
  op: document.body.style.getPropertyValue("--sk-chatbg-op"),
  bg: getComputedStyle(document.querySelector(".frame-_9fdf5")).backgroundImage.slice(0, 60)
}));
log("预设背景注入 body", inject.flag === "preset", JSON.stringify(inject));
log("遮罩变量=0.6", inject.op === "0.6", "op=" + inject.op);

// 相册选图 → 调整 → 应用
await gotoBgPage();
const fcPromise = page.waitForEvent("filechooser", { timeout: 5000 });
await page.locator('#sk-settings [data-act="bg-pick"]').click();
const fc = await fcPromise;
await fc.setFiles(pngPath);
await page.waitForTimeout(600);
log("选图后进入调整页", await page.locator("#sk-adjust-stage").count() > 0);
log("调整页含缩放滑块", await page.locator('#sk-settings [data-act="bg-zoom"]').count() > 0);
log("调整页含应用/取消/重置", (await page.locator('#sk-settings [data-act="bg-apply"]').count()) > 0 &&
  (await page.locator('#sk-settings [data-act="bg-adjust-cancel"]').count()) > 0 &&
  (await page.locator('#sk-settings [data-act="bg-reset"]').count()) > 0);

await page.locator('#sk-settings [data-act="bg-zoom"]').fill("200");
await page.waitForTimeout(120);
const stageStyle = await page.locator("#sk-adjust-stage").getAttribute("style");
log("缩放滑块实时更新预览", /200%/.test(stageStyle), stageStyle.slice(0, 90));

const box = await page.locator("#sk-adjust-stage").boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 - 80, box.y + box.height / 2 - 60, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(120);
const stageStyle2 = await page.locator("#sk-adjust-stage").getAttribute("style");
log("拖动实时更新位置", /background-position/.test(stageStyle2) && stageStyle2 !== stageStyle, stageStyle2.slice(0, 120));

await page.locator('#sk-settings [data-act="bg-apply"]').click();
await page.waitForTimeout(250);
const applied = await page.evaluate(() => JSON.parse(localStorage.getItem("chat-demo:chat-bg") || "{}"));
log("应用后写入 image 类型", applied.type === "image", JSON.stringify({type:applied.type, scale:applied.scale}));
log("应用保存缩放=2", applied.scale === 2, "scale=" + applied.scale);
log("应用保存位置≠默认", applied.posX !== 50 || applied.posY !== 50, `posX=${Math.round(applied.posX)} posY=${Math.round(applied.posY)}`);
log("应用后回到背景页", await page.locator('#sk-settings .sk-bg-grid').count() > 0);
const imgInject = await page.evaluate(() => ({
  flag: document.body.getAttribute("data-sk-chatbg"),
  size: document.body.style.getPropertyValue("--sk-chatbg-size"),
  pos: document.body.style.getPropertyValue("--sk-chatbg-pos")
}));
log("图片背景注入含缩放与位置", imgInject.flag === "image" && imgInject.size === "200%" && /%/.test(imgInject.pos), JSON.stringify(imgInject));

// 取消选择不落盘
await gotoBgPage();
const before = await page.evaluate(() => localStorage.getItem("chat-demo:chat-bg"));
const fc2p = page.waitForEvent("filechooser", { timeout: 5000 });
await page.locator('#sk-settings [data-act="bg-pick"]').click();
const fc2 = await fc2p;
await fc2.setFiles(pngPath);
await page.waitForTimeout(500);
await page.locator('#sk-settings .sk-bg-actions [data-act="bg-adjust-cancel"]').click();
await page.waitForTimeout(200);
const after = await page.evaluate(() => localStorage.getItem("chat-demo:chat-bg"));
log("取消调整不改动已有背景", before === after);

await gotoBgPage();
await page.locator('#sk-settings [data-preset="none"]').click();
await page.waitForTimeout(150);
log("选默认移除背景注入", (await page.evaluate(() => document.body.getAttribute("data-sk-chatbg"))) === null);

await browser.close();
const failed = out.filter(x => !x.ok);
console.log(`\n结果: ${out.length - failed.length}/${out.length} 通过`);
process.exit(failed.length ? 1 : 0);
