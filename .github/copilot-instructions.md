# Copilot Instructions for Reboot Starter

## Overview

A Node.js CLI task tracker with priorities and search. All logic in `cli.js` with JSON database at `~/.reboot-starter/tasks.json`. Supports dual output modes: human-readable text (default) and structured JSON (`--json` flag).

## Core Architecture

- **CLI Framework**: `commander` for command parsing
- **Data Flow**: Load → Validate → Modify → Atomic Save pattern
- **Output Modes**: Dual-mode via `isJsonOutput()` check; `respond()` and `respondError()` abstract format
- **Error Handling**: Corrupted DB backed up with timestamp; defaults to empty state on parse failure
- **Database**: `{ tasks: [] }` with atomic writes via temp file + rename

## Task Object Schema

```javascript
{
  id: string,              // 12-char crypto-based or timestamp-based fallback
  text: string,            // Task description
  done: boolean,           // false until marked complete
  priority: string,        // "low" | "normal" | "high" (default: "normal")
  createdAt: string,       // ISO timestamp
  doneAt: string | null    // ISO timestamp when marked done
}
```

## Implementation Patterns

- **Task IDs**: `crypto.randomUUID()` (12 chars, no dashes) or fallback to `Date.now()+Math.random()`
- **List Order**: `unshift()` adds newest first
- **Atomic Writes**: Write to temp file, delete original, rename temp (prevents corruption)
- **Validation**: Priority levels checked via `PRIORITIES` Set; normalizes to lowercase
- **Filtering**: `tasks.filter()` for state/priority; case-insensitive search via `.includes(query.toLowerCase())`
- **Platform File Opening**: Try VS Code first via `spawnSync("code")`, fallback to OS defaults (`cmd /c start` Win, `open` macOS, `xdg-open` Linux)

## Commands

| Command                             | Purpose                                   |
| ----------------------------------- | ----------------------------------------- |
| `add <text> [-p low\|normal\|high]` | Create task with optional priority        |
| `list [--all\|--done]`              | Filter by state (default: open only)      |
| `search <query> [--all\|--done]`    | Case-insensitive text search              |
| `done <id>`                         | Mark complete with timestamp              |
| `edit <id> <text...>`               | Modify task text                          |
| `priority <id> <low\|normal\|high>` | Update priority level                     |
| `rm <id>`                           | Delete task                               |
| `clear [--all]`                     | Remove completed (default) or all tasks   |
| `open`                              | Launch database in VS Code or default app |
| `where`                             | Print DB file path                        |

## Global Flag

- `--json`: Output all responses as structured JSON objects

## Examples

```bash
# Add task with high priority
reboot add "Fix critical bug" -p high

# List only open tasks
reboot list

# Search tasks containing "meeting"
reboot search meeting --all

# Mark task complete and show JSON response
reboot done abc123def --json
# → { ok: true, task: { id, text, done, priority, createdAt, doneAt } }

# Update priority
reboot priority xyz789abc low
```

## Development

- **No build step** — runs directly as Node.js
- **Dependencies**: commander (npm); fs, path, os, crypto, child_process (stdlib)
- **Tests**: `npm test` runs `node --test` on files in `test/`
- **Entry point**: Shebang at line 1 allows `reboot` global after `npm link`
