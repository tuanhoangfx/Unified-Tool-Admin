const fs = require('node:fs')
const path = require('node:path')
const https = require('node:https')

const owner = 'tuanhoangfx'
const secretFile = 'D:\\Dev\\.secrets\\github.env'

const projects = [
  {
    repo: 'GPM-Automation-Console',
    cwd: 'D:\\Dev\\Tool\\GPM-Automation-Console',
    branch: 'main',
    message: 'Add project manifest metadata',
    include: ['tool.manifest.json', 'PROJECT_CONTEXT.md', 'CHANGELOG.md'],
  },
  {
    repo: 'YT-Multistream-Console',
    cwd: 'D:\\Dev\\Tool\\YT-Multistream-Console',
    branch: 'main',
    message: 'Initialize YT multistream console',
  },
  {
    repo: 'Unified-Tool-Admin',
    cwd: 'D:\\Dev\\Tool\\Unified-Tool-Admin',
    branch: 'main',
    message: 'Initialize unified tool admin',
  },
  {
    repo: 'Tool-Control-Center',
    cwd: 'D:\\Dev\\Tool\\Tool-Control-Center',
    branch: 'main',
    message: 'Initialize tool control center',
  },
  {
    repo: 'Apps-Script-Sync',
    cwd: 'D:\\Dev\\App Script',
    branch: 'main',
    message: 'Initialize apps script sync workspace',
    include: ['README.md', 'SCRIPTS_MAP.md', 'package.json', '.gitignore', 'tool.manifest.json', 'PROJECT_CONTEXT.md', 'CHANGELOG.md'],
  },
]

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]+)=(.*)$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
  }
}

function request(method, apiPath, body = undefined) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  if (!token) throw new Error('Missing GITHUB_TOKEN or GH_TOKEN')
  const payload = body ? JSON.stringify(body) : undefined

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.github.com',
      path: apiPath,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'Unified-Tool-Admin',
        Accept: 'application/vnd.github+json',
        ...(payload ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        } : {}),
      },
    }, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        const parsed = data ? JSON.parse(data) : null
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(parsed)
        else reject(new Error(`${method} ${apiPath} failed: ${res.statusCode} ${parsed?.message || data}`))
      })
    })
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

function shouldSkip(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/')
  const parts = normalized.split('/')
  if (parts.some((part) => ['.git', 'node_modules', 'dist', 'dist-ssr', 'release', '.vscode', '.idea'].includes(part))) return true
  if (normalized.endsWith('.log') || normalized.endsWith('.tmp') || normalized.endsWith('.local')) return true
  if (normalized === '.clasprc.json') return true
  return false
}

function walkFiles(root, include) {
  if (include) return include.map((file) => path.join(root, file)).filter((file) => fs.existsSync(file))
  const files = []
  const stack = [root]
  while (stack.length) {
    const current = stack.pop()
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name)
      const relativePath = path.relative(root, fullPath)
      if (shouldSkip(relativePath)) continue
      if (entry.isDirectory()) stack.push(fullPath)
      else files.push(fullPath)
    }
  }
  return files
}

async function getBranch(repo, branch) {
  try {
    return await request('GET', `/repos/${owner}/${repo}/git/ref/heads/${branch}`)
  } catch {
    return null
  }
}

async function bootstrapEmptyRepo(repo, branch) {
  const content = Buffer.from(`# ${repo}\n\nRepository initialized by Unified Tool Admin.\n`).toString('base64')
  await request('PUT', `/repos/${owner}/${repo}/contents/README.md`, {
    message: 'Initialize repository',
    content,
    branch,
  })
}

async function pushProject(project) {
  const files = walkFiles(project.cwd, project.include)
  let baseRef = await getBranch(project.repo, project.branch)
  if (!baseRef) {
    await bootstrapEmptyRepo(project.repo, project.branch)
    baseRef = await getBranch(project.repo, project.branch)
  }
  let baseTree
  let parentSha

  if (baseRef) {
    parentSha = baseRef.object.sha
    const baseCommit = await request('GET', `/repos/${owner}/${project.repo}/git/commits/${parentSha}`)
    baseTree = baseCommit.tree.sha
  }

  const tree = []
  for (const file of files) {
    const relativePath = path.relative(project.cwd, file).replace(/\\/g, '/')
    const content = fs.readFileSync(file).toString('base64')
    const blob = await request('POST', `/repos/${owner}/${project.repo}/git/blobs`, {
      content,
      encoding: 'base64',
    })
    tree.push({
      path: relativePath,
      mode: '100644',
      type: 'blob',
      sha: blob.sha,
    })
  }

  const newTree = await request('POST', `/repos/${owner}/${project.repo}/git/trees`, {
    ...(baseTree ? { base_tree: baseTree } : {}),
    tree,
  })
  const commit = await request('POST', `/repos/${owner}/${project.repo}/git/commits`, {
    message: project.message,
    tree: newTree.sha,
    parents: parentSha ? [parentSha] : [],
  })

  if (baseRef) {
    await request('PATCH', `/repos/${owner}/${project.repo}/git/refs/heads/${project.branch}`, {
      sha: commit.sha,
      force: false,
    })
  } else {
    await request('POST', `/repos/${owner}/${project.repo}/git/refs`, {
      ref: `refs/heads/${project.branch}`,
      sha: commit.sha,
    })
  }

  console.log(`${project.repo}: ${commit.sha.slice(0, 7)} (${files.length} files)`)
}

async function main() {
  loadEnvFile(secretFile)
  const selected = process.argv.slice(2)
  const targets = selected.length ? projects.filter((project) => selected.includes(project.repo)) : projects
  for (const project of targets) await pushProject(project)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
