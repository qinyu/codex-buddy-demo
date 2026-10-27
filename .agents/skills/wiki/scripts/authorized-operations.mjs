#!/usr/bin/env node
// 许可感知操作执行器（可选实验）。
// 只接收显式 read / 受限 search / 公开 graph query 操作；不接收 shell、任意命令串或 then_run。
// 收据记录单次操作的实际结果，不宣称全会话安全。
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const GRAPH_SUBCOMMANDS = new Set(["query", "callers", "impact"]);

const MAX_READ_BYTES = 1024 * 1024; // 1 MiB
const MAX_SEARCH_FILES = 2000;
const MAX_SEARCH_MATCHES = 200;
const MAX_SEARCH_FILE_BYTES = 256 * 1024; // 256 KiB
const MAX_SEARCH_BYTES = 8 * 1024 * 1024;
const MAX_SEARCH_DIRS = 2000;
const MAX_SEARCH_EXCERPT = 1000;
const MAX_OPERATIONS = 100;
const MAX_GRAPH_STDOUT_BYTES = 2 * 1024 * 1024; // 2 MiB
const GRAPH_TIMEOUT_MS = 20000;
const GRAPH_MAX_BUFFER = 64 * 1024 * 1024; // 64 MiB

function isWithin(child, root) {
  const rel = path.relative(root, child);
  return rel === "" || (!rel.startsWith(".." + path.sep) && rel !== ".." && !path.isAbsolute(rel));
}

function errorResult(message) {
  return { ok: false, outcome: "error", workspace: null, operations: [], error: message };
}

function defaultRunGraph(cwd, argv) {
  const r = spawnSync(argv[0], argv.slice(1), {
    cwd,
    encoding: "utf8",
    timeout: GRAPH_TIMEOUT_MS,
    maxBuffer: GRAPH_MAX_BUFFER,
  });
  if (r.error) {
    return {
      status: 1,
      stdout: "",
      stderr: r.error.message || String(r.error),
      error: r.error.message || String(r.error),
    };
  }
  return { status: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "", error: null };
}

function normalizeScopeList(value, field) {
  if (value === undefined || value === null || value === "unknown") {
    return { items: [], error: null };
  }
  if (!Array.isArray(value)) {
    return { items: [], error: `${field} must be an array or "unknown"` };
  }
  const items = [];
  for (const entry of value) {
    if (entry === "unknown") continue;
    if (entry && typeof entry === "object" && typeof entry.path === "string" && entry.path.length > 0) {
      if (typeof entry.basis !== "string" || entry.basis.trim() === "") return { items: [], error: `${field} basis must be non-empty` };
      items.push({ path: entry.path, basis: entry.basis });
    } else {
      return { items: [], error: `${field} entries must be {path, basis}` };
    }
  }
  return { items, error: null };
}

function normalizeRepoList(value) {
  if (value === undefined || value === null || value === "unknown") {
    return { items: [], error: null };
  }
  if (!Array.isArray(value)) {
    return { items: [], error: 'graph_ops.repos must be an array or "unknown"' };
  }
  const items = [];
  for (const entry of value) {
    if (entry === "unknown") continue;
    if (
      entry && typeof entry === "object" &&
      typeof entry.repo === "string" && entry.repo.length > 0
    ) {
      if (typeof entry.basis !== "string" || entry.basis.trim() === "") return { items: [], error: "graph_ops.repos basis must be non-empty" };
      items.push({ repo: entry.repo, basis: entry.basis });
    } else {
      return { items: [], error: "graph_ops.repos entries must be {repo, basis}" };
    }
  }
  return { items, error: null };
}

function normalizeQueryList(value) {
  if (value === undefined || value === null || value === "unknown") {
    return { items: [], error: null };
  }
  if (!Array.isArray(value)) {
    return { items: [], error: 'graph_ops.queries must be an array or "unknown"' };
  }
  const items = [];
  for (const entry of value) {
    if (entry === "unknown") continue;
    if (
      entry && typeof entry === "object" &&
      typeof entry.op === "string" && GRAPH_SUBCOMMANDS.has(entry.op) &&
      typeof entry.arg === "string" && entry.arg.length > 0
    ) {
      if (typeof entry.repo !== "string" || !path.isAbsolute(entry.repo) || typeof entry.basis !== "string" || entry.basis.trim() === "") return { items: [], error: "graph_ops.queries require absolute repo and non-empty basis" };
      items.push({ op: entry.op, arg: entry.arg, repo: entry.repo, basis: entry.basis });
    } else {
      return { items: [], error: "graph_ops.queries entries must be {op, arg, basis} with op in query/callers/impact" };
    }
  }
  return { items, error: null };
}

