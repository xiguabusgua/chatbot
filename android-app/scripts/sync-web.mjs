// 把 chat-demo 的静态产物同步到 Capacitor 的 www 目录。
// 只拷贝运行时真正需要的文件，避免把 e2e 脚本、备份等带进 APK。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const src = path.resolve(root, "..", "chat-demo");
const out = path.resolve(root, "www");

const ENTRIES = [
  "index.html",
  "version.json",
  "settings-skin.js",
  "settings-skin.css",
  "static",
  "LICENSE"
];

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function copy(rel) {
  const from = path.join(src, rel);
  const to = path.join(out, rel);
  if (!fs.existsSync(from)) throw new Error("缺少源文件：" + from);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}

if (!fs.existsSync(path.join(src, "index.html"))) {
  throw new Error("未找到 chat-demo/index.html，请先确认源目录：" + src);
}

rmrf(out);
fs.mkdirSync(out, { recursive: true });
for (const e of ENTRIES) copy(e);

const count = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).reduce(
    (n, d) => n + (d.isDirectory() ? count(path.join(dir, d.name)) : 1),
    0
  );
console.log(`www 同步完成：${count(out)} 个文件 → ${out}`);
