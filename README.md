# WxBot — 微信聊天机器人 项目文档

> 版本 1.0.0 | 基于 Node.js + TypeScript + Wechaty | 2026-05

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术架构](#2-技术架构)
3. [项目结构](#3-项目结构)
4. [核心模块详解](#4-核心模块详解)
5. [配置系统](#5-配置系统)
6. [LLM 适配器架构](#6-llm-适配器架构)
7. [消息处理流程](#7-消息处理流程)
8. [快速开始](#8-快速开始)
9. [扩展指南](#9-扩展指南)
10. [常见问题](#10-常见问题)

---

## 1. 项目概述

WxBot 是一个基于 Wechaty 框架的微信聊天机器人，通过扫码登录微信，实现私聊场景下的智能对话。项目采用统一的 LLM（大语言模型）接口抽象层，支持灵活接入 GPT、通义千问等各类大模型。

### 核心特性

- 终端二维码扫码登录微信
- 私聊文本消息智能回复（预留 LLM 接口）
- Mock 回显模式 — 无需 API Key 即可测试微信收发流程
- 可插拔 LLM 架构 — 切换模型只需修改一行配置
- 自动断线重连（最多 3 次，间隔 5 秒）
- 会话上下文管理（滑动窗口，每联系人独立）

---

## 2. 技术架构

```
┌──────────────────────────────────────────────────┐
│                    入口 (index.ts)                 │
│         加载配置 → 创建适配器 → 启动 Bot           │
└──────────────────────┬───────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────┐
│                  Bot 核心 (bot.ts)                 │
│  ┌─────────┐ ┌──────────┐ ┌────────────────────┐ │
│  │ Wechaty │ │ LLM      │ │ ContextManager     │ │
│  │ 实例    │ │ Adapter  │ │ (会话上下文)        │ │
│  └────┬────┘ └────┬─────┘ └────────┬───────────┘ │
│       │            │               │              │
│  扫码/登录/消息     │               │              │
└───────┼────────────┼───────────────┼──────────────┘
        │            │               │
┌───────▼────────────▼───────────────▼──────────────┐
│              消息处理层 (handlers/)                 │
│  ┌──────────────┐  ┌───────────────────────────┐  │
│  │ text.handler │  │ fallback.handler          │  │
│  │ 文本→LLM流程 │  │ 非文本→友好提示            │  │
│  └──────────────┘  └───────────────────────────┘  │
└──────────────────────┬───────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────┐
│            LLM 抽象层 (llm/)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │ Mock     │ │ OpenAI   │ │ Qwen     │  ...    │
│  │ Adapter  │ │ Adapter  │ │ Adapter  │         │
│  └──────────┘ └──────────┘ └──────────┘         │
└──────────────────────────────────────────────────┘
```

### 技术选型

| 组件 | 技术 | 说明 |
|------|------|------|
| 运行环境 | Node.js 22+ | JavaScript 运行时 |
| 开发语言 | TypeScript 5.x | 类型安全 |
| 微信框架 | Wechaty 1.20+ | 微信机器人 SDK |
| 协议适配 | wechaty-puppet-wechat4u | Web 微信协议（免费） |
| 二维码 | qrcode-terminal | 终端显示二维码 |
| 环境变量 | dotenv | .env 文件加载 |
| 构建工具 | tsc + ts-node | 编译和运行 |

### 依赖版本

```json
{
  "dependencies": {
    "wechaty": "^1.20.2",
    "wechaty-puppet-wechat4u": "^1.14.9",
    "qrcode-terminal": "^0.12.0",
    "dotenv": "^16.4.7"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "ts-node": "^10.9.2"
  }
}
```

---

## 3. 项目结构

```
wx_bot/
├── package.json              # 项目配置、npm scripts
├── tsconfig.json             # TypeScript 编译配置
├── .env.example              # 环境变量模板（不提交 git）
├── .gitignore                # 排除 node_modules / dist / .env
│
├── config/
│   ├── default.json          # 默认配置（Mock 模式，即开即用）
│   └── production.json       # 生产配置覆盖（按需启用）
│
└── src/
    ├── index.ts              # 入口：加载配置 → 创建 Bot → 启动
    ├── bot.ts                # Bot 类：Wechaty 封装、事件绑定、生命周期管理
    │
    ├── config/
    │   ├── index.ts          # 配置加载器（JSON 合并 + 环境变量注入）
    │   └── types.ts          # 配置 TypeScript 接口定义
    │
    ├── handlers/
    │   ├── index.ts          # 消息路由器：按类型分发给对应 handler
    │   ├── text.handler.ts   # 文本消息处理器：上下文 → LLM → 回复
    │   └── fallback.handler.ts # 非文本消息处理器：友好回退提示
    │
    ├── llm/
    │   ├── interface.ts      # LLM 适配器接口定义（统一契约）
    │   ├── factory.ts        # 工厂函数：根据配置创建对应适配器
    │   ├── context.ts        # 会话上下文管理（滑动窗口）
    │   └── adapters/
    │       ├── mock.ts       # Mock 适配器（回显模式，用于测试）
    │       ├── openai.ts     # OpenAI 适配器（待实现）
    │       └── qwen.ts       # 通义千问适配器（待实现）
    │
    └── utils/
        ├── logger.ts         # 结构化日志（DEBUG/INFO/WARN/ERROR）
        └── env.ts            # 环境变量读取工具
```

---

## 4. 核心模块详解

### 4.1 入口文件 — `src/index.ts`

程序的启动入口，负责：

1. 调用 `loadConfig()` 加载配置（default.json + production.json + 环境变量）
2. 调用 `createLLMAdapter()` 创建 LLM 适配器实例
3. 实例化 `WeChatBot` 并调用 `start()`
4. 注册 `SIGINT` / `SIGTERM` 信号处理，实现优雅退出

```typescript
// 核心启动流程
const config = loadConfig();
const llmAdapter = createLLMAdapter(config.llm);
const bot = new WeChatBot(config, llmAdapter);
await bot.start();
```

### 4.2 Bot 核心 — `src/bot.ts`

`WeChatBot` 类封装了 Wechaty 实例和完整的生命周期管理：

**构造函数**
- 解析 puppet 名称（支持简写 `wechat4u` → 完整名 `wechaty-puppet-wechat4u`）
- 创建 `MemoryCard` 实例用于持久化登录会话
- 调用 `WechatyBuilder.build()` 创建 Wechaty 实例

**事件处理**

| 事件 | 处理逻辑 |
|------|----------|
| `scan` | 终端显示二维码，同时输出备用链接 |
| `login` | 打印登录用户名，重置重试计数 |
| `logout` | 5 秒后自动重连，最多 3 次 |
| `message` | 调用 `routeMessage()` 路由消息 |
| `error` | 打印错误信息 |

**断线重连机制**
- 登出后等待 5 秒自动重连
- 最多重试 3 次
- 3 次均失败则退出进程
- 登录成功后重置计数器

### 4.3 配置系统 — `src/config/`

**类型定义** (`types.ts`)

```typescript
interface AppConfig {
  puppet: PuppetConfig;       // 微信号协议配置
  llm: LLMConfig;            // LLM 提供商配置
  bot: BotSettings;          // Bot 基础设置
}
```

**配置加载器** (`index.ts`)

三层配置合并策略：
1. 读取 `config/default.json`（基础配置）
2. 深度合并 `config/production.json`（如果存在）
3. 从环境变量注入 API Key（`OPENAI_API_KEY`、`QWEN_API_KEY`）

```typescript
// 配置优先级：环境变量 > production.json > default.json
```

### 4.4 消息处理器 — `src/handlers/`

**路由器** (`index.ts`)
- 忽略自己发出的消息（防止死循环）
- 忽略群聊消息（第一阶段只处理私聊）
- 文本 → `handleText()`
- 其他 → `handleFallback()`

**文本处理器** (`text.handler.ts`)
```
1. 构建 Message{ role: 'user' }
2. 添加到 ContextManager
3. 获取会话历史
4. 调用 llmAdapter.chat()
5. 存储回复 Message{ role: 'assistant' }
6. msg.say() 发送回复
7. 异常时友好提示："抱歉，我遇到了一些问题"
```

**回退处理器** (`fallback.handler.ts`)
- 图片/语音/视频等 → 回复"抱歉，目前我只支持文字聊天"

### 4.5 日志工具 — `src/utils/logger.ts`

```typescript
logger.debug('调试信息');   // LOG_LEVEL=0 时可见
logger.info('常规信息');    // 默认级别
logger.warn('警告信息');
logger.error('错误信息');
```

通过 `LOG_LEVEL` 环境变量控制日志级别（0=DEBUG, 1=INFO, 2=WARN, 3=ERROR）。

---

## 5. 配置系统

### 默认配置 (`config/default.json`)

```json
{
  "puppet": {
    "type": "wechat4u",
    "options": {}
  },
  "llm": {
    "provider": "mock",
    "options": { "model": "echo" }
  },
  "bot": {
    "name": "WxBot",
    "maxContextMessages": 10
  }
}
```

### 生产配置 (`config/production.json`)

```json
{
  "llm": {
    "provider": "openai",
    "options": {
      "model": "gpt-4o-mini",
      "baseURL": "https://api.openai.com/v1"
    }
  }
}
```

### 支持的 Puppet 类型

| 配置值 | 实际模块名 | 说明 |
|--------|-----------|------|
| `wechat4u` | `wechaty-puppet-wechat4u` | 默认，Web 微信协议（免费） |
| `xp` | `wechaty-puppet-xp` | Windows 客户端协议（免费，需安装微信） |
| `padlocal` | `wechaty-puppet-padlocal` | iPad 协议（付费，最稳定） |

### 支持的 LLM Provider

| 配置值 | 状态 | 说明 |
|--------|------|------|
| `mock` | 已实现 | 回显模式，无需 API Key |
| `openai` | 待实现 | 需 `npm install openai` + `OPENAI_API_KEY` |
| `qwen` | 待实现 | 需 `QWEN_API_KEY` |

---

## 6. LLM 适配器架构

### 设计模式：接口 + 工厂（策略模式变体）

```
                    ┌─────────────────┐
                    │   LLMAdapter    │  ← 统一接口
                    │   (interface)   │
                    ├─────────────────┤
                    │ + name: string  │
                    │ + chat()        │
                    │ + chatStream()  │
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
     ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
     │ MockAdapter │ │OpenAIAdapter│ │ QwenAdapter │
     │   (已实现)  │ │  (待实现)   │ │  (待实现)   │
     └─────────────┘ └─────────────┘ └─────────────┘
```

### 统一消息格式

```typescript
interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
```

所有 LLM 适配器都遵循 OpenAI 兼容的 `{ role, content }` 消息格式。切换模型时 Bot 代码无需任何改动。

### 工厂函数 (`factory.ts`)

```typescript
function createLLMAdapter(config: LLMConfig): LLMAdapter {
  switch (config.provider) {
    case 'mock':  return new MockAdapter();
    case 'openai': return new OpenAIAdapter(config.options);
    case 'qwen':   return new QwenAdapter(config.options);
    default: throw new Error(`Unknown provider: ${config.provider}`);
  }
}
```

### 会话上下文 (`context.ts`)

- 内存 Map 存储，key 为联系人 ID
- 滑动窗口机制，默认保留最近 10 条消息
- 方法：`addMessage()` / `getHistory()` / `clear()`

```
用户A: [msg1, msg2, msg3, ...]  (最多 10 条)
用户B: [msg1, msg2, ...]
```

---

## 7. 消息处理流程

```
微信消息到达
       │
       ▼
  ┌──────────┐
  │ 是否自己  │──是──▶ 忽略
  └────┬─────┘
       │否
       ▼
  ┌──────────┐
  │ 是否群聊  │──是──▶ 忽略
  └────┬─────┘
       │否(私聊)
       ▼
  ┌──────────┐    非文本    ┌──────────────┐
  │ 消息类型  │──────────▶ │ fallback      │
  └────┬─────┘             │ "只支持文字"   │
       │文本               └──────────────┘
       ▼
  ┌──────────────────┐
  │ context.add(     │
  │   role: 'user'   │
  │   content: 原文  │
  │ )                │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │ llmAdapter.chat( │
  │   getHistory()   │
  │ )                │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │ context.add(     │
  │   role:'assistant'│
  │   content: 回复  │
  │ )                │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │ msg.say(reply)   │
  │ 发送回复到微信    │
  └──────────────────┘
```

---

## 8. 快速开始

### 环境要求

- Node.js 22+
- npm 11+
- 一个支持 Web 微信登录的微信号（建议使用注册较久的账号）

### 安装与启动

```bash
# 1. 进入项目目录
cd wx_bot

# 2. 安装依赖
npm install

# 3. 启动（Mock 模式，无需 API Key）
npm start
```

### 验证流程

1. 启动后终端显示二维码
2. 打开手机微信 → 扫一扫 → 扫描二维码
3. 手机上确认登录
4. 用另一个微信号向机器人发送文字消息
5. 验证收到 `[Mock echo]: 你发的内容` 的回显回复

### 切换到真实 LLM

```bash
# 1. 复制环境变量模板
cp .env.example .env

# 2. 编辑 .env 填入 API Key
OPENAI_API_KEY=sk-your-real-key

# 3. 启用 production.json
mv config/_production.json.disabled config/production.json

# 4. 安装 OpenAI SDK
npm install openai

# 5. 重新启动
npm start
```

### npm scripts

| 命令 | 说明 |
|------|------|
| `npm start` | 启动机器人（ts-node 运行） |
| `npm run build` | 编译 TypeScript → dist/ |
| `npm run typecheck` | 仅类型检查，不生成文件 |

---

## 9. 扩展指南

### 接入新的 LLM

1. 在 `src/llm/adapters/` 下新建文件，如 `claude.ts`
2. 实现 `LLMAdapter` 接口：

```typescript
import { LLMAdapter, Message, ChatOptions, LLMResponse } from '../interface';

export class ClaudeAdapter implements LLMAdapter {
  readonly name = 'claude';

  async chat(messages: Message[], options?: ChatOptions): Promise<LLMResponse> {
    // 调用 Claude API
    return { content: '...', model: 'claude-3-opus' };
  }

  async *chatStream(messages: Message[], options?: ChatOptions): AsyncIterable<string> {
    // 流式输出
  }
}
```

3. 在 `factory.ts` 中注册：

```typescript
case 'claude':
  const { ClaudeAdapter } = require('./adapters/claude');
  return new ClaudeAdapter(config.options);
```

4. 修改配置即可使用

### 支持群聊

修改 `src/handlers/index.ts` 中的 `routeMessage()`，去掉 `if (room) return` 并增加 `@机器人名称` 的判断逻辑。

### 持久化上下文

将 `ContextManager` 中的内存 Map 替换为 Redis/SQLite 存储，即可在机器人重启后保留对话历史。

### 自定义 System Prompt

在 LLM 配置中添加 `systemPrompt` 字段，在调用 `chat()` 时作为第一条 `{ role: 'system' }` 消息传入。

---

## 10. 常见问题

### Q: 二维码无法识别怎么办？

终端会同时输出一个链接，复制到浏览器打开后扫码。如果仍然失败，可能是当前微信号不支持 Web 微信登录（较新的微信号通常被封禁 Web 登录）。

解决方案：将配置 `puppet.type` 从 `wechat4u` 改为 `xp`，并安装微信 3.9.x Windows 客户端。

### Q: 提示 MemoryCard load() exception？

首次运行正常现象，MemoryCard 会自动清理并重建。该错误不影响功能。

### Q: 如何查看更详细的日志？

设置环境变量 `LOG_LEVEL=0` 开启 DEBUG 日志：

```bash
# Windows cmd
set LOG_LEVEL=0 && npm start

# Windows PowerShell
$env:LOG_LEVEL=0; npm start
```

### Q: 如何避免被微信封号？

- 不要频繁发送相同消息
- 控制消息发送频率
- 不要用于营销/广告场景
- 建议使用小号测试

---

## 附录

### 文件清单

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/index.ts` | ~45 | 入口，启动流程 |
| `src/bot.ts` | ~120 | Bot 核心，Wechaty 封装 |
| `src/config/types.ts` | ~20 | 配置类型定义 |
| `src/config/index.ts` | ~50 | 配置加载器 |
| `src/handlers/index.ts` | ~40 | 消息路由器 |
| `src/handlers/text.handler.ts` | ~35 | 文本消息处理 |
| `src/handlers/fallback.handler.ts` | ~15 | 非文本消息处理 |
| `src/llm/interface.ts` | ~25 | LLM 接口定义 |
| `src/llm/factory.ts` | ~40 | LLM 工厂 |
| `src/llm/context.ts` | ~35 | 会话上下文 |
| `src/llm/adapters/mock.ts` | ~30 | Mock 适配器 |
| `src/utils/logger.ts` | ~30 | 日志工具 |
| `src/utils/env.ts` | ~10 | 环境变量工具 |

### Git 提交备注

项目初始化过程中修复过以下关键问题：
- Puppet 模块名映射（简写 → 完整包名）
- qrcode-terminal ES module 上下文丢失（改用 require）
- MemoryCard 首次加载异常处理
- 二维码备用链接（终端渲染兼容性）

---

> 项目地址：`e:/AAAAcode/wx_bot`
