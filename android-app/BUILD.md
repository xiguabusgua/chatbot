# chatbot Android 打包说明

把 `../chat-demo` 的静态产物用 Capacitor 包成可安装的 APK。

## 目录结构

```
android-app/
├── capacitor.config.json     # appId / 应用名 / webDir
├── scripts/sync-web.mjs      # 把 chat-demo 的必要文件拷到 www
├── www/                      # 构建时生成，不用手改
└── android/                  # Capacitor 生成的原生工程
    ├── keystore/chatbot-release.jks   # 发布签名（务必保留）
    ├── keystore.properties            # 签名口令
    └── app/build.gradle               # 版本号、签名、lint 开关
```

## 构建

```bash
cd android-app
npm install
npm run sync          # 同步 web 资源 + 插件
cd android
export JAVA_HOME=$(/usr/libexec/java_home -v 21)
export ANDROID_HOME="$HOME/Library/Android/sdk"
./gradlew assembleRelease
```

产物：`android/app/build/outputs/apk/release/app-release.apk`

## 关键配置

| 项 | 值 |
|---|---|
| 包名 / applicationId | `com.chatbot.demo` |
| versionName | `0.1.1` |
| versionCode | `37` |
| minSdk / targetSdk / compileSdk | 23 / 34 / 35 |
| 签名 | `android/keystore/chatbot-release.jks`，alias `chatbot` |

## 升级安装的前提（三条必须同时满足）

1. **包名不变**：`com.chatbot.demo`
2. **签名一致**：必须继续用同一个 `chatbot-release.jks`，换 key 会导致「应用未安装 / 签名冲突」，只能卸载重装
3. **versionCode 递增**：每次发新版把 `app/build.gradle` 的 `versionCode` 加一（versionName 可读性用，不参与比较）

`keystore.properties` 与 `chatbot-release.jks` 属于发布凭据，不要提交到公开仓库。

## 已知取舍

- **targetSdk 34**：避开 Android 15 对 targetSdk 35 强制边到边（内容顶到状态栏下）。若日后要上架应用商店，需升到 35 并适配 `WindowInsets`。
- **release 构建关闭 lintVital**：`lint { checkReleaseBuilds false }`。原因是构建环境经代理访问 Google Maven 时拉取 lint 工具链会 502；不影响产物。需要静态检查时单独跑 `./gradlew lintDebug`。
- **文件导出**：WebView 不支持 `<a download>`，已在 `settings-skin.js` 里拦截 blob 下载，改走 Filesystem 写缓存 + 系统分享面板。
- **外链**：`window.open` 在 WebView 无效，改用 `@capacitor/browser` 调系统浏览器。
- **文件夹选择**（按天记忆）：WebView 无 File System Access API，自动回落到浏览器本地存储 + 单日导出。
