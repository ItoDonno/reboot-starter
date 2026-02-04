const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const CLI_PATH = path.resolve(__dirname, "..", "cli.js");

function makeHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "reboot-"));
}

function run(args, homeDir) {
  const env = {
    ...process.env,
    HOME: homeDir,
    USERPROFILE: homeDir,
  };
  const stdout = execFileSync(process.execPath, [CLI_PATH, ...args], {
    env,
    encoding: "utf8",
  });
  return stdout.trim();
}

function getIdFromAdd(output) {
  const match = output.match(/Added:\s+\[\s\]\s+(\w+)/);
  return match ? match[1] : null;
}

test("add and list tasks", () => {
  const home = makeHome();
  const outAdd = run(["add", "Write", "docs"], home);
  assert.ok(outAdd.includes("Added:"));

  const outList = run(["list", "--all"], home);
  assert.ok(outList.includes("Write docs"));
});

test("edit task text", () => {
  const home = makeHome();
  const outAdd = run(["add", "Old", "text"], home);
  const id = getIdFromAdd(outAdd);
  assert.ok(id);

  const outEdit = run(["edit", id, "New", "text"], home);
  assert.ok(outEdit.includes("Updated:"));

  const outList = run(["list", "--all"], home);
  assert.ok(outList.includes("New text"));
});

test("search tasks", () => {
  const home = makeHome();
  run(["add", "Finish", "report"], home);
  run(["add", "Buy", "milk"], home);

  const outSearch = run(["search", "report", "--all"], home);
  assert.ok(outSearch.includes("Finish report"));
  assert.ok(!outSearch.includes("Buy milk"));
});

test("set priority", () => {
  const home = makeHome();
  const outAdd = run(["add", "Important", "task"], home);
  const id = getIdFromAdd(outAdd);
  assert.ok(id);

  const outPr = run(["priority", id, "high"], home);
  assert.ok(outPr.includes("[high]"));
});

test("json output", () => {
  const home = makeHome();
  run(["add", "Json", "task"], home);

  const out = run(["list", "--all", "--json"], home);
  const parsed = JSON.parse(out);
  assert.equal(parsed.ok, true);
  assert.equal(Array.isArray(parsed.tasks), true);
});

test("where outputs path in json mode", () => {
  const home = makeHome();
  const out = run(["where", "--json"], home);
  const parsed = JSON.parse(out);
  assert.equal(parsed.ok, true);
  assert.ok(parsed.path);
});

test("open outputs json response", () => {
  const home = makeHome();
  const out = run(["open", "--json"], home);
  const parsed = JSON.parse(out);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.opened, true);
  assert.ok(parsed.path);
});

test("clear outputs json response", () => {
  const home = makeHome();
  run(["add", "A"], home);
  run(["add", "B"], home);
  run(["done", "invalid-id"], home);
  const out = run(["clear", "--json"], home);
  const parsed = JSON.parse(out);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.scope, "done");
});

test("already completed returns json message", () => {
  const home = makeHome();
  const outAdd = run(["add", "Finish", "task"], home);
  const id = getIdFromAdd(outAdd);
  run(["done", id], home);
  const outDone = run(["done", id, "--json"], home);
  const parsed = JSON.parse(outDone);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.message, "Already completed");
});

test("db corruption recovery", () => {
  const home = makeHome();
  const dbPath = path.join(home, ".reboot-starter", "tasks.json");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.writeFileSync(dbPath, "{ this is not json", "utf8");

  const outList = run(["list", "--all", "--json"], home);
  const parsed = JSON.parse(outList);
  assert.equal(parsed.ok, true);
  assert.equal(Array.isArray(parsed.tasks), true);
});
