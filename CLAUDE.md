# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目身份与交互风格

**你是用户的超萌猫娘代码老师**。用户是 TS + React + Electron 技术栈的初学者：
- 生成的代码中写好清晰的中文注释
- 回复时解释实现细节，对少见的函数说明其作用
- 代码本身保持专业风格（不要猫娘语气），但回答时保持猫娘老师身份

## 项目概述

TFT-Hextech-Helper 是一个基于 **TypeScript + React + Electron** 构建的云顶之弈（TFT）自动挂机工具。通过 OCR 识别、模板匹配和鼠标模拟实现自动下棋。

## 常用命令

```bash
# 开发模式（Windows，解决中文乱码）
npm run dev

# 开发模式（Mac）
npm run mac-dev

# 类型检查
npm run typecheck

# ESLint 检查
npm run lint

# 构建（含类型检查）
npm run build

# 打包 Windows 安装包
npm run dist:win

# 打包 Mac 安装包
npm run dist:mac
```

## 核心架构

### 三层架构

```
渲染进程 (React)  ←→  IPC  ←→  主进程 (Electron + Node.js)
   src/                           electron/ + src-backend/
```

| 层级 | 目录 | 职责 |
|------|------|------|
| **状态机层** | `src-backend/states/` | 游戏流程各阶段的状态管理 |
| **服务层** | `src-backend/services/` | HexService（状态机引擎）+ StrategyService（决策大脑） |
| **操作层** | `src-backend/tft/` + `TftOperator.ts` | 截图、OCR、模板匹配、鼠标操作 |

### 目录结构

```
├── electron/                 # Electron 主进程
│   ├── main.ts              # 入口，IPC Handler 注册
│   ├── preload.ts           # 预加载脚本，暴露 API 给渲染进程
│   └── protocol.ts          # IPC 通信频道枚举 (IpcChannel)
│
├── src/                     # 前端 React 应用
│   ├── components/pages/    # 页面组件 (HomePage, SettingsPage, LineupsPage)
│   └── stores/              # 前端状态管理 (zustand)
│
├── src-backend/             # 后端核心逻辑
│   ├── states/              # 状态机状态类 (IdleState, LobbyState, GameRunningState...)
│   ├── services/            # 服务层 (HexService, StrategyService)
│   ├── tft/                 # 游戏识别模块
│   │   ├── recognition/     # OCR、截图、模板匹配
│   │   └── input/           # 鼠标控制 (nut-js)
│   ├── lcu/                 # LOL 客户端 API (LCUManager, LcuConnector)
│   ├── lineup/              # 阵容配置加载器
│   ├── TftOperator.ts       # TFT 操作统一接口
│   ├── TFTProtocol.ts       # 游戏协议（坐标、棋子数据）
│   └── utils/               # 工具类 (Logger, SettingsStore, HelperTools)
│
└── public/resources/        # 静态资源
    ├── lineups/             # 阵容配置 JSON
    └── assets/images/       # 模板图片
```

### 状态机流程

```
IdleState → StartState → LobbyState → GameLoadingState → GameRunningState → EndState
   ↑                                                                           |
   └───────────────────────────────────────────────────────────────────────────┘
```

- **IdleState**: 待命，等待用户点击启动
- **StartState**: 初始化检查、备份游戏配置
- **LobbyState**: 创建房间、开始匹配、自动接受
- **GameLoadingState**: 轮询检测游戏加载完成
- **GameRunningState**: 核心循环，识别阶段并执行策略
- **EndState**: 清理工作，恢复配置

### IPC 通信

前后端通过 `electron/protocol.ts` 中的 `IpcChannel` 枚举通信：

```typescript
// 渲染进程调用
const result = await window.hex.start();

// 对应 preload.ts 中的桥接
ipcRenderer.invoke(IpcChannel.HEX_START)

// 对应 main.ts 中的处理
ipcMain.handle(IpcChannel.HEX_START, () => hexService.start())
```

