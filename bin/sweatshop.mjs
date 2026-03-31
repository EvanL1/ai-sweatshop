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

function makeHookEntry() {
  return {
    matcher: '*',
    hooks: [{
      type: 'command',
      command: `cat | curl -sf -X POST ${HOOK_URL} -H 'Content-Type: application/json' --data-binary @- 2>/dev/null || true`,
      async: true,
      timeout: 3,
      quiet: true,
      [MARKER]: true,
    }],
  }
}

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

    // Check if already injected
    const already = settings.hooks[event].some((entry) =>
      entry.hooks?.some((h) => h[MARKER])
    )
    if (already) continue

    settings.hooks[event].push(makeHookEntry())
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

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🏭 Sweatshop — AI Agent Monitor

Usage:
  npx sweatshop              Start the monitor (inject hooks + open UI)
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