function readTextBounded(absPath, maxBytes) {
  const fd = fs.openSync(absPath, "r");
  try {
    const size = fs.fstatSync(fd).size;
    const len = Math.min(size, maxBytes);
    const buf = Buffer.alloc(len);
    let read = 0;
    while (read < len) {
      const n = fs.readSync(fd, buf, read, len - read, read);
      if (n === 0) break;
      read += n;
    }
    return { text: buf.toString("utf8", 0, read), truncated: size > maxBytes, size };
  } finally {
    fs.closeSync(fd);
  }
}

function countMatches(text, query) {
  let count = 0;
  let idx = 0;
  while ((idx = text.indexOf(query, idx)) !== -1) {
    count += 1;
    idx += query.length;
  }
  return count;
}

function excerpt(text, idx, query) {
  const lineStart = text.lastIndexOf("\n", idx - 1) + 1;
  const nextNewline = text.indexOf("\n", idx + query.length);
  const lineEnd = nextNewline === -1 ? text.length : nextNewline;
  return text.slice(lineStart, lineEnd);
}

function rejectPlan(type, target, error, repo = null) {
  return { type, target, repo, authorized: false, error };
}

function validateOperation(op, ctx) {
  if (!op || typeof op !== "object") {
    return rejectPlan("unknown", null, "operation must be an object");
  }
  const type = op.type;
  if (type === "read" || type === "search") {
    if (typeof op.path !== "string" || op.path.length === 0) {
      return rejectPlan(type, op.path ?? null, `${type} requires path`);
    }
    if (path.isAbsolute(op.path)) {
      return rejectPlan(type, op.path, `${type} path must be workspace-relative`);
    }
    const abs = path.resolve(ctx.workspaceReal, op.path);
    if (!isWithin(abs, ctx.workspaceReal)) {
      return rejectPlan(type, op.path, `${type} escapes workspace: ${op.path}`);
    }
    let real;
    try {
      real = fs.realpathSync(abs);
    } catch {
      return rejectPlan(type, op.path, `${type} target not found: ${op.path}`);
    }
    if (!isWithin(real, ctx.workspaceReal)) return rejectPlan(type, op.path, `${type} target escapes workspace: ${op.path}`);
    const protectedSegment = path.relative(ctx.workspaceReal, real).split(path.sep).some((part) => part === ".git" || part === ".codegraph");
    if (protectedSegment) return rejectPlan(type, op.path, "repository metadata is not readable");
    const grant = ctx.readGrants.find((g) => isWithin(real, g.real));
    if (!grant) {
      return rejectPlan(type, op.path, `no read grant covers ${op.path}`);
    }
    let st;
    try {
      st = fs.statSync(real);
    } catch {
      return rejectPlan(type, op.path, `${type} target unreadable: ${op.path}`);
    }
    if (type === "read" && !st.isFile()) {
      return rejectPlan(type, op.path, `read target must be a file: ${op.path}`);
    }
    if (type === "search" && !st.isFile() && !st.isDirectory()) {
      return rejectPlan(type, op.path, `search target must be a file or directory: ${op.path}`);
    }
    if (type === "search" && (typeof op.query !== "string" || op.query.length === 0)) {
      return rejectPlan(type, op.path, "search requires a non-empty literal query");
    }
    return {
      type,
      target: op.path,
      repo: null,
      authorized: true,
      basis: grant.basis,
      real,
      workspaceReal: ctx.workspaceReal,
      grant,
      query: type === "search" ? op.query : null,
      isDir: st.isDirectory(),
    };
  }
  if (type === "graph") {
    if (typeof op.repo !== "string" || !path.isAbsolute(op.repo)) {
      return rejectPlan("graph", op.arg ?? null, "graph requires an absolute repo");
    }
    if (typeof op.op !== "string" || !GRAPH_SUBCOMMANDS.has(op.op)) {
      return rejectPlan("graph", op.arg ?? null, `graph op not allowed: ${String(op.op)}`);
    }
    if (typeof op.arg !== "string" || op.arg.length === 0) {
      return rejectPlan("graph", op.arg ?? null, "graph requires a non-empty arg");
    }
    let repoReal;
    try {
      repoReal = fs.realpathSync(op.repo);
    } catch {
      return rejectPlan("graph", op.arg, `graph repo not found: ${op.repo}`);
    }
    const repoGrant = ctx.repoGrants.find((g) => g.real === repoReal);
    if (!repoGrant) {
      return rejectPlan("graph", op.arg, `graph repo not granted: ${op.repo}`, op.repo);
    }
    if (/^-/.test(op.arg)) return rejectPlan("graph", op.arg, "graph arg must not be option-shaped", op.repo);
    const queryGrant = ctx.queryGrants.find((q) => {
      if (q.op !== op.op || q.arg !== op.arg) return false;
      try { return fs.realpathSync(q.repo) === repoReal; } catch { return false; }
    });
    if (!queryGrant) {
      return rejectPlan("graph", op.arg, `graph query not granted: ${op.op} ${op.arg}`, op.repo);
    }
    return {
      type,
      target: op.arg,
      repo: op.repo,
      repoReal,
      authorized: true,
      basis: queryGrant.basis || repoGrant.basis,
      opName: op.op,
      arg: op.arg,
    };
  }
  return rejectPlan("unknown", null, `unknown operation type: ${String(type)}`);
}

