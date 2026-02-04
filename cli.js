#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");
const crypto = require("crypto");

const commander = require("commander");
const program = new commander.Command();

const APP_DIR = path.join(os.homedir(), ".reboot-starter");
const DB_PATH = path.join(APP_DIR, "tasks.json");
const DB_TMP_PATH = path.join(APP_DIR, "tasks.json.tmp");
const PRIORITIES = new Set(["low", "normal", "high"]);

function ensureDb() {
  if (!fs.existsSync(APP_DIR)) fs.mkdirSync(APP_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ tasks: [] }, null, 2), "utf8");
  }
}

function loadDb() {
  ensureDb();
  const raw = fs.readFileSync(DB_PATH, "utf8").trim();
  if (!raw) return { tasks: [] };

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { tasks: [] };
    if (!Array.isArray(parsed.tasks)) parsed.tasks = [];
    return parsed;
  } catch (err) {
    const backupPath = path.join(APP_DIR, `tasks.json.bak-${Date.now()}`);
    try {
      fs.copyFileSync(DB_PATH, backupPath);
    } catch {}
    fs.writeFileSync(DB_PATH, JSON.stringify({ tasks: [] }, null, 2), "utf8");
    console.warn(
      "Warning: tasks.json was corrupted and has been reset.",
      `Backup saved at: ${backupPath}`
    );
    return { tasks: [] };
  }
}

function saveDb(db) {
  ensureDb();
  const json = JSON.stringify(db, null, 2);
  try {
    fs.writeFileSync(DB_TMP_PATH, json, "utf8");
    try {
      fs.rmSync(DB_PATH, { force: true });
    } catch {}
    fs.renameSync(DB_TMP_PATH, DB_PATH);
  } catch {
    try {
      fs.rmSync(DB_TMP_PATH, { force: true });
    } catch {}
    fs.writeFileSync(DB_PATH, json, "utf8");
  }
}

function newId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function parsePriority(p) {
  const v = String(p || "").trim().toLowerCase();
  return { ok: PRIORITIES.has(v), value: v };
}

function formatTask(t) {
  const box = t.done ? "[x]" : "[ ]";
  const pr = t.priority && t.priority !== "normal" ? ` [${t.priority}]` : "";
  return `${box} ${t.id}  ${t.text}${pr}`;
}

function tryOpenInVSCode(filePath) {
  const r = spawnSync("code", [filePath], { stdio: "ignore" });
  return !r.error && r.status === 0;
}

function openWithDefaultApp(filePath) {
  const platform = process.platform;

  if (platform === "win32") {
    // cmd /c start "" "<file>"
    spawnSync("cmd", ["/c", "start", "", filePath], { stdio: "ignore" });
    return;
  }

  if (platform === "darwin") {
    spawnSync("open", [filePath], { stdio: "ignore" });
    return;
  }

  // linux
  spawnSync("xdg-open", [filePath], { stdio: "ignore" });
}

function isJsonOutput() {
  return program.opts().json === true;
}

function respond(payload) {
  if (isJsonOutput()) {
    return console.log(JSON.stringify(payload, null, 2));
  }
  if (payload && payload.message) console.log(payload.message);
}

function respondError(message) {
  if (isJsonOutput()) return respond({ ok: false, error: message });
  return console.log(message);
}

function printTasks(label, tasks) {
  if (isJsonOutput()) {
    return console.log(JSON.stringify({ ok: true, label, tasks }, null, 2));
  }
  if (tasks.length === 0) return console.log("No tasks to show.");
  console.log(`Showing ${tasks.length} ${label} task${tasks.length === 1 ? "" : "s"}:`);
  tasks.forEach((t) => console.log(formatTask(t)));
}

program
  .name("reboot")
  .description("Reboot Starter — simple CLI task tracker")
  .version("0.1.0")
  .option("--json", "Output JSON");

program
  .command("add")
  .description("Add a task")
  .argument("<text...>", "Task text")
  .option("-p, --priority <level>", "Priority: low, normal, high", "normal")
  .action((textParts, opts) => {
    const text = textParts.join(" ").trim();
    if (!text) return respondError("Please provide task text.");
    const pr = parsePriority(opts.priority);
    if (!pr.ok) return respondError("Priority must be low, normal, or high.");
    const priority = pr.value || "normal";
    const db = loadDb();
    const task = {
      id: newId(),
      text,
      done: false,
      priority,
      createdAt: new Date().toISOString(),
      doneAt: null,
    };
    db.tasks.unshift(task);
    saveDb(db);
    if (isJsonOutput()) return respond({ ok: true, task });
    console.log("Added:", formatTask(task));
  });

