const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { execFileSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const outFile = path.join(root, 'public', 'registry.json')
const workspaceRoots = [
  'D:\\Dev\\Tool',
  'D:\\Dev\\Web App',
  'D:\\Dev\\Extension',
  'D:\\Dev\\App Script',
]

const typeByRoot = new Map([
  ['D:\\Dev\\Tool', 'Desktop'],
  ['D:\\Dev\\Web App', 'Web App'],
  ['D:\\Dev\\Extension', 'Extension'],
  ['D:\\Dev\\App Script', 'App Script'],
])

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

function detectFiles(projectPath) {
  const candidates = [
    'package.json',
    'tool.manifest.json',
    'README.md',
    'PROJECT_CONTEXT.md',
    'CHANGELOG.md',
    'manifest.json',
    'SCRIPTS_MAP.md',
  ]
  return candidates.filter((file) => fs.existsSync(path.join(projectPath, file)))
}

function inferStack(projectPath, packageJson, detected, fallbackType) {
  if (packageJson) {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies }
    const parts = []
    if (deps.electron) parts.push('Electron')
    if (deps.react) parts.push('React')
    if (deps.vite) parts.push('Vite')
    if (deps['@ffmpeg-installer/ffmpeg']) parts.push('FFmpeg')
    if (deps.playwright || deps['playwright-core']) parts.push('Playwright')
    return parts.length ? parts.join(' + ') : 'Node package'
  }
  if (detected.includes('manifest.json')) return 'Browser extension'
  if (detected.includes('SCRIPTS_MAP.md')) return 'Google Apps Script'
  return `${fallbackType} workspace`
}

function inferCommand(packageJson, detected) {
  if (packageJson?.scripts?.dev) return 'corepack pnpm dev'
  if (packageJson?.scripts?.build) return 'corepack pnpm build'
  if (detected.includes('SCRIPTS_MAP.md')) return 'Review SCRIPTS_MAP.md'
  return 'Open workspace'
}

function allowlistedCommands(packageJson, command) {
  const commands = new Set([command])
  if (packageJson?.scripts?.dev) commands.add('corepack pnpm dev')
  if (packageJson?.scripts?.build) commands.add('corepack pnpm build')
  if (packageJson?.scripts?.lint) commands.add('corepack pnpm lint')
  if (packageJson?.scripts?.['test:smoke']) commands.add('corepack pnpm test:smoke')
  commands.add('Open workspace')
  return [...commands]
}

