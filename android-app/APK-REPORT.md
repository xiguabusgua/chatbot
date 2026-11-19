# APK 打包交付报告（chatbot 0.1.1 / V51）

- 执行时间：2026-11-17 12:39（北京时间）
- 产物路径：`android-app/android/app/build/outputs/apk/release/app-release.apk`（约 5.0 MB）
- 追加修复：状态栏/导航栏颜色与界面一致（v39）
- 新增功能：**应用内检查更新**（v40 实现并全链路验证，v45 GitHub Releases）
- 启动行为：首次打开直接进入对话界面（v43）
- 新增功能：**DSH 风格首次新手引导**（v44，见 1.4）
- 最新功能：**自定义聊天背景**（v47，见 1.5）：预设渐变 / 相册图片 + 拖动缩放调整显示区域 + 遮罩浓度，深浅色自适应
- 最新修复（v48，见 1.6）：气泡预览配色误伤容器、输入框显示所选角色名

## 1. APK 基本信息

| 项 | 值 |
|---|---|
| 包名 | com.chatbot.demo |
| 应用名 | chatbot |
| versionCode / versionName | 51 / 0.1.1 |
| minSdk / targetSdk | 23（Android 6.0+）/ 34（规避 Android 15 强制 edge-to-edge） |
| 签名 | chatbot-release.jks（alias: chatbot） |
| 编译 SDK | 35 |

## 1.8 世界书与微信风格界面（v51）

按 grill-me 讨论确认的结论落地两项大改：

- **世界书（群聊场景）**：每张角色卡自动绑定一个同名世界书（成员名单+场景背景）；角色详情页可编辑场景名称、背景、勾选在场成员；发请求时 system 注入「群聊场景+背景+在场成员设定」，主角色发言、其他成员仅作背景，零 API 改动
- **微信风格界面**：个性化页全局开关，开启后侧栏会话列表改微信样式（灰底、圆角头像方块、分隔线、选中态），发送按钮改微信绿；深色模式适配；关闭回到原界面
- 验证：social-check 10/10；全套 15 套回归 160 项全通过
- 说明：live2D 按讨论结论暂缓（缺模型与 SDK）；会话列表标题仍为原应用生成的「新对话」，未改动原应用逻辑

## 1.7 清单基础项（v49-v50）

按 11.19 更新清单，经讨论确认后先落地基础项：

- **内存缓存层**：readChars/readMem/readIndex 缓存解析结果并记录 localStorage 原始串，外部改写自动失效；右侧上下文边栏显示缓存命中次数
- **角色卡字段扩展**：新增 personality（性格标签，注入 system 单列一段）和 avatar（相册选图+压缩）；角色列表/新对话选择器/上下文边栏显示头像，头像点击进入详情编辑
- **API 价格表**（设置→账户）：内置从官网核实的真实价格（deepseek-flash / deepseek-v4-pro，分高峰/非高峰×缓存命中/未命中/输出，USD/1M tokens），可手动编辑；余额页入口进入
- **从链接导入**：设置→数据管理新增入口，粘贴 ZIP 下载地址→fetch→DataTransfer 注入原应用 file input 复用解析；实测 DataTransfer 在 Chromium/WebView 可用
- 验证：base-check 7/7、feature-check 11/11；全套 14 套回归 150 项全通过
- 待办（大改，下一阶段）：世界书群聊场景 + 微信风格界面（共用一套 UI）

## 1.6 清单修复项（v48）

- **气泡预览配色异常**：`body[data-sk-bubble] [class*="bubble-"]` 会误匹配设置页自己的 `.sk-bubble-preview` 容器，导致选非默认色时整个预览区被染色、气泡"消失"。改为 `[class^="bubble-"]` 前缀匹配，只作用于真实聊天气泡（class 形如 `bubble-_4cfe7`）
- **输入框显示所选角色**：新建对话选角色后写入 `chat-demo:active-char`（角色名），通过 MutationObserver 持续把角色标签注入输入框容器（React 重建不丢失）；取消角色则隐藏
- 验证：`fixes-check.mjs` 6/6；全套 12 套回归全通过

## 1.5 自定义聊天背景（v47）

入口：设置 → 个性化 → Chat background。

- **预设背景**：默认 / 极光 / 薄荷 / 暖阳 / 海盐 / 暖沙 6 款渐变，点选即时生效
- **相册图片**：
  - Android 13+ 走系统照片选择器（`ACTION_PICK_IMAGES`，无需存储权限，遵循"仅授权所选照片"）；低版本先申请 `READ_EXTERNAL_STORAGE` 再打开相册
  - Web/浏览器端走 `<input type="file" accept="image/*">`
  - 原生侧按最长边 1280 缩放、JPEG 0.72 压缩后以 base64 回调 H5，避免 OOM 与 localStorage 超限
