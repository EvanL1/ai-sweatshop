# AI Sweatshop

[中文](README.md) | English

> A pixel-art metaverse for your AI coding agents.

AI Sweatshop turns your AI coding agents (Claude Code, Codex, Gemini CLI) into pixel-art office workers. Watch them code, collaborate, earn coins, and level up skills — all in a customizable virtual office powered by a Rust blockchain ledger.

![screenshot](docs/screenshot.png)

## Features

### Office Simulation
- **Pixel-art office** — Animated workers with monitors, desks, typing hands, eye blinks, and breathing
- **Walk-in animation** — New agents enter through the office door and walk to their desk
- **Persistent employees** — Agents survive across sessions. They clock out (💤) when idle and come back to work
- **Build mode** — Place furniture, change floors, customize your office like The Sims
- **Right-click menus** — Rotate, inspect, or delete furniture; promote/demote/fire agents

### Economy (Rust Blockchain)
- **Triple currency** — 💰 Coins (earned by working), 💎 Diamonds (API cost), ⭐ Prestige (milestones)
- **Blockchain ledger** — Every transaction mined into blocks with SHA-256 proof-of-work
- **SQLite persistence** — Wallet balances, transaction history, chain explorer
- **Anti-inflation** — Logarithmic reward scaling, WC3-style upkeep tax, office tier gates

### Skills & Progression
- **5 skill categories** — Engineering 🔧, Research 🔍, Testing 🧪, Management 📊, Communication 💬
- **Use-based leveling** — Write code → Engineering XP. Read files → Research XP. Auto-level, no grinding
- **Agent type bonuses** — Claude excels at Management, Codex at Engineering, Gemini at Research
- **Synergy system** — Diablo 2-style: high Engineering + Research unlocks "Full-Stack" bonus

### Monitoring
- **Real-time status** — See what each agent is doing (reading, writing, running tests)
- **Performance ranking** — S/A/B/C/D based on ROI (tasks ÷ tokens)
- **Functional furniture** — Whiteboard shows token burn, server rack reflects WebSocket status
- **Economy dashboard** — Coins earned, blocks mined, office tier progression

## Quick Start

### As a Claude Code Plugin (recommended)

```bash
claude plugins add bridge -- npx ai-sweatshop
```

This injects hooks into Claude Code automatically. Open http://localhost:7777 to see the office.

### Standalone

```bash
npx ai-sweatshop
```

### Development

```bash
git clone https://github.com/evanliu009/ai-sweatshop.git
cd ai-sweatshop
npm install
npm run dev        # Vite dev server (port 5173)
# In another terminal:
node server/bridge.mjs   # Bridge server (port 7777)
# Optional — start the Rust blockchain ledger:
cd crates/ledger && cargo run  # Ledger (port 7778)
```

### Uninstall hooks

```bash
npx ai-sweatshop --uninstall
```

## Architecture

```
Claude Code hooks → POST /events → Bridge (Node.js :7777)
                                      ├── WebSocket → Browser (PixiJS + React)
                                      └── fetch → Rust Ledger (:7778, SQLite)
```

```
src/
  agents/       — Types, Zustand store, mock data
  skills/       — Skill categories, XP thresholds, synergy system
  furniture/    — Furniture types, placement validation
  office/       — PixiJS rendering (Worker, Tiles, Furniture, Effects)
  sidebar/      — React panels (AgentCard, BuildPanel, Economy, ContextMenus)
  hooks/        — WebSocket client

server/
  bridge.mjs    — HTTP + WebSocket + ledger integration

crates/ledger/  — Rust blockchain (axum + rusqlite + sha2)
  src/
    chain.rs    — Block mining, hash validation
    economy.rs  — Reward formulas, upkeep tax
    db.rs       — SQLite persistence
    types.rs    — Transaction, Block, Wallet, OfficeTier
```

## Data Flow

```
1. Claude Code fires hook → HTTP POST to bridge /events
2. Bridge updates agent state + submits coin transaction to Rust ledger
3. Bridge broadcasts via WebSocket: agent:start, agent:status, economy:tx
4. Frontend receives events → Zustand store → PixiJS office + React sidebar
5. Skill XP auto-calculated from tool usage (Write→Engineering, Read→Research)
6. Agents persist across sessions (offduty/wake cycle)
```

## Economy Design

| Event | Coins Earned |
|-------|-------------|
| Complete Write/Edit | +50 |
| Complete Read/Grep | +15 |
| Complete Bash | +40 |
| Spawn sub-agent | +80 |
| Turn completed | +100 |
| Session settlement | ROI × 500 (max 500) |

More agents = higher upkeep tax (1-3: 100%, 4-6: 85%, 7+: 70%).

## Tech Stack

- **Frontend**: React 19 + PixiJS v8 + Zustand + Tailwind CSS
- **Bridge**: Node.js HTTP + WebSocket (~400 lines)
- **Ledger**: Rust + axum + rusqlite + sha2 (~500 lines)
- **Hooks**: Claude Code event hooks (sync SessionEnd, async others)

## License

MIT
