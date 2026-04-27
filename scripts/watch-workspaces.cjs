const fs = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const scanner = path.join(__dirname, 'scan-workspaces.cjs')
const workspaceRoots = [
  'D:\\Dev\\Tool',
  'D:\\Dev\\Web App',
  'D:\\Dev\\Extension',
  'D:\\Dev\\App Script',
]
const watchedFileNames = new Set([
  'tool.manifest.json',
  'package.json',
  'README.md',
  'PROJECT_CONTEXT.md',
  'CHANGELOG.md',
  'RELEASE.md',
  'manifest.json',
  'SCRIPTS_MAP.md',
])
const checkOnly = process.argv.includes('--check')

let scanTimer = null
const watchers = []

function scheduleScan(reason) {
  if (scanTimer) clearTimeout(scanTimer)
  scanTimer = setTimeout(() => {
    console.log(`[watch] ${reason}; refreshing registry`)
    const child = spawn(process.execPath, [scanner], {
      cwd: root,
      stdio: 'inherit',
    })
    child.on('exit', (code) => {
      if (code !== 0) console.error(`[watch] scan failed with exit code ${code}`)
    })
  }, 250)
}

function isWatchableDirectory(entry) {
  return entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.') && entry.name !== 'dist' && entry.name !== 'release'
}

function watchProject(projectPath) {
  if (!fs.existsSync(projectPath)) return
  if (checkOnly) {
    console.log(`[watch-check] ${projectPath}`)
    return
  }
  try {
    const watcher = fs.watch(projectPath, (eventType, fileName) => {
      if (!fileName || !watchedFileNames.has(String(fileName))) return
      scheduleScan(`${path.join(projectPath, String(fileName))} ${eventType}`)
    })
    watchers.push(watcher)
    console.log(`[watch] ${projectPath}`)
  } catch (error) {
    console.error(`[watch] failed for ${projectPath}: ${error.message}`)
  }
}

function watchRoot(rootPath) {
  if (!fs.existsSync(rootPath)) return
  watchProject(rootPath)
  for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
    if (isWatchableDirectory(entry)) watchProject(path.join(rootPath, entry.name))
  }
}

for (const workspaceRoot of workspaceRoots) watchRoot(workspaceRoot)
if (checkOnly) {
  console.log('[watch-check] ok')
  process.exit(0)
}

scheduleScan('initial watch scan')

process.on('SIGINT', () => {
  for (const watcher of watchers) watcher.close()
  process.exit(0)
})
