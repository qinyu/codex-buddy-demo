#!/usr/bin/env node
// Adapter-owned argv and result parsing; stage consumers receive facts, never approval.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function runVerification({ implementation, cwd, files = [], required = true, waived = false } = {}) {
  const result = { capability: 'verification', implementation: implementation || '', status: 'incomplete', approved: false, tests: 0, exitCode: null, stdout: '', stderr: '', command: [], reason: '' };
  if (!['node-test', 'python-unittest'].includes(implementation)) {
    return { ...result, status: required ? 'incomplete' : 'substituted', reason: required ? '缺少必需验证实现；豁免不构成通过' : '改用项目既有验证；尚未执行' };
  }
  if (!cwd || !Array.isArray(files) || !files.length || files.some(f => typeof f !== 'string' || !f || f.startsWith('-'))) {
    return { ...result, reason: '需要工作区和显式测试文件' };
  }
  let sources;
  try {
    if (!fs.statSync(cwd).isDirectory()) return { ...result, reason: '缺少可用工作区' };
    sources = files.map(file => fs.readFileSync(path.resolve(cwd, file), 'utf8'));
  } catch {
    return { ...result, reason: '缺少工作区或测试文件不可读' };
  }
  const command = implementation === 'node-test'
    ? [process.execPath, '--test', '--test-reporter=tap', ...files.map(f => path.resolve(cwd, f))]
    : ['python3', '-m', 'unittest', ...files];
  const env = { ...process.env };
  // A caller may itself run under node --test; the child is an independent test run.
  delete env.NODE_TEST_CONTEXT;
  const ran = spawnSync(command[0], command.slice(1), { cwd, env, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
  const stdout = ran.stdout || '';
  const stderr = ran.stderr || '';
  const emptySource = sources.some(source => !/\b(?:test|it|describe)\s*\(|\bdef\s+test_|\bclass\s+\w+\s*\(\s*unittest\.TestCase\s*\)/.test(source));
  const tests = Number((implementation === 'node-test' ? stdout.match(/^# tests (\d+)$/m) : stderr.match(/^Ran (\d+) tests? in /m))?.[1] || 0);
  const skipped = Number((implementation === 'node-test' ? stdout.match(/^# skipped (\d+)$/m) : stderr.match(/skipped=(\d+)/))?.[1] || 0);
  const todo = Number((implementation === 'node-test' ? stdout.match(/^# todo (\d+)$/m) : null)?.[1] || 0);
  const nodePoints = [...stdout.matchAll(/^(ok|not ok) \d+/gm)];
  const pythonOk = /^OK(?: \(skipped=\d+\))?$/m.test(stderr);
  const executed = implementation === 'node-test' ? nodePoints.some((match) => match[1] === 'ok') && !nodePoints.some((match) => match[1] === 'not ok') : pythonOk && tests > skipped;
  const passed = !emptySource && !ran.error && ran.status === 0 && executed && tests > skipped + todo;
  return { ...result, command, stdout, stderr, tests, skipped, todo, exitCode: ran.status, status: passed ? 'passed' : 'incomplete', reason: passed ? '' : ran.error?.message || '测试失败或没有实际执行测试' };
}

function sameFile(left, right) {
  try { return fs.realpathSync(left) === fs.realpathSync(right); } catch { return false; }
}

if (process.argv[1] && sameFile(process.argv[1], fileURLToPath(import.meta.url))) {
  const [implementation, cwd, ...files] = process.argv.slice(2);
  const result = runVerification({ implementation, cwd, files });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.status === 'passed' ? 0 : 1;
}