function normalizeGithubRepo(value) {
  if (!value || typeof value !== 'string') return ''
  return value
    .replace(/^git\+/, '')
    .replace(/^https:\/\/github\.com\//, '')
    .replace(/^git@github\.com:/, '')
    .replace(/\.git$/, '')
    .trim()
}

function inferGithub(projectPath, packageJson, manifestGithub) {
  if (manifestGithub?.repo) return manifestGithub

  const packageRepo = typeof packageJson?.repository === 'string'
    ? packageJson.repository
    : packageJson?.repository?.url
  const repo = normalizeGithubRepo(packageRepo)
  if (repo) {
    return {
      repo,
      branch: manifestGithub?.branch || 'main',
      manifestPath: manifestGithub?.manifestPath || 'tool.manifest.json',
      source: 'package.json',
    }
  }

  try {
    const remote = execFileSync('git', ['-C', projectPath, 'remote', 'get-url', 'origin'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    const remoteRepo = normalizeGithubRepo(remote)
    if (remoteRepo) {
      return {
        repo: remoteRepo,
        branch: manifestGithub?.branch || 'main',
        manifestPath: manifestGithub?.manifestPath || 'tool.manifest.json',
        source: 'git-remote',
      }
    }
  } catch {
    // No git remote is acceptable for local-only tools.
  }

  return manifestGithub || null
}

function readDocs(projectPath, docs) {
  const docMap = docs && typeof docs === 'object'
    ? docs
    : {
        readme: 'README.md',
        context: 'PROJECT_CONTEXT.md',
        changelog: 'CHANGELOG.md',
        release: 'RELEASE.md',
      }

  return Object.entries(docMap).reduce((result, [kind, relativePath]) => {
    if (typeof relativePath !== 'string') return result
    const docPath = path.join(projectPath, relativePath)
    if (!fs.existsSync(docPath)) return result
    const content = fs.readFileSync(docPath, 'utf8')
    const stat = fs.statSync(docPath)
    result[kind] = {
      path: relativePath,
      updatedAt: stat.mtime.toISOString(),
      hash: crypto.createHash('sha1').update(content).digest('hex'),
      summary: extractSummary(content),
    }
    return result
  }, {})
}

function extractSummary(markdown) {
  const lines = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('```'))
  return lines.slice(0, 2).join(' ').slice(0, 240)
}

function scanRoot(rootPath) {
  if (!fs.existsSync(rootPath)) return []
  const entries = fs.readdirSync(rootPath, { withFileTypes: true })
  const rootType = typeByRoot.get(rootPath) ?? 'Automation'
  const projects = []

  if (rootPath.endsWith('App Script')) {
    const detected = detectFiles(rootPath)
    projects.push(createProject(rootPath, path.basename(rootPath), rootType, detected))
    return projects
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const projectPath = path.join(rootPath, entry.name)
    const detected = detectFiles(projectPath)
    if (detected.length === 0 && rootType !== 'Extension' && rootType !== 'Web App') continue
    projects.push(createProject(projectPath, entry.name, rootType, detected))
  }

  return projects
}

function createProject(projectPath, directoryName, type, detected) {
  const packageJson = readJson(path.join(projectPath, 'package.json'))
  const manifest = readJson(path.join(projectPath, 'tool.manifest.json'))
  const manifestCommands = manifest?.commands && typeof manifest.commands === 'object'
    ? Object.values(manifest.commands).filter((value) => typeof value === 'string')
    : []
  const name = manifest?.name || packageJson?.build?.productName || packageJson?.productName || packageJson?.name || directoryName
  const command = manifest?.commands?.dev || manifestCommands[0] || inferCommand(packageJson, detected)
  const hasDocs = detected.includes('README.md') || detected.includes('PROJECT_CONTEXT.md')
  const hasBuild = Boolean(packageJson?.scripts?.build)
  const release = Math.min(95, 25 + (hasDocs ? 20 : 0) + (hasBuild ? 25 : 0) + detected.length * 5)
  const docs = readDocs(projectPath, manifest?.docs)
  const stack = Array.isArray(manifest?.stack) ? manifest.stack.join(' + ') : inferStack(projectPath, packageJson, detected, type)
  const allowlist = [...new Set([...allowlistedCommands(packageJson, command), ...manifestCommands])]
  const github = inferGithub(projectPath, packageJson, manifest?.github)

  return {
    code: manifest?.code || null,
    id: manifest?.id || slugify(directoryName),
    aliases: Array.isArray(manifest?.aliases) ? manifest.aliases : [],
    name: humanizeName(String(name)),
    type: manifest?.type || type,
    path: projectPath,
    owner: manifest?.owner || (type === 'App Script' ? 'Apps' : type === 'Extension' ? 'Browser' : type === 'Web App' ? 'Web' : 'Tool'),
    status: manifest?.status || manifest?.health?.status || (hasBuild ? 'Ready' : 'Schedule'),
    summary: manifest?.summary || docs.readme?.summary || '',
    stack,
    branch: 'workspace',
    version: manifest?.release?.version || packageJson?.version || (detected.length ? 'docs' : 'untracked'),
    lastRun: 'Scanned registry',
    release,
    incidents: hasDocs ? 0 : 1,
    command,
    allowlistedCommands: allowlist,
    nextAction: Array.isArray(manifest?.nextActions) ? manifest.nextActions[0] : hasDocs ? 'Wire live run telemetry and release history.' : 'Add README and project metadata.',
    nextActions: Array.isArray(manifest?.nextActions) ? manifest.nextActions : [],
    health: manifest?.health?.note || (detected.length ? `Detected ${detected.join(', ')}` : 'No standard project metadata detected.'),
    github,
    docs,
    tags: [
      ...(manifest?.code ? [manifest.code.toLowerCase()] : []),
      (manifest?.type || type).toLowerCase().replace(/\s+/g, '-'),
      ...detected.map((file) => file.replace(/\..+$/, '').toLowerCase()),
    ],
    detected,
  }
}

function humanizeName(value) {
  return value
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bGpm\b/g, 'GPM')
    .replace(/\bYt\b/g, 'YT')
}

const projects = workspaceRoots.flatMap(scanRoot)
const registry = { workspaceRoots, projects }

fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, `${JSON.stringify(registry, null, 2)}\n`)
console.log(`Wrote ${projects.length} projects to ${outFile}`)
