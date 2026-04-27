# Project Context

Living context file for `Unified Tool Admin`.

## Product Goal

Build a central operations console for every tool, webapp, browser extension, and automation script in `D:\Dev`.

The product is intended for repeated operator workflows:

```text
discover project -> inspect state -> run/check -> monitor logs -> prepare release -> recover/rollback
```

## Current Direction

- Product type: web control plane first, desktop packaging later if needed.
- UI language: English.
- UI direction: dense operational console following `D:\Dev\Workspace_Design_Standard.md`.
- Working rules source: `D:\Dev\Codex_Working_Rules.md`.
- Theme support: dark/light through shared CSS variables.
- Initial data: `public/registry.json` generated from the known local workspaces.
- Registry refresh: `corepack pnpm scan:workspaces`.
- Project code support: stable `P####` aliases are read from per-tool `tool.manifest.json`.
- Registry watch mode: `corepack pnpm scan:watch`.
- GitHub status: metadata-only links and sync intents; realtime GitHub API/webhook sync is not connected yet.
- Command execution direction: allowlist runner state in browser now, real local agent later.

## Current Features

- Central registry table.
- Search by project name, stack, type, and tags.
- Type filter for desktop tools, web apps, extensions, app scripts, and automation.
- Active project detail panel.
- Allowlist-only command runner state.
- Terminal-style console output.
- Release gate score and localStorage-backed checklist per project.
- Guide, Changelog, Refresh, and Add Project modals/actions.
- Workspace scanner script that detects `package.json`, README/context docs, changelog, manifests, and Apps Script maps.
- Scanner can infer GitHub repo metadata from `tool.manifest.json`, `package.json.repository`, or local `git remote`.
- Project registry table shows a GitHub Repo column plus Open/Pull/Push intent actions.
- GitHub API push helper exists at `scripts/push-github-api.cjs` because local Git lacks `git-remote-https`.
- Manifest-first project identity. `P0001` maps to `GPM Automation Console` through `D:\Dev\Tool\GPM-Automation-Console\tool.manifest.json`.
- `P0002` maps to `YT Multistream Console` through `D:\Dev\Tool\YT-Multistream-Console\tool.manifest.json`.

## Important Decisions

- Keep this separate from the existing `Tool-Control-Center` scaffold.
- Use the shared `D:\Dev\Tool\design-base.css` import instead of redefining base tokens.
- Keep project actions local-state only until a safe command runner is designed.
- Do not execute arbitrary project commands from the browser without an explicit local agent boundary.
- Do not run GitHub push/pull from the browser. GitHub sync buttons are intent-only until a safe local agent or GitHub API integration exists.
- `scripts/push-github-api.cjs` is an operator-run helper, not a browser action. It reads credentials only from `D:\Dev\.secrets\github.env`.
- Keep `public/registry.json` human-readable so it can be edited manually if scanner inference is wrong.
- Prefer `tool.manifest.json` over README parsing for machine-readable project identity, code, GitHub repo, docs, commands, and next actions.
- Persist lightweight release gate state in browser localStorage until a database is justified.

## Development Commands

Use `corepack pnpm` on this machine.

```powershell
cd D:\Dev\Tool\Unified-Tool-Admin
corepack pnpm dev
corepack pnpm scan:workspaces
corepack pnpm scan:watch
corepack pnpm build
corepack pnpm lint
```

## Next Development Suggestions

- Add command runner service with bounded process lifecycle, masked logs, and stop/recovery path.
- Add editable registry rows and write changes back through a local agent.
- Add changelog rollup and rollback metadata per project.
- Add a local agent that can safely persist registry edits, execute allowlisted commands, and perform GitHub push/pull.
- Add GitHub remote manifest sync for repos with configured `github.repo`.
