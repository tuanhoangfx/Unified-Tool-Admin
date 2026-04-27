# Changelog

## 0.5.0 - GitHub repo actions

- Added GitHub Repo column in the Project Registry table.
- Added Open Repo, Pull Remote intent, and Push Local intent actions.
- Added scanner fallback to infer GitHub repo metadata from `package.json.repository` or local `git remote`.
- Added `scripts/push-github-api.cjs` operator helper for pushing repositories through the GitHub API.
- Documented that realtime GitHub API/webhook sync is not connected yet.

## 0.4.0 - Manifest watch and P0002

- Added `P0002` support through `D:\Dev\Tool\YT-Multistream-Console\tool.manifest.json`.
- Added `corepack pnpm scan:watch` to refresh `public/registry.json` when manifests or docs change.
- Added `node scripts\watch-workspaces.cjs --check` to validate watcher coverage without leaving a long-running process open.
- Added workspace manifest template reference through `D:\Dev\tool.manifest.template.json`.

## 0.3.0 - Workspace governance update

- Added workspace-level governance references:
  - `D:\Dev\Codex_Working_Rules.md`
  - `D:\Dev\Workspace_Design_Standard.md`
  - `D:\Dev\PROJECT_INDEX.md`
- Kept compatibility aliases under `D:\Dev\Tool`.
- Updated Unified docs to follow the root rules and design standard.
- Continued manifest-first project identity with `P0001` for GPM Automation Console.

## 0.2.0 - Registry and release persistence

- Added `public/registry.json`.
- Added workspace scanner script.
- Added allowlist command runner state.
- Added localStorage release checklist per project.

## 0.1.0 - MVP registry console

- Added central project registry.
- Added project detail inspector.
- Added run queue state, release gate, and console log.
