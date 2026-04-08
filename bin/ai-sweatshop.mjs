#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'
import { exec } from 'child_process'
import { fileURLToPath } from 'url'

const PORT = process.env.SWEATSHOP_PORT || 7777
// Write PORT back to env so bridge.mjs reads the same value (including the default)
process.env.SWEATSHOP_PORT = String(PORT)
const HOOK_URL = `http://localhost:${PORT}/events`
const CLAUDE_SETTINGS = join(homedir(), '.claude', 'settings.json')
const MARKER = '__sweatshop__'

// --- Hook config to inject ---
const HOOK_EVENTS = [
  'SessionStart', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure',
  'SubagentStart', 'SubagentStop', 'Stop', 'SessionEnd', 'UserPromptSubmit',
]

const __dirname = dirname(fileURLToPath(import.meta.url))
const ENSURE_BRIDGE = join(__dirname, 'ensure-bridge.sh')

function makeHookEntry(isSync = false) {
  return {
    matcher: '*',
    hooks: [{
      type: 'command',
      command: `cat | ${ENSURE_BRIDGE}`,
      ...(isSync ? {} : { async: true }),
      timeout: 5,
      quiet: true,
      [MARKER]: true,
    }],
  }
}

// SessionEnd must be synchronous so the curl completes before Claude Code exits
const SYNC_EVENTS = new Set(['SessionEnd'])

// --- Read/write Claude settings ---
function readSettings() {
  if (!existsSync(CLAUDE_SETTINGS)) return {}
  try {
    return JSON.parse(readFileSync(CLAUDE_SETTINGS, 'utf-8'))
  } catch {
    return {}
  }
}

function writeSettings(settings) {
  writeFileSync(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2))
}

// --- Inject hooks ---
function injectHooks() {
  const settings = readSettings()
  if (!settings.hooks) settings.hooks = {}

  let injected = 0
  for (const event of HOOK_EVENTS) {
    if (!settings.hooks[event]) settings.hooks[event] = []

    const isSync = SYNC_EVENTS.has(event)
    const existingIdx = settings.hooks[event].findIndex((entry) =>
      entry.hooks?.some((h) => h[MARKER])
    )

    if (existingIdx !== -1) {
      // Check if existing hook config matches (e.g. async flag changed)
      const existing = settings.hooks[event][existingIdx]
      const desired = makeHookEntry(isSync)
      const existingAsync = existing.hooks?.[0]?.async
      const desiredAsync = desired.hooks[0].async
      if (existingAsync !== desiredAsync) {
        settings.hooks[event][existingIdx] = desired
        injected++
      }
      continue
    }

    settings.hooks[event].push(makeHookEntry(isSync))
    injected++
  }

  writeSettings(settings)
  return injected
}

// --- Remove hooks ---
function removeHooks() {
  const settings = readSettings()
  if (!settings.hooks) return 0

  let removed = 0
  for (const event of HOOK_EVENTS) {
    if (!settings.hooks[event]) continue
    const before = settings.hooks[event].length
    settings.hooks[event] = settings.hooks[event].filter(
      (entry) => !entry.hooks?.some((h) => h[MARKER])
    )
    removed += before - settings.hooks[event].length
    if (settings.hooks[event].length === 0) delete settings.hooks[event]
  }

  if (Object.keys(settings.hooks).length === 0) delete settings.hooks
  writeSettings(settings)
  return removed
}

// --- Open browser ---
function openBrowser(url) {
  const cmd = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'start' : 'xdg-open'
  exec(`${cmd} ${url}`, (err) => {
    if (err) console.error(`Failed to open browser: ${err.message}`)
  })
}

// --- Main ---
const args = process.argv.slice(2)

if (args.includes('--uninstall') || args.includes('--remove')) {
  const count = removeHooks()
  console.log(`🧹 Removed ${count} sweatshop hooks from ${CLAUDE_SETTINGS}`)
  process.exit(0)
}

// MCP mode — run as Claude Code plugin (stdio)
if (args.includes('--mcp')) {
  process.env.SWEATSHOP_MCP = '1'
  injectHooks()
  const mcpPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'server', 'mcp.mjs')
  await import(mcpPath)
  // MCP server runs until stdin closes; cleanup hooks on exit
  process.on('exit', () => removeHooks())
  // Block forever (MCP server handles stdio)
  await new Promise(() => {})
}

// Install-only mode — inject hooks and exit (bridge starts on-demand via ensure-bridge.sh)
if (args.includes('--install')) {
  console.log('🔧 Injecting hooks into Claude Code settings...')
  const injected = injectHooks()
  if (injected > 0) {
    console.log(`   ✓ Injected ${injected} hook events (bridge starts on-demand)`)
  } else {
    console.log('   ✓ Hooks already configured')
  }
  process.exit(0)
}

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🏭 Sweatshop — AI Agent Monitor

Usage:
  npx sweatshop              Start the monitor (inject hooks + open UI)
  npx sweatshop --install    Inject hooks only (bridge auto-starts on first event)
  npx sweatshop --mcp        Run as MCP server (Claude Code plugin)
  npx sweatshop --uninstall  Remove injected hooks
  npx sweatshop --no-open    Start without opening browser

Environment:
  SWEATSHOP_PORT=7777    Custom port (default: 7777)
`)
  process.exit(0)
}

// Inject hooks
console.log('🔧 Injecting hooks into Claude Code settings...')
const injected = injectHooks()
if (injected > 0) {
  console.log(`   ✓ Injected ${injected} hook events`)
} else {
  console.log('   ✓ Hooks already configured')
}

// Start bridge server
console.log('🚀 Starting bridge server...')
const bridgePath = join(dirname(fileURLToPath(import.meta.url)), '..', 'server', 'bridge.mjs')
await import(bridgePath)

// Open browser
if (!args.includes('--no-open')) {
  setTimeout(() => openBrowser(`http://localhost:${PORT}`), 500)
}

// Graceful shutdown — remove hooks on Ctrl+C
function cleanup() {
  console.log('\n🧹 Cleaning up hooks...')
  const count = removeHooks()
  console.log(`   Removed ${count} hook entries. Bye!`)
  process.exit(0)
}

process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)