function repoStatus(ctx, repoReal) {
  if (ctx.repoStatus.has(repoReal)) {
    return ctx.repoStatus.get(repoReal);
  }
  const r = ctx.runGraph(repoReal, ["codegraph", "status", "--json"]);
  let state = null;
  try {
    state = JSON.parse(r.stdout ?? "");
  } catch {
    state = null;
  }
  let result;
  if ((r.status ?? 1) !== 0) {
    result = { ok: false, reason: `status exit ${r.status ?? 1}`, exitCode: r.status ?? 1 };
  } else if (!state || typeof state !== "object" || state.initialized !== true) {
    result = {
      ok: false,
      reason: `initialized:${state && typeof state === "object" ? String(state.initialized) : "missing"}`,
      exitCode: 0,
    };
  } else {
    result = { ok: true, reason: "", exitCode: 0 };
  }
  result.invocation = { argv: ["codegraph", "status", "--json"], stdout: r.stdout ?? "", stderr: r.stderr ?? "", exitCode: r.status ?? 1 };
  ctx.repoStatus.set(repoReal, result);
  return result;
}

function searchUnder(plan) {
  const files = [], results = [], errors = [];
  const dirs = [], visited = new Set();
  let incomplete = false, bytes = 0, matchesTotal = 0, plannedEntries = 0, stopPlan = false;
  function enumerate(p, display) {
    if (stopPlan) return;
    plannedEntries += 1;
    if (plannedEntries > MAX_SEARCH_FILES + MAX_SEARCH_DIRS) { incomplete = true; stopPlan = true; return; }
    if (dirs.length + files.length >= MAX_SEARCH_FILES || dirs.length >= MAX_SEARCH_DIRS) { incomplete = true; stopPlan = true; return; }
    let st;
    try { st = fs.lstatSync(p); } catch (e) { errors.push({ file: display, outcome: "error", error: String(e.message || e) }); incomplete = true; return; }
    if (st.isSymbolicLink()) {
      let real;
      try { real = fs.realpathSync(p); } catch { errors.push({ file: display, outcome: "error", error: "broken symlink" }); incomplete = true; return; }
      if (!isWithin(real, plan.grant.real)) { errors.push({ file: display, outcome: "rejected", error: "symlink escape" }); incomplete = true; return; }
      if (path.relative(plan.workspaceReal, real).split(path.sep).some(part => part === '.git' || part === '.codegraph')) {
        errors.push({ file: display, outcome: 'rejected', error: 'repository metadata alias' }); incomplete = true; return;
      }
      st = fs.statSync(real); p = real;
    }
    if (st.isDirectory()) {
      let real; try { real = fs.realpathSync(p); } catch { incomplete = true; return; }
      if (visited.has(real)) return;
      visited.add(real); dirs.push(display);
      let names; try { names = fs.readdirSync(p).sort(); } catch (e) { errors.push({ file: display, outcome: "error", error: String(e.message || e) }); incomplete = true; return; }
      for (const name of names) {
        if (stopPlan) break;
        if (name === ".git" || name === ".codegraph") continue;
        enumerate(path.join(p, name), display ? `${display}/${name}` : name);
      }
    } else if (st.isFile()) files.push({ path: p, file: display });
  }
  if (plan.isDir) enumerate(plan.real, ""); else files.push({ path: plan.real, file: path.basename(plan.target) });
  const scannedFiles = [];
  for (const entry of files) {
    if (bytes >= MAX_SEARCH_BYTES || scannedFiles.length >= MAX_SEARCH_FILES) { incomplete = true; break; }
    try {
      const allowance = Math.min(MAX_SEARCH_FILE_BYTES, MAX_SEARCH_BYTES - bytes);
      const { text, truncated: wasTruncated, size } = readTextBounded(entry.path, allowance);
      bytes += Math.min(size, allowance);
      const idx = text.indexOf(plan.query);
      const count = idx < 0 ? 0 : countMatches(text, plan.query);
      matchesTotal += count;
      const row = { file: entry.file, outcome: "scanned", bytes: Math.min(size, allowance), matches: count, truncated: wasTruncated };
      scannedFiles.push(row);
      if (idx >= 0 && results.length < MAX_SEARCH_MATCHES) results.push({ file: entry.file, matches: count, excerpt: excerpt(text, idx, plan.query).slice(0, MAX_SEARCH_EXCERPT), truncated: wasTruncated });
      if (wasTruncated || matchesTotal > MAX_SEARCH_MATCHES) incomplete = true;
    } catch (e) { scannedFiles.push({ file: entry.file, outcome: "error", error: String(e.message || e) }); incomplete = true; }
  }
  return { results, truncated: incomplete, incomplete, scannedFiles, errors, directoriesScanned: dirs.length, bytesScanned: bytes };
}

