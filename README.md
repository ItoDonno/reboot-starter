# Reboot Starter

Reboot Starter is a tiny CLI task tracker that stores tasks in a local JSON file.

## Install

```bash
npm install
npm link
```

## Usage

Add a task:

```bash
reboot add "Write docs"
```

List tasks:

```bash
reboot list
reboot list --all
reboot list --done
```

Edit a task:

```bash
reboot edit <id> "New text"
```

Search tasks:

```bash
reboot search "docs"
```

Set priority:

```bash
reboot priority <id> high
```

JSON output (for scripting):

```bash
reboot list --all --json
```

Other commands
```
reboot done <id>           # mark task completed
reboot rm <id>             # remove a task
reboot clear [--all]       # clear completed tasks (or all with --all)
reboot where               # show DB path
reboot open                # open DB in VS Code or default app
```

Notes
- The database is created at `~/.reboot-starter/tasks.json` on first run.
- Use `--json` on any command to get structured JSON responses (ok/error and result objects) suitable for scripts.

## Data Location

Tasks are stored at `~/.reboot-starter/tasks.json`.
