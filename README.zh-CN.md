# ai-sweatshop 🏭

> 用像素风虚拟办公室监控你的 AI Agent

一个有趣的开源监控面板，把 AI 编码助手（Claude Code、Codex、Gemini CLI 等）可视化为像素风格的办公室打工人。每个 Agent 都有自己的工位、显示器、语音气泡，实时展示它们在做什么。

![screenshot](docs/screenshot.png)

## 特性

- **像素风办公室** — 每个 AI Agent 变成一个有动画的像素打工人，配备完整工位
- **实时监控** — 通过 Claude Code Hooks 捕获工具调用、子 Agent、会话生命周期
- **影分身** — 子 Agent 以团队成员形式出现，用流动虚线连接
- **绩效考核** — 基于任务完成量 / Token 消耗的 S/A/B/C/D 评级
- **Token 预算** — 共享资金池 + 工资差异（Claude = 高级、Codex = 中级、Gemini = 初级）
- **右键管理** — 升职、降职、加薪、开除
- **动态动画** — 呼吸、打字、眨眼、屏幕滚动、气泡打字机效果
- **Live/Mock 模式** — 接真实数据或独立 Demo 模式
- **MCP 插件** — 作为 Claude Code 插件安装，无缝集成

## 快速开始

### 作为 Claude Code 插件安装（推荐）

```bash
claude mcp add ai-sweatshop -- npx ai-sweatshop --mcp
```

重启 Claude Code 即可。像素办公室运行在 http://localhost:7777，Claude 自动获得查询办公室状态的能力。

### 独立使用

```bash
npx ai-sweatshop
```

自动注入 Hooks、启动监控服务、打开浏览器。

### 卸载 Hooks

```bash
npx ai-sweatshop --uninstall
```

## 工作原理

```
Claude Code 会话
  ├── PreToolUse hook  ──→  Bridge 服务 (:7777)  ──→  WebSocket  ──→  像素办公室
  ├── SubagentStart    ──→  新打工人出现（带桌子 + 烟雾特效）
  ├── PostToolUse      ──→  状态更新（敲代码/看文档/跑命令/摸鱼）
  ├── Stop             ──→  打工人转过来摸鱼（保持在办公室）
  └── SessionEnd       ──→  打工人下班走人
```

## MCP 工具

作为插件安装后，Claude 获得以下能力：

| 工具 | 说明 |
|------|------|
| `list_agents` | 看办公室里有谁，在干什么 |
| `agent_status` | 查询某个 Agent 的详细状态 |
| `office_summary` | 办公室总览：活跃/摸鱼人数、项目、团队结构 |

## Agent 命名

- **主 Agent** 以项目目录命名（如 `sweatshop`、`sage`）
- **子 Agent** 显示角色（如 `Explorer@sweatshop`、`Reviewer@sage`）

## 技术栈

- **前端**: React 19 + PixiJS v8 + @pixi/react + Zustand + Tailwind CSS
- **Bridge**: Node.js HTTP + WebSocket（~250 行）
- **MCP**: @modelcontextprotocol/sdk
- **Hooks**: Claude Code 异步 HTTP Hooks（quiet 模式）

## 开发

```bash
git clone https://github.com/EvanL1/ai-sweatshop.git
cd ai-sweatshop
npm install
npm run dev      # Vite 开发服务器（HMR）
npm run build    # 生产构建
npm start        # 启动 Bridge + 打开浏览器
```

## 许可证

MIT