- **调整显示区域**：选图后进入全屏调整页，可拖动图片改位置、滑块缩放 100%–300%，带点阵辅助线；满意后"应用"，"取消"不落盘
- **遮罩浓度**：0%–90% 可调，深浅主题自动用白色/黑色遮罩（深色模式不影响浅色文字可读性）
- **稳定与适配**：背景注入 `.frame-_9fdf5`（输入区自带底色不受影响）；`background-size/position` 用百分比做多尺寸适配；图片仅存本机 localStorage
- **异常处理**：取消选择、权限拒绝、图片读取/解码失败均有明确提示；`posX/posY/scale/opacity` 读取时做范围钳制
- 实测：Web 专项 19/19；模拟器走完「相册选图→调整页→缩放 145%+拖动→应用→对话页背景生效→冷启动保留」

## 1.4 DSH 风格首次新手引导（v44）

参考 DeepSeek Harness / DSH Go 的首次启动引导，新增全屏分步引导层（`#sk-ob`），仅在首次打开显示：

1. **欢迎页**：logo + "欢迎使用 chatbot" + 下一步 / 跳过
2. **选择外观**：浅色 / 深色 / 跟随系统三选一（实时生效）+ 4 种主题配色
3. **连接 DeepSeek**：填写 API Key 保存并继续，或"稍后设置"
4. **准备就绪**：确认后进入对话界面

- 完成标记 `chat-demo:onboarded`，完成后（含跳过）不再出现
- 外观/配色/API Key 与设置页共用同一存储键，无缝衔接
- 中英文、深浅色自适应；系统返回键在引导中逐页回退，第一步则关闭引导（不误退出）
- Web 端 15/15 专项通过；模拟器冷启动、切页、返回、跳过、二次冷启动全部验证通过

## 1.3 首次打开直接进入对话界面（v43）

- **背景**：DeepSeek 原版在无 API Key 时，冷启动会自动弹出配置引导框，皮肤层跟随挂载设置页。
- **修复**：`check()` 中增加 `dismissBootDialog()`：在用户尚未主动交互前自动关闭该引导框一次，
  `suppressSettingsUntil` 抑制重复挂载；`pointerdown` 时立即清除抑制，保证手动点“设置”不受影响。
- **实测**：清除数据后首次打开 → 直接显示对话首页 ✅；手动点设置 → 设置页立即打开（V43）✅；
  Web 端回归 23/23 全部通过（含新增“首次进对话、手动可开设置”断言）。

## 1.2 应用内更新（v40+）

**使用方式**：设置 → 关于 → 检查更新。App 请求更新服务器上的 `update.json`，
发现 `versionCode` 更大时弹出"发现新版本"面板 → 下载 APK（带进度）→ 调起系统
安装器覆盖安装（签名一致 + 版本号递增，本机数据全部保留）。

**服务器清单格式**（部署到你自己的静态服务器/OSS 即可）：

```json
{
  "versionName": "0.1.1",
  "versionCode": 43,
  "apkUrl": "https://your-server.com/chatbot/app-release.apk",
  "notes": "更新说明"
}
```

**配置更新服务器地址**（二选一）：
1. 改 `chat-demo/settings-skin.js` 中的 `UPDATE_MANIFEST_URL` 常量（当前为空，
   需填入你的 `update.json` 地址），然后 `npm run sync` + `gradlew assembleRelease`；
2. 或在设备上写入 localStorage：`localStorage["chat-demo:update-url"] = "<地址>"`。

**实现要点**：
- `MainActivity` 注入 `window.NativeUpdater`（`@JavascriptInterface`）：
  `check(manifestUrl)` 拉清单比对 versionCode；`install(apkUrl)` 原生下载到缓存目录
  （带进度回传）；`status()` 供 JS 轮询 phase/progress/error。
- Manifest 新增 `REQUEST_INSTALL_PACKAGES` 权限；未授予"安装未知应用"时自动跳转
  系统授权页。`usesCleartextTraffic=true` 允许 http 源（生产建议 https）。
- WebView 内 fetch 跨源受混合内容限制，因此全部走原生下载，无 CORS 问题。
- Web 端（浏览器）无 NativeUpdater，"检查更新"保持原 version.json 比对行为。

**模拟器全链路实测**（Pixel 5 / android-34，v40 → 服务器 v41）：
检查更新 → 面板"发现新版本 0.1.1（41）" → 下载 5.0MB → 系统安装器
"Do you want to update this app?" → Update → "App installed" → v41 正常启动，
本机数据保留 ✅

