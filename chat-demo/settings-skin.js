/*
 * 设置页外观改造层
 * 职责：
 * 1. 侦测应用自身的设置弹窗（.dialog-_85c1b），临时隐藏它；
 * 2. 用同一份数据渲染与参考图一致的移动端设置页；
 * 3. 操作回落到原应用的真实控件（主题单选、语言/音色下拉、上传/下载按钮）
 *    或本地存储键（chat-demo:*），不改动任何原有逻辑。
 */
(function () {
  "use strict";

  if (window.__skSettingsLoaded) return;
  window.__skSettingsLoaded = true;

  var DIALOG = ".dialog-_85c1b";
  var KEY = {
    apiKey: "chat-demo:api-key",
    locale: "chat-demo:locale",
    theme: "chat-demo:theme-preference",
    voice: "chat-demo:tts-voice"
  };

  var root = null;
  var view = "main";
  var state = { keyDraft: null, draft: null, editId: null };
  var backStack = [];
  var busy = false;

  /* ---------------- 图标 ---------------- */
  var ICONS = {
    left: '<path d="M15 4.8L7.6 12 15 19.2"/>',
    right: '<path d="M9 4.8L16.4 12 9 19.2"/>',
    user: '<circle cx="12" cy="8" r="3.55"/><path d="M4.9 19.6c.85-3.3 3.65-5.25 7.1-5.25s6.25 1.95 7.1 5.25"/>',
    db: '<ellipse cx="12" cy="6.3" rx="7.2" ry="2.7"/><path d="M4.8 6.3v11.4c0 1.5 3.22 2.7 7.2 2.7s7.2-1.2 7.2-2.7V6.3"/><path d="M4.8 12c0 1.5 3.22 2.7 7.2 2.7s7.2-1.2 7.2-2.7"/>',
    globe: '<circle cx="12" cy="12" r="8.2"/><path d="M3.8 12h16.4"/><path d="M12 3.8c2.2 2.25 3.3 5.05 3.3 8.2s-1.1 5.95-3.3 8.2c-2.2-2.25-3.3-5.05-3.3-8.2S9.8 6.05 12 3.8z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.8v2.1M12 19.1v2.1M2.8 12h2.1M19.1 12h2.1M5.5 5.5l1.5 1.5M17 17l1.5 1.5M18.5 5.5L17 7M7 17l-1.5 1.5"/>',
    moon: '<path d="M20 14.5A8.2 8.2 0 019.5 4 8.4 8.4 0 1020 14.5z"/>',
    sliders: '<path d="M4 7.2h6.4M16.2 7.2H20M4 12h1.8M11.6 12H20M4 16.8h6.4M16.2 16.8H20"/><circle cx="13.3" cy="7.2" r="2.1"/><circle cx="8.7" cy="12" r="2.1"/><circle cx="13.3" cy="16.8" r="2.1"/>',
    speaker: '<path d="M4.4 9.6h2.9l4.3-3.9v12.6l-4.3-3.9H4.4z"/><path d="M15.2 9.3a3.8 3.8 0 010 5.4"/><path d="M17.8 6.7a7.5 7.5 0 010 10.6"/>',
    info: '<circle cx="12" cy="12" r="8.3"/><path d="M12 11.2v5.3"/><circle cx="12" cy="8.2" r="0.95" fill="currentColor" stroke="none"/>',
    doc: '<path d="M6.4 3.9h7.3l4.3 4.3v12.1H6.4z"/><path d="M13.5 3.9v4.5h4.5"/><path d="M9.1 13.1h6M9.1 16.3h6"/>',
    help: '<circle cx="12" cy="12" r="8.3"/><path d="M9.7 9.5a2.45 2.45 0 113.95 2.2c-.9.6-1.55 1.2-1.55 2.2"/><circle cx="12" cy="17.1" r="0.95" fill="currentColor" stroke="none"/>',
    logout: '<path d="M14.4 4.6H6.2v14.8h8.2"/><path d="M11.5 12h9"/><path d="M17.5 8.7L20.8 12l-3.3 3.3"/>',
    upload: '<path d="M12 16.2V4.8"/><path d="M7.7 9.1L12 4.8l4.3 4.3"/><path d="M4.9 15.4v2.3c0 1 .8 1.8 1.8 1.8h10.6c1 0 1.8-.8 1.8-1.8v-2.3"/>',
    download: '<path d="M12 4.8v11.4"/><path d="M7.7 11.9L12 16.2l4.3-4.3"/><path d="M4.9 15.4v2.3c0 1 .8 1.8 1.8 1.8h10.6c1 0 1.8-.8 1.8-1.8v-2.3"/>',
    trash: '<path d="M4.9 7.1h14.2"/><path d="M9.7 7.1V4.9h4.6v2.2"/><path d="M6.7 7.1l.9 12.2h8.8l.9-12.2"/>',
    tick: '<path d="M4.9 12.6l4.6 4.6L19.1 7.6"/>',
    layers: '<path d="M12 3.4l8.2 4.4-8.2 4.4-8.2-4.4z"/><path d="M3.8 12.2l8.2 4.4 8.2-4.4"/><path d="M3.8 16.2l8.2 4.4 8.2-4.4"/>',
    link: '<path d="M10.2 13.8a3.6 3.6 0 005.1 0l3.1-3.1a3.6 3.6 0 00-5.1-5.1L11.9 7"/><path d="M13.8 10.2a3.6 3.6 0 00-5.1 0l-3.1 3.1a3.6 3.6 0 005.1 5.1L12.1 17"/>',
    palette: '<path d="M12 3.6a8.4 8.4 0 100 16.8c1.3 0 2.1-.9 2.1-2 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.2 0-1 .8-1.8 1.8-1.8h1.3a3.8 3.8 0 003.8-3.8c0-3.8-3.6-6.7-8-6.7z"/><circle cx="8.2" cy="10.2" r="0.95" fill="currentColor" stroke="none"/><circle cx="12" cy="7.8" r="0.95" fill="currentColor" stroke="none"/><circle cx="15.6" cy="10.2" r="0.95" fill="currentColor" stroke="none"/>',
    radius: '<rect x="4.6" y="4.6" width="14.8" height="14.8" rx="5.6"/><path d="M4.6 9.4h14.8"/>',
    width: '<path d="M4 12h16"/><path d="M7.6 8.4L4 12l3.6 3.6"/><path d="M16.4 8.4L20 12l-3.6 3.6"/>',
    image: '<rect x="3.4" y="4.6" width="17.2" height="14.8" rx="2.4"/><circle cx="8.6" cy="9.6" r="1.6"/><path d="M4.2 17l4.6-4.4 3.4 3.2 2.8-2.6 5 4.6"/>'
  };

  function icon(name) {
    return (
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (ICONS[name] || "") +
      "</svg>"
    );
  }

  /* ---------------- 文案 ---------------- */
  var STR = {
    zh: {
      title: "设置",
      account: "账户",
      accountMgr: "账号管理",
      data: "数据管理",
      app: "应用",
      language: "语言",
      appearance: "外观",
      fontSize: "字体大小",
      personalize: "个性化",
      voiceGroup: "语音",
      voice: "朗读音色",
      about: "关于",
      update: "检查更新",
      terms: "服务协议",
      help: "帮助与反馈",
      logout: "退出登录",
      modelName: "模型名称：Deepseek Chat",
      zhCN: "中文（简体中文）",
      enUS: "English",
      light: "浅色",
      dark: "深色",
      system: "跟随系统",
      systemShort: "系统",
      stella: "海星（女声）",
      tide: "暗潮（男声）",
      apiKey: "API Key",
      keyPlaceholder: "请输入 API Key",
      keyHint: "API Key 仅保存在本机浏览器，用于直接调用 DeepSeek 接口，不会上传到其他服务器。",
      save: "保存",
      clear: "清除",
      localData: "本地对话数据",
      importChat: "导入历史对话",
      importUrl: "从链接导入",
      importUrlHint: "粘贴对话备份 ZIP 的下载地址",
      importUrlPh: "https://example.com/backup.zip",
      importUrlStart: "开始导入",
      importUrlInvalid: "请输入有效的 http(s) 链接",
      importUrlFetch: "正在下载备份…",
      importUrlFail: "下载失败，请检查链接或网络",
      importUrlNoInput: "未找到导入控件，请使用文件导入",
      exportChat: "导出所有历史对话",
      deleteChat: "删除所有对话",
      dataHint: "导入支持 DeepSeek 导出的 ZIP 文件；导出内容包含全部对话与本地图片原件，不含 API Key。",
      cancel: "取消",
      back: "返回",
      soon: "演示版本暂未开放",
      keyEmpty: "请先输入 API Key",
      keySaved: "已保存，正在刷新…",
      keyCleared: "已清除本机保存的 API Key",
      exporting: "正在导出对话…",
      noExport: "未找到导出入口，请稍后重试",
      noImport: "未找到上传入口，请稍后重试",
      deleting: "正在删除…",
      deleted: "所有对话已删除",
      confirmTitle: "删除后，所有对话都将被清空且无法找回",
      switching: "正在切换语言…",
      importing: "正在导入…",
      imported: "导入完成，请在左侧会话列表查看",
      fontSize: "字体大小",
      fsSmall: "小",
      fsNormal: "标准",
      fsLarge: "大",
      fsXL: "特大",
      density: "紧凑模式",
      densityHint: "减小消息间距，一屏显示更多内容",
      caveatToggle: "显示 AI 生成提示",
      caveatHint: "输入框下方的“内容由 AI 生成”说明",
      checkUpdate: "检查更新",
      checking: "正在检查更新…",
      upToDate: "已是最新版本",
      updateFound: "发现新版本",
      updateFailed: "检查更新失败，请稍后重试",
      updateAction: "下载并安装",
      later: "稍后再说",
      downloading: "正在下载更新…",
      installing: "正在调起安装，请在系统页面完成安装",
      updateGrant: "请在系统页面允许本应用安装未知应用后重试",
      updateNoServer: "未配置更新服务器地址",
      rollback: "回退到上一版本",
      rollbackHint: "安装遇到问题？可恢复到更新前的版本",
      rollbackConfirm: "确定回退到上一版本吗？",
      rollbackDone: "正在调起安装，请在系统页面确认回退",
      noBackup: "没有可回退的旧版本",
      updateBadge: "有新版本可用",
      updateNotes: "更新说明",
      diag: "复制诊断信息",
      diagHint: "反馈问题时附上这些信息，便于定位",
      copied: "已复制到剪贴板",
      copyFailed: "复制失败，请手动选择文本",
      faq: "常见问题",
      logoutTitle: "退出后本机数据将被清除且无法恢复",
      logoutNote: "将清除本机的 API Key、全部对话记录与偏好设置。",
      logoutAction: "退出登录",
      source: "项目来源",
      sourceValue: "GitHub",
      sourceFooter: "项目来源：",
      bubbleGroup: "对话气泡",
      bubbleColor: "气泡配色",
      bubbleRadius: "气泡圆角",
      bubbleWidth: "气泡宽度",
      bubblePreview: "你好，这是一条示例消息",
      wechatMode: "微信风格界面",
      wechatModeHint: "会话列表与聊天顶栏切换到微信风格",
      chatBg: "聊天背景",
      chatBgGroup: "聊天背景",
      chatBgApplied: "背景已应用",
      chatBgNone: "默认",
      chatBgImage: "自定义图片",
      chatBgOpacity: "遮罩浓度",
      chatBgOpacityHint: "数值越高，背景越浅、文字越清晰",
      chatBgPick: "选择图片",
      chatBgClear: "清除图片",
      chatBgHint: "选择一张图片作为聊天背景，可调节遮罩让文字更清晰。图片仅保存在本机。",
      chatBgPreset: "预设背景",
      chatBgUploadFail: "图片读取失败，请换一张试试",
      chatBgTooLarge: "图片过大，已自动压缩",
      chatBgAdjust: "调整背景",
      chatBgAdjustHint: "拖动图片调整位置，用滑块缩放，满意后点“应用”。",
      chatBgZoom: "缩放",
      chatBgApply: "应用",
      chatBgCancel: "取消",
      chatBgReset: "重置",
      chatBgNoImage: "请先选择一张图片",
      chatBgLoading: "正在读取图片…",
      chatBgCancelPick: "已取消选择",
      chatBgPermission: "需要相册权限才能选择图片，请在系统设置中允许",
      cDefault: "默认",
      cMint: "薄荷",
      cLilac: "淡紫",
      cSand: "暖灰",
      rRound: "圆润",
      rMedium: "适中",
      rSquare: "方正",
      wNormal: "标准",
      wWide: "加宽",
      balance: "账户余额",
      balanceCheck: "查看余额",
      balanceChecking: "查询中…",
      balanceAvailable: "余额可用",
      balanceUnavailable: "余额不足",
      balanceTotal: "总余额",
      priceTable: "API 价格表",
      priceRef: "参考价，单位 USD / 1M tokens，以官网为准",
      priceEdit: "编辑价格",
      pricePeak: "高峰",
      priceOff: "非高峰",
      priceCacheHit: "缓存命中",
      priceCacheMiss: "缓存未命中",
      priceOutput: "输出",
      priceExtras: "其他计费",
      priceSaved: "价格表已保存",
      priceTip: "高峰：周一至周五 01:00-04:00、06:00-10:00 UTC，节假日除外",
      balanceGranted: "赠送",
      balanceTopped: "充值",
      balanceNoKey: "请先填写并保存 API Key",
      balanceInvalid: "密钥无效或已过期",
      balanceNetwork: "网络异常，请稍后重试",
      balanceFailed: "查询失败",
      balanceUpdated: "更新于",
      roleGroup: "角色",
      characters: "角色卡",
      characterNone: "未设置",
      characterNew: "新建角色",
      characterEdit: "编辑角色",
      characterName: "角色名称",
      characterNamePh: "例如：林工，材料顾问",
      characterPersonality: "性格标签",
      characterPersonalityPh: "例如：外向、毒舌、护短（逗号分隔）",
      worldGroup: "群聊场景（世界书）",
      worldName: "场景名称",
      worldBackground: "场景背景设定",
      worldBackgroundPh: "例如：一间深夜还亮着灯的材料实验室",
      worldMembers: "在场成员",
      worldMemberHint: "勾选的角色作为群成员在场，主角色仍只有当前角色发言",
      worldSaved: "群聊场景已保存",
      characterAvatar: "角色头像",
      characterAvatarPick: "选择头像",
      characterAvatarNone: "未设置",
      characterPersona: "人设描述",
      characterPersonaPh: "例如：你是资深冷轧工艺工程师，说话简短，先给结论再给参数。",
      characterGreeting: "开场白",
      characterGreetingPh: "例如：说吧，这次遇到什么问题？",
      characterSave: "保存",
      characterUse: "设为当前角色",
      characterClear: "取消使用角色",
      characterDelete: "删除角色",
      characterEmpty: "还没有角色卡",
      characterNeedName: "请填写角色名称",
      characterSaved: "角色已保存",
      characterDeleted: "角色已删除",
      characterOn: "已启用",
      characterOff: "已停用",
      memory: "对话记忆",
      memoryAuto: "自动记录对话",
      memoryAutoHint: "每次发送后把最新一句存入记忆，最多 20 条",
      memoryEmpty: "还没有记忆条目",
      memoryAdd: "添加记忆",
      memoryPh: "例如：用户做冷轧板材生意，关心报价与账期",
      memorySaved: "记忆已保存",
      memoryCleared: "记忆已清空",
      memoryLimit: "最多保留 20 条",
      memoryNeedText: "请先输入内容",
      memoryCount: "条",
      daily: "按天记忆",
      dailyGroup: "按天归档",
      dailyStorage: "存储位置",
      dailyStorageLocal: "浏览器本地",
      dailyStorageDir: "文件夹",
      dailyPick: "选择文件夹",
      dailyPickHint: "选择一个文件夹后，每天的记忆会写成 YYYY-MM-DD.md",
      dailyRecord: "按天记录对话",
      dailyRecordHint: "每轮问答结束后追加到当天的 md 文件",
      dailyDays: "跨天加载",
      dailyDaysHint: "新一天开始时读取前几天的记忆文件",
      dailyDaysValue: "最近 {n} 天",
      dailyList: "记忆文件",
      dailyEmpty: "还没有按天记录",
      dailyChars: "字",
      dailyExport: "导出",
      dailyUnsupported: "当前浏览器不支持选择文件夹，已改用浏览器本地存储",
      dailyNoPerm: "需要重新授权文件夹访问",
      dailyGrant: "授权访问",
      dailySaved: "已写入当天记忆",
      dailyInjected: "已加载 {n} 天历史记忆",
      pickCharacter: "选择角色开始对话",
      noCharacter: "不使用角色",
      picked: "本次对话使用「{n}」",
      charInChat: "角色：{n}",
      pickedNone: "本次对话不使用角色",
      ctx: "上下文",
      ctxRole: "当前角色",
      ctxMemory: "长期记忆",
      ctxDaily: "按天记忆",
      ctxInject: "注入概览",
      ctxNoRole: "未使用角色",
      ctxNoMem: "暂无记忆条目",
      ctxNoDays: "暂无按天记录",
      ctxWaiting: "发一条消息后显示实际注入的上下文",
      ctxChars: "字",
      ctxItems: "条",
      ctxDays: "天",
      ctxSystem: "系统提示词",
      ctxRecent: "最近更新",
      ctxNote: "以上为本次请求实际拼入 system 的内容来源",
      ctxCache: "缓存命中",
      savedToDevice: "已保存 {n}，可在分享面板中转存",
      downloadFailed: "保存文件失败，请重试",
      obWelcome: "欢迎使用 chatbot",
      obWelcomeSub: "你的随身 AI 助手，几步设置即可开始对话",
      obAppearance: "选择外观",
      obAppearanceSub: "随时可以在设置里更改",
      obThemeColor: "主题配色",
      obConnect: "连接 DeepSeek",
      obConnectSub: "填入 API Key 即可开始，也可以稍后再设置",
      obApiKeyPh: "粘贴 API Key（sk-...）",
      obUseKey: "保存并继续",
      obSkipForNow: "稍后设置",
      obKeyHint: "API Key 仅保存在本机，用于直接调用 DeepSeek 接口",
      obReady: "准备就绪",
      obReadySub: "一切就绪，开始你的第一段对话吧",
      obStart: "开始对话",
      obSkip: "跳过",
      obNext: "下一步",
      obPrev: "上一步",
      obStep1: "开始",
      obStep2: "外观",
      obStep3: "连接",
      obStep4: "完成"
    },
    en: {
      title: "Settings",
      account: "Account",
      accountMgr: "Account",
      data: "Data",
      app: "App",
      language: "Language",
      appearance: "Appearance",
      fontSize: "Text size",
      personalize: "Personalization",
      voiceGroup: "Voice",
      voice: "Read-aloud voice",
      about: "About",
      update: "Check for updates",
      terms: "Terms of service",
      help: "Help & feedback",
      logout: "Sign out",
      modelName: "Model: Deepseek Chat",
      zhCN: "Chinese (Simplified)",
      enUS: "English",
      light: "Light",
      dark: "Dark",
      system: "System",
      systemShort: "System",
      stella: "Stella (female)",
      tide: "Tide (male)",
      apiKey: "API Key",
      keyPlaceholder: "Enter API Key",
      keyHint:
        "The API Key is stored only in this browser and used to call the DeepSeek API directly.",
      save: "Save",
      clear: "Clear",
      localData: "Local chats",
      importChat: "Import chat history",
      importUrl: "Import from link",
      importUrlHint: "Paste the download URL of a chat backup ZIP",
      importUrlPh: "https://example.com/backup.zip",
      importUrlStart: "Import",
      importUrlInvalid: "Enter a valid http(s) URL",
      importUrlFetch: "Downloading backup…",
      importUrlFail: "Download failed, check the URL or network",
      importUrlNoInput: "Import control not found, use file import instead",
      exportChat: "Export all chats",
      deleteChat: "Delete all chats",
      dataHint:
        "Import a ZIP file exported from DeepSeek. Exports include all chats and local images, but not your API Key.",
      cancel: "Cancel",
      back: "Back",
      soon: "Not available in this demo",
      keyEmpty: "Enter an API Key first",
      keySaved: "Saved, reloading…",
      keyCleared: "API Key removed from this browser",
      exporting: "Exporting chats…",
      noExport: "Export entry not found, try again later",
      noImport: "Upload entry not found, try again later",
      deleting: "Deleting…",
      deleted: "All chats deleted",
      confirmTitle: "All chats will be cleared and cannot be recovered",
      switching: "Switching language…",
      importing: "Importing…",
      imported: "Import finished. Check the chat list.",
      fontSize: "Text size",
      fsSmall: "Small",
      fsNormal: "Default",
      fsLarge: "Large",
      fsXL: "Extra large",
      density: "Compact mode",
      densityHint: "Reduce spacing to fit more messages on screen",
      caveatToggle: "Show AI notice",
      caveatHint: "The “AI-generated” note under the composer",
      checking: "Checking for updates…",
      upToDate: "You're up to date",
      updateFound: "New version available",
      updateFailed: "Update check failed, try again later",
      updateAction: "Download & install",
      later: "Later",
      downloading: "Downloading update…",
      installing: "Opening installer, please confirm on system page",
      updateGrant: "Please allow installing unknown apps for this app, then retry",
      updateNoServer: "No update server configured",
      rollback: "Roll back to previous version",
      rollbackHint: "Installation issue? Restore the version before the update",
      rollbackConfirm: "Roll back to the previous version?",
      rollbackDone: "Opening installer, please confirm the rollback on system page",
      noBackup: "No previous version to roll back to",
      updateBadge: "Update available",
      updateNotes: "What's new",
      diag: "Copy diagnostics",
      diagHint: "Attach this info when reporting an issue",
      copied: "Copied to clipboard",
      copyFailed: "Copy failed, please select manually",
      faq: "FAQ",
      logoutTitle: "Your local data will be erased permanently",
      logoutNote: "This clears the stored API Key, all chats and preferences.",
      logoutAction: "Sign out",
      source: "Source code",
      sourceValue: "GitHub",
      sourceFooter: "Source: ",
      bubbleGroup: "Chat bubbles",
      bubbleColor: "Bubble color",
      bubbleRadius: "Bubble corners",
      bubbleWidth: "Bubble width",
      bubblePreview: "Hi, this is a sample message",
      wechatMode: "WeChat-style UI",
      wechatModeHint: "Switch the chat list and header to WeChat style",
      chatBg: "Chat background",
      chatBgGroup: "Chat background",
      chatBgApplied: "Background applied",
      chatBgNone: "Default",
      chatBgImage: "Custom image",
      chatBgOpacity: "Overlay strength",
      chatBgOpacityHint: "Higher value makes the background lighter and text clearer",
      chatBgPick: "Choose image",
      chatBgClear: "Clear image",
      chatBgHint: "Pick an image as your chat background and adjust the overlay for clearer text. The image stays on this device.",
      chatBgPreset: "Presets",
      chatBgUploadFail: "Could not read the image, please try another",
      chatBgTooLarge: "Image was too large and has been compressed",
      chatBgAdjust: "Adjust background",
      chatBgAdjustHint: "Drag to reposition, use the slider to zoom, then tap Apply.",
      chatBgZoom: "Zoom",
      chatBgApply: "Apply",
      chatBgCancel: "Cancel",
      chatBgReset: "Reset",
      chatBgNoImage: "Please choose an image first",
      chatBgLoading: "Loading image…",
      chatBgCancelPick: "Selection cancelled",
      chatBgPermission: "Photo library access is required. Please allow it in system settings",
      cDefault: "Default",
      cMint: "Mint",
      cLilac: "Lilac",
      cSand: "Sand",
      rRound: "Rounded",
      rMedium: "Medium",
      rSquare: "Square",
      wNormal: "Standard",
      wWide: "Wide",
      balance: "Balance",
      balanceCheck: "Check balance",
      balanceChecking: "Checking…",
      balanceAvailable: "Sufficient",
      balanceUnavailable: "Insufficient",
      balanceTotal: "Total",
      priceTable: "API pricing",
      priceRef: "Reference, USD per 1M tokens. Check official docs.",
      priceEdit: "Edit prices",
      pricePeak: "Peak",
      priceOff: "Off-peak",
      priceCacheHit: "Cache hit",
      priceCacheMiss: "Cache miss",
      priceOutput: "Output",
      priceExtras: "Other charges",
      priceSaved: "Pricing saved",
      priceTip: "Peak: Mon-Fri 01:00-04:00 & 06:00-10:00 UTC, excluding holidays",
      balanceGranted: "Granted",
      balanceTopped: "Topped up",
      balanceNoKey: "Save an API Key first",
      balanceInvalid: "Key is invalid or expired",
      balanceNetwork: "Network error, try again later",
      balanceFailed: "Request failed",
      balanceUpdated: "Updated",
      roleGroup: "Characters",
      characters: "Character cards",
      characterNone: "None",
      characterNew: "New character",
      characterEdit: "Edit character",
      characterName: "Name",
      characterNamePh: "e.g. Lin, materials advisor",
      characterPersonality: "Personality tags",
      characterPersonalityPh: "e.g. outgoing, sarcastic, loyal (comma separated)",
      worldGroup: "Group scene (World Book)",
      worldName: "Scene name",
      worldBackground: "Scene background",
      worldBackgroundPh: "e.g. A materials lab still lit late at night",
      worldMembers: "Present members",
      worldMemberHint: "Checked characters are present; only the main character speaks",
      worldSaved: "Group scene saved",
      characterAvatar: "Avatar",
      characterAvatarPick: "Choose image",
      characterAvatarNone: "None",
      characterPersona: "Persona",
      characterPersonaPh: "e.g. You are a senior cold-rolling engineer. Be brief, conclusion first.",
      characterGreeting: "Greeting",
      characterGreetingPh: "e.g. What are we dealing with today?",
      characterSave: "Save",
      characterUse: "Use this character",
      characterClear: "Stop using character",
      characterDelete: "Delete",
      characterEmpty: "No character cards yet",
      characterNeedName: "Name is required",
      characterSaved: "Character saved",
      characterDeleted: "Character deleted",
      characterOn: "Active",
      characterOff: "Inactive",
      memory: "Chat memory",
      memoryAuto: "Auto-record chats",
      memoryAutoHint: "Save the latest message after each send, max 20",
      memoryEmpty: "No memory yet",
      memoryAdd: "Add memory",
      memoryPh: "e.g. User sells cold-rolled steel, cares about quotes and payment terms",
      memorySaved: "Memory saved",
      memoryCleared: "Memory cleared",
      memoryLimit: "Max 20 entries",
      memoryNeedText: "Enter something first",
      memoryCount: "",
      daily: "Daily memory",
      dailyGroup: "Daily archive",
      dailyStorage: "Storage",
      dailyStorageLocal: "Browser storage",
      dailyStorageDir: "Folder",
      dailyPick: "Choose folder",
      dailyPickHint: "Each day is written as a YYYY-MM-DD.md file in that folder",
      dailyRecord: "Record by day",
      dailyRecordHint: "Append each exchange to today's md file",
      dailyDays: "Load previous days",
      dailyDaysHint: "Read earlier memory files when a new day starts",
      dailyDaysValue: "Last {n} days",
      dailyList: "Memory files",
      dailyEmpty: "Nothing recorded yet",
      dailyChars: "chars",
      dailyExport: "Export",
      dailyUnsupported: "Folder picking is not supported here; using browser storage",
      dailyNoPerm: "Folder access needs to be granted again",
      dailyGrant: "Grant access",
      dailySaved: "Saved to today's memory",
      dailyInjected: "Loaded {n} day(s) of history",
      pickCharacter: "Pick a character",
      noCharacter: "No character",
      picked: "Using 「{n}」 for this chat",
      charInChat: "Character: {n}",
      pickedNone: "No character for this chat",
      ctx: "Context",
      ctxRole: "Character",
      ctxMemory: "Long-term memory",
      ctxDaily: "Daily memory",
      ctxInject: "Injection",
      ctxNoRole: "No character",
      ctxNoMem: "No memory yet",
      ctxNoDays: "No daily files",
      ctxWaiting: "Send a message to see the injected context",
      ctxChars: "chars",
      ctxItems: "items",
      ctxDays: "days",
      ctxSystem: "System prompt",
      ctxRecent: "Updated",
      ctxNote: "What this request actually put into the system prompt",
      ctxCache: "Cache hits",
      savedToDevice: "Saved {n}, use the share sheet to keep it",
      downloadFailed: "Failed to save file, please retry",
      obWelcome: "Welcome to chatbot",
      obWelcomeSub: "Your pocket AI assistant. A few steps and you're ready to chat.",
      obAppearance: "Choose appearance",
      obAppearanceSub: "You can change this anytime in Settings",
      obThemeColor: "Theme color",
      obConnect: "Connect to DeepSeek",
      obConnectSub: "Paste your API Key to begin, or set it up later",
      obApiKeyPh: "Paste API Key (sk-...)",
      obUseKey: "Save & continue",
      obSkipForNow: "Set up later",
      obKeyHint: "The API Key stays on this device and is used to call DeepSeek directly",
      obReady: "All set",
      obReadySub: "You're ready. Start your first conversation.",
      obStart: "Start chatting",
      obSkip: "Skip",
      obNext: "Next",
      obPrev: "Back",
      obStep1: "Start",
      obStep2: "Look",
      obStep3: "Connect",
      obStep4: "Done"
    }
  };

  /* 未显式设置语言时，跟随系统语言（与应用自身的默认行为保持一致） */
  function effectiveLocale() {
    var v = read(KEY.locale, "");
    if (v) return v;
    var nav = navigator.language || navigator.userLanguage || "zh-CN";
    return /^en/i.test(nav) ? "en-US" : "zh-CN";
  }

  function isEN() {
    return effectiveLocale().indexOf("en") === 0;
  }

  function t(key) {
    return (isEN() ? STR.en : STR.zh)[key] || STR.zh[key] || key;
  }

  /* ---------------- 存储读取 ---------------- */
  function read(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v === null || v === "" ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      return false;
    }
  }

  function currentTheme() {
    var v = read(KEY.theme, "system");
    return v === "light" || v === "dark" ? v : "system";
  }

  function themeLabel() {
    var v = currentTheme();
    return v === "light" ? t("light") : v === "dark" ? t("dark") : t("systemShort");
  }

  function localeLabel() {
    return isEN() ? t("enUS") : t("zhCN");
  }

  function voiceValue() {
    var v = read(KEY.voice, "stella");
    return v === "tide" ? "tide" : "stella";
  }

  function prefersDark() {
    var v = currentTheme();
    if (v === "dark") return true;
    if (v === "light") return false;
    return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  }

  /* ---------------- 与原应用交互 ---------------- */
  function dialogEl() {
    var d = document.querySelector(DIALOG);
    if (!d) return null;
    // 结构判定，不依赖界面语言
    if (!d.querySelector('[class*="dialogMain-"]')) return null;
    return d;
  }

  function normalize(el) {
    return (el.textContent || "").replace(/\s+/g, "").trim();
  }

  function findButton(scope, test) {
    if (!scope) return null;
    var list = scope.querySelectorAll('button, [role="option"], [role="menuitem"]');
    for (var i = 0; i < list.length; i++) {
      if (test(normalize(list[i]))) return list[i];
    }
    return null;
  }

  /* 从链接导入：下载 ZIP → DataTransfer 注入原应用 file input → 复用其解析 */
  var importUrlMask = null;
  function closeImportUrl() {
    if (importUrlMask && importUrlMask.parentNode) importUrlMask.parentNode.removeChild(importUrlMask);
    importUrlMask = null;
  }

  function openImportUrl() {
    closeImportUrl();
    importUrlMask = document.createElement("div");
    importUrlMask.className = "skp-mask";
    var box = document.createElement("div");
    box.className = "sk-iu-box";
    box.innerHTML =
      '<div class="sk-iu-title">' + t("importUrl") + "</div>" +
      '<p class="sk-iu-hint">' + t("importUrlHint") + "</p>" +
      '<input type="url" class="sk-iu-input" placeholder="' + escapeAttr(t("importUrlPh")) + '">' +
      '<div class="sk-iu-actions">' +
      '<button type="button" class="sk-btn" data-iu="cancel">' + t("cancel") + "</button>" +
      '<button type="button" class="sk-btn primary" data-iu="go">' + t("importUrlStart") + "</button>" +
      "</div>";
    importUrlMask.appendChild(box);
    document.body.appendChild(importUrlMask);
    importUrlMask.addEventListener("click", function (e) {
      if (e.target === importUrlMask) { closeImportUrl(); return; }
      var b = e.target.closest("[data-iu]");
      if (!b) return;
      if (b.getAttribute("data-iu") === "cancel") { closeImportUrl(); return; }
      var url = (box.querySelector(".sk-iu-input").value || "").trim();
      if (!/^https?:\/\//i.test(url)) { toast(t("importUrlInvalid")); return; }
      closeImportUrl();
      downloadAndImport(url);
    });
  }

  function downloadAndImport(url) {
    toast(t("importUrlFetch"));
    fetch(url, { mode: "cors", credentials: "omit" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.blob();
      })
      .then(function (blob) {
        var name = (url.split("?")[0].split("/").pop() || "backup.zip").replace(/[^A-Za-z0-9._-]/g, "_");
        if (!/\.(zip)$/i.test(name)) name += ".zip";
        var file = new File([blob], name, { type: "application/zip" });
        return injectBackupFile(file);
      })
      .catch(function () {
        toast((window.NativeGallery || !isNative()) ? t("importUrlFail") : t("importUrlFail"));
      });
  }

  function injectBackupFile(file) {
    return new Promise(function (resolve, reject) {
      openDataTab(function (dlg) {
        if (!dlg) { toast(t("importUrlNoInput")); reject(new Error("no dialog")); return; }
        // 找到原应用数据页里的 file input
        var input = null;
        var candidates = dlg.querySelectorAll('input[type="file"]');
        if (candidates.length) {
          input = candidates[0];
        } else {
          // 点"上传"按钮触发应用创建 file input（短暂延迟后查找全局）
          var btn = findButton(dlg, function (txt) { return txt === "上传" || txt === "Upload"; });
          if (btn) btn.click();
        }
        setTimeout(function () {
          if (!input) {
            var all = document.querySelectorAll('input[type="file"]');
            if (all.length) input = all[all.length - 1];
          }
          if (!input) { toast(t("importUrlNoInput")); reject(new Error("no input")); return; }
          try {
            var dt = new DataTransfer();
            dt.items.add(file);
            input.files = dt.files;
            input.dispatchEvent(new Event("change", { bubbles: true }));
            toast(t("importing"));
            resolve(true);
          } catch (e) {
            toast(t("importUrlNoInput"));
            reject(e);
          }
        }, 200);
      });
    });
  }

  function openDataTab(done) {
    var dlg = dialogEl();
    if (!dlg) {
      done(null);
      return;
    }
    var tab = findButton(dlg, function (txt) {
      return txt === t("data");
    });
    if (tab) tab.click();
    setTimeout(function () {
      done(dlg);
    }, 160);
  }

  var toastTimer = null;

  /* ---------------- 原生（Capacitor）适配 ---------------- */
  function nativeRuntime() {
    var c = window.Capacitor;
    if (!c) return null;
    var isNative = c.isNativePlatform ? c.isNativePlatform() : c.isNative;
    return isNative ? c : null;
  }

  function isNative() {
    return !!nativeRuntime();
  }

  /* 直接按插件名调用原生方法，避免依赖打包进来的 JS 包装层 */
  function nativeCall(plugin, method, opts) {
    var c = nativeRuntime();
    if (!c) return Promise.reject(new Error("not native"));
    try {
      if (typeof c.nativePromise === "function") return c.nativePromise(plugin, method, opts || {});
      var P = c.Plugins || {};
      if (P[plugin] && typeof P[plugin][method] === "function") return P[plugin][method](opts || {});
    } catch (e) {}
    return Promise.reject(new Error("plugin unavailable: " + plugin));
  }

  /* WebView 里 window.open 不会开新窗口，统一走系统浏览器 */
  function openExternal(url) {
    if (!isNative()) {
      window.open(url, "_blank", "noopener");
      return;
    }
    nativeCall("Browser", "open", { url: url }).catch(function () {
      nativeCall("Share", "share", { url: url }).catch(function () {});
    });
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () {
        var out = String(fr.result || "");
        resolve(out.slice(out.indexOf(",") + 1));
      };
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }

  /* Android WebView 不支持 <a download>，改成写缓存目录再拉起分享面板 */
  function installNativeDownloads() {
    // 注意：Capacitor 的 window.Capacitor 可能在页面脚本之后才注入，
    // 因此这里无条件挂监听，在点击时再判断是否原生环境。
    document.addEventListener(
      "click",
      function (e) {
        if (!isNative()) return;
        var a = e.target && e.target.closest && e.target.closest("a[download]");
        if (!a) return;
        var href = a.getAttribute("href") || "";
        if (href.indexOf("blob:") !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        var name = (a.getAttribute("download") || "download").replace(/[\\/:*?"<>|]/g, "_");
        fetch(href)
          .then(function (r) {
            return r.blob();
          })
          .then(blobToBase64)
          .then(function (b64) {
            return nativeCall("Filesystem", "writeFile", {
              path: name,
              data: b64,
              directory: "CACHE",
              encoding: "base64"
            });
          })
          .then(function (w) {
            toast(t("savedToDevice").replace("{n}", name));
            return nativeCall("Share", "share", { title: name, url: w && w.uri }).catch(function () {});
          })
          .catch(function () {
            toast(t("downloadFailed"));
          });
      },
      true
    );
  }

  function toast(text) {
    var old = document.querySelectorAll(".sk-toast");
    for (var i = 0; i < old.length; i++) {
      if (old[i].parentNode) old[i].parentNode.removeChild(old[i]);
    }
    var el = document.createElement("div");
    el.className = "sk-toast";
    el.textContent = text;
    document.body.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }, 2200);
  }

  function closeSettings() {
    var dlg = dialogEl();
    if (!dlg) {
      unmount();
      return;
    }
    var closeBtn =
      dlg.querySelector('[aria-label="关闭"], [aria-label="Close"]') ||
      dlg.querySelector("button");
    if (closeBtn) closeBtn.click();
    setTimeout(check, 60);
  }

  /* ---------------- 结构片段 ---------------- */
  function row(act, ico, label, value, opts) {
    opts = opts || {};
    var iconHtml = ico === "aa" ? '<span class="sk-aa">AA</span>' : icon(ico);
    return (
      '<button type="button" class="sk-row' +
      (opts.danger ? " sk-danger" : "") +
      '" data-act="' +
      act +
      '" ' +
      (opts.attr || "") +
      ">" +
      '<span class="sk-ico">' +
      iconHtml +
      "</span>" +
      '<span class="sk-label">' +
      label +
      "</span>" +
      (value ? '<span class="sk-val">' + value + "</span>" : "") +
      '<span class="sk-arrow">' +
      icon("right") +
      "</span>" +
      "</button>"
    );
  }

  function header(title, act) {
    return (
      '<div class="sk-header">' +
      '<button type="button" class="sk-back" data-act="' +
      act +
      '" aria-label="' +
      t("back") +
      '">' +
      icon("left") +
      "</button>" +
      "<h1>" +
      title +
      "</h1>" +
      "<span></span>" +
      "</div>"
    );
  }

  function mainHtml() {
    return (
      '<div class="sk-page">' +
      header(t("title"), "close") +
      '<div class="sk-group">' +
      t("account") +
      "</div>" +
      '<section class="sk-card">' +
      row("account", "user", t("accountMgr")) +
      row("data", "db", t("data")) +
      "</section>" +
      '<div class="sk-group">' +
      t("app") +
      "</div>" +
      '<section class="sk-card">' +
      row("language", "globe", t("language"), localeLabel()) +
      row("appearance", "sun", t("appearance"), themeLabel()) +
      row("fontsize", "aa", t("fontSize")) +
      row("personalize", "sliders", t("personalize")) +
      "</section>" +
      '<div class="sk-group">' +
      t("voiceGroup") +
      "</div>" +
      '<section class="sk-card">' +
      row("voice", "speaker", t("voice")) +
      "</section>" +
      '<div class="sk-group">' +
      t("about") +
      "</div>" +
      '<section class="sk-card">' +
      row("update", "info", t("update"), versionLabel()) +
      ((window.NativeUpdater && window.NativeUpdater.hasBackup &&
        window.NativeUpdater.hasBackup() === "1")
        ? row("rollback", "layers", t("rollback"), "", { hint: t("rollbackHint") })
        : "") +
      row("terms", "doc", t("terms")) +
      row("source", "link", t("source"), t("sourceValue")) +
      "</section>" +
      '<div class="sk-gap"></div>' +
      '<section class="sk-card">' +
      row("help", "help", t("help")) +
      "</section>" +
      '<div class="sk-gap"></div>' +
      '<section class="sk-card">' +
      row("logout", "logout", t("logout")) +
      "</section>" +
      '<div class="sk-footer">' +
      t("modelName") +
      "<br>" +
      t("sourceFooter") +
      '<a href="' + SOURCE_URL + '" target="_blank" rel="noreferrer">' + SOURCE_TEXT + "</a>" +
      "</div>" +
      "</div>"
    );
  }

  /* ---------------- API 价格表（内置参考价，可编辑） ---------------- */
  var PRICE_KEY = "chat-demo:api-prices";
  var DEFAULT_PRICES = {
    models: [
      { name: "deepseek-flash", peak: { hit: 0.006, miss: 0.3, out: 1.2 }, off: { hit: 0.003, miss: 0.15, out: 0.6 } },
      { name: "deepseek-v4-pro", peak: { hit: 0.044, miss: 1.32, out: 3.96 }, off: { hit: 0.022, miss: 0.66, out: 1.98 } }
    ],
    extras: [
      { name: "Search / Fetch API", price: "$0.75 / 1,000 req" },
      { name: "File parsing / OCR", price: "$0.225 / 1,000 pages" },
      { name: "TTS", price: "$0.225 / 10k chars" },
      { name: "ASR", price: "$0.058 / hour" }
    ],
    updated: "2026-11-19"
  };

  function readPrices() {
    var raw = read(PRICE_KEY, "");
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_PRICES));
    try {
      var o = JSON.parse(raw);
      if (o && Array.isArray(o.models) && o.models.length) return o;
    } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULT_PRICES));
  }

  function writePrices(o) {
    write(PRICE_KEY, JSON.stringify(o));
  }

  function pricesHtml() {
    var p = readPrices();
    var rows = p.models.map(function (m, i) {
      return (
        '<div class="sk-price-model"><div class="sk-price-name">' + escapeHtml(m.name) + "</div>" +
        '<div class="sk-price-grid">' +
        '<span class="sk-price-k">' + t("pricePeak") + '</span>' +
        '<span class="sk-price-v">' + t("priceCacheHit") + ' $' + m.peak.hit + '</span>' +
        '<span class="sk-price-v">' + t("priceCacheMiss") + ' $' + m.peak.miss + '</span>' +
        '<span class="sk-price-v">' + t("priceOutput") + ' $' + m.peak.out + '</span>' +
        '<span class="sk-price-k">' + t("priceOff") + '</span>' +
        '<span class="sk-price-v">' + t("priceCacheHit") + ' $' + m.off.hit + '</span>' +
        '<span class="sk-price-v">' + t("priceCacheMiss") + ' $' + m.off.miss + '</span>' +
        '<span class="sk-price-v">' + t("priceOutput") + ' $' + m.off.out + '</span>' +
        "</div></div>"
      );
    }).join("");
    var extras = (p.extras || []).map(function (x) {
      return '<div class="sk-price-extra"><span>' + escapeHtml(x.name) + "</span><b>" + escapeHtml(x.price) + "</b></div>";
    }).join("");
    return (
      '<div class="sk-page">' +
      header(t("priceTable"), "back") +
      '<div class="sk-bg-hint">' + t("priceRef") + "（" + escapeHtml(p.updated || "") + "）</div>" +
      '<section class="sk-card">' + rows + "</section>" +
      '<div class="sk-group">' + t("priceExtras") + "</div>" +
      '<section class="sk-card">' + (extras || '<p class="sk-hint">—</p>') + "</section>" +
      '<p class="sk-bg-hint">' + t("priceTip") + "</p>" +
      '<div class="sk-bg-actions"><button type="button" class="sk-btn primary" data-act="price-edit">' + t("priceEdit") + "</button></div>" +
      "</div>"
    );
  }

  function priceEditHtml() {
    var p = readPrices();
    var fields = "";
    p.models.forEach(function (m, mi) {
      [["peak", t("pricePeak")], ["off", t("priceOff")]].forEach(function (band) {
        var bk = band[0], bl = band[1];
        ["hit", "miss", "out"].forEach(function (k) {
          var label = { hit: t("priceCacheHit"), miss: t("priceCacheMiss"), out: t("priceOutput") }[k];
          fields +=
            '<div class="sk-field"><label>' + escapeHtml(m.name + " · " + bl + " · " + label) + "</label>" +
            '<input type="number" step="0.001" min="0" data-price="' + mi + "-" + bk + "-" + k +
            '" value="' + m[bk][k] + '"></div>';
        });
      });
    });
    return (
      '<div class="sk-page">' + header(t("priceEdit"), "back") +
      '<div class="sk-bg-hint">' + t("priceRef") + "</div>" +
      '<section class="sk-card sk-panel">' + fields + "</section>" +
      '<div class="sk-bg-actions"><button type="button" class="sk-btn primary" data-act="price-save">' + t("characterSave") + "</button></div>" +
      "</div>"
    );
  }

  function balanceBlock() {
    var st = balanceState;
    var body;
    if (!st) {
      body = '<p class="sk-hint" style="margin:0">' + t("balanceCheck") + "</p>";
    } else if (st.loading) {
      body = '<p class="sk-hint" style="margin:0">' + t("balanceChecking") + "</p>";
    } else if (st.error) {
      body = '<p class="sk-hint sk-err" style="margin:0">' + escapeHtml(st.error) + "</p>";
    } else {
      var infos = (st.data && st.data.balance_infos) || [];
      var badge = st.data && st.data.is_available ? t("balanceAvailable") : t("balanceUnavailable");
      var rows = infos
        .map(function (b) {
          var sym = b.currency === "USD" ? "$" : "¥";
          return (
            '<div class="sk-bal-row"><span class="sk-bal-cur">' +
            escapeHtml(b.currency) +
            '</span><b class="sk-bal-num">' +
            sym +
            escapeHtml(b.total_balance) +
            "</b></div>" +
            '<div class="sk-bal-sub">' +
            t("balanceGranted") +
            " " +
            sym +
            escapeHtml(b.granted_balance) +
            " · " +
            t("balanceTopped") +
            " " +
            sym +
            escapeHtml(b.topped_up_balance) +
            "</div>"
          );
        })
        .join("");
      body =
        '<div class="sk-bal-head"><span class="sk-badge' +
        (st.data && st.data.is_available ? " is-ok" : " is-bad") +
        '">' +
        badge +
        "</span>" +
        (st.at ? '<span class="sk-bal-time">' + t("balanceUpdated") + " " + new Date(st.at).toLocaleTimeString() + "</span>" : "") +
        "</div>" +
        (rows || '<p class="sk-hint" style="margin:0">' + t("balanceFailed") + "</p>");
    }
    return (
      '<div class="sk-group">' + t("balance") + "</div>" +
      '<section class="sk-card sk-panel">' +
      '<div class="sk-bal">' + body + "</div>" +
      '<div class="sk-actions"><button type="button" class="sk-btn primary" data-act="check-balance"' +
      (st && st.loading ? " disabled" : "") +
      ">" + (st && st.loading ? t("balanceChecking") : t("balanceCheck")) + "</button>" +
      '<button type="button" class="sk-btn" data-act="prices">' + t("priceTable") + "</button></div>" +
      "</section>"
    );
  }

  function accountHtml() {
    var key = state.keyDraft != null ? state.keyDraft : read(KEY.apiKey, "");
    return (
      '<div class="sk-page">' +
      header(t("accountMgr"), "back") +
      '<div class="sk-group">' +
      t("apiKey") +
      "</div>" +
      '<section class="sk-card sk-panel">' +
      '<div class="sk-field"><input id="sk-api-key" data-field="apiKey" type="password" autocomplete="off" ' +
      'spellcheck="false" placeholder="' +
      t("keyPlaceholder") +
      '" value="' +
      escapeAttr(key) +
      '"></div>' +
      '<p class="sk-hint">' +
      t("keyHint") +
      "</p>" +
      '<div class="sk-actions">' +
      '<button type="button" class="sk-btn primary" data-act="save-key">' +
      t("save") +
      "</button>" +
      '<button type="button" class="sk-btn" data-act="clear-key">' +
      t("clear") +
      "</button>" +
      "</div>" +
      "</section>" +
      balanceBlock() +
      "</div>"
    );
  }

  function dataHtml() {
    return (
      '<div class="sk-page">' +
      header(t("data"), "back") +
      '<div class="sk-group">' +
      t("roleGroup") +
      "</div>" +
      '<section class="sk-card">' +
      row("characters", "user", t("characters"), activeChar() ? escapeHtml(activeChar().name) : t("characterNone")) +
      row("memory", "doc", t("memory"), activeChar() ? readMem(activeChar().id).length + t("memoryCount") : "") +
      "</section>" +
      '<div class="sk-group">' + t("dailyGroup") + "</div>" +
      '<section class="sk-card">' +
      row("daily", "doc", t("daily"), readIndex().length + t("memoryCount")) +
      "</section>" +
      '<div class="sk-group">' +
      t("localData") +
      "</div>" +
      '<section class="sk-card">' +
      row("import", "upload", t("importChat")) +
      row("import-url", "link", t("importUrl")) +
      row("export", "download", t("exportChat")) +
      row("delete", "trash", t("deleteChat"), "", { danger: true }) +
      "</section>" +
      '<p class="sk-desc">' +
      t("dataHint") +
      "</p>" +
      "</div>"
    );
  }

  /* ---------------- 新增：字号 / 个性化 / 关于页 ---------------- */
  var FS_STEPS = ["s", "m", "l", "xl"];
  var FS_LABEL = { s: "fsSmall", m: "fsNormal", l: "fsLarge", xl: "fsXL" };
  var APP_VERSION = { version: "0.1.1", build: "V51" };

  /* 应用内更新：manifest 清单地址（json: {versionName,versionCode,apkUrl,notes}）。
     部署到你的服务器后改这里；也可在设备上用 localStorage["chat-demo:update-url"] 覆盖 */
  var UPDATE_MANIFEST_URL = ""; // 兼容旧方案：自定义 update.json（留空则优先用 GitHub Releases）
  var GH_REPO = "xiguabusgua/chatbot"; // GitHub 更新源
  var AUTO_CHECK_KEY = "chat-demo:last-update-check";
  var AUTO_CHECK_MS = 6 * 60 * 60 * 1000; // 启动静默检查间隔 6 小时

  function versionLabel() {
    return APP_VERSION.version + "（" + APP_VERSION.build + "）";
  }
  var SOURCE_URL = "https://github.com/" + GH_REPO;
  var SOURCE_TEXT = "github.com/" + GH_REPO;

  function readFs() {
    var v = read("chat-demo:font-size", "m");
    return FS_STEPS.indexOf(v) > -1 ? v : "m";
  }

  function readDensity() {
    return read("chat-demo:density", "comfort") === "compact" ? "compact" : "comfort";
  }

  function readCaveat() {
    return read("chat-demo:caveat", "on") !== "off";
  }

  function readWechat() {
    return read("chat-demo:wechat-mode", "off") === "on";
  }

  var BUBBLE_COLORS = ["default", "mint", "lilac", "sand"];
  var BUBBLE_RADII = ["round", "medium", "square"];
  var BUBBLE_WIDTHS = ["normal", "wide"];

  function readBubble() {
    var c = read("chat-demo:bubble-color", "default");
    var r = read("chat-demo:bubble-radius", "round");
    var w = read("chat-demo:bubble-width", "normal");
    return {
      color: BUBBLE_COLORS.indexOf(c) > -1 ? c : "default",
      radius: BUBBLE_RADII.indexOf(r) > -1 ? r : "round",
      width: BUBBLE_WIDTHS.indexOf(w) > -1 ? w : "normal"
    };
  }

  function bubbleLabel(kind) {
    var b = readBubble();
    if (kind === "color") {
      return { default: t("cDefault"), mint: t("cMint"), lilac: t("cLilac"), sand: t("cSand") }[b.color];
    }
    if (kind === "radius") {
      return { round: t("rRound"), medium: t("rMedium"), square: t("rSquare") }[b.radius];
    }
    return { normal: t("wNormal"), wide: t("wWide") }[b.width];
  }

  /* ---------------- 自定义聊天背景 ---------------- */
  var BG_KEY = "chat-demo:chat-bg";
  var BG_PRESETS = [
    { k: "none", zh: "默认", en: "Default", css: "" },
    { k: "aurora", zh: "极光", en: "Aurora", css: "linear-gradient(135deg,#e8f0fe 0%,#f3e8ff 50%,#fce7f3 100%)" },
    { k: "mint", zh: "薄荷", en: "Mint", css: "linear-gradient(135deg,#e0f7ef 0%,#d4f0e4 50%,#e8f5e9 100%)" },
    { k: "sunset", zh: "暖阳", en: "Sunset", css: "linear-gradient(135deg,#fff1e6 0%,#ffe0d1 50%,#ffe8ee 100%)" },
    { k: "ocean", zh: "海盐", en: "Ocean", css: "linear-gradient(135deg,#e3f2fd 0%,#dcecfb 50%,#e0f7fa 100%)" },
    { k: "sand", zh: "暖沙", en: "Sand", css: "linear-gradient(135deg,#f7efe2 0%,#f1e6d4 50%,#f5ece0 100%)" }
  ];

  function clampNum(v, min, max, fallback) {
    var n = Number(v);
    if (isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function readBg() {
    var raw = read(BG_KEY, "{}");
    var o = {};
    try { o = JSON.parse(raw) || {}; } catch (e) {}
    var type = o.type === "image" || o.type === "preset" ? o.type : "none";
    var preset = BG_PRESETS.some(function (p) { return p.k === o.preset; }) ? o.preset : "aurora";
    var op = clampNum(o.opacity, 0, 95, 35);
    var posX = clampNum(o.posX, 0, 100, 50);
    var posY = clampNum(o.posY, 0, 100, 50);
    var scale = clampNum(o.scale, 1, 3, 1);
    return {
      type: type,
      preset: preset,
      image: typeof o.image === "string" ? o.image : "",
      opacity: op,
      posX: posX,
      posY: posY,
      scale: scale
    };
  }

  function writeBg(bg) {
    write(BG_KEY, JSON.stringify({
      type: bg.type,
      preset: bg.preset,
      image: bg.type === "image" ? bg.image : "",
      opacity: bg.opacity,
      posX: bg.posX,
      posY: bg.posY,
      scale: bg.scale
    }));
  }

  function bgLabel() {
    var bg = readBg();
    if (bg.type === "image") return t("chatBgImage");
    if (bg.type === "preset") {
      var p = BG_PRESETS.filter(function (x) { return x.k === bg.preset; })[0];
      return p ? (isEN() ? p.en : p.zh) : t("chatBgNone");
    }
    return t("chatBgNone");
  }

  /* 把背景注入聊天主容器：遮罩层（保证文字可读）+ 背景层（渐变或图片）。
     图片背景支持缩放(--sk-chatbg-size)与位置(--sk-chatbg-pos)，做不同屏幕适配。 */
  function applyChatBg() {
    var bg = readBg();
    var body = document.body;
    var frame = document.querySelector(".frame-_9fdf5");
    var img = "";
    var size = "cover";
    var pos = "center center";
    if (bg.type === "image" && bg.image) {
      img = 'url("' + bg.image + '")';
      size = Math.round(bg.scale * 100) + "%";
      pos = bg.posX + "% " + bg.posY + "%";
    } else if (bg.type === "preset") {
      var p = BG_PRESETS.filter(function (x) { return x.k === bg.preset; })[0];
      img = p ? p.css : "";
    }
    if (!img) {
      body.removeAttribute("data-sk-chatbg");
      if (frame) frame.removeAttribute("data-sk-chatbg");
      return;
    }
    body.setAttribute("data-sk-chatbg", bg.type);
    body.style.setProperty("--sk-chatbg-op", String(bg.opacity / 100));
    body.style.setProperty("--sk-chatbg-img", img);
    body.style.setProperty("--sk-chatbg-size", size);
    body.style.setProperty("--sk-chatbg-pos", pos);
    if (frame) frame.setAttribute("data-sk-chatbg", bg.type);
  }

  /* 压缩上传图片到最长边 1280、JPEG 0.72，避免超出 localStorage 配额 */
  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onerror = function () { reject(new Error("read")); };
      fr.onload = function () {
        var dataUrl = String(fr.result || "");
        var img = new Image();
        img.onerror = function () { reject(new Error("decode")); };
        img.onload = function () {
          var max = 1280;
          var w = img.width || 1;
          var h = img.height || 1;
          var scale = Math.min(1, max / Math.max(w, h));
          var cw = Math.max(1, Math.round(w * scale));
          var ch = Math.max(1, Math.round(h * scale));
          var canvas = document.createElement("canvas");
          canvas.width = cw;
          canvas.height = ch;
          var ctx2 = canvas.getContext("2d");
          if (!ctx2) { resolve(dataUrl); return; }
          ctx2.fillStyle = "#ffffff";
          ctx2.fillRect(0, 0, cw, ch);
          ctx2.drawImage(img, 0, 0, cw, ch);
          try {
            resolve(canvas.toDataURL("image/jpeg", 0.72));
          } catch (e) {
            resolve(dataUrl);
          }
        };
        img.src = dataUrl;
      };
      fr.readAsDataURL(file);
    });
  }

  /* 选图后进入“调整显示区域”预览页：草稿存 state.bgDraft，应用时才写入正式配置 */
  function enterAdjust(dataUrl, compressed) {
    if (!dataUrl) {
      toast(t("chatBgUploadFail"));
      return;
    }
    var cur = readBg();
    state.bgDraft = {
      image: dataUrl,
      opacity: cur.type === "image" ? cur.opacity : 30,
      posX: cur.type === "image" ? cur.posX : 50,
      posY: cur.type === "image" ? cur.posY : 50,
      scale: cur.type === "image" ? cur.scale : 1
    };
    backStack.push("chatbg");
    view = "bg-adjust";
    paint();
    if (compressed) toast(t("chatBgTooLarge"));
  }

  function pickViaFile() {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";
    document.body.appendChild(input);
    var done = false;
    function cleanup() {
      if (done) return;
      done = true;
      if (input.parentNode) input.parentNode.removeChild(input);
    }
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      if (!file) { cleanup(); return; }
      toast(t("chatBgLoading"));
      var big = file.size > 1500000;
      compressImage(file)
        .then(function (dataUrl) { enterAdjust(dataUrl, big); })
        .catch(function () { toast(t("chatBgUploadFail")); })
        .then(cleanup);
    });
    // 用户取消（切回应用但未选图）时清理临时节点
    window.addEventListener("focus", cleanup, { once: true });
    input.click();
  }

  /* 通用选图：直接压缩返回 dataUrl（角色头像用，不走背景调整页） */
  function pickAvatar(cb) {
    if (window.NativeGallery && typeof window.NativeGallery.pick === "function") {
      var cbName = "__skAvatarCb" + Date.now();
      window[cbName] = function (res) {
        try { delete window[cbName]; } catch (e) { window[cbName] = null; }
        if (res && res.ok && res.data) cb("data:image/jpeg;base64," + res.data);
      };
      try { window.NativeGallery.pick(cbName); }
      catch (e) { delete window[cbName]; pickAvatarFile(cb); }
      return;
    }
    pickAvatarFile(cb);
  }

  function pickAvatarFile(cb) {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";
    document.body.appendChild(input);
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      if (!file) { if (input.parentNode) input.parentNode.removeChild(input); return; }
      compressImage(file).then(function (d) { cb(d); }).catch(function () { toast(t("chatBgUploadFail")); })
        .then(function () { if (input.parentNode) input.parentNode.removeChild(input); });
    });
    window.addEventListener("focus", function () {
      if (input.parentNode) input.parentNode.removeChild(input);
    }, { once: true });
    input.click();
  }

  function pickBackgroundImage() {
    if (window.NativeGallery && typeof window.NativeGallery.pick === "function") {
      var cbName = "__skGalleryCb" + Date.now();
      toast(t("chatBgLoading"));
      window[cbName] = function (res) {
        try { delete window[cbName]; } catch (e) { window[cbName] = null; }
        if (!res) { toast(t("chatBgUploadFail")); return; }
        if (!res.ok) {
          if (res.reason === "cancel") toast(t("chatBgCancelPick"));
          else if (res.reason === "permission") toast(t("chatBgPermission"));
          else toast(t("chatBgUploadFail"));
          return;
        }
        // 原生已压缩，直接拼 data URL
        var dataUrl = "data:image/jpeg;base64," + res.data;
        var img = new Image();
        img.onload = function () { enterAdjust(dataUrl, false); };
        img.onerror = function () { toast(t("chatBgUploadFail")); };
        img.src = dataUrl;
      };
      try {
        window.NativeGallery.pick(cbName);
      } catch (e) {
        delete window[cbName];
        pickViaFile();
      }
      return;
    }
    pickViaFile();
  }

  /* ---------------- 右侧上下文边栏 ---------------- */
  var ctxState = null;
  var ctxPanel = null;
  var ctxBtn = null;

  function ctxChar() {
    var id = ctxState && ctxState.charId;
    if (id) return charById(id);
    return activeChar();
  }

  function ctxDaysList() {
    var today = todayKey();
    return readIndex()
      .map(function (x) {
        return x;
      })
      .filter(function (x) {
        return x.date && x.date < today;
      })
      .sort(function (a, b) {
        return a.date < b.date ? 1 : -1;
      })
      .slice(0, dailyDays());
  }

  function renderCtx() {
    if (!ctxPanel) return;
    var body = ctxPanel.querySelector(".skc-body");
    if (!body) return;
    if (!ctxState) {
      body.innerHTML = '<p class="skc-empty">' + t("ctxWaiting") + "</p>";
      return;
    }
    var c = ctxChar();
    var mem = c ? readMem(c.id) : [];
    var days = ctxDaysList();

    var ctxAv = c ? (c.avatar
      ? '<img class="sk-char-avatar-img" src="' + c.avatar + '" alt="">'
      : '<span class="sk-char-avatar-ph">' + escapeHtml((c.name || "?").slice(0, 1)) + "</span>") : "";
    var roleHtml = c
      ? '<div class="skc-role"><span class="sk-char-avatar">' + ctxAv + "</span>" +
        '<span class="skc-role-name">' + escapeHtml(c.name) + "</span>" +
        (c.personality ? '<p class="skc-role-desc">' + escapeHtml(c.personality) + "</p>" : "") +
        (c.persona ? '<p class="skc-role-desc">' + escapeHtml(c.persona) + "</p>" : "") +
        "</div>"
      : '<p class="skc-empty">' + t("ctxNoRole") + "</p>";

    var memHtml = mem.length
      ? '<ul class="skc-list">' +
        mem
          .slice(-6)
          .reverse()
          .map(function (m) {
            return "<li>" + escapeHtml(m.text) + "</li>";
          })
          .join("") +
        "</ul>" +
        (mem.length > 6 ? '<p class="skc-more">+' + (mem.length - 6) + " " + t("ctxItems") + "</p>" : "")
      : '<p class="skc-empty">' + t("ctxNoMem") + "</p>";

    var dayHtml = days.length
      ? '<ul class="skc-days">' +
        days
          .map(function (d) {
            return (
              '<li><span class="skc-date">' + escapeHtml(d.date) + "</span>" +
              '<span class="skc-chars">' + (d.chars || 0) + " " + t("ctxChars") + "</span></li>"
            );
          })
          .join("") +
        "</ul>"
      : '<p class="skc-empty">' + t("ctxNoDays") + "</p>";

    body.innerHTML =
      '<section class="skc-sec"><h3>' + t("ctxRole") +
      '<span class="skc-tag' + (c ? " is-on" : "") + '">' + (c ? c.name : t("ctxNoRole")) + "</span></h3>" +
      roleHtml + "</section>" +
      '<section class="skc-sec"><h3>' + t("ctxMemory") +
      '<span class="skc-count">' + mem.length + " " + t("ctxItems") + "</span></h3>" + memHtml + "</section>" +
      '<section class="skc-sec"><h3>' + t("ctxDaily") +
      '<span class="skc-count">' + days.length + " " + t("ctxDays") + "</span></h3>" + dayHtml + "</section>" +
      '<section class="skc-sec"><h3>' + t("ctxInject") + "</h3>" +
      '<dl class="skc-kv">' +
      "<dt>" + t("ctxSystem") + "</dt><dd>" + ctxState.systemLen + " " + t("ctxChars") + "</dd>" +
      "<dt>" + t("ctxMemory") + "</dt><dd>" + (ctxState.memCount || 0) + " " + t("ctxItems") + "</dd>" +
      "<dt>" + t("ctxDaily") + "</dt><dd>" + (ctxState.daily ? (ctxState.dailyDays || 0) + " " + t("ctxDays") : "—") + "</dd>" +
      "<dt>" + t("ctxRecent") + "</dt><dd>" + new Date(ctxState.at).toLocaleTimeString() + "</dd>" +
      "<dt>" + t("ctxCache") + "</dt><dd>" + cacheStats.hits + "</dd>" +
      "</dl></section>" +
      '<p class="skc-note">' + t("ctxNote") + "</p>";
  }

  function toggleCtx(force) {
    if (!ctxPanel) return;
    var open = force != null ? force : ctxPanel.classList.contains("is-hidden");
    ctxPanel.classList.toggle("is-hidden", !open);
    document.body.classList.toggle("skc-open", open);
    if (ctxBtn) ctxBtn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) renderCtx();
  }

  /* 输入框角色标签：把当前对话角色显示在输入框上方，随 React 重建持续刷新 */
  var CHAR_BADGE_ID = "sk-char-badge";
  function refreshCharBadge() {
    var raw = read("chat-demo:active-char", "");
    var name = "";
    try { var o = JSON.parse(raw); name = (o && o.name) ? String(o.name) : ""; } catch (e) {}
    var wrappers = document.querySelectorAll(".wrapper-ed6f47, .textareaWrapper-ed6f47");
    if (!wrappers.length) return;
    var wrap = wrappers[0];
    var badge = document.getElementById(CHAR_BADGE_ID);
    if (!name) {
      if (badge && badge.parentNode) badge.parentNode.removeChild(badge);
      return;
    }
    if (!badge) {
      badge = document.createElement("div");
      badge.id = CHAR_BADGE_ID;
      badge.className = "sk-char-badge";
      wrap.insertBefore(badge, wrap.firstChild);
    }
    var label = t("charInChat").replace("{n}", name);
    if (badge.textContent !== label) badge.textContent = label;
  }

  function buildCtx() {
    if (ctxPanel) return;
    ctxBtn = document.createElement("button");
    ctxBtn.id = "sk-ctx-btn";
    ctxBtn.type = "button";
    ctxBtn.setAttribute("aria-label", t("ctx"));
    ctxBtn.setAttribute("aria-expanded", "false");
    ctxBtn.innerHTML = icon("layers", 20);
    ctxBtn.addEventListener("click", function () {
      toggleCtx();
    });
    document.body.appendChild(ctxBtn);

    ctxPanel = document.createElement("aside");
    ctxPanel.id = "sk-ctx";
    ctxPanel.className = "is-hidden";
    ctxPanel.setAttribute("aria-label", t("ctx"));
    ctxPanel.innerHTML =
      '<div class="skc-head"><h2>' + t("ctx") + '</h2>' +
      '<button type="button" class="skc-close" aria-label="' + t("clear") + '">×</button></div>' +
      '<div class="skc-body"></div>';
    ctxPanel.querySelector(".skc-close").addEventListener("click", function () {
      toggleCtx(false);
    });
    document.body.appendChild(ctxPanel);
  }

  /* ---------------- 新对话：选择角色 ---------------- */
  var pickerEl = null;

  function closePicker() {
    var nodes = document.querySelectorAll(".skp-mask, .skp-sheet");
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].parentNode) nodes[i].parentNode.removeChild(nodes[i]);
    }
    pickerEl = null;
  }

  function openCharPicker(trigger) {
    closePicker();
    var list = readChars();
    var mask = document.createElement("div");
    mask.className = "skp-mask";
    var sheet = document.createElement("div");
    sheet.className = "skp-sheet";
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-label", t("pickCharacter"));
    var html = '<div class="skp-title">' + t("pickCharacter") + "</div>";
    html +=
      '<button type="button" class="skp-opt" data-pick=""><span class="skp-name">' +
      t("noCharacter") +
      "</span></button>";
    list.forEach(function (c) {
      var av = c.avatar
        ? '<img class="sk-char-avatar-img" src="' + c.avatar + '" alt="">'
        : '<span class="sk-char-avatar-ph">' + escapeHtml((c.name || "?").slice(0, 1)) + "</span>";
      html +=
        '<button type="button" class="skp-opt" data-pick="' + escapeAttr(c.id) + '">' +
        '<span class="sk-char-avatar">' + av + "</span>" +
        '<span class="skp-name">' + escapeHtml(c.name) + "</span>" +
        (c.personality ? '<span class="skp-sub">' + escapeHtml(c.personality.slice(0, 24)) + "</span>" :
          c.persona ? '<span class="skp-sub">' + escapeHtml(c.persona.slice(0, 30)) + "</span>" : "") +
        "</button>";
    });
    html += '<button type="button" class="skp-cancel" data-close="1">' + t("cancel") + "</button>";
    sheet.innerHTML = html;

    sheet.addEventListener("click", function (e) {
      var p = e.target.closest("[data-pick]");
      if (p) {
        var id = p.getAttribute("data-pick") || "";
        write("chat-demo:char-pending", id || "__none__");
        var nm = charById(id);
        // 当前对话角色：写入显示名，供输入框角色标签展示
        if (id && nm) write("chat-demo:active-char", JSON.stringify({ id: id, name: nm.name }));
        else {
          try { localStorage.removeItem("chat-demo:active-char"); } catch (e) {}
        }
        closePicker();
        toast(id && nm ? t("picked").replace("{n}", nm.name) : t("pickedNone"));
        refreshCharBadge();
        if (trigger) {
          window.__skBypassNew = true;
          trigger.click();
          setTimeout(function () {
            window.__skBypassNew = false;
          }, 400);
        }
        return;
      }
      if (e.target.closest("[data-close]")) closePicker();
    });
    mask.addEventListener("click", closePicker);
    document.body.appendChild(mask);
    document.body.appendChild(sheet);
    pickerEl = sheet;
  }

  function installNewChatPicker() {
    document.addEventListener(
      "click",
      function (e) {
        if (window.__skBypassNew) return;
        var b = e.target.closest && e.target.closest("button");
        if (!b) return;
        var txt = (b.textContent || "").replace(/\s+/g, "");
        if (txt !== "开启新对话" && txt !== "Newchat") return;
        if (document.querySelector(".skp-sheet")) return;
        // 没有任何角色卡时不打扰，直接走应用原生的新对话
        if (!readChars().length) return;
        e.preventDefault();
        e.stopPropagation();
        openCharPicker(b);
      },
      true
    );
  }

  /* ---------------- 按天记忆（md 文件） ---------------- */
  var DAILY_PREFIX = "chat-demo:daily:";
  var DAILY_INDEX = "chat-demo:daily-index";
  var dirHandle = null;
  var dailyCache = { date: "", text: "", days: 0 };
  var pendingUser = "";

  function todayKey() {
    var d = new Date();
    return (
      d.getFullYear() +
      "-" +
      ("0" + (d.getMonth() + 1)).slice(-2) +
      "-" +
      ("0" + d.getDate()).slice(-2)
    );
  }

  /* ---------------- 内存缓存层：减少重复的 JSON.parse ----------------
     缓存条目记录 localStorage 原始字符串，读取时对比；外部直接改 localStorage
     （如原应用或测试）导致版本变化时自动失效，避免读到陈旧数据。 */
  var DATA_CACHE = { chars: null, index: null, worlds: null, mem: {} };
  var cacheStats = { hits: 0, misses: 0 };
  function cacheGet(slot, key, storageKey, loader) {
    var owner = key == null ? DATA_CACHE : DATA_CACHE[slot];
    var k = key == null ? slot : key;
    var raw = read(storageKey, "");
    var entry = owner ? owner[k] : null;
    if (entry && entry.raw === raw) {
      cacheStats.hits++;
      return entry.value;
    }
    cacheStats.misses++;
    var val = loader();
    if (owner) owner[k] = { raw: raw, value: val };
    return val;
  }
  function cacheInvalidate(slot, key) {
    if (key == null) {
      DATA_CACHE[slot] = null;
    } else if (DATA_CACHE[slot]) {
      delete DATA_CACHE[slot][key];
    }
  }

  function readIndex() {
    return cacheGet("index", null, DAILY_INDEX, function () {
      try {
        var v = JSON.parse(read(DAILY_INDEX, "[]"));
        return Array.isArray(v) ? v : [];
      } catch (e) {
        return [];
      }
    });
  }

  function dailyOn() {
    return read("chat-demo:daily-on", "on") !== "off";
  }

  function dailyDays() {
    var n = parseInt(read("chat-demo:daily-days", "3"), 10);
    return [1, 3, 5, 7].indexOf(n) > -1 ? n : 3;
  }

  function idb(mode, fn) {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open("chat-demo-memory", 1);
      req.onupgradeneeded = function () {
        if (!req.result.objectStoreNames.contains("kv")) req.result.createObjectStore("kv");
      };
      req.onsuccess = function () {
        try {
          var tx = req.result.transaction("kv", mode);
          fn(tx.objectStore("kv"), resolve, reject);
        } catch (e) {
          reject(e);
        }
      };
      req.onerror = function () {
        reject(req.error);
      };
    });
  }

  function initDir() {
    if (!("showDirectoryPicker" in window)) return Promise.resolve();
    return idb("readonly", function (st, resolve) {
      var g = st.get("dir");
      g.onsuccess = function () {
        if (g.result) dirHandle = g.result;
        resolve();
      };
      g.onerror = function () {
        resolve();
      };
    }).catch(function () {});
  }

  function dirPermission() {
    if (!dirHandle || !dirHandle.queryPermission) return Promise.resolve("none");
    return dirHandle.queryPermission({ mode: "readwrite" }).catch(function () {
      return "none";
    });
  }

  function pickDir() {
    if (!window.showDirectoryPicker) {
      toast(t("dailyUnsupported"));
      return;
    }
    window
      .showDirectoryPicker({ mode: "readwrite", id: "chat-demo-memory" })
      .then(function (h) {
        dirHandle = h;
        return idb("readwrite", function (st, resolve) {
          var p = st.put(h, "dir");
          p.onsuccess = resolve;
          p.onerror = resolve;
        });
      })
      .then(function () {
        return refreshDailyContext();
      })
      .then(function () {
        paint();
        toast(t("dailyStorageDir") + "：" + (dirHandle && dirHandle.name ? dirHandle.name : ""));
      })
      .catch(function () {});
  }

  function readDaily(date) {
    var local = read(DAILY_PREFIX + date, "");
    if (!dirHandle) return Promise.resolve(local);
    return dirPermission().then(function (p) {
      if (p !== "granted") return local;
      return dirHandle
        .getFileHandle(date + ".md")
        .then(function (fh) {
          return fh.getFile();
        })
        .then(function (f) {
          return f.text();
        })
        .catch(function () {
          return local;
        });
    });
  }

  function writeDaily(date, text) {
    write(DAILY_PREFIX + date, text);
    var idx = readIndex();
    var hit = false;
    idx.forEach(function (it) {
      if (it.date === date) {
        it.chars = text.length;
        hit = true;
      }
    });
    if (!hit) idx.push({ date: date, chars: text.length });
    write(DAILY_INDEX, JSON.stringify(idx));
    cacheInvalidate("index", null);
    if (!dirHandle) return Promise.resolve();
    return dirPermission().then(function (p) {
      if (p !== "granted") return;
      return dirHandle
        .getFileHandle(date + ".md", { create: true })
        .then(function (fh) {
          return fh.createWritable();
        })
        .then(function (w) {
          return w.write(text).then(function () {
            return w.close();
          });
        })
        .catch(function () {});
    });
  }

  function refreshDailyContext() {
    var today = todayKey();
    var dates = readIndex()
      .map(function (x) {
        return x.date;
      })
      .filter(function (d) {
        return d && d < today;
      })
      .sort()
      .reverse()
      .slice(0, dailyDays());
    var budget = 4000;
    var parts = [];
    var chain = Promise.resolve();
    dates.forEach(function (d) {
      chain = chain.then(function () {
        return readDaily(d).then(function (txt) {
          txt = (txt || "").trim();
          if (!txt || budget <= 0) return;
          if (txt.length > budget) txt = txt.slice(0, budget) + "…";
          parts.push("### " + d + "\n" + txt);
          budget -= txt.length;
        });
      });
    });
    return chain.then(function () {
      dailyCache = {
        date: today,
        days: parts.length,
        text: parts.length ? "【此前几天的对话记忆】\n" + parts.join("\n\n") : ""
      };
    });
  }

  function dailyPrompt() {
    if (dailyCache.date !== todayKey()) refreshDailyContext();
    return dailyOn() ? dailyCache.text : "";
  }

  function appendExchange(userText, assistantText) {
    if (!dailyOn() || !userText) return;
    var today = todayKey();
    var now = new Date();
    var hh = ("0" + now.getHours()).slice(-2) + ":" + ("0" + now.getMinutes()).slice(-2);
    readDaily(today)
      .then(function (cur) {
        var body = (cur || "").replace(/\s+$/, "");
        if (!body) body = "# " + today + " 对话记忆";
        var next =
          body +
          "\n\n## " + hh + " · 用户\n" + userText +
          "\n\n## " + hh + " · 助手\n" + (assistantText || "").trim() +
          "\n";
        return writeDaily(today, next);
      })
      .then(function () {
        if (root) paint();
        return refreshDailyContext();
      })
      .catch(function () {});
  }

  function tapResponse(res, userText) {
    try {
      if (!res || !res.body || !res.clone) return res;
      var reader = res.clone().body.getReader();
      var dec = new TextDecoder();
      var buf = "";
      var out = "";
      var done = false;
      var finish = function () {
        if (done) return;
        done = true;
        if (out) appendExchange(userText, out);
      };
      (function pump() {
        reader
          .read()
          .then(function (r) {
            if (r.done) {
              finish();
              return;
            }
            buf += dec.decode(r.value, { stream: true });
            var lines = buf.split("\n");
            buf = lines.pop();
            for (var i = 0; i < lines.length; i++) {
              var ln = lines[i].trim();
              if (ln.indexOf("data:") !== 0) continue;
              var js = ln.slice(5).trim();
              if (!js || js === "[DONE]") continue;
              try {
                var ev = JSON.parse(js);
                if (ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta") {
                  out += ev.delta.text || "";
                }
              } catch (e) {}
            }
            pump();
          })
          .catch(finish);
      })();
      return res;
    } catch (e) {
      return res;
    }
  }

  /* ---------------- 角色卡 / 记忆 ---------------- */
  function readChars() {
    return cacheGet("chars", null, "chat-demo:characters", function () {
      try {
        var v = JSON.parse(read("chat-demo:characters", "[]"));
        return Array.isArray(v) ? v : [];
      } catch (e) {
        return [];
      }
    });
  }

  function writeChars(list) {
    write("chat-demo:characters", JSON.stringify(list));
    cacheInvalidate("chars", null);
  }

  function activeId() {
    return read("chat-demo:character-active", "");
  }

  function activeChar() {
    var id = activeId();
    var list = readChars();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /* ---------------- 世界书（群聊场景） ----------------
     世界书 = {id,name,memberIds:[角色id],background,at}；用户是群主。
     每张角色卡绑定一个默认世界（worldId）；对话仍绑单角色，主角色发言，
     同世界其他成员作为"在场角色"注入 system，不实际发言。 */
  var WORLD_KEY = "chat-demo:worlds";
  function readWorlds() {
    return cacheGet("worlds", null, WORLD_KEY, function () {
      try {
        var v = JSON.parse(read(WORLD_KEY, "[]"));
        return Array.isArray(v) ? v : [];
      } catch (e) {
        return [];
      }
    });
  }
  function writeWorlds(list) {
    write(WORLD_KEY, JSON.stringify(list));
    cacheInvalidate("worlds", null);
  }
  function worldById(id) {
    if (!id) return null;
    var list = readWorlds();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function ensureWorldForChar(c) {
    if (!c) return null;
    var w = worldById(c.worldId);
    if (w) {
      // 成员名单保持与角色卡同步
      if (w.memberIds.indexOf(c.id) < 0) { w.memberIds.push(c.id); writeWorlds(readWorlds()); }
      return w;
    }
    var wid = "w" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    w = { id: wid, name: c.name, memberIds: [c.id], background: "", at: Date.now() };
    var all = readWorlds();
    all.push(w);
    writeWorlds(all);
    c.worldId = wid;
    return w;
  }

  function readMem(id) {
    return cacheGet("mem", id, "chat-demo:memory:" + id, function () {
      try {
        var v = JSON.parse(read("chat-demo:memory:" + id, "[]"));
        return Array.isArray(v) ? v : [];
      } catch (e) {
        return [];
      }
    });
  }

  function writeMem(id, list) {
    var out = list.slice(-20);
    write("chat-demo:memory:" + id, JSON.stringify(out));
    cacheInvalidate("mem", id);
  }

  function memAuto() {
    return read("chat-demo:memory-auto", "off") === "on";
  }

  /* 对话指纹：首条用户消息归一化后取短哈希，用于把角色绑定到具体对话 */
  function convKey(payload) {
    var msgs = payload && payload.messages;
    if (!Array.isArray(msgs)) return "";
    for (var i = 0; i < msgs.length; i++) {
      if (msgs[i] && msgs[i].role === "user") {
        var c = msgs[i].content;
        var s = typeof c === "string" ? c : "";
        if (!s && Array.isArray(c)) {
          for (var j = 0; j < c.length; j++) {
            if (c[j] && typeof c[j].text === "string") {
              s = c[j].text;
              break;
            }
          }
        }
        s = (s || "").replace(/\s+/g, " ").trim().slice(0, 80);
        var h = 5381;
        for (var k = 0; k < s.length; k++) h = ((h << 5) + h + s.charCodeAt(k)) >>> 0;
        return s ? h.toString(36) : "";
      }
    }
    return "";
  }

  function convMap() {
    try {
      var v = JSON.parse(read("chat-demo:conv-char", "{}"));
      return v && typeof v === "object" ? v : {};
    } catch (e) {
      return {};
    }
  }

  function setConvChar(key, id) {
    var m = convMap();
    m[key] = id || "";
    write("chat-demo:conv-char", JSON.stringify(m));
  }

  /* 解析本次请求应使用的角色：对话已绑定 → 用它；首条消息 → 绑定新对话的选择；否则回落到全局启用 */
  function resolveCharFor(payload) {
    var key = convKey(payload);
    var map = convMap();
    if (key && Object.prototype.hasOwnProperty.call(map, key)) return map[key] || "";
    if (key) {
      var pend = read("chat-demo:char-pending", "");
      // "__none__" = 用户在新建对话时显式选择“不使用角色”；空值 = 没走选择器，沿用全局启用角色
      var use = pend === "__none__" ? "" : pend || activeId();
      setConvChar(key, use);
      if (pend) write("chat-demo:char-pending", "");
      return use;
    }
    return activeId();
  }

  function charById(id) {
    if (!id) return null;
    var list = readChars();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /* 把角色设定与记忆拼进请求的 system 提示词 */
  function characterPrompt(charId) {
    var c = charById(charId != null ? charId : activeId());
    if (!c) return "";
    var w = worldById(c.worldId);
    var out = "【角色设定】\n你现在扮演「" + c.name + "」。";
    if (c.personality) out += "\n性格特点：" + c.personality;
    if (c.persona) out += "\n" + c.persona;
    if (c.greeting) out += "\n开场风格参考：" + c.greeting;
    // 世界书：群聊场景 + 在场成员（仅作背景，不实际发言）
    if (w) {
      out += "\n\n【群聊场景】" + (w.name || "群聊");
      if (w.background) out += "\n场景背景：" + w.background;
      var others = [];
      var mids = w.memberIds || [];
      for (var j = 0; j < mids.length; j++) {
        if (mids[j] === c.id) continue;
        var oc = charById(mids[j]);
        if (oc) others.push("「" + oc.name + "」" + (oc.personality ? "（" + oc.personality + "）" : "") + (oc.persona ? "：" + oc.persona : ""));
      }
      if (others.length) {
        out += "\n【在场的其他成员（仅作背景，由你统一以" + c.name + "的口吻回应，不要代替他们发言）】";
        for (var k = 0; k < others.length; k++) out += "\n- " + others[k];
      }
    }
    var mem = readMem(c.id);
    if (mem.length) {
      out += "\n\n【关于用户的长期记忆】";
      for (var i = 0; i < mem.length; i++) out += "\n- " + mem[i].text;
    }
    return out + "\n\n（以上为背景设定，回答时不要复述设定本身。）";
  }

  function lastUserText(payload) {
    var msgs = payload && payload.messages;
    if (!Array.isArray(msgs)) return "";
    for (var i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i] && msgs[i].role === "user") {
        var c = msgs[i].content;
        if (typeof c === "string") return c.slice(0, 120);
        if (Array.isArray(c)) {
          for (var j = 0; j < c.length; j++) {
            if (c[j] && typeof c[j].text === "string") return c[j].text.slice(0, 120);
          }
        }
      }
    }
    return "";
  }

  var fetchHooked = false;
  function installFetchHook() {
    if (fetchHooked || !window.fetch) return;
    fetchHooked = true;
    var orig = window.fetch;
    window.fetch = function (input, init) {
      try {
        var url = typeof input === "string" ? input : (input && input.url) || "";
        if (/\/anthropic\/v1\/messages/.test(url) && init && typeof init.body === "string") {
          var payload = JSON.parse(init.body);
          var charId = resolveCharFor(payload);
          var extra = characterPrompt(charId);
          if (extra) payload.system = (payload.system ? payload.system + "\n\n" : "") + extra;
          var dExtra = dailyPrompt();
          if (dExtra) payload.system = (payload.system ? payload.system + "\n\n" : "") + dExtra;
          ctxState = {
            charId: charId || "",
            systemLen: (payload.system || "").length,
            memCount: charId ? readMem(charId).length : 0,
            daily: !!dExtra,
            dailyDays: dailyCache.days || 0,
            at: Date.now()
          };
          if (ctxPanel && !ctxPanel.classList.contains("is-hidden")) renderCtx();
          pendingUser = lastUserText(payload) || "";
          var c = charById(charId);
          if (c && memAuto()) {
            var txt = lastUserText(payload);
            if (txt) {
              var mem = readMem(c.id);
              var last = mem.length ? mem[mem.length - 1].text : "";
              if (txt !== last) {
                mem.push({ text: txt, at: Date.now() });
                writeMem(c.id, mem);
              }
            }
          }
          init = Object.assign({}, init, { body: JSON.stringify(payload) });
          var pending = orig.call(this, input, init);
          var u = pendingUser;
          if (pending && pending.then) {
            return pending.then(function (res) {
              return tapResponse(res, u);
            });
          }
          return pending;
        }
      } catch (e) {}
      return orig.apply(this, arguments.length > 1 ? [input, init] : [input]);
    };
  }

  /* ---------------- 余额 ---------------- */
  var balanceState = null;

  function checkBalance() {
    var key = (state.keyDraft != null ? state.keyDraft : read(KEY.apiKey, "")).trim();
    if (!key) {
      toast(t("balanceNoKey"));
      return;
    }
    balanceState = { loading: true };
    paint();
    fetch("https://api.deepseek.com/user/balance", {
      headers: {
        Authorization: "Bearer " + key,
        "x-api-key": key,
        Accept: "application/json"
      }
    })
      .then(function (r) {
        if (r.status === 401 || r.status === 403) throw new Error("401");
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (d) {
        balanceState = { data: d, at: Date.now() };
        paint();
      })
      .catch(function (e) {
        balanceState = {
          error:
            e.message === "401"
              ? t("balanceInvalid")
              : e.message.indexOf("HTTP") === 0
              ? t("balanceFailed") + " " + e.message
              : t("balanceNetwork")
        };
        paint();
      });
  }

  function applyPrefs() {
    var fs = readFs();
    var density = readDensity();
    var caveat = readCaveat();
    if (fs === "m") document.body.removeAttribute("data-sk-fs");
    else document.body.setAttribute("data-sk-fs", fs);
    if (density === "comfort") document.body.removeAttribute("data-sk-density");
    else document.body.setAttribute("data-sk-density", density);
    if (caveat) document.body.removeAttribute("data-sk-caveat");
    else document.body.setAttribute("data-sk-caveat", "off");
    if (readWechat()) document.body.setAttribute("data-sk-wechat", "on");
    else document.body.removeAttribute("data-sk-wechat");

    var bub = readBubble();
    if (bub.color === "default") document.body.removeAttribute("data-sk-bubble");
    else document.body.setAttribute("data-sk-bubble", bub.color);
    if (bub.radius === "round") document.body.removeAttribute("data-sk-radius");
    else document.body.setAttribute("data-sk-radius", bub.radius);
    if (bub.width === "normal") document.body.removeAttribute("data-sk-width");
    else document.body.setAttribute("data-sk-width", bub.width);
    applyChatBg();
  }

  function toggleRow(act, labelLabel, hint, on) {
    return (
      '<button type="button" class="sk-row sk-row-switch" role="switch" aria-checked="' +
      (on ? "true" : "false") +
      '" data-act="' +
      act +
      '">' +
      '<span class="sk-stack"><span class="sk-label">' +
      labelLabel +
      "</span><span class=\"sk-sublabel\">" +
      hint +
      "</span></span>" +
      '<span class="sk-switch' +
      (on ? " is-on" : "") +
      '" aria-hidden="true"></span>' +
      "</button>"
    );
  }

  function personalizeHtml() {
    return (
      '<div class="sk-page">' +
      header(t("personalize"), "back") +
      '<div class="sk-group">' +
      t("app") +
      "</div>" +
      '<section class="sk-card">' +
      toggleRow("toggle-density", t("density"), t("densityHint"), readDensity() === "compact") +
      toggleRow("toggle-caveat", t("caveatToggle"), t("caveatHint"), readCaveat()) +
      toggleRow("toggle-wechat", t("wechatMode"), t("wechatModeHint"), readWechat()) +
      "</section>" +
      '<div class="sk-group">' +
      t("bubbleGroup") +
      "</div>" +
      '<section class="sk-card">' +
      '<div class="sk-bubble-preview"><span class="sk-bubble-demo">' +
      t("bubblePreview") +
      "</span></div>" +
      row("bubble-color", "palette", t("bubbleColor"), bubbleLabel("color")) +
      row("bubble-radius", "radius", t("bubbleRadius"), bubbleLabel("radius")) +
      row("bubble-width", "width", t("bubbleWidth"), bubbleLabel("width")) +
      "</section>" +
      '<div class="sk-group">' +
      t("chatBgGroup") +
      "</div>" +
      '<section class="sk-card">' +
      row("chatbg", "image", t("chatBg"), bgLabel()) +
      "</section>" +
      "</div>"
    );
  }

  function chatBgHtml() {
    var bg = readBg();
    var presets = BG_PRESETS.map(function (p) {
      var on = bg.type === "preset" && bg.preset === p.k;
      var swatch = p.k === "none" ? "var(--sk-card)" : p.css;
      return (
        '<button type="button" class="sk-bg-preset' + (on ? " is-on" : "") +
        '" data-act="bg-preset" data-preset="' + p.k + '" aria-label="' +
        (isEN() ? p.en : p.zh) + '">' +
        '<span class="sk-bg-swatch" style="background:' + swatch + '"></span>' +
        '<span class="sk-bg-name">' + (isEN() ? p.en : p.zh) + "</span>" +
        (on ? '<span class="sk-bg-tick">' + icon("tick") + "</span>" : "") +
        "</button>"
      );
    }).join("");

    var imageOn = bg.type === "image" && bg.image;
    var previewStyle = "";
    if (imageOn) {
      previewStyle = "background-image:" + veilCss(bg.opacity) + ",url('" + bg.image + "')" +
        ";background-size:cover," + Math.round(bg.scale * 100) + "%" +
        ";background-position:center," + bg.posX + "% " + bg.posY + "%";
    } else if (bg.type === "preset") {
      var p = BG_PRESETS.filter(function (x) { return x.k === bg.preset; })[0];
      if (p) previewStyle = "background-image:" + veilCss(bg.opacity) + "," + p.css;
    }

    return (
      '<div class="sk-page">' +
      header(t("chatBg"), "back") +
      '<div class="sk-bg-hint">' + t("chatBgHint") + "</div>" +
      '<div class="sk-bg-preview" style="' + previewStyle + '">' +
      '<div class="sk-bg-demo-row"><span class="sk-bg-demo-bubble">Hi</span></div>' +
      '<div class="sk-bg-demo-row left"><span class="sk-bg-demo-bubble">' +
      t("bubblePreview") + "</span></div>" +
      "</div>" +
      '<div class="sk-group">' + t("chatBgPreset") + "</div>" +
      '<section class="sk-card"><div class="sk-bg-grid">' + presets + "</div></section>" +
      '<div class="sk-group">' + t("chatBgImage") + "</div>" +
      '<section class="sk-card">' +
      '<div class="sk-bg-actions">' +
      '<button type="button" class="sk-btn primary" data-act="bg-pick">' + t("chatBgPick") + "</button>" +
      (imageOn ? '<button type="button" class="sk-btn" data-act="bg-adjust">' + t("chatBgAdjust") + "</button>" : "") +
      (imageOn ? '<button type="button" class="sk-btn" data-act="bg-clear">' + t("chatBgClear") + "</button>" : "") +
      "</div>" +
      "</section>" +
      '<div class="sk-group">' + t("chatBgOpacity") + "</div>" +
      '<section class="sk-card">' +
      '<div class="sk-bg-opacity"><input type="range" min="0" max="90" step="5" value="' +
      bg.opacity + '" data-act="bg-opacity" aria-label="' + t("chatBgOpacity") + '"></div>' +
      '<div class="sk-bg-opacity-hint">' + t("chatBgOpacityHint") + "</div>" +
      "</section>" +
      "</div>"
    );
  }

  function veilCss(opacity) {
    return "linear-gradient(rgba(255,255,255," + (opacity / 100) + "),rgba(255,255,255," + (opacity / 100) + "))";
  }

  function bgImageCss(bg) {
    var veil = veilCss(bg.opacity);
    if (bg.type === "image" && bg.image) return veil + ',url("' + bg.image + '")';
    if (bg.type === "preset") {
      var p = BG_PRESETS.filter(function (x) { return x.k === bg.preset; })[0];
      if (p) return veil + "," + p.css;
    }
    return "";
  }

  /* 调整显示区域：可拖动 / 缩放的实时预览。数据来自 state.bgDraft，应用时才落盘 */
  function adjustPreviewCss(d) {
    return "background-image:" + veilCss(d.opacity) + ",url('" + d.image + "')" +
      ";background-size:cover," + Math.round(d.scale * 100) + "%" +
      ";background-position:center," + d.posX + "% " + d.posY + "%";
  }

  function adjustBgHtml() {
    var d = state.bgDraft;
    if (!d || !d.image) {
      return '<div class="sk-page">' + header(t("chatBgAdjust"), "back") +
        '<div class="sk-bg-hint">' + t("chatBgNoImage") + "</div></div>";
    }
    return (
      '<div class="sk-page sk-adjust-page">' +
      header(t("chatBgAdjust"), "bg-adjust-cancel") +
      '<div class="sk-bg-hint">' + t("chatBgAdjustHint") + "</div>" +
      '<div class="sk-adjust-stage" id="sk-adjust-stage" style="' + adjustPreviewCss(d) + '">' +
      '<div class="sk-adjust-dots" aria-hidden="true"></div>' +
      "</div>" +
      '<section class="sk-card">' +
      '<div class="sk-bg-opacity"><span class="sk-adjust-label">' + t("chatBgZoom") +
      '</span><input type="range" min="100" max="300" step="5" value="' +
      Math.round(d.scale * 100) + '" data-act="bg-zoom" aria-label="' + t("chatBgZoom") + '"></div>' +
      "</section>" +
      '<div class="sk-bg-actions">' +
      '<button type="button" class="sk-btn primary" data-act="bg-apply">' + t("chatBgApply") + "</button>" +
      '<button type="button" class="sk-btn" data-act="bg-reset">' + t("chatBgReset") + "</button>" +
      '<button type="button" class="sk-btn" data-act="bg-adjust-cancel">' + t("chatBgCancel") + "</button>" +
      "</div>" +
      "</div>"
    );
  }

  var TERMS = {
    zh: [
      ["服务说明", "本页面是 DeepSeek API 使用演示，仅用于展示对话界面与接口调用方式，不提供正式商业服务。"],
      ["账号与密钥", "对话能力由你自行填入的 API Key 调用。密钥仅保存在本机浏览器，不会上传到除此之外的任何服务器。"],
      ["内容与责任", "模型的输出由 AI 生成，可能存在错误或不完整，请自行判断后再使用，不应作为医疗、法律或财务决策的唯一依据。"],
      ["数据存储", "对话记录、附件与偏好设置保存在本机（IndexedDB 与 localStorage）。清除浏览器数据或退出登录会一并删除。"],
      ["条款变更", "演示版本可能随时调整功能与条款，更新后以页面展示为准。"]
    ],
    en: [
      ["About", "This page is a DeepSeek API demo. It showcases the chat UI and API usage only, not a commercial service."],
      ["Account & key", "Chat runs on the API Key you provide. The key stays in this browser and is sent only to the DeepSeek endpoint."],
      ["Content", "Model output is AI-generated and may be inaccurate. Do not rely on it as sole medical, legal or financial advice."],
      ["Storage", "Chats, attachments and preferences are stored locally (IndexedDB and localStorage). Clearing site data removes them."],
      ["Changes", "Features and terms may change at any time in this demo."]
    ]
  };

  var FAQ = {
    zh: [
      ["为什么提示要配置 API Key？", "对话请求会直接调用 DeepSeek 接口，需要你的密钥。可在「账号管理」中填写，密钥只存本机。"],
      ["对话记录保存在哪里？", "保存在浏览器本地（IndexedDB）。换浏览器或清除站点数据后就看不到了，可用「导出所有历史对话」备份。"],
      ["导入的 ZIP 从哪来？", "来自本应用或 DeepSeek 导出的对话备份。导入会覆盖当前全部对话，操作前建议先导出一份。"],
      ["这些设置保存在哪里？", "字号、外观、语言、音色等偏好都保存在本机 localStorage，换浏览器或清除站点数据后需要重新设置。"]
    ],
    en: [
      ["Why do I need an API Key?", "Requests go straight to the DeepSeek API with your own key. Add it in Account; it stays local."],
      ["Where are chats stored?", "Locally in IndexedDB. Clearing site data removes them; use Export to back up."],
      ["Where does the import ZIP come from?", "A backup exported by this app or DeepSeek. Importing replaces all current chats."],
      ["Where are these settings stored?", "Font size, appearance, language and voice are stored in localStorage on this device. Clearing site data resets them."]
    ]
  };

  function termsHtml() {
    var items = (isEN() ? TERMS.en : TERMS.zh)
      .map(function (it) {
        return (
          '<section class="sk-doc-block"><h3>' + it[0] + "</h3><p>" + it[1] + "</p></section>"
        );
      })
      .join("");
    return (
      '<div class="sk-page">' + header(t("terms"), "back") +
      '<p class="sk-doc-note">' +
      (isEN() ? "Demo terms — not a legal document." : "演示用条款，不构成正式法律文件。") +
      "</p>" + items + "</div>"
    );
  }

  function helpHtml() {
    var faq = (isEN() ? FAQ.en : FAQ.zh)
      .map(function (it) {
        return (
          '<details class="sk-faq"><summary>' + it[0] + "</summary><p>" + it[1] + "</p></details>"
        );
      })
      .join("");
    return (
      '<div class="sk-page">' + header(t("help"), "back") +
      '<div class="sk-group">' + t("faq") + "</div>" +
      '<section class="sk-card sk-faq-card">' + faq + "</section>" +
      '<div class="sk-group">' + t("diag") + "</div>" +
      '<section class="sk-card sk-panel">' +
      '<p class="sk-hint" style="margin-top:0">' + t("diagHint") + "</p>" +
      '<div class="sk-actions"><button type="button" class="sk-btn primary" data-act="copy-diag">' +
      t("diag") + "</button></div>" +
      "</section></div>"
    );
  }

  /* ---------------- 角色卡 / 记忆页面 ---------------- */
  function charactersHtml() {
    var list = readChars();
    var act = activeId();
    var rows = list
      .map(function (c) {
        var av = c.avatar
          ? '<img class="sk-char-avatar-img" src="' + c.avatar + '" alt="">'
          : '<span class="sk-char-avatar-ph">' + escapeHtml((c.name || "?").slice(0, 1)) + "</span>";
        return (
          '<button type="button" class="sk-row sk-char-row" data-act="char-open" data-id="' +
          escapeAttr(c.id) + '">' +
          '<span class="sk-char-avatar" data-act="char-open" data-id="' + escapeAttr(c.id) + '">' + av + "</span>" +
          '<span class="sk-label">' + escapeHtml(c.name) + "</span>" +
          (c.id === act ? '<span class="sk-val">' + t("characterOn") + "</span>" : "") +
          '<span class="sk-arrow">' + icon("right") + "</span>" +
          "</button>"
        );
      })
      .join("");
    return (
      '<div class="sk-page">' +
      header(t("characters"), "back") +
      '<div class="sk-group">' + t("characters") + "</div>" +
      (list.length
        ? '<section class="sk-card">' + rows + "</section>"
        : '<section class="sk-card sk-panel"><p class="sk-hint" style="margin:0">' + t("characterEmpty") + "</p></section>") +
      '<div class="sk-page-actions"><button type="button" class="sk-btn primary" data-act="char-new">' +
      t("characterNew") + "</button></div>" +
      "</div>"
    );
  }

  function characterHtml() {
    var d = state.draft || { name: "", persona: "", greeting: "", personality: "", avatar: "" };
    var isNew = !state.editId;
    var isActive = !isNew && activeId() === state.editId;
    var avatarHtml = d.avatar
      ? '<img class="sk-char-avatar-img" src="' + d.avatar + '" alt="">'
      : '<span class="sk-char-avatar-ph">' + escapeHtml((d.name || "?").slice(0, 1)) + "</span>";
    var actions =
      '<button type="button" class="sk-btn primary" data-act="char-save">' + t("characterSave") + "</button>";
    if (!isNew) {
      actions +=
        '<button type="button" class="sk-btn" data-act="char-use">' +
        (isActive ? t("characterClear") : t("characterUse")) +
        "</button>";
      actions +=
        '<button type="button" class="sk-btn danger" data-act="char-del">' + t("characterDelete") + "</button>";
    }
    return (
      '<div class="sk-page">' +
      header(isNew ? t("characterNew") : t("characterEdit"), "back") +
      '<div class="sk-group">' + t("characterAvatar") + "</div>" +
      '<section class="sk-card sk-panel"><div class="sk-char-avatar-row">' +
      '<span class="sk-char-avatar" id="sk-char-avatar-preview">' + avatarHtml + "</span>" +
      '<button type="button" class="sk-btn" data-act="char-avatar">' + t("characterAvatarPick") + "</button>" +
      "</div></section>" +
      '<div class="sk-group">' + t("characterName") + "</div>" +
      '<section class="sk-card sk-panel"><div class="sk-field"><input data-field="name" value="' +
      escapeAttr(d.name || "") + '" placeholder="' + escapeAttr(t("characterNamePh")) + '"></div></section>' +
      '<div class="sk-group">' + t("characterPersonality") + "</div>" +
      '<section class="sk-card sk-panel"><div class="sk-field"><input data-field="personality" value="' +
      escapeAttr(d.personality || "") + '" placeholder="' + escapeAttr(t("characterPersonalityPh")) + '"></div></section>' +
      '<div class="sk-group">' + t("characterPersona") + "</div>" +
      '<section class="sk-card sk-panel"><div class="sk-field sk-field-area"><textarea data-field="persona" rows="4" placeholder="' +
      escapeAttr(t("characterPersonaPh")) + '">' + escapeHtml(d.persona || "") + "</textarea></div></section>" +
      '<div class="sk-group">' + t("characterGreeting") + "</div>" +
      '<section class="sk-card sk-panel"><div class="sk-field"><input data-field="greeting" value="' +
      escapeAttr(d.greeting || "") + '" placeholder="' + escapeAttr(t("characterGreetingPh")) + '"></div></section>' +
      (!isNew && d.world ? worldEditHtml(d.world) : "") +
      '<div class="sk-actions sk-col">' + actions + "</div>" +
      "</div>"
    );
  }

  function worldEditHtml(w) {
    var all = readChars();
    var members = w.memberIds || [];
    var boxes = all.map(function (c) {
      var on = members.indexOf(c.id) > -1;
      var av = c.avatar
        ? '<img class="sk-char-avatar-img" src="' + c.avatar + '" alt="">'
        : '<span class="sk-char-avatar-ph">' + escapeHtml((c.name || "?").slice(0, 1)) + "</span>";
      return (
        '<label class="sk-world-member"><input type="checkbox" data-world-member="' + escapeAttr(c.id) + '"' +
        (on ? " checked" : "") + '><span class="sk-char-avatar">' + av + "</span>" +
        '<span>' + escapeHtml(c.name) + "</span></label>"
      );
    }).join("");
    return (
      '<div class="sk-group">' + t("worldGroup") + "</div>" +
      '<section class="sk-card sk-panel">' +
      '<div class="sk-field"><label>' + t("worldName") + '</label><input data-world-field="name" value="' +
      escapeAttr(w.name || "") + '"></div>' +
      '<div class="sk-field sk-field-area"><label>' + t("worldBackground") + '</label><textarea data-world-field="background" rows="3" placeholder="' +
      escapeAttr(t("worldBackgroundPh")) + '">' + escapeHtml(w.background || "") + "</textarea></div>" +
      '<div class="sk-field"><label>' + t("worldMembers") + '</label><p class="sk-hint">' + t("worldMemberHint") + "</p>" +
      '<div class="sk-world-members">' + boxes + "</div></div>" +
      '<button type="button" class="sk-btn" data-act="world-save">' + t("worldSaved") + "</button>" +
      "</section>"
    );
  }

  function memoryHtml() {
    var c = activeChar();
    if (!c) {
      return (
        '<div class="sk-page">' +
        header(t("memory"), "back") +
        '<section class="sk-card sk-panel"><p class="sk-hint" style="margin:0">' + t("characterNone") + "</p>" +
        '<div class="sk-actions"><button type="button" class="sk-btn primary" data-act="characters">' +
        t("characters") + "</button></div></section></div>"
      );
    }
    var mem = readMem(c.id);
    var items = mem
      .map(function (m, i) {
        return (
          '<div class="sk-mem"><span class="sk-mem-text">' + escapeHtml(m.text) + "</span>" +
          '<button type="button" class="sk-mem-del" data-act="mem-del" data-idx="' + i +
          '" aria-label="' + escapeAttr(t("deleteChat")) + '">×</button></div>'
        );
      })
      .join("");
    return (
      '<div class="sk-page">' +
      header(t("memory"), "back") +
      '<div class="sk-group">' + escapeHtml(c.name) + "</div>" +
      '<section class="sk-card">' +
      toggleRow("mem-auto", t("memoryAuto"), t("memoryAutoHint"), memAuto()) +
      "</section>" +
      '<div class="sk-group">' + t("memory") + " · " + mem.length + "</div>" +
      (mem.length
        ? '<section class="sk-card sk-mem-card">' + items + "</section>"
        : '<section class="sk-card sk-panel"><p class="sk-hint" style="margin:0">' + t("memoryEmpty") + "</p></section>") +
      '<section class="sk-card sk-panel" style="margin-top:14px">' +
      '<div class="sk-field sk-field-area"><textarea data-field="memory" rows="2" placeholder="' +
      escapeAttr(t("memoryPh")) + '"></textarea></div>' +
      '<div class="sk-actions">' +
      '<button type="button" class="sk-btn primary" data-act="mem-add">' + t("memoryAdd") + "</button>" +
      '<button type="button" class="sk-btn" data-act="mem-clear">' + t("clear") + "</button>" +
      "</div></section>" +
      "</div>"
    );
  }

  function dailyHtml() {
    var idx = readIndex()
      .slice()
      .sort(function (a, b) {
        return a.date < b.date ? 1 : -1;
      });
    var store = dirHandle
      ? t("dailyStorageDir") + "：" + escapeHtml(dirHandle.name || "")
      : t("dailyStorageLocal");
    var rows = idx
      .map(function (it) {
        return row("daily-open", "doc", escapeHtml(it.date), (it.chars || 0) + " " + t("dailyChars"), {
          attr: 'data-date="' + escapeAttr(it.date) + '"'
        });
      })
      .join("");
    return (
      '<div class="sk-page">' +
      header(t("daily"), "back") +
      '<div class="sk-group">' + t("dailyStorage") + "</div>" +
      '<section class="sk-card sk-panel">' +
      '<p class="sk-hint" style="margin-top:0">' + store + "</p>" +
      '<p class="sk-hint">' + t("dailyPickHint") + "</p>" +
      '<div class="sk-actions"><button type="button" class="sk-btn primary" data-act="daily-pick">' +
      t("dailyPick") + "</button></div>" +
      "</section>" +
      '<div class="sk-group">' + t("dailyRecord") + "</div>" +
      '<section class="sk-card">' +
      toggleRow("daily-toggle", t("dailyRecord"), t("dailyRecordHint"), dailyOn()) +
      "</section>" +
      '<div class="sk-group">' + t("dailyDays") + "</div>" +
      '<section class="sk-card">' +
      row("daily-days", "info", t("dailyDays"), t("dailyDaysValue").replace("{n}", dailyDays())) +
      "</section>" +
      '<div class="sk-group">' + t("dailyList") + " · " + idx.length + "</div>" +
      (idx.length
        ? '<section class="sk-card">' + rows + "</section>"
        : '<section class="sk-card sk-panel"><p class="sk-hint" style="margin:0">' + t("dailyEmpty") + "</p></section>") +
      "</div>"
    );
  }

  function dailyPreviewHtml() {
    var d = state.dailyDate || "";
    var txt = state.dailyText || "";
    return (
      '<div class="sk-page">' +
      header(d, "back") +
      '<section class="sk-card sk-panel"><pre class="sk-md">' + escapeHtml(txt) + "</pre></section>" +
      '<div class="sk-actions"><button type="button" class="sk-btn primary" data-act="daily-export" data-date="' +
      escapeAttr(d) + '">' + t("dailyExport") + "</button></div>" +
      "</div>"
    );
  }

  function downloadText(name, text) {
    try {
      var blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        URL.revokeObjectURL(a.href);
        if (a.parentNode) a.parentNode.removeChild(a);
      }, 1200);
    } catch (e) {}
  }

  function escapeHtml(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeAttr(v) {
    return String(v)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function bodyHtml() {
    if (view === "account") return accountHtml();
    if (view === "data") return dataHtml();
    if (view === "personalize") return personalizeHtml();
    if (view === "chatbg") return chatBgHtml();
    if (view === "bg-adjust") return adjustBgHtml();
    if (view === "prices") return pricesHtml();
    if (view === "price-edit") return priceEditHtml();
    if (view === "characters") return charactersHtml();
    if (view === "character") return characterHtml();
    if (view === "memory") return memoryHtml();
    if (view === "daily") return dailyHtml();
    if (view === "daily-preview") return dailyPreviewHtml();
    if (view === "terms") return termsHtml();
    if (view === "help") return helpHtml();
    return mainHtml();
  }

  /* ---------------- 渲染 ---------------- */
  function paint() {
    if (!root) return;
    root.innerHTML = bodyHtml();
    root.classList.toggle("sk-dark", prefersDark());
    if (view !== "main") root.scrollTop = 0;
  }

  /* 应用在 document 上监听指针事件判断“点击外部关闭弹窗”，
     本层面板挂在 #root 之外，必须阻断冒泡，否则真实鼠标点击会直接关掉设置。 */
  var SWALLOW = [
    "pointerdown",
    "pointerup",
    "mousedown",
    "mouseup",
    "touchstart",
    "touchend",
    "click",
    "dblclick",
    "contextmenu"
  ];

  function stopBubble(e) {
    e.stopPropagation();
  }

  /* 把设置面板接入浏览器历史，让 Android 返回键先关面板而不是退出应用 */
  var histPushed = false;
  var suppressPop = false;

  function pushHistEntry() {
    if (histPushed) return;
    histPushed = true;
    try {
      if (!(history.state && history.state.skOverlay)) {
        history.pushState({ skOverlay: true }, "");
      }
    } catch (e) {}
  }

  function popHistEntry() {
    if (!histPushed) return;
    histPushed = false;
    try {
      if (history.state && history.state.skOverlay) {
        suppressPop = true;
        history.back();
      }
    } catch (e) {}
  }

  function onPopState() {
    if (suppressPop) {
      suppressPop = false;
      return;
    }
    if (!root) {
      histPushed = false;
      return;
    }
    // 先关底部选择面板
    var sheet = document.querySelector(".sk-sheet");
    if (sheet) {
      var cancel = sheet.querySelector("[data-sheet-close]");
      if (cancel) cancel.click();
      else closeSheet();
      pushHistEntry();
      return;
    }
    // 再逐级返回二级页
    if (view !== "main") {
      view = backStack.length ? backStack.pop() : "main";
      paint();
      pushHistEntry();
      return;
    }
    // 最后关闭设置，避免直接退出应用
    histPushed = false;
    closeSettings();
  }

  /* 调整页：拖动舞台改变背景位置。用指针位移换算百分比，向上拖显示图片下半部分 */
  function installAdjustDrag(container) {
    var dragging = false;
    var startX = 0, startY = 0, startPX = 0, startPY = 0;
    container.addEventListener("pointerdown", function (e) {
      if (!state.bgDraft || !e.target.closest("#sk-adjust-stage")) return;
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      startPX = state.bgDraft.posX; startPY = state.bgDraft.posY;
      var stage = e.target.closest("#sk-adjust-stage");
      if (stage && stage.setPointerCapture) {
        try { stage.setPointerCapture(e.pointerId); } catch (err) {}
      }
      e.stopPropagation();
      e.preventDefault();
    }, true);
    container.addEventListener("pointermove", function (e) {
      if (!dragging || !state.bgDraft) return;
      var stage = document.querySelector("#sk-adjust-stage");
      if (!stage) return;
      var r = stage.getBoundingClientRect();
      // 拖动方向与背景位移相反：手指向左，图片向左，露出右侧 => posX 增大
      var dx = (startX - e.clientX) / Math.max(1, r.width) * 60;
      var dy = (startY - e.clientY) / Math.max(1, r.height) * 60;
      state.bgDraft.posX = Math.round(Math.max(0, Math.min(100, startPX + dx)) * 10) / 10;
      state.bgDraft.posY = Math.round(Math.max(0, Math.min(100, startPY + dy)) * 10) / 10;
      stage.style.cssText = adjustPreviewCss(state.bgDraft);
      e.stopPropagation();
      e.preventDefault();
    }, true);
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      e.stopPropagation();
    }
    container.addEventListener("pointerup", endDrag, true);
    container.addEventListener("pointercancel", endDrag, true);
  }

  function mount() {
    if (root) return;
    busy = true;
    root = document.createElement("div");
    root.id = "sk-settings";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", t("title"));
    document.body.appendChild(root);
    document.body.classList.add("sk-on");
    view = "main";
    paint();
    for (var i = 0; i < SWALLOW.length; i++) {
      root.addEventListener(SWALLOW[i], stopBubble, false);
    }
    root.addEventListener("click", onClick);
    root.addEventListener("input", onInput);
    installAdjustDrag(root);
    document.addEventListener("keydown", onKeydown, true);
    busy = false;
    pushHistEntry();
  }

  function unmount() {
    if (!root) return;
    busy = true;
    closeSheet();
    root.removeEventListener("click", onClick);
    document.removeEventListener("keydown", onKeydown, true);
    if (root.parentNode) root.parentNode.removeChild(root);
    root = null;
    document.body.classList.remove("sk-on");
    busy = false;
    popHistEntry();
  }

  /* 应用自己的确认类弹窗（如“确认导入历史对话？”）与设置弹窗同属 overlay-_83af2，
     层级只有 1000，会被本层盖住导致按钮点不到。这里把“不含设置弹窗”的 overlay 抬到本层之上。 */
  function liftModals() {
    var list = document.querySelectorAll('[class*="overlay-"], [class*="toast-"]');
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      // 设置弹窗自身所在的 overlay 不能抬，否则会盖住本层
      if (o.querySelector(DIALOG)) continue;
      if (o.style.zIndex === "2147483006") continue;
      var cs = window.getComputedStyle(o);
      if (cs.position !== "fixed" || cs.display === "none") continue;
      o.style.zIndex = "2147483006";
      if (!o.__skHooked) {
        o.__skHooked = true;
        o.addEventListener(
          "click",
          function (ev) {
            var b = ev.target.closest && ev.target.closest("button");
            if (!b) return;
            var txt = (b.textContent || "").replace(/\s+/g, "").trim();
            if (!/^(确认导入|确认|Confirm|Import)$/.test(txt)) return;
            toast(t("importing"));
            setTimeout(function () {
              toast(t("imported"));
            }, 1500);
          },
          true
        );
      }
    }
  }

  /* 冷启动时应用自身会弹出配置引导框（无 API Key 时），这里在用户尚未主动交互前
     自动关闭一次，让首次打开直接进入对话界面；用户之后手动点“设置”不受影响。 */
  var autoClosedOnBoot = false;
  var userInteracted = false;
  var suppressSettingsUntil = 0;
  document.addEventListener("pointerdown", function () {
    userInteracted = true;
    suppressSettingsUntil = 0; // 用户主动操作后立即解除抑制，避免拦住手动打开设置
  }, true);
  document.addEventListener("keydown", function (e) {
    userInteracted = true;
    if (obEl && e.key === "Escape") {
      e.stopPropagation();
      if (obStep > 0) obGoStep(obStep - 1);
      else closeOnboarding(true);
    }
  }, true);

  function dismissBootDialog() {
    var dlg = dialogEl();
    if (!dlg) return;
    var closeBtn =
      dlg.querySelector('[aria-label="关闭"], [aria-label="Close"]') ||
      dlg.querySelector('[title="关闭"], [title="Close"]');
    if (!closeBtn) {
      // 找无文字的图标按钮，通常是右上角关闭
      var btns = dlg.querySelectorAll("button");
      for (var i = 0; i < btns.length; i++) {
        if (!(btns[i].textContent || "").trim()) {
          closeBtn = btns[i];
          break;
        }
      }
    }
    if (closeBtn) closeBtn.click();
  }

  /* ---------------- DSH 风格首次引导 ---------------- */
  var OB_KEY = "chat-demo:onboarded";
  var obStep = 0;
  var obEl = null;
  var obNeedReload = false;
  var obEverShown = false;

  function onboardDone() {
    return read(OB_KEY, "") === "1";
  }

  function obWrap(inner) {
    return (
      '<div class="sk-ob-card">' +
      inner +
      '<div class="sk-ob-dots">' +
      [0, 1, 2, 3]
        .map(function (i) {
          return '<span class="sk-ob-dot' + (i === obStep ? " is-on" : "") + '"></span>';
        })
        .join("") +
      "</div></div>"
    );
  }

  function obHead(title, sub) {
    return (
      '<div class="sk-ob-head"><h1>' + title + "</h1><p>" + sub + "</p></div>"
    );
  }

  function obPage() {
    if (obStep === 0) {
      return obWrap(
        '<div class="sk-ob-hero"><div class="sk-ob-logo">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M20 11.5a8 8 0 01-8 8 8.5 8.5 0 01-3.6-.8L4 20l1.4-4.2A8 8 0 1120 11.5z"/>' +
          '<path d="M8.5 11.6h.01M12 11.6h.01M15.5 11.6h.01"/></svg></div></div>' +
          obHead(t("obWelcome"), t("obWelcomeSub")) +
          '<div class="sk-ob-actions"><button type="button" class="sk-ob-btn sk-ob-btn-primary" data-ob="next">' +
          t("obNext") + "</button></div>"
      );
    }
    if (obStep === 1) {
      var theme = currentTheme();
      var themes = [
        { k: "light", label: t("light"), ico: "sun" },
        { k: "dark", label: t("dark"), ico: "moon" },
        { k: "system", label: t("system"), ico: "sliders" }
      ];
      var cards = themes
        .map(function (x) {
          return (
            '<button type="button" class="sk-ob-choice' + (theme === x.k ? " is-on" : "") +
            '" data-ob="theme" data-value="' + x.k + '">' +
            '<span class="sk-ob-choice-ico">' + icon(x.ico) + "</span>" +
            '<span class="sk-ob-choice-label">' + x.label + "</span></button>"
          );
        })
        .join("");
      var cur = readBubble().color;
      var colors = [
        { k: "default", c: "#4d6bfe" },
        { k: "mint", c: "#12a594" },
        { k: "lilac", c: "#9065d6" },
        { k: "sand", c: "#b07d54" }
      ];
      var dots = colors
        .map(function (x) {
          return (
            '<button type="button" class="sk-ob-color' + (cur === x.k ? " is-on" : "") +
            '" data-ob="color" data-value="' + x.k + '" style="--dot:' + x.c + '" aria-label="' + x.k + '"></button>'
          );
        })
        .join("");
      return obWrap(
        obHead(t("obAppearance"), t("obAppearanceSub")) +
          '<div class="sk-ob-choices">' + cards + "</div>" +
          '<div class="sk-ob-colors"><span>' + t("obThemeColor") + "</span><div class=\"sk-ob-color-row\">" + dots + "</div></div>" +
          '<div class="sk-ob-actions"><button type="button" class="sk-ob-btn sk-ob-btn-primary" data-ob="next">' +
          t("obNext") + "</button>" +
          '<button type="button" class="sk-ob-btn sk-ob-btn-text" data-ob="prev">' + t("obPrev") + "</button></div>"
      );
    }
    if (obStep === 2) {
      var key = read(KEY.apiKey, "");
      return obWrap(
        obHead(t("obConnect"), t("obConnectSub")) +
          '<div class="sk-ob-field"><input type="password" class="sk-ob-input" data-ob="key" ' +
          'placeholder="' + escapeAttr(t("obApiKeyPh")) + '" value="' + escapeAttr(key) + '" ' +
          'autocomplete="off" autocapitalize="off" spellcheck="false"/></div>' +
          '<p class="sk-ob-hint">' + t("obKeyHint") + "</p>" +
          '<div class="sk-ob-actions"><button type="button" class="sk-ob-btn sk-ob-btn-primary" data-ob="save-key">' +
          t("obUseKey") + "</button>" +
          '<button type="button" class="sk-ob-btn sk-ob-btn-text" data-ob="skip-key">' + t("obSkipForNow") + "</button></div>"
      );
    }
    return obWrap(
      '<div class="sk-ob-hero"><div class="sk-ob-logo sk-ob-logo-done">' + icon("tick") + "</div></div>" +
        obHead(t("obReady"), t("obReadySub")) +
        '<div class="sk-ob-actions"><button type="button" class="sk-ob-btn sk-ob-btn-primary" data-ob="finish">' +
        t("obStart") + "</button></div>"
    );
  }

  function paintOnboarding() {
    if (!obEl) return;
    obEl.className = "sk-ob" + (prefersDark() ? " sk-ob-dark" : "");
    obEl.innerHTML =
      (obStep < 3
        ? '<button type="button" class="sk-ob-skip" data-ob="skip">' + t("obSkip") + "</button>"
        : "") +
      '<div class="sk-ob-scroll">' + obPage() + "</div>";
    var inp = obEl.querySelector('[data-ob="key"]');
    if (inp) {
      try { inp.focus(); } catch (e) {}
      inp.addEventListener("input", function () { obNeedReload = true; });
    }
  }

  function openOnboarding() {
    if (obEl || onboardDone()) return;
    obEverShown = true;
    obStep = 0;
    obNeedReload = false;
    obEl = document.createElement("div");
    obEl.id = "sk-ob";
    (document.body || document.documentElement).appendChild(obEl);
    paintOnboarding();
  }

  function closeOnboarding(finished) {
    if (!obEl) return;
    var el = obEl;
    obEl = null;
    if (el.parentNode) el.parentNode.removeChild(el);
    write(OB_KEY, "1");
    // 引导结束后若原配置框仍在，关闭并短暂抑制，避免直接盖到对话界面
    dismissBootDialog();
    autoClosedOnBoot = true;
    suppressSettingsUntil = Date.now() + 1800;
    if (finished && obNeedReload) {
      setTimeout(function () { location.reload(); }, 350);
    } else if (finished) {
      setTimeout(check, 250);
    }
  }

  function obGoStep(n) {
    obStep = Math.max(0, Math.min(3, n));
    paintOnboarding();
  }

  document.addEventListener("click", function (e) {
    if (!obEl) return;
    var b = e.target.closest ? e.target.closest("[data-ob]") : null;
    if (!b || !obEl.contains(b)) return;
    e.stopPropagation();
    var act = b.getAttribute("data-ob");
    if (act === "next") obGoStep(obStep + 1);
    else if (act === "prev") obGoStep(obStep - 1);
    else if (act === "skip") closeOnboarding(true);
    else if (act === "theme") {
      write(KEY.theme, b.getAttribute("data-value"));
      paintOnboarding();
    } else if (act === "color") {
      write("chat-demo:bubble-color", b.getAttribute("data-value"));
      applyPrefs();
      paintOnboarding();
    } else if (act === "save-key" || act === "skip-key") {
      var inp = obEl.querySelector('[data-ob="key"]');
      var val = inp ? (inp.value || "").trim() : "";
      if (act === "save-key") {
        if (!val) { toast(t("keyEmpty")); return; }
        write(KEY.apiKey, val);
        obNeedReload = true;
      }
      obGoStep(3);
    } else if (act === "finish") closeOnboarding(true);
  }, true);

  /* 微信风格：给会话列表项注入头像（React 重建后由 check 每次补齐） */
  function applyWechatList() {
    if (!readWechat()) return;
    var c = activeChar();
    var av = c && c.avatar
      ? '<img src="' + c.avatar + '" alt="">'
      : '<span>' + escapeHtml(c ? (c.name || "聊").slice(0, 1) : "聊") + "</span>";
    var items = document.querySelectorAll(".list-ac14ac .item-ff6fc9");
    for (var i = 0; i < items.length; i++) {
      if (items[i].querySelector(".sk-wx-avatar")) continue;
      var a = document.createElement("span");
      a.className = "sk-wx-avatar";
      a.innerHTML = av;
      items[i].insertBefore(a, items[i].firstChild);
    }
  }

  function check() {
    if (busy) return;
    if (obEl) return; // 引导层接管期间不处理设置页
    refreshCharBadge();
    applyWechatList();
    if (Date.now() < suppressSettingsUntil) return;
    liftModals();
    if (!onboardDone() && !userInteracted) {
      dismissBootDialog();
      openOnboarding();
      return;
    }
    if (dialogEl()) {
      if (!autoClosedOnBoot && !userInteracted) {
        autoClosedOnBoot = true;
        suppressSettingsUntil = Date.now() + 2000;
        dismissBootDialog();
        return;
      }
      mount();
    } else unmount();
  }

  /* 原生返回键（APK）：由 MainActivity 通过 evaluateJavascript 调用。
     返回 true 表示已消费（关闭了某个面板），否则走默认退出逻辑。 */
  window.__skHandleBack = function () {
    // 0. 首次引导：上一步；第一步则关闭引导（消费掉，避免误退出）
    if (obEl) {
      if (obStep > 0) obGoStep(obStep - 1);
      else closeOnboarding(true);
      return true;
    }
    // 1. 新对话角色选择面板
    if (document.querySelector(".skp-sheet")) {
      closePicker();
      return true;
    }
    // 2. 设置里的底部选择面板
    if (root && document.querySelector("#sk-settings .sk-sheet")) {
      closeSheet();
      return true;
    }
    // 3. 右侧上下文边栏
    if (ctxPanel && !ctxPanel.classList.contains("is-hidden")) {
      ctxPanel.classList.add("is-hidden");
      return true;
    }
    // 4. 设置面板：二级页先逐级返回，主页面则整个关闭
    if (root) {
      if (view !== "main") {
        view = backStack.length ? backStack.pop() : "main";
        paint();
      } else {
        closeSettings();
      }
      return true;
    }
    // 5. 应用自身的左侧抽屉（收起边栏按钮存在 = 抽屉打开）
    var collapse =
      document.querySelector('[aria-label*="收起"]') ||
      document.querySelector('[aria-label*="ollapse" i]');
    if (collapse) {
      collapse.click();
      return true;
    }
    // 6. 应用自己的确认类弹窗（已被 liftModals 抬层）：尝试点取消/关闭
    var lifted = document.querySelectorAll('[class*="overlay-"]');
    for (var i = 0; i < lifted.length; i++) {
      var o = lifted[i];
      if (o.style.zIndex !== "2147483006") continue;
      if (o.style.display === "none") continue;
      var btns = o.querySelectorAll("button");
      for (var j = 0; j < btns.length; j++) {
        var txt = (btns[j].textContent || "").trim();
        if (/^(取消|关闭|Cancel|Close)$/i.test(txt)) {
          btns[j].click();
          return true;
        }
      }
      // 有弹窗但找不到取消按钮：消费掉返回键，避免误退出
      return true;
    }
    return false;
  };

  function onKeydown(e) {
    if (obEl && e.key === "Escape") {
      e.stopPropagation();
      if (obStep > 0) obGoStep(obStep - 1);
      else closeOnboarding(true);
      return;
    }
    if (!root) return;
    if (e.key === "Escape") {
      e.stopPropagation();
      if (sheetEl) closeSheet();
      else if (view !== "main") {
        view = "main";
        paint();
      } else closeSettings();
    }
  }

  /* ---------------- 底部选择面板 ---------------- */
  var sheetEl = null;

  function closeSheet() {
    if (!sheetEl) return;
    var nodes = document.querySelectorAll("#sk-settings .sk-mask, #sk-settings .sk-sheet");
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].parentNode) nodes[i].parentNode.removeChild(nodes[i]);
    }
    sheetEl = null;
  }

  function openSheet(title, options, selected, onPick, notes) {
    closeSheet();
    var mask = document.createElement("div");
    mask.className = "sk-mask";
    mask.setAttribute("data-sheet-close", "1");

    var sheet = document.createElement("div");
    sheet.className = "sk-sheet";
    var html = '<div class="sk-sheet-title">' + title + "</div>";
    if (notes) {
      html += '<div class="sk-sheet-notes">' + notes + "</div>";
    }
    for (var i = 0; i < options.length; i++) {
      var o = options[i];
      html +=
        '<button type="button" class="sk-opt' +
        (o.danger ? " sk-danger" : "") +
        (o.value === selected ? " sk-on" : "") +
        '" data-pick="' +
        i +
        '">' +
        o.label +
        (o.value === selected ? '<span class="sk-tick">' + icon("tick") + "</span>" : "") +
        "</button>";
    }
    html += '<button type="button" class="sk-cancel" data-sheet-close="1">' + t("cancel") + "</button>";
    sheet.innerHTML = html;
    sheet.addEventListener("click", function (e) {
      var pick = e.target.closest("[data-pick]");
      if (pick) {
        closeSheet();
        onPick(parseInt(pick.getAttribute("data-pick"), 10));
        return;
      }
      if (e.target.closest("[data-sheet-close]")) closeSheet();
    });

    root.appendChild(mask);
    root.appendChild(sheet);
    sheetEl = sheet;
  }

  /* ---------------- 交互 ---------------- */
  function onInput(e) {
    var zoomSlider = e.target.closest && e.target.closest('[data-act="bg-zoom"]');
    if (zoomSlider) {
      if (state.bgDraft) state.bgDraft.scale = Number(zoomSlider.value) / 100;
      var stageZ = document.querySelector("#sk-adjust-stage");
      if (stageZ && state.bgDraft) stageZ.style.cssText = adjustPreviewCss(state.bgDraft);
      return;
    }
    var bgSlider = e.target.closest && e.target.closest('[data-act="bg-opacity"]');
    if (bgSlider) {
      var bg = readBg();
      bg.opacity = Number(bgSlider.value);
      writeBg(bg);
      applyChatBg();
      var pv = document.querySelector("#sk-settings .sk-bg-preview");
      if (pv) pv.style.cssText = "background-image:" + bgImageCss(bg) +
        (bg.type === "image" ? ";background-size:cover," + Math.round(bg.scale * 100) + "%;background-position:center," + bg.posX + "% " + bg.posY + "%" : "");
      return;
    }
    var f = e.target.closest && e.target.closest("[data-field]");
    if (!f) return;
    var k = f.getAttribute("data-field");
    if (k === "apiKey") {
      state.keyDraft = f.value;
      return;
    }
    if (!state.draft) state.draft = {};
    state.draft[k] = f.value;
  }

  function onClick(e) {
    var maskClose = e.target.closest("[data-sheet-close]");
    if (maskClose) {
      closeSheet();
      return;
    }
    var el = e.target.closest("[data-act]");
    if (!el || !root.contains(el)) return;
    var act = el.getAttribute("data-act");
    e.preventDefault();

    if (act === "close") {
      closeSettings();
      return;
    }
    if (act === "back") {
      view = backStack.length ? backStack.pop() : "main";
      paint();
      return;
    }
    if (act === "account") {
      view = "account";
      paint();
      return;
    }
    if (act === "data") {
      view = "data";
      paint();
      return;
    }
    if (act === "language") {
      openSheet(
        t("language"),
        [
          { value: "zh-CN", label: t("zhCN") },
          { value: "en-US", label: t("enUS") }
        ],
        isEN() ? "en-US" : "zh-CN",
        function (i) {
          pickLocale(i === 1 ? "en-US" : "zh-CN");
        }
      );
      return;
    }
    if (act === "appearance") {
      openSheet(
        t("appearance"),
        [
          { value: "light", label: t("light") },
          { value: "dark", label: t("dark") },
          { value: "system", label: t("system") }
        ],
        currentTheme(),
        function (i) {
          pickTheme(["light", "dark", "system"][i]);
        }
      );
      return;
    }
    if (act === "voice") {
      openSheet(
        t("voice"),
        [
          { value: "stella", label: t("stella") },
          { value: "tide", label: t("tide") }
        ],
        voiceValue(),
        function (i) {
          pickVoice(i === 1 ? "tide" : "stella");
        }
      );
      return;
    }
    if (act === "import-url") {
      openImportUrl();
      return;
    }
    if (act === "import") {
      openDataTab(function (dlg) {
        var btn = findButton(dlg, function (txt) {
          return txt === "上传" || txt === "Upload";
        });
        if (btn) btn.click();
        else toast(t("noImport"));
      });
      return;
    }
    if (act === "export") {
      openDataTab(function (dlg) {
        var btn = findButton(dlg, function (txt) {
          return txt === "下载" || txt === "Download";
        });
        if (btn) {
          btn.click();
          toast(t("exporting"));
        } else toast(t("noExport"));
      });
      return;
    }
    if (act === "delete") {
      openSheet(
        t("confirmTitle"),
        [{ value: "yes", label: t("deleteChat"), danger: true }],
        null,
        function (i) {
          if (i === 0) wipeAll();
        }
      );
      return;
    }
    if (act === "save-key") {
      var input = root.querySelector("#sk-api-key");
      var v = input ? input.value.trim() : "";
      if (!v) {
        toast(t("keyEmpty"));
        return;
      }
      write(KEY.apiKey, v);
      toast(t("keySaved"));
      setTimeout(function () {
        location.reload();
      }, 600);
      return;
    }
    if (act === "clear-key") {
      try {
        localStorage.removeItem(KEY.apiKey);
      } catch (err) {}
      var box = root.querySelector("#sk-api-key");
      if (box) box.value = "";
      toast(t("keyCleared"));
      return;
    }
    if (act === "fontsize") {
      openSheet(
        t("fontSize"),
        FS_STEPS.map(function (k) {
          return { value: k, label: t(FS_LABEL[k]) };
        }),
        readFs(),
        function (i) {
          write("chat-demo:font-size", FS_STEPS[i]);
          applyPrefs();
          paint();
        }
      );
      return;
    }
    if (act === "personalize") {
      view = "personalize";
      paint();
      return;
    }
    if (act === "chatbg") {
      backStack.push("personalize");
      view = "chatbg";
      paint();
      return;
    }
    if (act === "bg-preset") {
      var pk = el.getAttribute("data-preset") || "none";
      var b1 = readBg();
      b1.type = pk === "none" ? "none" : "preset";
      b1.preset = pk === "none" ? b1.preset : pk;
      writeBg(b1);
      applyChatBg();
      paint();
      return;
    }
    if (act === "bg-pick") {
      pickBackgroundImage();
      return;
    }
    if (act === "bg-adjust") {
      var cur = readBg();
      state.bgDraft = {
        image: cur.image,
        opacity: cur.opacity,
        posX: cur.posX,
        posY: cur.posY,
        scale: cur.scale
      };
      backStack.push("chatbg");
      view = "bg-adjust";
      paint();
      return;
    }
    if (act === "bg-apply") {
      var d = state.bgDraft;
      if (!d || !d.image) { toast(t("chatBgNoImage")); return; }
      writeBg({ type: "image", preset: "aurora", image: d.image, opacity: d.opacity, posX: d.posX, posY: d.posY, scale: d.scale });
      applyChatBg();
      state.bgDraft = null;
      view = backStack.length ? backStack.pop() : "chatbg";
      paint();
      toast(t("chatBgApplied"));
      return;
    }
    if (act === "bg-reset") {
      if (state.bgDraft) {
        state.bgDraft.posX = 50;
        state.bgDraft.posY = 50;
        state.bgDraft.scale = 1;
      }
      paint();
      return;
    }
    if (act === "bg-adjust-cancel") {
      state.bgDraft = null;
      view = backStack.length ? backStack.pop() : "chatbg";
      paint();
      return;
    }
    if (act === "bg-clear") {
      var b2 = readBg();
      b2.type = "none";
      b2.image = "";
      writeBg(b2);
      applyChatBg();
      paint();
      return;
    }
    if (act === "toggle-density") {
      write("chat-demo:density", readDensity() === "compact" ? "comfort" : "compact");
      applyPrefs();
      paint();
      return;
    }
    if (act === "toggle-caveat") {
      write("chat-demo:caveat", readCaveat() ? "off" : "on");
      applyPrefs();
      paint();
      return;
    }
    if (act === "toggle-wechat") {
      write("chat-demo:wechat-mode", readWechat() ? "off" : "on");
      applyPrefs();
      paint();
      return;
    }
    if (act === "update") {
      checkUpdate(false);
      return;
    }
    if (act === "rollback") {
      openSheet(t("rollback"), [{ label: t("rollback"), value: "go" }, { label: t("cancel"), value: "no" }],
        undefined, function (i) { if (i === 0) nativeRollback(); }, t("rollbackConfirm"));
      return;
    }
    if (act === "prices") {
      backStack.push(view === "account" ? "account" : "main");
      view = "prices";
      paint();
      return;
    }
    if (act === "price-edit") {
      backStack.push("prices");
      view = "price-edit";
      paint();
      return;
    }
    if (act === "price-save") {
      var pr = readPrices();
      var inputs = root.querySelectorAll("[data-price]");
      for (var pi = 0; pi < inputs.length; pi++) {
        var parts = inputs[pi].getAttribute("data-price").split("-");
        var v = Number(inputs[pi].value);
        if (!isNaN(v) && v >= 0 && pr.models[Number(parts[0])]) {
          pr.models[Number(parts[0])][parts[1]][parts[2]] = v;
        }
      }
      pr.updated = new Date().toISOString().slice(0, 10);
      writePrices(pr);
      toast(t("priceSaved"));
      view = backStack.length ? backStack.pop() : "prices";
      paint();
      return;
    }
    if (act === "check-balance") {
      checkBalance();
      return;
    }
    if (act === "characters") {
      backStack = ["data"];
      view = "characters";
      state.draft = null;
      paint();
      return;
    }
    if (act === "memory") {
      backStack = ["data"];
      view = "memory";
      state.draft = {};
      paint();
      return;
    }
    if (act === "char-new") {
      backStack.push("characters");
      state.editId = null;
      state.draft = { name: "", persona: "", greeting: "", personality: "", avatar: "" };
      view = "character";
      paint();
      return;
    }
    if (act === "char-avatar") {
      if (!state.draft) state.draft = {};
      pickAvatar(function (dataUrl) {
        if (!state.draft) return;
        state.draft.avatar = dataUrl;
        var box = document.getElementById("sk-char-avatar-preview");
        if (box) box.innerHTML = '<img class="sk-char-avatar-img" src="' + dataUrl + '" alt="">';
      });
      return;
    }
    if (act === "world-save") {
      if (!state.draft || !state.draft.world) return;
      var w = state.draft.world;
      var nameInput = root.querySelector('[data-world-field="name"]');
      var bgInput = root.querySelector('[data-world-field="background"]');
      if (nameInput) w.name = nameInput.value.trim() || w.name;
      if (bgInput) w.background = bgInput.value.trim();
      var checked = root.querySelectorAll("[data-world-member]:checked");
      w.memberIds = [];
      for (var wi = 0; wi < checked.length; wi++) w.memberIds.push(checked[wi].getAttribute("data-world-member"));
      // 主角色必须在场
      if (state.editId && w.memberIds.indexOf(state.editId) < 0) w.memberIds.push(state.editId);
      var worlds = readWorlds();
      var replaced = false;
      for (var wj = 0; wj < worlds.length; wj++) {
        if (worlds[wj].id === w.id) { worlds[wj] = w; replaced = true; }
      }
      if (!replaced) worlds.push(w);
      writeWorlds(worlds);
      state.draft.world = JSON.parse(JSON.stringify(w));
      toast(t("worldSaved"));
      return;
    }
    if (act === "char-open") {
      backStack.push("characters");
      var cid = el.getAttribute("data-id");
      var cList = readChars();
      for (var ci = 0; ci < cList.length; ci++) {
        if (cList[ci].id === cid) {
          state.editId = cid;
          var cw = ensureWorldForChar(cList[ci]);
          writeChars(cList);
          state.draft = {
            name: cList[ci].name,
            persona: cList[ci].persona,
            greeting: cList[ci].greeting,
            personality: cList[ci].personality || "",
            avatar: cList[ci].avatar || "",
            world: cw ? JSON.parse(JSON.stringify(cw)) : null
          };
        }
      }
      view = "character";
      paint();
      return;
    }
    if (act === "char-save") {
      var d = state.draft || {};
      var name = (d.name || "").trim();
      if (!name) {
        toast(t("characterNeedName"));
        return;
      }
      var list = readChars();
      if (state.editId) {
        for (var li = 0; li < list.length; li++) {
          if (list[li].id === state.editId) {
            list[li].name = name;
            list[li].personality = (d.personality || "").trim();
            list[li].persona = (d.persona || "").trim();
            list[li].greeting = (d.greeting || "").trim();
            list[li].avatar = d.avatar || "";
          }
        }
      } else {
        var nid = "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        list.push({
          id: nid,
          name: name,
          personality: (d.personality || "").trim(),
          persona: (d.persona || "").trim(),
          greeting: (d.greeting || "").trim(),
          avatar: d.avatar || "",
          at: Date.now()
        });
        state.editId = nid;
      }
      // 角色保存后确保其拥有默认世界书（群聊场景）
      var savedChar = null;
      for (var si = 0; si < list.length; si++) if (list[si].id === state.editId) savedChar = list[si];
      ensureWorldForChar(savedChar);
      writeChars(list);
      toast(t("characterSaved"));
      backStack = ["data"];
      view = "characters";
      state.draft = null;
      paint();
      return;
    }
    if (act === "char-use") {
      if (!state.editId) return;
      if (activeId() === state.editId) {
        write("chat-demo:character-active", "");
        // 取消启用时，把绑定到该角色的会话一并解绑，避免旧对话继续使用
        var cm = convMap();
        Object.keys(cm).forEach(function (k) {
          if (cm[k] === state.editId) delete cm[k];
        });
        write("chat-demo:conv-char", JSON.stringify(cm));
      } else {
        write("chat-demo:character-active", state.editId);
      }
      paint();
      return;
    }
    if (act === "char-del") {
      var delId = state.editId;
      if (!delId) return;
      openSheet(
        t("characterDelete"),
        [{ value: "yes", label: t("characterDelete"), danger: true }],
        null,
        function (i) {
          if (i !== 0) return;
          writeChars(readChars().filter(function (x) { return x.id !== delId; }));
          if (activeId() === delId) write("chat-demo:character-active", "");
          write("chat-demo:memory:" + delId, "[]");
          state.editId = null;
          state.draft = null;
          backStack = ["data"];
          view = "characters";
          paint();
          toast(t("characterDeleted"));
        }
      );
      return;
    }
    if (act === "mem-add") {
      var mc = activeChar();
      if (!mc) return;
      var mtxt = ((state.draft && state.draft.memory) || "").trim();
      if (!mtxt) {
        toast(t("memoryNeedText"));
        return;
      }
      var mm = readMem(mc.id);
      mm.push({ text: mtxt, at: Date.now() });
      writeMem(mc.id, mm);
      state.draft.memory = "";
      paint();
      toast(t("memorySaved"));
      return;
    }
    if (act === "mem-del") {
      var dc = activeChar();
      if (!dc) return;
      var idx = parseInt(el.getAttribute("data-idx"), 10);
      var dm = readMem(dc.id);
      dm.splice(idx, 1);
      writeMem(dc.id, dm);
      paint();
      return;
    }
    if (act === "mem-clear") {
      var cc = activeChar();
      if (!cc) return;
      writeMem(cc.id, []);
      paint();
      toast(t("memoryCleared"));
      return;
    }
    if (act === "mem-auto") {
      write("chat-demo:memory-auto", memAuto() ? "off" : "on");
      paint();
      return;
    }
    if (act === "daily") {
      backStack = ["data"];
      view = "daily";
      paint();
      return;
    }
    if (act === "daily-pick") {
      pickDir();
      return;
    }
    if (act === "daily-toggle") {
      write("chat-demo:daily-on", dailyOn() ? "off" : "on");
      paint();
      return;
    }
    if (act === "daily-days") {
      openSheet(
        t("dailyDays"),
        [1, 3, 5, 7].map(function (n) {
          return { value: String(n), label: t("dailyDaysValue").replace("{n}", n) };
        }),
        String(dailyDays()),
        function (i) {
          write("chat-demo:daily-days", String([1, 3, 5, 7][i]));
          refreshDailyContext().then(function () {
            paint();
          });
        }
      );
      return;
    }
    if (act === "daily-open") {
      var dd = el.getAttribute("data-date");
      readDaily(dd).then(function (txt) {
        state.dailyDate = dd;
        state.dailyText = txt || "";
        backStack.push("daily");
        view = "daily-preview";
        paint();
      });
      return;
    }
    if (act === "daily-export") {
      var de = el.getAttribute("data-date");
      readDaily(de).then(function (txt) {
        downloadText(de + ".md", txt || "");
      });
      return;
    }
    if (act === "bubble-color") {
      openSheet(
        t("bubbleColor"),
        BUBBLE_COLORS.map(function (v) {
          return {
            value: v,
            label: { default: t("cDefault"), mint: t("cMint"), lilac: t("cLilac"), sand: t("cSand") }[v]
          };
        }),
        readBubble().color,
        function (i) {
          write("chat-demo:bubble-color", BUBBLE_COLORS[i]);
          applyPrefs();
          paint();
        }
      );
      return;
    }
    if (act === "bubble-radius") {
      openSheet(
        t("bubbleRadius"),
        BUBBLE_RADII.map(function (v) {
          return {
            value: v,
            label: { round: t("rRound"), medium: t("rMedium"), square: t("rSquare") }[v]
          };
        }),
        readBubble().radius,
        function (i) {
          write("chat-demo:bubble-radius", BUBBLE_RADII[i]);
          applyPrefs();
          paint();
        }
      );
      return;
    }
    if (act === "bubble-width") {
      openSheet(
        t("bubbleWidth"),
        BUBBLE_WIDTHS.map(function (v) {
          return { value: v, label: { normal: t("wNormal"), wide: t("wWide") }[v] };
        }),
        readBubble().width,
        function (i) {
          write("chat-demo:bubble-width", BUBBLE_WIDTHS[i]);
          applyPrefs();
          paint();
        }
      );
      return;
    }
    if (act === "source") {
      openExternal(SOURCE_URL);
      return;
    }
    if (act === "terms") {
      view = "terms";
      paint();
      return;
    }
    if (act === "help") {
      view = "help";
      paint();
      return;
    }
    if (act === "copy-diag") {
      copyDiag();
      return;
    }
    if (act === "logout") {
      openSheet(
        t("logoutTitle"),
        [{ value: "yes", label: t("logoutAction"), danger: true }],
        null,
        function (i) {
          if (i === 0) doLogout();
        }
      );
      return;
    }
    toast(t("soon"));
  }

  /* 检查更新：APK 内优先走 GitHub Releases（原生 NativeUpdater），
     兼容自定义 update.json；Web 端读取同目录 version.json 比对。
     silent=true 为启动静默检查：有新版本只弹一次轻提示，不打断操作。 */
  var checking = false;
  var updateBadgeEl = null;

  function failReason(s) {
    if (!s) return "";
    var e = s.error || "";
    var map = {
      network: "网络不可用",
      download: "下载失败",
      "invalid-url": "更新地址无效",
      "invalid-package": "安装包校验失败",
      "package-mismatch": "安装包不匹配",
      "signature-mismatch": "签名不一致",
      downgrade: "版本异常",
      "install-permission": "未授予安装权限",
      "install-failed": "安装失败",
      "no-backup": "无备份"
    };
    return map[e] || e || "";
  }

  function checkUpdate(silent) {
    if (checking) return;
    if (window.NativeUpdater) {
      nativeCheckUpdate(!!silent);
      return;
    }
    if (silent) return; // Web 端不做静默检查
    checking = true;
    toast(t("checking"));
    fetch("version.json", { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (v) {
        var cur = versionLabel();
        var next = (v.version || "") + "（" + (v.build || "") + "）";
        if (!v.version || next === cur) toast(t("upToDate") + " " + cur);
        else toast(t("updateFound") + " " + next);
      })
      .catch(function () {
        toast(t("updateFailed"));
      })
      .then(function () {
        checking = false;
      });
  }

  function nativeStatus() {
    try {
      return JSON.parse(window.NativeUpdater.status());
    } catch (e) {
      return null;
    }
  }

  function showUpdateBadge() {
    if (updateBadgeEl || !root) return;
    var target = root.querySelector('#sk-settings [data-act="update"]');
    if (!target) return;
    updateBadgeEl = document.createElement("span");
    updateBadgeEl.className = "sk-update-badge";
    updateBadgeEl.textContent = "•";
    updateBadgeEl.title = t("updateBadge");
    target.appendChild(updateBadgeEl);
  }

  function nativeCheckUpdate(silent) {
    if (checking) return;
    checking = true;
    var manifest = read("chat-demo:update-url", "") || UPDATE_MANIFEST_URL;
    if (!silent) toast(t("checking"));
    try {
      if (manifest) window.NativeUpdater.check(manifest);
      else window.NativeUpdater.checkGithub(GH_REPO);
    } catch (e) {
      checking = false;
      if (!silent) toast(t("updateFailed"));
      return;
    }
    var n = 0;
    var timer = setInterval(function () {
      var s = nativeStatus();
      if (s && s.phase === "available") {
        clearInterval(timer);
        checking = false;
        write(AUTO_CHECK_KEY, String(Date.now()));
        showUpdateBadge();
        if (silent) {
          toast(t("updateBadge") + "：" + (s.versionName || "") + "（" + s.versionCode + "）");
          return;
        }
        var title = t("updateFound") + " " + (s.versionName || "") + "（" + s.versionCode + "）";
        var opts = [
          { label: t("updateAction"), value: "go" },
          { label: t("later"), value: "no" }
        ];
        if (window.NativeUpdater.hasBackup && window.NativeUpdater.hasBackup() === "1") {
          opts.push({ label: t("rollback"), value: "rollback" });
        }
        var notes = (s.notes || "").trim();
        var rollbackIdx = -1;
        for (var oi = 0; oi < opts.length; oi++) {
          if (opts[oi].value === "rollback") rollbackIdx = oi;
        }
        openSheet(
          title,
          opts,
          undefined,
          function (i) {
            if (i === 0) nativeInstall(s.apkUrl);
            else if (i === rollbackIdx) nativeRollback();
          },
          notes ? escapeHtml(t("updateNotes") + "：" + notes.slice(0, 300)) : ""
        );
      } else if (s && s.phase === "uptodate") {
        clearInterval(timer);
        checking = false;
        write(AUTO_CHECK_KEY, String(Date.now()));
        if (!silent) toast(t("upToDate") + " " + versionLabel());
      } else if (s && s.phase === "failed") {
        clearInterval(timer);
        checking = false;
        if (!silent) toast(t("updateFailed") + (failReason(s) ? "：" + failReason(s) : ""));
      } else if (++n > 120) {
        clearInterval(timer);
        checking = false;
        if (!silent) toast(t("updateFailed"));
      }
    }, 300);
  }

  function nativeInstall(apkUrl) {
    if (!apkUrl) {
      toast(t("updateFailed"));
      return;
    }
    toast(t("downloading"));
    window.NativeUpdater.install(apkUrl);
    var n = 0;
    var timer = setInterval(function () {
      var s = nativeStatus();
      if (s && s.phase === "installing") {
        clearInterval(timer);
        toast(t("installing"));
      } else if (s && s.phase === "failed") {
        clearInterval(timer);
        var why = failReason(s);
        toast(
          s.error === "install-permission"
            ? t("updateGrant")
            : t("updateFailed") + (why ? "：" + why + "，已保留当前版本" : "")
        );
      } else if (s && s.phase === "downloading") {
        // 进度由原生记录；这里不持续打断用户
      } else if (++n > 600) {
        clearInterval(timer);
      }
    }, 300);
  }

  function nativeRollback() {
    if (!window.NativeUpdater.rollback) {
      toast(t("noBackup"));
      return;
    }
    window.NativeUpdater.rollback();
    setTimeout(function () { toast(t("rollbackDone")); }, 400);
  }

  /* 启动静默检查：仅原生环境、距上次检查超过间隔时触发一次 */
  function autoCheckOnBoot() {
    if (!window.NativeUpdater || !window.NativeUpdater.checkGithub) return;
    var last = parseInt(read(AUTO_CHECK_KEY, "0"), 10) || 0;
    if (Date.now() - last < AUTO_CHECK_MS) return;
    setTimeout(function () { checkUpdate(true); }, 4000);
  }

  function copyDiag() {
    var diag = [
      "app=chatbot",
      "version=" + versionLabel(),
      "ua=" + navigator.userAgent,
      "lang=" + effectiveLocale(),
      "hasKey=" + (read(KEY.apiKey, "") ? "yes" : "no"),
      "fs=" + readFs(),
      "density=" + readDensity()
    ].join("\n");
    var done = function () {
      toast(t("copied"));
    };
    var fail = function () {
      toast(t("copyFailed"));
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(diag).then(done).catch(fail);
      return;
    }
    try {
      var ta = document.createElement("textarea");
      ta.value = diag;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      ok ? done() : fail();
    } catch (e) {
      fail();
    }
  }

  /* 退出登录：清除本机全部 chat-demo 数据 */
  function doLogout() {
    toast(t("logoutNote"));
    try {
      Object.keys(localStorage).forEach(function (k) {
        if (k.indexOf("chat-demo") === 0) localStorage.removeItem(k);
      });
    } catch (e) {}
    try {
      sessionStorage.clear();
    } catch (e) {}
    var finish = function () {
      location.reload();
    };
    try {
      var req = indexedDB.deleteDatabase("chat-demo");
      req.onsuccess = finish;
      req.onerror = finish;
      req.onblocked = finish;
      setTimeout(finish, 1200);
    } catch (e) {
      finish();
    }
  }

  function pickTheme(value) {
    var dlg = dialogEl();
    var label = value === "light" ? t("light") : value === "dark" ? t("dark") : t("system");
    var btn = findButton(dlg, function (txt) {
      return txt === label;
    });
    if (btn) btn.click();
    setTimeout(function () {
      if (currentTheme() !== value) write(KEY.theme, value);
      paint();
    }, 120);
  }

  function pickVoice(value) {
    var dlg = dialogEl();
    var trigger =
      dlg &&
      dlg.querySelector('[aria-label="朗读音色"], [aria-label="Read-aloud voice"]');
    if (!trigger) {
      write(KEY.voice, value);
      paint();
      return;
    }
    trigger.click();
    setTimeout(function () {
      var target = value === "tide" ? t("tide") : t("stella");
      var opt = findButton(document, function (txt) {
        return txt === target;
      });
      if (opt) opt.click();
      setTimeout(function () {
        if (voiceValue() !== value) write(KEY.voice, value);
        paint();
      }, 120);
    }, 140);
  }

  function pickLocale(value) {
    var dlg = dialogEl();
    var trigger = dlg && dlg.querySelector('[aria-label="语言"], [aria-label="Language"]');
    var label = value === "en-US" ? "English" : "简体中文";
    if (!trigger) {
      write(KEY.locale, value);
      location.reload();
      return;
    }
    trigger.click();
    setTimeout(function () {
      var opt = findButton(document, function (txt) {
        return txt === label || (value === "en-US" && txt.indexOf("English") > -1);
      });
      if (opt) opt.click();
      setTimeout(function () {
        var now = read(KEY.locale, "zh-CN");
        if (now !== value) {
          write(KEY.locale, value);
          toast(t("switching"));
          setTimeout(function () {
            location.reload();
          }, 500);
          return;
        }
        paint();
      }, 160);
    }, 140);
  }

  function wipeAll() {
    toast(t("deleting"));
    var done = false;
    var finish = function () {
      if (done) return;
      done = true;
      toast(t("deleted"));
      setTimeout(function () {
        location.reload();
      }, 700);
    };
    try {
      var req = indexedDB.deleteDatabase("chat-demo");
      req.onsuccess = finish;
      req.onerror = finish;
      req.onblocked = finish;
      setTimeout(finish, 1200);
    } catch (e) {
      finish();
    }
  }

  /* ---------------- 启动侦测 ---------------- */
  function boot() {
    new MutationObserver(function () {
      if (busy) return;
      window.requestAnimationFrame(check);
    }).observe(document.body, { childList: true, subtree: true });
    applyPrefs();
    installFetchHook();
    initDir().then(refreshDailyContext);
    installNewChatPicker();
    installNativeDownloads();
    window.addEventListener("popstate", onPopState);
    buildCtx();
    // 跨天时自动换档：每分钟与回到前台时检查一次日期
    setInterval(function () {
      if (dailyCache.date !== todayKey()) refreshDailyContext();
    }, 60000);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && dailyCache.date !== todayKey()) refreshDailyContext();
    });
    check();
    setTimeout(liftModals, 300);
    autoCheckOnBoot();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();