program
  .command("list")
  .description("List tasks")
  .option("--done", "Show only completed tasks")
  .option("--all", "Show all tasks (default shows only open)")
  .action((opts) => {
    const db = loadDb();
    let tasks = db.tasks;
    let label = "open";

    if (opts.done) tasks = tasks.filter((t) => t.done);
    else if (!opts.all) tasks = tasks.filter((t) => !t.done);
    if (opts.done) label = "done";
    else if (opts.all) label = "all";

    return printTasks(label, tasks);
  });

program
  .command("search")
  .description("Search tasks by text")
  .argument("<query...>", "Search query")
  .option("--done", "Search only completed tasks")
  .option("--all", "Search all tasks (default searches only open)")
  .action((queryParts, opts) => {
    const query = queryParts.join(" ").trim().toLowerCase();
    if (!query) return respondError("Please provide a search query.");

    const db = loadDb();
    let tasks = db.tasks;
    let label = "open";

    if (opts.done) tasks = tasks.filter((t) => t.done);
    else if (!opts.all) tasks = tasks.filter((t) => !t.done);
    if (opts.done) label = "done";
    else if (opts.all) label = "all";

    tasks = tasks.filter((t) => String(t.text || "").toLowerCase().includes(query));
    return printTasks(`matching ${label}`, tasks);
  });

program
  .command("done")
  .description("Mark a task as done")
  .argument("<id>", "Task id")
  .action((id) => {
    const db = loadDb();
    const task = db.tasks.find((t) => t.id === id);
    if (!task) return respondError(`No task found with id: ${id}`);
    if (task.done) {
      if (isJsonOutput()) return respond({ ok: true, task, message: "Already completed" });
      return console.log("Already completed:", formatTask(task));
    }

    task.done = true;
    task.doneAt = new Date().toISOString();
    saveDb(db);
    if (isJsonOutput()) return respond({ ok: true, task });
    console.log("Completed:", formatTask(task));
  });

program
  .command("edit")
  .description("Edit a task's text")
  .argument("<id>", "Task id")
  .argument("<text...>", "New task text")
  .action((id, textParts) => {
    const text = textParts.join(" ").trim();
    if (!text) return respondError("Please provide new task text.");
    const db = loadDb();
    const task = db.tasks.find((t) => t.id === id);
    if (!task) return respondError(`No task found with id: ${id}`);

    task.text = text;
    saveDb(db);
    if (isJsonOutput()) return respond({ ok: true, task });
    console.log("Updated:", formatTask(task));
  });

program
  .command("priority")
  .description("Set a task priority")
  .argument("<id>", "Task id")
  .argument("<level>", "Priority: low, normal, high")
  .action((id, level) => {
    const pr = parsePriority(level);
    if (!pr.ok) return respondError("Priority must be low, normal, or high.");
    const priority = pr.value;
    const db = loadDb();
    const task = db.tasks.find((t) => t.id === id);
    if (!task) return respondError(`No task found with id: ${id}`);

    task.priority = priority;
    saveDb(db);
    if (isJsonOutput()) return respond({ ok: true, task });
    console.log("Priority updated:", formatTask(task));
  });

program
  .command("rm")
  .description("Remove a task")
  .argument("<id>", "Task id")
  .action((id) => {
    const db = loadDb();
    const before = db.tasks.length;
    db.tasks = db.tasks.filter((t) => t.id !== id);
    saveDb(db);
    if (isJsonOutput()) return respond({ ok: before !== db.tasks.length, id, removed: before !== db.tasks.length });
    console.log(before !== db.tasks.length ? `Removed task ${id}` : `No task found with id: ${id}`);
  });

program
  .command("where")
  .description("Show where tasks are stored")
  .action(() => {
    ensureDb();
    if (isJsonOutput()) return respond({ ok: true, path: DB_PATH });
    console.log(DB_PATH);
  });

program
  .command("open")
  .description("Open the tasks database file")
  .action(() => {
    ensureDb();

    // Try VS Code first (nice dev experience), then fall back to default OS open.
    const opened = tryOpenInVSCode(DB_PATH);
    if (!opened) openWithDefaultApp(DB_PATH);

    if (isJsonOutput()) return respond({ ok: true, opened: true, path: DB_PATH });
    console.log("Opened:", DB_PATH);
  });

program
  .command("clear")
  .description("Remove completed tasks (default) or wipe all tasks")
  .option("--all", "Remove ALL tasks")
  .action((opts) => {
    const db = loadDb();
    const before = db.tasks.length;

    if (opts.all) {
      db.tasks = [];
      saveDb(db);
      if (isJsonOutput()) return respond({ ok: true, removed: before, scope: "all" });
      console.log(`Cleared all tasks. (${before} removed)`);
      return;
    }

    const doneCount = db.tasks.filter((t) => t.done).length;
    db.tasks = db.tasks.filter((t) => !t.done);
    saveDb(db);
    if (isJsonOutput()) return respond({ ok: true, removed: doneCount, scope: "done" });
    console.log(`Cleared completed tasks. (${doneCount} removed)`);
  });

program.parse(process.argv);
