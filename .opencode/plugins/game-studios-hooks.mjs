import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const projectRoot = "C:/Users/ronbiter/Documents/projects/Claude-Code-Game-Studios";
const LOG_FILE = path.join(projectRoot, "production/session-logs/plugin-log.txt");

function log(msg) {
  try {
    const dir = path.dirname(LOG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const ts = new Date().toISOString();
    fs.appendFileSync(LOG_FILE, `[${ts}] ${msg}\n`);
  } catch {}
}

function logSection(title) {
  log(`=== ${title} ===`);
}

function fileExists(filePath) {
  try { return fs.existsSync(filePath); } catch { return false; }
}

function readFile(filePath) {
  try {
    if (fs.existsSync(filePath)) return fs.readFileSync(filePath, "utf8");
  } catch {}
  return "";
}

function checkJsonValid(filePath) {
  try { JSON.parse(fs.readFileSync(filePath, "utf8")); return true; } catch { return false; }
}

function grepSections(filePath, sections) {
  const content = readFile(filePath);
  return sections.filter(s => !content.toLowerCase().includes(s.toLowerCase()));
}

function parseCommand(input) {
  if (!input) return "";
  if (input.tool_input?.command) return input.tool_input.command;
  const m = JSON.stringify(input).match(/"command"\s*:\s*"([^"]*)"/);
  return m ? m[1] : "";
}

function parseFilePath(input) {
  if (!input) return "";
  if (input.tool_input?.file_path) return input.tool_input.file_path;
  if (input.args?.filePath) return input.args.filePath;
  const m = JSON.stringify(input).match(/"file_path"\s*:\s*"([^"]*)"/);
  return m ? m[1] : "";
}