function executeOperation(plan, ctx) {
  try {
    if (plan.type === "read") {
      const { text, truncated } = readTextBounded(plan.real, MAX_READ_BYTES);
      return {
        type: "read",
        target: plan.target,
        authorized: true,
        outcome: "completed",
        result: text,
        truncated,
        error: null,
        basis: plan.basis,
        exitCode: null,
        repo: null,
      };
    }
    if (plan.type === "search") {
      const search = searchUnder(plan);
      const { results, truncated } = search;
      return {
        type: "search",
        target: plan.target,
        authorized: true,
        outcome: "completed",
        result: results,
        truncated,
        incomplete: truncated,
        scannedFiles: search.scannedFiles,
        errors: search.errors,
        directoriesScanned: search.directoriesScanned,
        bytesScanned: search.bytesScanned,
        error: null,
        basis: plan.basis,
        exitCode: null,
        repo: null,
      };
    }
    if (plan.type === "graph") {
      const status = repoStatus(ctx, plan.repoReal);
      if (!status.ok) {
        return {
          type: "graph",
          target: plan.target,
          repo: plan.repo,
          authorized: true,
          outcome: "graph-unavailable",
          result: null,
          truncated: false,
          error: `graph-unavailable: ${status.reason}`,
          basis: plan.basis,
          exitCode: status.exitCode ?? null,
          statusInvocation: status.invocation,
        };
      }
      const rawRun = ctx.runGraph(plan.repoReal, ["codegraph", plan.opName, plan.arg, "--json"]);
      const bounded = value => Buffer.from(String(value ?? "")).subarray(0, MAX_GRAPH_STDOUT_BYTES - 3).toString("utf8");
      const truncated = [rawRun.stdout, rawRun.stderr].some(value => Buffer.byteLength(String(value ?? "")) > MAX_GRAPH_STDOUT_BYTES - 3);
      const r = { ...rawRun, stdout: bounded(rawRun.stdout), stderr: bounded(rawRun.stderr) };
      let parseError = truncated ? "graph output exceeded limit" : null;
      if (r.status === 0 && !parseError) {
        try { JSON.parse(r.stdout); } catch { parseError = "graph query returned malformed JSON"; }
      }
      if (parseError) return { type: "graph", target: plan.target, repo: plan.repo, authorized: true, outcome: "error", result: r.stdout, stdout: r.stdout, stderr: r.stderr, argv: ["codegraph", plan.opName, plan.arg, "--json"], truncated, error: parseError, basis: plan.basis, exitCode: r.status ?? 1, statusInvocation: status.invocation };
      const raw = r.stdout;
      const result = raw;
      if ((r.status ?? 1) !== 0) {
        return {
          type: "graph",
          target: plan.target,
          repo: plan.repo,
          authorized: true,
          outcome: "error",
          result,
          stdout: raw,
          stderr: r.stderr ?? "",
          argv: ["codegraph", plan.opName, plan.arg, "--json"],
          statusInvocation: status.invocation,
          truncated,
          error: `graph query failed (exit ${r.status ?? 1}): ${r.stderr ?? ""}`,
          basis: plan.basis,
          exitCode: r.status ?? 1,
        };
      }
      return {
        type: "graph",
        target: plan.target,
        repo: plan.repo,
        authorized: true,
        outcome: "completed",
        result,
        stdout: raw,
        stderr: r.stderr ?? "",
        argv: ["codegraph", plan.opName, plan.arg, "--json"],
        statusInvocation: status.invocation,
        truncated,
        error: null,
        basis: plan.basis,
        exitCode: 0,
      };
    }
    return {
      type: plan.type ?? "unknown",
      target: plan.target ?? null,
      repo: plan.repo ?? null,
      authorized: false,
      outcome: "rejected",
      result: null,
      truncated: false,
      error: plan.error ?? "unexecutable operation",
      basis: null,
      exitCode: null,
    };
  } catch (e) {
    return {
      type: plan.type ?? "unknown",
      target: plan.target ?? null,
      repo: plan.repo ?? null,
      authorized: plan.authorized,
      outcome: "error",
      result: null,
      truncated: false,
      error: e && e.message ? e.message : String(e),
      basis: plan.basis ?? null,
      exitCode: null,
    };
  }
}