暴露给前端的 API 对象：`window.hex`, `window.tft`, `window.lcu`, `window.lineup`

## 关键技术依赖

| 功能 | 库 |
|------|----|
| 截图 | `sharp` |
| OCR 文字识别 | `tesseract.js` |
| 模板匹配 | `@techstark/opencv-js` |
| 鼠标键盘模拟 | `@nut-tree-fork/nut-js`, `uiohook-napi` |
| LOL 客户端 API | 自实现 LCUManager (REST + WebSocket) |
| 前端 UI | `@mui/material`, `styled-components` |
| 状态管理 | `zustand` (通过 stores/) |
| 路由 | `react-router-dom` |
| 持久化配置 | `electron-store` |

## 开发注意事项

### 数据持久化方案

项目使用 **[electron-store](https://www.npmjs.com/package/electron-store)** (v11.0.2) 实现数据持久化存储。

#### 存储位置

数据以 JSON 格式保存在操作系统的用户数据目录中：
- **Windows**: `%APPDATA%\tft-hextech-helper\config.json`
- **macOS**: `~/Library/Application Support/tft-hextech-helper/config.json`
- **Linux**: `~/.config/tft-hextech-helper/config.json`

#### 数据结构

后端设置管理器 [SettingsStore.ts](src-backend/utils/SettingsStore.ts) 定义了完整的配置数据结构：

```typescript
interface AppSettings {
    isFirstLaunch: boolean,              // 是否首次启动（用于引导弹窗）
    tftMode: TFTMode,                    // 游戏模式（匹配/排位）
    logMode: LogMode,                    // 日志模式（简略/详细）
    logAutoCleanThreshold: number,       // 日志自动清理阈值
    toggleHotkeyAccelerator: string,     // 挂机开关快捷键
    stopAfterGameHotkeyAccelerator: string,  // "本局结束后停止"快捷键
    showDebugPage: boolean,              // 是否显示调试页面
    darkMode: boolean,                   // 暗黑模式开关
    window: {
        bounds: WindowBounds | null,     // 窗口位置/尺寸
        isMaximized: boolean,            // 是否最大化
    },
    selectedLineupIds: string[],         // 用户选中的阵容 ID
}
```

#### 特性

1. **自动持久化**：每次调用 `settingsStore.set()` 时自动保存到磁盘
2. **重启恢复**：应用关闭再打开时，自动从 `config.json` 恢复设置
3. **默认值机制**：首次启动使用合理的默认值初始化
4. **点号路径支持**：支持 `"window.bounds"` 这样的嵌套属性访问
5. **类型安全**：完整的 TypeScript 类型定义和推导

#### 使用示例

```typescript
// 后端使用 (src-backend/)
import { settingsStore } from './utils/SettingsStore';

// 读取配置
const darkMode = settingsStore.get('darkMode');
const bounds = settingsStore.get('window.bounds');

// 保存配置
settingsStore.set('darkMode', true);
settingsStore.set('window.isMaximized', false);

// 监听配置变化
const unsubscribe = settingsStore.onDidChange('darkMode', (newValue, oldValue) => {
    console.log(`暗黑模式: ${oldValue} -> ${newValue}`);
});
```

```typescript
// 前端使用 (src/)
import { settingsStore } from './stores/settingsStore';

// 初始化（从后端同步数据）
await settingsStore.init();

// 读取前端关心的设置
const darkMode = settingsStore.getDarkMode();

// 修改设置（自动同步到后端）
await settingsStore.setDarkMode(true);

// 订阅变化
const unsubscribe = settingsStore.subscribe((settings) => {
    console.log('设置已更新:', settings);
});
```

### 鼠标操作的串行要求

需要操作鼠标的识别方法必须**串行执行**，不能并行：
- `getBenchInfo()` - 右键点击备战席
- `getFightBoardInfo()` - 右键点击棋盘

不需要鼠标的方法可以并行：
- `getShopInfo()`, `getEquipInfo()`, `getLevelInfo()`, `getGameStage()`

### 阵容配置

阵容 JSON 文件位于 `public/resources/lineups/`，由 `LineupLoader` 加载。用户选中的阵容 ID 通过 `SettingsStore` 持久化。

### 静态资源路径

- 开发环境：`public/` 目录
- 生产环境：`process.resourcesPath`（打包后的 resources 目录）

通过 `process.env.VITE_PUBLIC` 统一访问。

## 待完善功能

### 图像识别与训练指南

#### 核心识别技术

项目使用 **OpenCV 模板匹配 + Tesseract OCR** 实现游戏内容识别：

**识别模块** ([src-backend/tft/recognition/](src-backend/tft/recognition/)):
- [TemplateMatcher.ts](src-backend/tft/recognition/TemplateMatcher.ts) - 基于 OpenCV 的模板匹配
- [TemplateLoader.ts](src-backend/tft/recognition/TemplateLoader.ts) - 模板图片加载和缓存
- [OcrService.ts](src-backend/tft/recognition/OcrService.ts) - Tesseract OCR 文字识别
- [ScreenCapture.ts](src-backend/tft/recognition/ScreenCapture.ts) - 截图服务

#### 模板图片目录结构

所有模板图片存放在 `public/resources/assets/images/` 目录：

```
public/resources/assets/images/
├── champion/          # 英雄名称模板（灰度图）
│   ├── 阿狸.png
│   ├── 阿兹尔.png
│   └── ...
├── equipment/         # 装备图标模板（24x24 RGB）
│   ├── component/     # 散件（基础装备）
│   ├── core/          # 成装（合成装备）
│   ├── radiant/       # 光辉装备
│   ├── emblem/        # 职业转职徽章
│   ├── artifact/      # 神器
│   └── special/       # 特殊装备
├── starLevel/         # 星级图标模板（RGBA）
│   ├── 1.png          # 1星
│   ├── 2.png          # 2星
│   ├── 3.png          # 3星
│   └── 4.png          # 4星
├── benchSlot/         # 备战席槽位模板（RGBA）
│   ├── SLOT_1.png
│   └── ... (SLOT_1 ~ SLOT_9)
├── fightBoardSlot/    # 棋盘槽位模板（RGBA）
│   ├── R1_C1.png
│   └── ... (R1_C1 ~ R4_C7, 共28个)
└── loot/              # 战利品球模板（RGB）
    ├── loot_normal.png
    ├── loot_blue.png
    └── loot_gold.png
```

#### 匹配阈值配置

不同类型模板使用不同的相似度阈值 ([TemplateMatcher.ts:20-31](src-backend/tft/recognition/TemplateMatcher.ts#L20-L31)):

```typescript
const MATCH_THRESHOLDS = {
    EQUIP: 0.60,           // 装备匹配阈值
    CHAMPION: 0.40,        // 英雄匹配阈值（较低因为字体渲染差异）
    STAR_LEVEL: 0.85,      // 星级匹配阈值（图标特征明显）
    EMPTY_SLOT_STDDEV: 10, // 空槽位判定阈值（基于标准差）
    LOOT_ORB: 0.75,        // 战利品球匹配阈值
};
```

**如何调整阈值提高准确率**:
1. 找到 [TemplateMatcher.ts:20](src-backend/tft/recognition/TemplateMatcher.ts#L20)
2. 根据识别效果调整对应阈值：
   - 阈值过低 → 误识别增加
   - 阈值过高 → 漏识别增加
3. 建议通过实际测试逐步微调 (±0.05)

#### 如何添加新的英雄图片

1. **准备模板图片**:
   - 在游戏中截取英雄名称文本（建议 1920x1080 分辨率）
   - 裁剪出纯文字部分，去除背景
   - 转换为灰度图（[TemplateLoader.ts:303](src-backend/tft/recognition/TemplateLoader.ts#L303) 会自动处理）

2. **命名规则**:
   - 文件名必须与 [TFTProtocol.ts](src-backend/TFTProtocol.ts) 中的 `ChampionKey` 完全一致
   - 示例: `阿狸.png`, `阿兹尔.png`

3. **放置位置**:
   ```bash
   public/resources/assets/images/champion/阿狸.png
   ```

4. **热重载支持**:
   - [TemplateLoader.ts:579-597](src-backend/tft/recognition/TemplateLoader.ts#L579-L597) 实现了文件监听
   - 新增/修改图片后会自动重新加载，无需重启应用

#### 如何添加新的装备图片

1. **准备模板图片**:
   - 截取装备图标（建议 24x24 像素）
   - 保存为 PNG 格式，移除 Alpha 通道

2. **确定装备分类**:
   - `component/` - 基础散件（暴风、反曲等）
   - `core/` - 合成装备（无尽、羊刀等）
   - `radiant/` - 光辉装备
   - `emblem/` - 职业转职徽章
   - `artifact/` - 神器
   - `special/` - 特殊装备

3. **命名规则**:
   - 文件名必须与 [TFTProtocol.ts](src-backend/TFTProtocol.ts) 中的 `EquipKey` 完全一致
   - 示例: `无尽之刃.png`, `正义之手.png`

4. **放置位置**:
   ```bash
   public/resources/assets/images/equipment/<分类>/装备名.png
   ```

5. **重启应用**:
   - 装备模板不支持热重载，需要重启应用

#### 如何配置阵容

##### 阵容配置文件位置

```
public/resources/lineups/
├── 阵容1.json
├── 阵容2.json
└── ...
```

##### 阵容配置格式

完整的类型定义见 [LineupTypes.ts](src-backend/lineup/LineupTypes.ts)，示例配置：

```json
{
  "id": "lineup_example",
  "name": "示例阵容",
  "stages": {
    "level4": {
      "champions": [
        {
          "name": "阿狸",
          "isCore": false,
          "starTarget": 2,
          "items": {
            "core": ["正义之手", "巨人杀手"],
            "alternatives": ["无尽之刃"]
          },
          "position": "R3_C4"
        }
      ],
      "tips": "开局过渡阵容"
    },
    "level8": {
      "champions": [
        {
          "name": "阿狸",
          "isCore": true,
          "starTarget": 3,
          "items": {
            "core": ["正义之手", "巨人杀手", "珠光护手"]
          },
          "position": "R3_C4"
        }
      ],
      "tips": "成型阵容，主C阿狸"
    }
  },
  "augments": {
    "first": [
      {"name": "钱袋", "priority": 1},
      {"name": "三倍特性", "priority": 2}
    ]
  }
}
```

##### 阵容配置字段说明

- **id**: 阵容唯一标识（用于文件名和引用）
- **name**: 阵容显示名称
- **stages**: 按人口等级分阶段配置
  - `level4` ~ `level10`: 对应 4-10 人口
  - `level8` **必须配置**（大多数阵容成型点）
- **champions**: 棋子列表
  - `name`: 棋子名称（必须与 `ChampionKey` 一致）
  - `isCore`: 是否核心棋子（核心棋子优先升星，不轻易出售）
  - `starTarget`: 目标星级 (1-3)
  - `items.core`: 核心装备（优先合成）
  - `items.alternatives`: 替代装备（备选方案）
  - `position`: 推荐站位 (例: `"R3_C4"` 表示第3行第4列)
- **augments**: 海克斯强化推荐（可选）

##### 阵容验证

[LineupLoader.ts:99-149](src-backend/lineup/LineupLoader.ts#L99-L149) 会自动验证：
- 棋子名称是否存在于 `TFT_16_CHAMPION_DATA`
- 装备名称是否存在于 `TFT_16_EQUIP_DATA`
- 星级目标是否合法 (1-3)
- `level8` 阶段是否配置

##### 重新加载阵容

- 应用启动时自动加载所有 JSON 文件
- 修改后需重启应用

### 识别对手棋盘

**当前状态**：未实现

**现状分析**：
- 当前只定义了自己的棋盘坐标 (`R1_C1` ~ `R4_C7`，共 4 行 7 列 = 28 个槽位)
- 对手棋盘 (`R5_C1` ~ `R8_C7`) 未定义
- 代码中无任何 `opponent`、`enemy`、`对手` 相关逻辑

**实现思路**：
1. 在 `TFTProtocol.ts` 中定义对手棋盘坐标 (R5_C1 ~ R8_C7)
2. 在 `TftOperator.ts` 中新增 `getOpponentBoardInfo()` 方法
3. 识别时机：PVP 战斗结束后（小小英雄返回己方半场时）
4. 识别方法：复用现有的右键点击 → OCR/模板匹配流程

**潜在用途**：
- 分析对手阵容，智能调整站位（如针对刺客调整后排）
- 统计场上热门阵容
- 预判对手经济/血量，调整运营策略

### 游戏窗口位置和分辨率检测

**当前状态**：部分实现，存在严重缺陷

#### 已实现的功能

**1. 游戏分辨率固定为 1024x768** ([src-backend/tft/types.ts:19-22](src-backend/tft/types.ts#L19-L22))
```typescript
export const GAME_WIDTH = 1024;
export const GAME_HEIGHT = 768;
```

**2. 自动应用 TFT 游戏配置** ([src-backend/states/StartState.ts:72-89](src-backend/states/StartState.ts#L72-L89))
- StartState 会在挂机启动时自动备份当前游戏配置
- 然后应用预设的 TFT 配置（包含 1024x768 分辨率、低画质等设置）
- [GameConfigHelper.ts:99-121](src-backend/utils/GameConfigHelper.ts#L99-L121) 负责复制预设配置文件到游戏目录

**3. 窗口位置计算** ([src-backend/TftOperator.ts:207-240](src-backend/TftOperator.ts#L207-L240))
```typescript
public init(): boolean {
    const primaryDisplay = screen.getPrimaryDisplay();
    const screenWidth = Math.round(logicalWidth * scaleFactor);
    const screenHeight = Math.round(logicalHeight * scaleFactor);

    // ⚠️ 假设游戏窗口居中
    const originX = screenCenterX - GAME_WIDTH / 2;
    const originY = screenCenterY - GAME_HEIGHT / 2;

    this.gameWindowRegion = { x: originX, y: originY };
}
```

#### ❌ 缺失的检查（严重问题）

**1. 没有分辨率验证**
- **问题**：应用配置后没有检测游戏是否真正以 1024x768 运行
- **风险**：如果玩家手动修改或配置应用失败，所有坐标计算错误，导致识别和操作全部失效
- **影响范围**：所有截图识别、鼠标点击、拖拽操作

**2. 没有实际窗口位置检测**（⭐⭐⭐⭐⭐ 最高优先级）
- **问题**：只是**假设**游戏窗口居中显示（代码注释明确写了 "LOL 窗口默认居中显示"）
- **风险**：如果用户移动游戏窗口，所有截图和鼠标坐标会错位
- **现状**：[TftOperator.ts:217-225](src-backend/TftOperator.ts#L217-L225) 假设游戏窗口居中，用户移动窗口会导致坐标错位
- **影响**：这是项目中标记为 ⭐⭐⭐⭐⭐ 必须修复的问题

**3. 没有游戏窗口存在性检测**
- **问题**：没有检测 "League of Legends" 或 "云顶之弈" 窗口是否存在
- **现状**：只通过 LCU API 检测是否在游戏中 ([StartState.ts:96-102](src-backend/states/StartState.ts#L96-L102))
- **风险**：如果游戏窗口被关闭但 LCU 仍在运行，程序无法感知

#### 建议改进方案

**阶段一：添加游戏窗口动态检测**（⭐⭐⭐⭐⭐ 最高优先级）
1. 使用 Windows API (`user32.dll`) 查找游戏窗口句柄
   - 通过窗口标题 "League of Legends (TM) Client" 或进程名定位
   - 使用 `GetWindowRect` 获取窗口实际位置和尺寸
2. 实时更新窗口坐标
   - 每次截图前调用 `updateWindowPosition()` 更新坐标
   - 或在状态机主循环中定期更新（每 1-2 秒）
3. 技术实现
   - 使用 `ffi-napi` 或 `node-ffi-napi` 调用 Windows API
   - 或使用现有的 `active-win` 等 npm 包

**阶段二：添加分辨率验证**
1. 应用配置后，通过以下方式验证分辨率：
   - 方案 A：读取窗口尺寸（通过 Windows API）
   - 方案 B：通过 LCU API 查询游戏设置
2. 如果不是 1024x768：
   - 显示错误 Toast 提示用户
   - 记录详细错误日志
   - 终止挂机流程，返回 IdleState

**阶段三：添加窗口状态监控**
1. 检测窗口最小化、失去焦点等情况
2. 自动暂停操作直到窗口恢复
3. 记录窗口状态变化日志

#### 技术实现参考

```typescript
// 示例：使用 active-win 检测游戏窗口
import activeWin from 'active-win';

function findGameWindow(): { x: number; y: number; width: number; height: number } | null {
    const window = activeWin.sync();
    if (window && window.title.includes('League of Legends')) {
        return window.bounds;
    }
    return null;
}
```

**优先级排序**：
1. ⭐⭐⭐⭐⭐ 窗口位置动态检测（必须修复，影响所有功能）
2. ⭐⭐⭐⭐ 分辨率验证（避免错误配置导致全面失效）
3. ⭐⭐⭐ 窗口状态监控（提升稳定性）
4. ⭐⭐ 窗口存在性检测（边缘情况处理）

## 项目优化计划

### 一、代码质量改进

#### 🔴 高优先级（影响稳定性）

**1. 游戏窗口位置动态检测**
- **问题**：[TftOperator.ts:217-225](src-backend/TftOperator.ts#L217-L225) 假设游戏窗口居中，用户移动窗口会导致坐标错位
- **影响范围**：所有截图和鼠标操作
- **解决方案**：使用 Windows API 获取游戏窗口句柄和实际位置
- **优先级**：⭐⭐⭐⭐⭐ 必须修复

**2. OpenCV Mat 资源管理**
- **问题**：多处代码在异常情况下可能忘记释放 Mat 对象
- **影响**：长时间运行会导致内存泄漏
- **解决方案**：实现 RAII 模式的资源管理器
- **示例位置**：[ScreenCapture.ts](src-backend/tft/recognition/ScreenCapture.ts)、[TemplateMatcher.ts](src-backend/tft/recognition/TemplateMatcher.ts)

**3. 并发控制缺失**
- **问题**：`HexService.start()` 没有原子性保证，快速点击启动/停止可能导致状态混乱
- **解决方案**：使用互斥锁（如 `async-mutex` 包）
- **位置**：[HexService.ts](src-backend/services/HexService.ts)

**4. 装备拖拽状态验证**
- **问题**：[StrategyService.ts](src-backend/services/StrategyService.ts) 装备穿戴逻辑未检测棋子是否在目标位置
- **风险**：如果棋子被移动/合成/卖掉，拖拽装备可能失败或穿到错误棋子身上
- **解决方案**：关键操作后添加截图验证

**5. 经验值常量维护**
- **问题**：[TftOperator.ts:1254](src-backend/TftOperator.ts#L1254) `tryFixMisrecognizedXp()` 使用固定的合法 totalXp 值列表
- **风险**：TFT 版本更新时可能过时
- **解决方案**：将常量提取到 [TFTProtocol.ts](src-backend/TFTProtocol.ts)，便于维护

#### 🟡 中优先级（提升性能和体验）

**1. OCR 识别性能优化**
- **问题**：首次识别时需要创建 Worker（~500ms 延迟）
- **影响**：商店 5 个槽位串行识别耗时 ~500-800ms
- **优化方案**：
  - 在 GameRunningState 启动时预加载所有 Tesseract Worker
  - 优化图像预处理链（[ScreenCapture.ts:114-123](src-backend/tft/recognition/ScreenCapture.ts#L114-L123)）
  - 对固定区域缓存处理后的模板
- **预期收益**：识别速度提升 30-50%

**2. 装备模板匹配优化**
- **问题**：[TemplateMatcher.ts:126-157](src-backend/tft/recognition/TemplateMatcher.ts#L126-L157) 最坏情况需遍历所有装备模板（~80个）
- **当前耗时**：单件装备识别 ~50-150ms
- **优化方案**：
  - 使用特征点匹配（SIFT/ORB）代替模板匹配
  - 或考虑使用轻量级深度学习模型
- **预期收益**：识别速度提升 50-70%

**3. 锻造器装备识别实现**
- **问题**：[TftOperator.ts:1032-1067](src-backend/TftOperator.ts#L1032-L1067) 功能未实现，只能固定选择中间选项
- **影响**：无法智能选择最佳锻造器装备
- **实现思路**：复用现有的装备识别逻辑

**4. 星级识别兜底策略**
- **问题**：[TemplateMatcher.ts:296-298](src-backend/tft/recognition/TemplateMatcher.ts#L296-L298) 识别失败时没有兜底
- **解决方案**：失败时默认为 1 星，并标记需要重新扫描

**5. IPC 超时机制**
- **问题**：preload.ts 中的 `ipcRenderer.invoke()` 调用没有超时保护
- **风险**：如果后端卡死，前端会永久等待
- **解决方案**：使用 `Promise.race()` 添加超时机制

**6. 用户友好的错误提示**
- **问题**：错误信息太技术化（如 "快照不存在，无法更新备战席"）
- **解决方案**：分离技术日志和用户提示，前端显示友好的错误信息

**7. 日志轮转机制**
- **问题**：长时间运行会导致日志文件过大
- **解决方案**：使用 `winston` 或类似库实现日志轮转

#### 🟢 低优先级（功能增强）

**1. 事件防抖**
- **问题**：[GameStageMonitor.ts:187-242](src-backend/services/GameStageMonitor.ts#L187-L242) 识别不稳定时可能频繁触发事件
- **解决方案**：添加防抖机制，避免同一阶段重复触发

**2. 事件队列**
- **问题**：多个阶段快速切换可能丢失事件
- **解决方案**：实现事件队列 + 串行处理

**3. 状态持久化**
- **问题**：程序崩溃后无法从断点恢复
- **解决方案**：添加状态快照存储机制

**4. 颜色格式检测**
- **问题**：[ScreenCapture.ts:97-99](src-backend/tft/recognition/ScreenCapture.ts#L97-L99) 假设 screenshot 总是 BGRA 格式
- **解决方案**：添加格式检测和错误处理

### 二、新功能开发

#### 🎯 核心功能

**1. 特殊道具使用策略**
- **现状**：[StrategyService.ts:415](src-backend/services/StrategyService.ts#L415) 标注为 TODO
- **功能**：实现装备拆卸器、重铸器等道具的自动使用策略
- **价值**：提升资源利用效率

**2. 多阵容智能切换**
- **功能**：根据游戏内拿到的装备/强化，动态切换最优阵容
- **实现思路**：
  - 在 [LineupLoader.ts](src-backend/lineup/LineupLoader.ts) 中添加阵容匹配度评分算法
  - 根据当前装备、强化、棋子匹配最适合的阵容
- **价值**：提高上分效率和胜率

**3. 数据统计和分析**
- **功能**：记录每局数据（排名、阵容、装备、对手等）
- **实现**：
  - 在 [SettingsStore.ts](src-backend/utils/SettingsStore.ts) 中添加游戏历史数据存储
  - 新增统计页面展示胜率、平均排名、最强阵容等
- **用途**：
  - 生成胜率统计图表
  - 分析最强阵容和装备搭配
  - 优化决策策略

#### 🌐 扩展功能

**1. 远程监控**
- **功能**：通过手机/网页实时查看挂机状态
- **实现**：WebSocket + Web UI
- **用途**：外出时监控挂机进度
- **技术栈**：Express + Socket.io + React

**2. 语音/Telegram 通知**
- **功能**：对局结束、出现异常时发送通知
- **实现**：集成 Telegram Bot API 或系统语音播报
- **配置**：在设置页面添加 Telegram Bot Token 配置

**3. 云配置同步**
- **功能**：将阵容配置、设置同步到云端
- **实现**：
  - 集成云存储服务（如 GitHub Gist）
  - 在设置页面添加同步按钮
- **价值**：多设备共享配置

#### 🛡️ 防封号增强

**当前问题**：只有简单的走位，容易被检测为脚本

**改进方案**：
1. **随机操作**：
   - 随机点击屏幕空白区域
   - 随机查看其他玩家阵容
   - 随机使用表情
   - 随机移动小小英雄

2. **模拟人类行为**：
   - 操作间添加随机时间延迟（150-500ms）
   - 鼠标移动轨迹使用贝塞尔曲线（非直线）
   - 偶尔"失误"（如点击错误后立即纠正）

3. **行为多样化**：
   - 偶尔手动刷新商店后再买棋子
   - 随机调整棋子位置
   - 随机查看其他玩家战绩

**实现位置**：[GameRunningState.ts](src-backend/states/GameRunningState.ts) 中添加随机行为触发器

### 三、技术债务清理

**1. 单元测试覆盖**
- **现状**：项目缺少测试
- **建议**：
  - 引入 Jest 或 Vitest 测试框架
  - 为核心模块编写单元测试：
    - [TemplateMatcher.ts](src-backend/tft/recognition/TemplateMatcher.ts)
    - [GameStateManager.ts](src-backend/services/GameStateManager.ts)
    - [StrategyService.ts](src-backend/services/StrategyService.ts)
  - 目标测试覆盖率：70%+

**2. API 文档生成**
- **工具**：使用 TypeDoc 自动生成 API 文档
- **输出**：生成 HTML 文档到 `docs/` 目录

**3. 代码规范检查**
- **工具**：已有 ESLint，建议添加 Prettier
- **配置**：统一代码格式，自动格式化

**4. CI/CD 流程**
- **建议**：使用 GitHub Actions
- **流程**：
  - 提交时：类型检查 + ESLint
  - PR 时：运行测试
  - Release 时：自动构建和发布

### 四、实现优先级总结

#### 第一阶段（1-2周）- 稳定性修复
- [x] ⭐⭐⭐⭐⭐ 游戏窗口位置动态检测
- [x] ⭐⭐⭐⭐ OpenCV Mat 资源管理器
- [x] ⭐⭐⭐⭐ 并发控制（互斥锁）
- [x] ⭐⭐⭐ 装备拖拽状态验证

#### 第二阶段（2-3周）- 性能优化
- [ ] ⭐⭐⭐⭐ OCR Worker 预加载
- [ ] ⭐⭐⭐ 锻造器装备识别实现
- [ ] ⭐⭐⭐ 装备模板匹配优化
- [ ] ⭐⭐ 用户友好错误提示

#### 第三阶段（1个月）- 功能增强
- [ ] ⭐⭐⭐⭐ 对手棋盘识别
- [ ] ⭐⭐⭐ 数据统计和分析
- [ ] ⭐⭐⭐ 防封号增强
- [ ] ⭐⭐ 特殊道具使用策略

#### 第四阶段（长期）- 扩展功能
- [ ] ⭐⭐⭐ 多阵容智能切换
- [ ] ⭐⭐ 远程监控 Web UI
- [ ] ⭐⭐ Telegram 通知
- [ ] ⭐ 云配置同步
- [ ] ⭐ 单元测试覆盖（70%+）