## 1.1 状态栏颜色修复（v39）

- **原因**：主题未显式设置 `android:statusBarColor`，系统取了模板遗留的
  `colorPrimaryDark`（#303F9F 深色系），显示为灰色，与白色界面不协调。
- **修复**：`AppTheme.NoActionBar` 显式配置状态栏/导航栏颜色：
  - 浅色模式：`#FFFFFF` 白色 + 深色图标（`windowLightStatusBar/NavigationBar=true`）
  - 深色模式（values-night）：`#292A2D` 与应用深色背景一致 + 浅色图标
- **实测**：浅色状态栏纯背景 (255,255,255) 与界面融为一体；深色模式 (41,42,45)
  与应用背景一致。
- **注意**：Manifest 声明 `configChanges` 含 `uiMode`，切换系统深浅色不会重建
  Activity，颜色在应用重启后生效（跟随系统的颜色本来就是下次启动取值，行为一致）。

## 2. 本次变更（V37 → V38）

1. **原生返回键拦截**（`MainActivity.java`）：重写 `onBackPressed()`，先通过
   `evaluateJavascript` 调用页面侧 `window.__skHandleBack`；页面返回 "1" 表示已消费，
   否则走默认行为（退出应用）。
2. **页面侧返回优先级**（`settings-skin.js` 新增 `window.__skHandleBack`）：
   ① 新对话角色选择面板 → ② 设置底部选择面板 → ③ 右侧上下文边栏 →
   ④ 设置二级页逐级返回 / 主页面整个关闭 → ⑤ 应用左侧抽屉收起 →
   ⑥ 应用确认类弹窗尝试点取消 → ⑦ 都无则退出应用。
3. 版本号同步：`version.json`、页面显示 `0.1.1（V38）`、`build.gradle versionCode 38`、
   `index.html` 缓存指纹 `?v=38&h=66ab26`。

## 3. 模拟器实测（Pixel 5 / android-34 arm64）

| 场景 | 预期 | 实测 |
|---|---|---|
| 设置二级页按返回 | 回到设置主页 | ✅ |
| 设置主页按返回 | 关闭设置回聊天 | ✅ |
| 聊天界面抽屉打开按返回 | 收起抽屉 | ✅ |
| 抽屉收起后再按返回 | 退出应用 | ✅（Launcher 顶起） |
| 右侧上下文边栏打开按返回 | 关闭边栏 | ✅ |
| 无任何面板按返回 | 退出应用 | ✅ |

安装方式：`adb install -r app-release.apk`；冷启动自动弹出设置页属应用自身记忆行为，非缺陷。

## 4. 已知注意事项

- 返回键在"新对话角色选择面板"场景走的同一处理器（优先级 ①），未单独在模拟器复测
  （需先创建角色卡），逻辑与已验证的关闭路径一致。
- `onBackPressed` 在 API 33+ 标记为过时，功能不受影响（targetSdk 34 下仍正常回调）。
- 接口调用依赖 WebView 直连 `api.deepseek.com`（不开 CapacitorHttp，保证流式），
  设备需可访问该域名。
- 重新构建命令：`cd android-app && npm run sync && cd android && ./gradlew assembleRelease`
- Web 端回归套件保留在 `e2e/`（8 套检查脚本 + artifacts + report.md），
  APK 调试探针（apk-probe/apk-cdp/shots-settings）已清理。

## 6. GitHub 内置更新（v45）

- 更新源：`https://api.github.com/repos/xiguabusgua/chatbot/releases/latest`（仓库 public，无需 token）
- 版本管理：tag 末尾数字解析为 versionCode，与本机比对；Release 资产中的 `.apk` 为安装包
- 检查时机：启动后 4 秒静默检查（每 6 小时最多一次）+ 设置里手动「检查更新」
- 下载安装：真实 HTTP 下载 → 校验包名/签名/版本 → 备份当前 APK → 系统安装器覆盖安装
- 异常处理：网络失败/下载失败/包校验失败均保留旧版本并友好提示；安装前自动备份，设置页出现「回退到上一版本」
- 仓库：https://github.com/xiguabusgua/chatbot ，基线 Release `v45` 已发布并上传 APK
- 模拟器全链路实测：uptodate(45=45) → 发现 v46 → 下载 58%→100% → 校验通过 → 系统安装器 → 安装成功 → 回退入口出现
- 注意：GitHub latest API 有约数十秒 CDN 缓存，刚发版可能短暂读到旧版本