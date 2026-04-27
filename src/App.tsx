import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AppWindow,
  Archive,
  Boxes,
  CalendarClock,
  Check,
  ChevronDown,
  CircleAlert,
  CloudDownload,
  CloudUpload,
  ClipboardList,
  ExternalLink,
  FileCode2,
  Gauge,
  Globe2,
  Info,
  Layers3,
  Moon,
  PackageCheck,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Square,
  Terminal,
  Wrench,
} from 'lucide-react'
import './App.css'

type ProjectType = 'Desktop' | 'Web App' | 'Extension' | 'App Script' | 'Automation'
type ProjectStatus = 'Ready' | 'Running' | 'Schedule' | 'Failed'
type ModalView = 'guide' | 'changelog' | 'add' | null
type CommandState = 'idle' | 'queued' | 'running' | 'blocked'

type Project = {
  code: string | null
  id: string
  aliases: string[]
  name: string
  type: ProjectType
  path: string
  owner: string
  status: ProjectStatus
  stack: string
  branch: string
  version: string
  lastRun: string
  release: number
  incidents: number
  command: string
  allowlistedCommands: string[]
  summary: string
  nextAction: string
  nextActions: string[]
  health: string
  github: {
    repo: string
    branch: string
    manifestPath: string
  } | null
  docs: Record<string, { path: string; updatedAt: string; hash: string; summary: string }>
  tags: string[]
  detected: string[]
}

type Registry = {
  workspaceRoots: string[]
  projects: Project[]
}

type ReleaseChecklist = Record<string, Record<string, boolean>>

const fallbackRegistry: Registry = {
  workspaceRoots: ['D:\\Dev\\Tool', 'D:\\Dev\\Web App', 'D:\\Dev\\Extension', 'D:\\Dev\\App Script'],
  projects: [],
}

const filters = ['All', 'Desktop', 'Web App', 'Extension', 'App Script', 'Automation'] as const
const releaseChecks = ['Build check', 'Context docs', 'Rollback notes', 'Package metadata'] as const
const checklistStorageKey = 'uta.releaseChecklist.v1'