const GameStudiosHooks = async (ctx) => {
  log("Plugin loaded");
  const root = projectRoot;

  return {
    "tool.execute.before": async (input, output) => {
      const cmd = parseCommand(input);
      if (!cmd) return;

      if (cmd.match(/^git\s+commit/)) {
        log("Validating commit: " + cmd);
        const warnings = [];
        try {
          const staged = execSync("git diff --cached --name-only", { cwd: root, encoding: "utf8" }).trim();
          if (staged) {
            for (const file of staged.split("\n").filter(f => f.trim())) {
              const fp = path.join(root, file);
              if (file.startsWith("design/gdd/") && file.endsWith(".md")) {
                const missing = grepSections(fp, ["Overview", "Player Fantasy", "Detailed", "Formulas", "Edge Cases", "Dependencies", "Tuning Knobs", "Acceptance Criteria"]);
                if (missing.length) warnings.push(`DESIGN: ${file} missing: ${missing.join(", ")}`);
              }
              if (file.match(/^assets\/data\/.*\.json$/) && fileExists(fp) && !checkJsonValid(fp)) {
                throw new Error(`BLOCKED: ${file} invalid JSON`);
              }
              if (file.startsWith("src/gameplay/") && fileExists(fp)) {
                const c = readFile(fp);
                if (/damage\s*[:=]\s*\d+|health\s*[:=]\s*\d+/.test(c)) warnings.push(`CODE: ${file} hardcoded values`);
              }
              if (file.startsWith("src/") && fileExists(fp)) {
                const c = readFile(fp);
                if (/(TODO|FIXME|HACK)\s*[^(\n]/.test(c)) warnings.push(`STYLE: ${file} TODO without owner`);
              }
            }
          }
        } catch (e) {
          if (e.message?.startsWith("BLOCKED:")) throw e;
        }
        if (warnings.length) {
          logSection("Commit Validation Warnings");
          warnings.forEach(w => log(w));
          log("================================");
        }
      }

      if (cmd.match(/^git\s+push/)) {
        try {
          const branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: root, encoding: "utf8" }).trim();
          if (["develop", "main", "master"].includes(branch)) {
            log(`WARNING: Push to protected branch '${branch}'`);
          }
        } catch {}
      }
    },

    "tool.execute.after": async (input, output) => {
      const tool = input?.tool;
      const fpath = parseFilePath(input);

      if ((tool === "write" || tool === "edit") && fpath?.includes("assets/")) {
        log("Validating asset: " + fpath);
        const fname = path.basename(fpath);
        const warnings = [], errors = [];
        if (/[A-Z\s\-]/.test(fname)) warnings.push(`NAMING: ${fname} should be lowercase`);
        if (fpath.match(/assets\/data\/.*\.json$/) && fileExists(path.join(root, fpath))) {
          if (!checkJsonValid(path.join(root, fpath))) errors.push(`FORMAT: ${fpath} invalid JSON`);
        }
        if (warnings.length) { warnings.forEach(w => log("WARN: " + w)); }
        if (errors.length) { errors.forEach(e => log("ERROR: " + e)); throw new Error(errors.join("\n")); }
      }

      if ((tool === "write" || tool === "edit") && fpath?.includes(".agents/skills/")) {
        const sn = fpath.match(/\.agents\/skills\/([^/]+)/)?.[1];
        if (sn) { logSection(`Skill Modified: ${sn}`); log("Run /skill-test static"); }
      }
    },

    "session.created": async (input, output) => {
      logSection("Session Context");

      try {
        const branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: root, encoding: "utf8" }).trim();
        if (branch) {
          log(`Branch: ${branch}`);
          log("Recent commits:");
          execSync("git log --oneline -5", { cwd: root, encoding: "utf8" }).trim().split("\n").forEach(l => log("  " + l));
        }
      } catch (e) { log("Error: " + e.message); }

      try {
        const sprintDir = path.join(root, "production/sprints");
        if (fileExists(sprintDir)) {
          const files = fs.readdirSync(sprintDir).filter(f => f.match(/^sprint-.*\.md$/));
          if (files.length) { files.sort().reverse(); log(`Active sprint: ${files[0].replace(".md", "")}`); }
        }
      } catch {}

      try {
        let bugCount = 0;
        ["tests/playtest", "production"].forEach(dir => {
          const dp = path.join(root, dir);
          if (fileExists(dp)) bugCount += fs.readdirSync(dp).filter(f => f.startsWith("BUG-") && f.endsWith(".md")).length;
        });
        if (bugCount) log(`Open bugs: ${bugCount}`);
      } catch {}

      const stateFile = path.join(root, "production/session-state/active.md");
      if (fileExists(stateFile)) {
        log("");
        logSection("Active Session State");
        const lines = readFile(stateFile).split("\n").slice(0, 15).join("\n");
        log(lines);
      }

      logSection("Documentation Gaps Check");

      let fresh = true;
      if (fileExists(path.join(root, ".agents/docs/technical-preferences.md"))) {
        const c = readFile(path.join(root, ".agents/docs/technical-preferences.md"));
        if (c.includes("Engine:") && !c.includes("TO BE CONFIGURED")) fresh = false;
      }
      if (fileExists(path.join(root, "design/gdd/game-concept.md"))) fresh = false;

      if (fresh) { log("NEW PROJECT: Run /start"); return; }

      let srcFiles = 0, designFiles = 0;
      const srcDir = path.join(root, "src"), designDir = path.join(root, "design/gdd");

      try {
        if (fileExists(srcDir)) {
          function countFiles(dir, exts) {
            let n = 0;
            fs.readdirSync(dir).forEach(item => {
              const fp = path.join(dir, item);
              if (fs.statSync(fp).isDirectory()) n += countFiles(fp, exts);
              else if (exts.includes(path.extname(item))) n++;
            });
            return n;
          }
          srcFiles = countFiles(srcDir, [".gd", ".cs", ".cpp", ".c", ".h", ".rs", ".py", ".js", ".ts"]);
        }
      } catch {}

      try {
        if (fileExists(designDir)) designFiles = fs.readdirSync(designDir).filter(f => f.endsWith(".md")).length;
      } catch {}

      if (srcFiles > 50 && designFiles < 5) log(`GAP: ${srcFiles} src files, ${designFiles} design docs`);

      const archDir = path.join(root, "docs/architecture");
      if (fileExists(path.join(root, "src/core")) || fileExists(path.join(root, "src/engine"))) {
        if (!fileExists(archDir)) log("GAP: No docs/architecture/");
        else {
          const adrs = fs.readdirSync(archDir).filter(f => f.endsWith(".md")).length;
          if (adrs < 3) log(`GAP: Only ${adrs} ADRs`);
        }
      }

      log("===================================");
    },

    "session.idle": async (input, output) => {
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const logDir = path.join(root, "production/session-logs");
      const stateFile = path.join(root, "production/session-state/active.md");

      try { if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true }); } catch {}
      try {
        if (fileExists(stateFile)) {
          fs.appendFileSync(path.join(logDir, "session-log.md"), `\n## Archived: ${ts}\n${readFile(stateFile)}\n---\n`);
        }
      } catch {}

      try {
        const commits = execSync('git log --oneline --since="8 hours ago"', { cwd: root, encoding: "utf8" }).trim();
        const modified = execSync("git diff --name-only", { cwd: root, encoding: "utf8" }).trim();
        if (commits || modified) {
          fs.appendFileSync(path.join(logDir, "session-log.md"),
            `\n## Session End: ${ts}\n${commits ? "### Commits\n" + commits + "\n" : ""}${modified ? "### Changes\n" + modified + "\n" : ""}---\n`);
        }
      } catch {}

      log("Session ended");
    },

    "experimental.session.compacting": async (input, output) => {
      logSection("Before Compaction");
      const stateFile = path.join(root, "production/session-state/active.md");
      if (fileExists(stateFile)) {
        log("Active state: " + readFile(stateFile).split("\n").slice(0, 20).join("\n"));
      }

      try {
        const changed = execSync("git diff --name-only", { cwd: root, encoding: "utf8" }).trim();
        const staged = execSync("git diff --staged --name-only", { cwd: root, encoding: "utf8" }).trim();
        const untracked = execSync("git ls-files --others --exclude-standard", { cwd: root, encoding: "utf8" }).trim();
        log(`Changed: ${changed || "(none)"}`);
        log(`Staged: ${staged || "(none)"}`);
        log(`Untracked: ${untracked || "(none)"}`);
      } catch {}

      log("===================================");
    },

    "session.updated": async (input, output) => {
      const stateFile = path.join(root, "production/session-state/active.md");
      if (fileExists(stateFile)) {
        log(`State restored: ${readFile(stateFile).split("\n").length} lines`);
      } else {
        log("No state file found");
      }
    },
  };
};

export default GameStudiosHooks;