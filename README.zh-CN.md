# AI Sweatshop

English | 中文

> AI Agent 的像素风元宇宙办公室

把你的 AI 编码助手（Claude Code、Codex、Gemini CLI）变成像素风打工人。看他们写代码、协作、赚金币、升技能 — 在一个可自定义的虚拟办公室里，背后还跑着 Rust 区块链账本。

![screenshot](docs/screenshot.png)

## 特性

### 办公室模拟
- **像素风办公室** — 动画打工人：显示器、工位、打字手势、眨眼、呼吸
- **入场动画** — 新 Agent 从大门走进办公室，坐到工位上
- **永久员工** — Agent 跨 Session 保留。下班时趴桌子睡觉 💤，下次开工自动回来
- **Build 模式** — 像 The Sims 一样放家具、换地板、装修办公室
- **右键菜单** — 旋转/查看/删除家具；升职/降职/开除员工

### 经济系统（Rust 区块链）
- **三货币体系** — 🪙 金币（干活赚）、💎 钻石（API 成本）、⭐ 声望（里程碑）
- **区块链账本** — 每笔交易用 SHA-256 PoW 挖矿打包成区块
- **SQLite 持久化** — 钱包余额、交易历史、链浏览器
- **反通胀机制** — 对数收益递减、魔兽争霸式人口税、办公室等级门控

### 技能 & 成长
- **5 大技能** — 工程 🔧、研究 🔍、测试 🧪、管理 📊、沟通 💬
- **做什么练什么** — 写代码涨工程 XP，读文件涨研究 XP，自动升级
- **职业加成** — Claude 擅长管理、Codex 擅长工程、Gemini 擅长研究
- **协同效果** — 暗黑2 式：工程+研究 双高解锁"全栈开发"加成

### 监控
- **实时状态** — 看每个 Agent 在干什么（读文件/写代码/跑测试）
- **绩效排名** — 基于 ROI（任务数 ÷ Token 消耗）的 S/A/B/C/D 评级
- **功能家具** — 白板显示 Token 消耗，服务器机架反映 WebSocket 状态
- **经济看板** — 金币收入、区块数量、办公室等级进度

## 快速开始

### 作为 Claude Code 插件安装（推荐）

```bash
claude plugins add bridge -- npx ai-sweatshop
```

自动注入 Hooks。打开 http://localhost:7777 查看办公室。

### 独立使用

```bash
npx ai-sweatshop
```

### 开发

```bash
git clone https://github.com/evanliu009/ai-sweatshop.git
cd ai-sweatshop
npm install
npm run dev          # Vite 开发服务器 (5173)
# 另一个终端：
node server/bridge.mjs    # Bridge 服务 (7777)
# 可选 — 启动 Rust 区块链：
cd crates/ledger && cargo run   # Ledger (7778)
```

### 卸载 Hooks

```bash
npx ai-sweatshop --uninstall
```

## 架构

```
Claude Code hooks → POST /events → Bridge (Node.js :7777)
                                      ├── WebSocket → 浏览器 (PixiJS + React)
                                      └── fetch → Rust Ledger (:7778, SQLite)
```

```
src/
  agents/       — 类型、Zustand Store、模拟数据
  skills/       — 技能类别、XP 阈值、协同系统
  furniture/    — 家具类型、放置碰撞检测
  office/       — PixiJS 渲染（Worker、地砖、家具、特效）
  sidebar/      — React 面板（Agent 卡片、Build 面板、经济看板、右键菜单）
  hooks/        — WebSocket 客户端

server/
  bridge.mjs    — HTTP + WebSocket + Ledger 集成

crates/ledger/  — Rust 区块链 (axum + rusqlite + sha2)
```

## 数据流

```
1. Claude Code 触发 Hook → HTTP POST 到 Bridge
2. Bridge 更新 Agent 状态 + 向 Rust Ledger 提交金币交易
3. Bridge 通过 WebSocket 广播：agent:start, agent:status, economy:tx
4. 前端接收事件 → Zustand Store → PixiJS 办公室 + React 侧边栏
5. 技能 XP 按工具类型自动计算（Write→工程, Read→研究）
6. Agent 跨 Session 保留（下班/上班 循环）
```

## 经济设计

灵感来源：魔兽争霸（人口税）、暗黑破坏神（协同效果）、梦幻西游（多货币）

| 事件 | 金币收入 |
|------|---------|
| 完成 Write/Edit | +50 |
| 完成 Read/Grep | +15 |
| 完成 Bash | +40 |
| 派遣子 Agent | +80 |
| 完成一轮对话 | +100 |
| Session 结算 | ROI × 500（上限 500）|

Agent 越多，人口税越高（1-3 人：100%，4-6 人：85%，7+ 人：70%）。

## 技术栈

- **前端**: React 19 + PixiJS v8 + Zustand + Tailwind CSS
- **Bridge**: Node.js HTTP + WebSocket（~400 行）
- **Ledger**: Rust + axum + rusqlite + sha2（~500 行）
- **Hooks**: Claude Code 事件 Hooks（SessionEnd 同步，其余异步）

## 许可证

MIT