export function executeRequest(request, options = {}) {
  const runGraph = typeof options.runGraph === "function" ? options.runGraph : defaultRunGraph;

  if (!request || typeof request !== "object" || Array.isArray(request)) {
    return errorResult("request must be an object");
  }
  const allowedRequestFields = new Set(["authorization_confirmed", "workspace", "read_scope", "graph_ops", "operations"]);
  const unknownRequestField = Object.keys(request).find((key) => !allowedRequestFields.has(key));
  if (unknownRequestField) return errorResult(`unsupported request field: ${unknownRequestField}`);
  if (request.authorization_confirmed !== true) return errorResult("authorization list must be confirmed before business access");
  if (typeof request.workspace !== "string" || request.workspace.length === 0 || !path.isAbsolute(request.workspace)) {
    return errorResult("workspace must be an absolute path");
  }
  if (!Array.isArray(request.operations) || request.operations.length === 0) {
    return errorResult("operations must be a non-empty array");
  }

  let workspaceReal;
  try {
    workspaceReal = fs.realpathSync(request.workspace);
  } catch {
    return errorResult(`workspace not found: ${request.workspace}`);
  }

  const readScope = request.read_scope && typeof request.read_scope === "object" ? request.read_scope : {};
  const graphOps = request.graph_ops && typeof request.graph_ops === "object" ? request.graph_ops : {};
  if (Object.keys(readScope).some((key) => !["docs", "source"].includes(key))) return errorResult("unsupported read_scope field");
  if (Object.keys(graphOps).some((key) => !["repos", "queries"].includes(key))) return errorResult("unsupported graph_ops field");
  if (request.operations.length > MAX_OPERATIONS) return errorResult(`operations exceeds limit ${MAX_OPERATIONS}`);

  const docs = normalizeScopeList(readScope.docs, "read_scope.docs");
  const source = normalizeScopeList(readScope.source, "read_scope.source");
  const repos = normalizeRepoList(graphOps.repos);
  const queries = normalizeQueryList(graphOps.queries);
  const scopeError = docs.error || source.error || repos.error || queries.error;
  if (scopeError) {
    return errorResult(scopeError);
  }

  const readGrants = [];
  for (const item of [...docs.items, ...source.items]) {
    const abs = path.resolve(workspaceReal, item.path);
    if (!isWithin(abs, workspaceReal)) {
      return errorResult(`read grant escapes workspace: ${item.path}`);
    }
    try {
      const real = fs.realpathSync(abs);
      if (!isWithin(real, workspaceReal)) return errorResult(`read grant symlink escapes workspace: ${item.path}`);
      readGrants.push({ real, basis: item.basis, path: item.path });
    } catch {
      // 不存在的授权路径不授予任何读取能力
    }
  }

  const repoGrants = [];
  for (const item of repos.items) {
    if (!path.isAbsolute(item.repo)) {
      return errorResult("graph_ops.repos entries must be absolute paths");
    }
    let real;
    try {
      real = fs.realpathSync(item.repo);
    } catch {
      return errorResult(`graph repo not found: ${item.repo}`);
    }
    repoGrants.push({ real, basis: item.basis, repo: item.repo });
  }

  const ctx = {
    workspaceReal,
    readGrants,
    repoGrants,
    queryGrants: queries.items,
    runGraph,
    repoStatus: new Map(),
  };

  if (docs.items.length + source.items.length + repos.items.length + queries.items.length === 0) return errorResult("authorization basis must not be empty");
  const plans = request.operations.map((op) => {
    if (op && typeof op === "object") {
      const allowed = op.type === "read" ? ["type", "path"] : op.type === "search" ? ["type", "path", "query"] : op.type === "graph" ? ["type", "repo", "op", "arg"] : ["type"];
      const extra = Object.keys(op).find((key) => !allowed.includes(key));
      if (extra) return rejectPlan(op.type ?? "unknown", op.path ?? op.arg ?? null, `unsupported operation field: ${extra}`);
    }
    return validateOperation(op, ctx);
  });
  const firstRejected = plans.find((p) => !p.authorized);
  if (firstRejected) {
    return {
      ok: false,
      outcome: "rejected",
      workspace: request.workspace,
      operations: plans.map((p) => ({
        type: p.type,
        target: p.target ?? null,
        repo: p.repo ?? null,
        authorized: p.authorized,
        outcome: "rejected",
        result: null,
        truncated: false,
        error: p.authorized ? `batch rejected: ${firstRejected.error}` : p.error,
        basis: p.authorized ? p.basis : null,
        exitCode: null,
      })),
      error: firstRejected.error,
    };
  }

  const receipts = [];
  let graphUnavailable = false;
  for (const plan of plans) {
    if (graphUnavailable && plan.type === "graph") {
      receipts.push({ type: "graph", target: plan.target, repo: plan.repo, authorized: true, outcome: "graph-unavailable", result: null, truncated: false, error: "graph-unavailable: earlier graph operation unavailable", basis: plan.basis, exitCode: null });
      continue;
    }
    const receipt = executeOperation(plan, ctx);
    receipts.push(receipt);
    if (receipt.type === "graph" && receipt.outcome !== "completed") graphUnavailable = true;
  }
  const allCompleted = receipts.every((r) => r.outcome === "completed" && r.truncated !== true);
  const firstFailure = receipts.find((r) => r.outcome !== "completed" || r.truncated === true);
  return {
    ok: allCompleted,
    outcome: allCompleted ? "completed" : "partial",
    workspace: request.workspace,
    operations: receipts,
    error: allCompleted ? null : firstFailure ? firstFailure.error : "partial failure",
  };
}

export function runRequestFile(requestFile, options = {}) {
  let request;
  try {
    request = JSON.parse(fs.readFileSync(requestFile, "utf8"));
  } catch (e) {
    return errorResult(`cannot read request: ${e && e.message ? e.message : String(e)}`);
  }
  return executeRequest(request, options);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    process.stdout.write(JSON.stringify({
      ok: false,
      outcome: "error",
      workspace: null,
      operations: [],
      error: "usage: node authorized-operations.mjs <request.json>",
    }, null, 2) + "\n");
    process.exitCode = 2;
    return;
  }
  const result = runRequestFile(args[0]);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exitCode = result.ok ? 0 : result.outcome === "error" ? 2 : 1;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main();
}