function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<(typeof filters)[number]>('All')
  const [registry, setRegistry] = useState<Registry>(fallbackRegistry)
  const [activeId, setActiveId] = useState('')
  const [modal, setModal] = useState<ModalView>(null)
  const [commandState, setCommandState] = useState<Record<string, CommandState>>({})
  const [releaseChecklist, setReleaseChecklist] = useState<ReleaseChecklist>(() => loadChecklist())
  const [logs, setLogs] = useState([
    '[system] Loading public registry from /registry.json',
    '[system] Command runner is allowlist-only; no shell execution in browser.',
  ])

  useEffect(() => {
    fetch('/registry.json')
      .then((response) => {
        if (!response.ok) throw new Error(`Registry request failed: ${response.status}`)
        return response.json() as Promise<Registry>
      })
      .then((loadedRegistry) => {
        setRegistry(loadedRegistry)
        setActiveId((current) => current || loadedRegistry.projects[0]?.id || '')
        appendLog(`Registry loaded: ${loadedRegistry.projects.length} projects across ${loadedRegistry.workspaceRoots.length} roots`)
      })
      .catch((error) => appendLog(`Registry load failed: ${error instanceof Error ? error.message : String(error)}`))
  }, [])

  useEffect(() => {
    localStorage.setItem(checklistStorageKey, JSON.stringify(releaseChecklist))
  }, [releaseChecklist])

  const projects = registry.projects
  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchesFilter = filter === 'All' || project.type === filter
      const haystack = `${project.code ?? ''} ${project.aliases.join(' ')} ${project.name} ${project.type} ${project.stack} ${project.summary} ${project.tags.join(' ')} ${project.detected.join(' ')}`
      return matchesFilter && haystack.toLowerCase().includes(query.toLowerCase())
    })
  }, [filter, projects, query])

  const activeProject = projects.find((project) => project.id === activeId) ?? projects[0]
  const runningIds = Object.entries(commandState).filter(([, state]) => state === 'running' || state === 'queued').map(([id]) => id)
  const stats = {
    ready: projects.filter((project) => project.status === 'Ready').length,
    running: runningIds.length,
    schedule: projects.filter((project) => project.status === 'Schedule').length,
    failed: projects.filter((project) => project.status === 'Failed').length,
  }

  function appendLog(message: string) {
    const time = new Date().toLocaleTimeString('en-GB')
    setLogs((current) => [`[${time}] ${message}`, ...current].slice(0, 10))
  }

  function refreshRegistry() {
    appendLog('Refresh requested. Run `corepack pnpm scan:workspaces` to update public/registry.json, then reload.')
  }

  function runCommand(project: Project, command = project.command) {
    if (!project.allowlistedCommands.includes(command)) {
      setCommandState((current) => ({ ...current, [project.id]: 'blocked' }))
      appendLog(`Blocked command for ${project.name}: ${command}`)
      return
    }

    setCommandState((current) => ({ ...current, [project.id]: 'queued' }))
    appendLog(`Queued ${project.name}: ${command}`)
    window.setTimeout(() => {
      setCommandState((current) => ({ ...current, [project.id]: 'running' }))
      appendLog(`Running ${project.name}: ${command}`)
    }, 320)
  }

  function githubUrl(project: Project) {
    return project.github?.repo ? `https://github.com/${project.github.repo}` : ''
  }

  function openGithub(project: Project) {
    const url = githubUrl(project)
    if (!url) {
      appendLog(`GitHub repo is not configured for ${project.name}`)
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
    appendLog(`Opened GitHub repo for ${project.name}: ${url}`)
  }

  function queueGithubSync(project: Project, direction: 'push' | 'pull') {
    const url = githubUrl(project)
    if (!url) {
      appendLog(`Blocked GitHub ${direction}: ${project.name} has no github.repo in manifest`)
      return
    }
    const action = direction === 'push' ? 'Local -> GitHub sync intent' : 'GitHub -> Local sync intent'
    appendLog(`${action} queued for ${project.name}. A local agent is required to execute git/GitHub operations.`)
  }

  function stopCommand(project: Project) {
    setCommandState((current) => ({ ...current, [project.id]: 'idle' }))
    appendLog(`Stopped ${project.name}`)
  }

  function toggleRun(project: Project) {
    const state = commandState[project.id]
    if (state === 'running' || state === 'queued') stopCommand(project)
    else runCommand(project)
  }

  function setChecklistValue(projectId: string, label: string, checked: boolean) {
    setReleaseChecklist((current) => ({
      ...current,
      [projectId]: {
        ...current[projectId],
        [label]: checked,
      },
    }))
  }

  return (
    <div className={`shell theme-${theme} app-shell`}>
      <aside className="sidebar card">
        <button className="icon-nav active" type="button" title="Dashboard"><Gauge size={20} /></button>
        <button className="icon-nav" type="button" title="Projects"><Boxes size={20} /></button>
        <button className="icon-nav" type="button" title="Releases"><PackageCheck size={20} /></button>
        <button className="icon-nav" type="button" title="Settings"><Settings size={20} /></button>
      </aside>

      <main className="workspace">
        <header className="topbar card">
          <div className="title-block">
            <div className="brand-mark"><Layers3 size={18} /></div>
            <div>
              <h1>Unified Tool Admin</h1>
              <p className="muted">Central operations console for tools, webapps, extensions, and scripts.</p>
            </div>
          </div>
          <div className="top-actions">
            <span className={`api-pill ${projects.length ? 'connected' : 'checking'}`}>
              <Activity size={13} /> {projects.length ? `${projects.length} projects` : 'Loading registry'}
            </span>
            <button className="ghost" type="button" onClick={() => setModal('guide')}><Info size={14} /> Guide</button>
            <button className="ghost" type="button" onClick={() => setModal('changelog')}><ClipboardList size={14} /> Changelog</button>
            <button className="ghost" type="button" onClick={refreshRegistry}><RefreshCw size={14} /> Refresh</button>
            <button className="ghost icon-mode" type="button" title="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><Moon size={15} /></button>
            <button className="primary" type="button" onClick={() => setModal('add')}><Plus size={14} /> Add Project</button>
          </div>
        </header>

        <section className="stat-grid">
          <StatCard icon={<Check size={18} />} label="Ready" value={stats.ready} tone="ready" />
          <StatCard icon={<Play size={18} />} label="Running" value={stats.running} tone="running" />
          <StatCard icon={<CalendarClock size={18} />} label="Schedule" value={stats.schedule} tone="schedule" />
          <StatCard icon={<CircleAlert size={18} />} label="Failed" value={stats.failed} tone="failed" />
        </section>

        <section className="scanner-card card panel">
          <div>
            <h2>Workspace Scanner</h2>
            <p className="muted">{registry.workspaceRoots.join('  |  ')} · GitHub realtime sync: not connected</p>
          </div>
          <div className="scanner-actions">
            <code>corepack pnpm scan:workspaces</code>
            <span className="chip warning">Local registry</span>
            <button className="ghost" type="button" onClick={refreshRegistry}><RefreshCw size={14} /> Sync Registry</button>
          </div>
        </section>

        <section className="main-grid">
          <div className="card panel project-panel">
            <div className="panel-header">
              <div>
                <h2>Project Registry</h2>
                <p className="muted">Backed by `public/registry.json`; scanner updates it from local workspaces.</p>
              </div>
              <div className="toolbar">
                <label className="search-box">
                  <Search size={14} />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search project..." />
                </label>
                <label className="select-wrap">
                  <select value={filter} onChange={(event) => setFilter(event.target.value as (typeof filters)[number])}>
                    {filters.map((item) => <option key={item}>{item}</option>)}
                  </select>
                  <ChevronDown size={14} />
                </label>
              </div>
            </div>

            <div className="table-frame">
              <table className="project-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>GitHub Repo</th>
                    <th>Release</th>
                    <th>Detected</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((project) => {
                    const isSelected = project.id === activeProject?.id
                    const state = commandState[project.id]
                    const isRunning = state === 'running' || state === 'queued'
                    return (
                      <tr key={project.id} className={isSelected ? 'selected' : ''} onClick={() => setActiveId(project.id)}>
                        <td>
                          <div className="file-link-cell">
                            <span className="file-link-title">
                              {project.code && <span className="code-badge">{project.code}</span>}
                              {project.name}
                            </span>
                            <span className="file-link-subtle">{project.path}</span>
                          </div>
                        </td>
                        <td>{project.type}</td>
                        <td><StatusPill status={isRunning ? 'Running' : state === 'blocked' ? 'Failed' : project.status} /></td>
                        <td>
                          <button className="repo-link" type="button" disabled={!project.github?.repo} onClick={(event) => { event.stopPropagation(); openGithub(project) }}>
                            <Globe2 size={13} />
                            <span>{project.github?.repo || 'Not configured'}</span>
                          </button>
                        </td>
                        <td><div className="release-meter"><span style={{ width: `${releaseScore(project, releaseChecklist)}%` }} /></div></td>
                        <td>{project.detected.length ? project.detected.length : '-'}</td>
                        <td>
                          <div className="table-actions">
                            <button className={`icon-action ${isRunning ? 'stop' : 'run'}`} type="button" title={isRunning ? 'Stop' : 'Run'} onClick={(event) => { event.stopPropagation(); toggleRun(project) }}>
                              {isRunning ? <Square size={13} /> : <Play size={13} />}
                            </button>
                            <button className="icon-action neutral" type="button" title="Pull from GitHub" disabled={!project.github?.repo} onClick={(event) => { event.stopPropagation(); queueGithubSync(project, 'pull') }}>
                              <CloudDownload size={13} />
                            </button>
                            <button className="icon-action neutral" type="button" title="Push local to GitHub" disabled={!project.github?.repo} onClick={(event) => { event.stopPropagation(); queueGithubSync(project, 'push') }}>
                              <CloudUpload size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {activeProject && (
            <aside className="side-stack">
              <ProjectDetail
                project={activeProject}
                state={commandState[activeProject.id] ?? 'idle'}
                onRun={() => toggleRun(activeProject)}
                onCommand={(command) => runCommand(activeProject, command)}
                onOpenGithub={() => openGithub(activeProject)}
                onGithubSync={(direction) => queueGithubSync(activeProject, direction)}
              />
              <ReleaseGate project={activeProject} checklist={releaseChecklist[activeProject.id] ?? {}} onChange={(label, checked) => setChecklistValue(activeProject.id, label, checked)} />
            </aside>
          )}
        </section>

        <section className="bottom-grid">
          <div className="card panel">
            <div className="panel-header compact">
              <h2>Run Queue</h2>
              <span className="chip">{runningIds.length} active</span>
            </div>
            <div className="queue-list">
              {runningIds.length === 0 ? (
                <p className="empty">No active project. Run one from the registry.</p>
              ) : runningIds.map((id) => {
                const project = projects.find((item) => item.id === id)
                return project ? (
                  <div className="queue-item" key={id}>
                    <span className="status-dot" />
                    <div>
                      <strong>{project.name}</strong>
                      <p className="muted">{commandState[id]}: {project.command}</p>
                    </div>
                  </div>
                ) : null
              })}
            </div>
          </div>

          <div className="card panel console-panel">
            <div className="panel-header compact">
              <h2><Terminal size={15} /> Console</h2>
              <button className="ghost" type="button" onClick={() => setLogs([])}>Clear</button>
            </div>
            <div className="console">{logs.map((line, index) => <div key={`${index}-${line}`}>{line}</div>)}</div>
          </div>
        </section>
      </main>

      {modal && <InfoModal view={modal} onClose={() => setModal(null)} />}
    </div>
  )
}

function loadChecklist(): ReleaseChecklist {
  try {
    const raw = localStorage.getItem(checklistStorageKey)
    return raw ? JSON.parse(raw) as ReleaseChecklist : {}
  } catch {
    return {}
  }
}

function releaseScore(project: Project, checklist: ReleaseChecklist) {
  const checked = Object.values(checklist[project.id] ?? {}).filter(Boolean).length
  return Math.min(100, project.release + checked * 6)
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: 'ready' | 'running' | 'schedule' | 'failed' }) {
  return (
    <article className="stat-card">
      <span className={`stat-icon status-${tone}`}>{icon}</span>
      <span className="stat-content"><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong></span>
    </article>
  )
}

function StatusPill({ status }: { status: ProjectStatus }) {
  return <span className={`status-pill ${status.toLowerCase()}`}>{status}</span>
}

function ProjectDetail({
  project,
  state,
  onRun,
  onCommand,
  onOpenGithub,
  onGithubSync,
}: {
  project: Project
  state: CommandState
  onRun: () => void
  onCommand: (command: string) => void
  onOpenGithub: () => void
  onGithubSync: (direction: 'push' | 'pull') => void
}) {
  const isRunning = state === 'running' || state === 'queued'
  return (
    <div className="card panel detail-panel">
      <div className="detail-top">
        <span className="project-icon"><ProjectIcon type={project.type} /></span>
        <div>
          <h2>{project.code ? `${project.code} - ${project.name}` : project.name}</h2>
          <p className="muted">{project.stack}</p>
        </div>
      </div>
      {project.summary && <p className="summary-box">{project.summary}</p>}
      <div className="detail-grid">
        <Meta label="Owner" value={project.owner} />
        <Meta label="Version" value={project.version} />
        <Meta label="Branch" value={project.branch} />
        <Meta label="Command State" value={state} />
      </div>
      <div className="command-box"><span className="muted">Default command</span><code>{project.command}</code></div>
      <div className="allowlist-box">
        <span className="muted">Allowlisted commands</span>
        {project.allowlistedCommands.map((command) => (
          <button className="command-chip" key={command} type="button" onClick={() => onCommand(command)}>{command}</button>
        ))}
      </div>
      <div className="github-box">
        <div className="github-head">
          <span className="muted">GitHub sync</span>
          <span className={`chip ${project.github?.repo ? 'success' : 'warning'}`}>{project.github?.repo ? 'Repo configured' : 'Missing repo'}</span>
        </div>
        <div className="repo-value">
          <Globe2 size={14} />
          <span>{project.github?.repo || 'No github.repo in manifest'}</span>
        </div>
        <div className="detail-actions">
          <button className="ghost" type="button" disabled={!project.github?.repo} onClick={onOpenGithub}><ExternalLink size={14} /> Open Repo</button>
          <button className="ghost" type="button" disabled={!project.github?.repo} onClick={() => onGithubSync('pull')}><CloudDownload size={14} /> Pull Remote</button>
          <button className="ghost" type="button" disabled={!project.github?.repo} onClick={() => onGithubSync('push')}><CloudUpload size={14} /> Push Local</button>
        </div>
      </div>
      <div className="docs-box">
        <span className="muted">Manifest docs</span>
        {Object.entries(project.docs).length === 0 ? (
          <span className="muted">No manifest-backed docs detected.</span>
        ) : Object.entries(project.docs).map(([kind, doc]) => (
          <div className="doc-row" key={kind}>
            <strong>{kind}</strong>
            <span>{doc.path}</span>
          </div>
        ))}
      </div>
      <div className="health-box"><ShieldCheck size={15} /><span>{project.health}</span></div>
      <p className="next-action">{project.nextAction}</p>
      <div className="tag-row">{project.tags.map((tag) => <span className="chip" key={tag}>{tag}</span>)}</div>
      <div className="detail-actions">
        <button className={isRunning ? 'stop' : 'primary'} type="button" onClick={onRun}>
          {isRunning ? <Square size={14} /> : <Play size={14} />} {isRunning ? 'Stop Run' : 'Run Project'}
        </button>
        <button className="ghost" type="button"><ExternalLink size={14} /> Open Folder</button>
      </div>
    </div>
  )
}

function ReleaseGate({ project, checklist, onChange }: { project: Project; checklist: Record<string, boolean>; onChange: (label: string, checked: boolean) => void }) {
  const score = releaseScore(project, { [project.id]: checklist })
  return (
    <div className="card panel release-panel">
      <div className="panel-header compact"><h2>Release Gate</h2><span className="chip">{score}%</span></div>
      <div className="release-score">
        <div className="release-ring" style={{ '--score': `${score}%` } as React.CSSProperties}>{score}</div>
        <div><strong>{score >= 75 ? 'Ready for package pass' : 'Needs preparation'}</strong><p className="muted">Checklist is persisted per project in localStorage.</p></div>
      </div>
      <div className="check-list">
        {releaseChecks.map((label) => {
          const checked = Boolean(checklist[label])
          return (
            <label className="check-row release-check" key={label}>
              <input type="checkbox" checked={checked} onChange={(event) => onChange(label, event.target.checked)} />
              <span className={checked ? 'check-ok' : 'check-missing'}>{checked ? <Check size={12} /> : <CircleAlert size={12} />}</span>
              <span>{label}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div className="meta"><span>{label}</span><strong>{value}</strong></div>
}

function ProjectIcon({ type }: { type: ProjectType }) {
  const icons = {
    Desktop: <AppWindow size={18} />,
    'Web App': <Globe2 size={18} />,
    Extension: <Archive size={18} />,
    'App Script': <FileCode2 size={18} />,
    Automation: <Wrench size={18} />,
  }
  return icons[type]
}

function InfoModal({ view, onClose }: { view: Exclude<ModalView, null>; onClose: () => void }) {
  const isAdd = view === 'add'
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className={`modal-card ${isAdd ? '' : 'info-modal'}`} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div><h2>{view === 'guide' ? 'Guide' : view === 'changelog' ? 'Changelog' : 'Add Project'}</h2><p className="muted">{view === 'add' ? 'Register a new tool workspace.' : 'Operational notes for the control center.'}</p></div>
          <button className="ghost icon-mode" type="button" title="Close" onClick={onClose}>x</button>
        </div>

        {view === 'guide' && (
          <div className="info-modal-body">
            <section className="info-section">
              <h3>Daily Flow</h3>
              <ul>
                <li>Run `corepack pnpm scan:workspaces` after adding or changing projects.</li>
                <li>Filter the registry, inspect health, run allowlisted commands, and monitor console output.</li>
                <li>Use Release Gate checkboxes to persist readiness notes per project.</li>
              </ul>
            </section>
            <section className="info-section">
              <h3>Safety</h3>
              <ul>
                <li>The browser runner does not execute shell commands; it only queues allowlisted command intent.</li>
                <li>A future local agent must own real process lifecycle, masking, and stop/recovery behavior.</li>
              </ul>
            </section>
          </div>
        )}

        {view === 'changelog' && (
          <div className="info-modal-body">
            <section className="info-section">
              <div className="version-log-title"><span className="version-log-version">0.2.0</span><strong>Registry and release persistence</strong></div>
              <ul>
                <li>Added `public/registry.json`, workspace scanner script, allowlist command runner state, and localStorage release checklist.</li>
              </ul>
            </section>
            <section className="info-section">
              <div className="version-log-title"><span className="version-log-version">0.1.0</span><strong>MVP registry console</strong></div>
              <ul>
                <li>Added central registry, detail inspector, queue state, release gate, and console log.</li>
              </ul>
            </section>
          </div>
        )}

        {isAdd && (
          <form className="modal-form">
            <label><span>Project name</span><input placeholder="New Automation Console" /></label>
            <label><span>Type</span><select><option>Desktop</option><option>Web App</option><option>Extension</option><option>App Script</option></select></label>
            <label className="span-2"><span>Workspace path</span><input placeholder="D:\\Dev\\Tool\\New-Tool" /></label>
            <label className="span-2"><span>Default command</span><input placeholder="corepack pnpm dev" /></label>
          </form>
        )}

        <div className="modal-actions"><button className="primary" type="button" onClick={onClose}>{isAdd ? 'Save Draft' : 'Done'}</button></div>
      </div>
    </div>
  )
}

export default App
