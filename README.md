# Unified Tool Admin

Central web console for managing tools, webapps, browser extensions, and scripts inside `D:\Dev`.

For product direction and future work, see `PROJECT_CONTEXT.md`.

## Current Features

- Project registry with search and type filter.
- Registry data loaded from `public/registry.json`.
- Workspace scanner for `D:\Dev\Tool`, `D:\Dev\Web App`, `D:\Dev\Extension`, and `D:\Dev\App Script`.
- Project code support through per-tool `tool.manifest.json` files, starting with `P0001` and `P0002`.
- Watch mode to refresh registry when manifests or project docs change.
- GitHub Repo column with Open Repo, Pull Remote intent, and Push Local intent actions.
- Project detail inspector with default command, health, tags, and next action.
- Allowlist-only command runner state with terminal-style console output.
- Release readiness gate with per-project checklist persisted in localStorage.
- Dark/light theme using shared tokens from `D:\Dev\Tool\design-base.css`.
- Topbar Guide, Changelog, Refresh, and Add Project controls.

## Stack

- React + TypeScript + Vite
- `lucide-react` for icons
- Shared working rules from `D:\Dev\Codex_Working_Rules.md`
- Shared design rules from `D:\Dev\Workspace_Design_Standard.md`

## Run

```powershell
cd D:\Dev\Tool\Unified-Tool-Admin
corepack pnpm dev
```

## Refresh Registry

```powershell
corepack pnpm scan:workspaces
```

## Watch Registry

```powershell
corepack pnpm scan:watch
node scripts\watch-workspaces.cjs --check
```

## Project Codes

Project codes are stable short references such as `P0001`.

The first registered code is:

```text
P0001 = D:\Dev\Tool\GPM-Automation-Console
P0002 = D:\Dev\Tool\YT-Multistream-Console
```

Unified Tool Admin prefers `tool.manifest.json` when present, then falls back to `package.json` and docs inference.
New projects should start from `D:\Dev\tool.manifest.template.json`.

## GitHub Sync Status

Current GitHub integration is metadata-only:

- Repo links are read from `tool.manifest.json`, `package.json.repository`, or local `git remote`.
- `Open Repo` opens the configured GitHub URL.
- `Pull Remote` and `Push Local` currently queue sync intent in the UI console only.
- Realtime GitHub API/webhook sync is not connected yet; local registry updates still come from scanner/watch.

Admin push helper:

```powershell
node scripts\push-github-api.cjs
```

The helper reads `GITHUB_TOKEN` / `GH_TOKEN` from `D:\Dev\.secrets\github.env` and uses the GitHub API because this machine's Git installation currently has no HTTPS remote helper.

## Build Check

```powershell
corepack pnpm build
corepack pnpm lint
```

## Next Steps

- Add real command execution through a safe local agent.
- Add SQLite persistence when project history grows beyond browser localStorage.
- Add per-project release history, rollback metadata, and changelog rollups.
