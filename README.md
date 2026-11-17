# chatbot

基于 DeepSeek chat-demo 编译产物改造的聊天应用，通过覆盖层注入扩展设置、角色卡、按天记忆、上下文边栏等能力，并用 Capacitor 打包为 Android APK。

- Web 版源码：`chat-demo/`（`settings-skin.js` / `settings-skin.css` 为改造层，原应用 bundle 保持原样）
- Android 工程：`android-app/`（Capacitor 7，包名 `com.chatbot.demo`）
- 端到端测试：`e2e/`（Playwright，10 套回归）

## 功能

- 设置页重构：账号 / 数据 / 语言 / 外观 / 字号 / 个性化 / 关于
- 角色卡与角色记忆（与会话绑定）、按天记忆（YYYY-MM-DD.md）、右侧上下文边栏
- 对话气泡定制（配色 / 圆角 / 宽度）
- 首次打开 DSH 风格新手引导
- **应用内更新（GitHub Releases）**：启动静默检查 + 手动检查、版本比较、下载安装、失败保护与回滚

## 应用内更新机制

应用启动时（每 6 小时最多一次）与用户点击「设置 → 关于 → 检查更新」时，
读取本仓库最新 Release（`https://api.github.com/repos/xiguabusgua/chatbot/releases/latest`）：

- 解析 `tag_name` 末尾数字为 versionCode，与本机版本比较
- 有新版本 → 弹面板展示 `name` 与 `body`（更新说明），提供「下载并安装」
- 从 Release 资产中找 `.apk` 下载，校验包名 / 签名 / 版本后调起系统安装器
- 安装前自动备份当前 APK；校验失败或安装失败则保留旧版本
- 设置里出现「回退到上一版本」，可恢复更新前版本

### 发版步骤

1. 改代码 → 更新 `chat-demo/version.json` 的 `build` 与 `APP_VERSION`、Android `versionCode+1`
2. 重新 `npm run sync` 并 `./gradlew assembleRelease`
3. 在 GitHub 创建 Release：tag 用 `v<versionCode>`（如 `v46`），标题写版本名，正文写更新说明
4. 上传 `app-release.apk` 到该 Release 资产，发布即可

> 仓库需为 public（APK 内不能携带 GitHub token），用户无需登录即可检查更新。

## 本地运行

```
# Web 预览
cd chat-demo && python3 -m http.server 8123

# 回归测试（另开终端）
cd .. && node e2e/web-check.mjs

# Android 构建（需 Android SDK 与签名材料，见 android-app/android/keystore/README.txt）
cd android-app && npm install && npm run sync
cd android && ./gradlew assembleRelease
```

签名 keystore 与 `keystore.properties`、`local.properties` 均不入库，详见
`android-app/android/keystore/README.txt`。
