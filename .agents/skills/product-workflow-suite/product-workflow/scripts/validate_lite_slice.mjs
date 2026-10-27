#!/usr/bin/env node
// 校验 lite 切片的文件、短模板章节和状态。用于实现后/收尾前，不替代逐阶段 state 校验。
import { spawnSync } from 'node:child_process';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateFile, canonicalStatus, validateWorkflowState } from './validate_workflow_state.mjs';

const REQUIRED = ['prd.md', 'development-plan.md', 'develop.md', '.workflow-state.json'];
const CUT_STAGES = [
  ['clarify', 'clarify.md'],
  ['project-wiki', 'project-wiki.md'],
  ['prototype', 'prototype.html'],
  ['stitch-prototype', 'stitch-prototype.md'],
  ['test-cases', 'test-cases.md'],
  ['test-automation', 'automation-test-plan.md'],
  ['technical-solution', 'technical-solution.md'],
  ['start-implement', 'start-implement.md'],
];

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function hasHeading(text, name) {
  return new RegExp(`^#{1,6}\\s+.*${name}`, 'm').test(text);
}

export async function validateLiteSlice(target, options = {}) {
  const root = path.resolve(target);
  const errors = [];
  const warnings = [];
  for (const name of REQUIRED) {
    if (!(await exists(path.join(root, name)))) errors.push(`缺少 ${name}`);
  }
  if (errors.length) return { root, errors, warnings };

  const stateReport = await validateFile(path.join(root, '.workflow-state.json'));
  errors.push(...stateReport.errors);
  warnings.push(...stateReport.warnings);
  let state;
  try {
    state = JSON.parse((await fs.readFile(path.join(root, '.workflow-state.json'), 'utf8')).replace(/^\uFEFF/, ''));
  } catch {
    return { root, errors, warnings };
  }
  if (state.run_mode !== 'lite') errors.push(`run_mode 必须是 lite，当前 ${state.run_mode ?? '未写'}`);

  const stages = state.stages || state.phases || {};
  if (canonicalStatus(stages.prd) !== 'Reviewed') errors.push('lite 开工/收尾前 prd 必须为 Reviewed');
  if (canonicalStatus(stages['development-plan']) !== 'Draft') errors.push('lite development-plan 必须为 Draft（不单独请求批准）');
  const developStatus = canonicalStatus(stages.develop);
  if (!['Draft', 'Reviewed'].includes(developStatus)) errors.push('lite develop 必须为 Draft 或 Reviewed');
  for (const [id, file] of CUT_STAGES) {
    if (await exists(path.join(root, file))) errors.push(`lite 不生成 ${file}`);
    const value = stages[id];
    if (canonicalStatus(value) !== 'Not Applicable') {
      errors.push(`lite stages.${id} 必须为 Not Applicable`);
    } else if (!value || typeof value !== 'object' || !value.reason) {
      errors.push(`lite stages.${id} 缺裁剪原因`);
    }
  }

  const prd = await fs.readFile(path.join(root, 'prd.md'), 'utf8');
  for (const heading of ['范围', '验收', '验证', '不做']) {
    if (!hasHeading(prd, heading)) errors.push(`prd.md 缺「${heading}」章节`);
  }
  if (!/自动化测试[^\n]*(不适用|裁剪|原因)/.test(prd)) errors.push('prd.md 缺自动化测试裁剪原因');
  if (!/技术方案[^\n]*(不适用|裁剪|原因)/.test(prd)) errors.push('prd.md 缺技术方案裁剪原因');
  if (options.testAutomationRequired) {
    const override = (Array.isArray(state.explicit_overrides) ? state.explicit_overrides : [])
      .find((item) => item?.policy === 'workflow_policy.test_automation');
    if (!override || !override.reason || !override.risk || !override.recovery) {
      errors.push('配置要求自动化测试：lite 必须记录 workflow_policy.test_automation 的 explicit_override（reason/risk/recovery）');
    }
    if (!/explicit_override/i.test(prd)) errors.push('prd.md 缺 test_automation explicit_override 记录');
  }
  const plan = await fs.readFile(path.join(root, 'development-plan.md'), 'utf8');
  if (!/TASK-\d+/i.test(plan)) errors.push('development-plan.md 缺 TASK 编号');
  if (!hasHeading(plan, '验证命令')) errors.push('development-plan.md 缺「验证命令」章节');
  const develop = await fs.readFile(path.join(root, 'develop.md'), 'utf8');
  if (!hasHeading(develop, '验证证据')) errors.push('develop.md 缺「验证证据」章节');
  if (!/(通过|失败|阻断|未执行)/.test(develop)) errors.push('develop.md 未如实记录验证结果');

  return { root, errors, warnings };
}

const NETWORK_COMMANDS = new Set(['curl', 'wget', 'ssh', 'nc', 'npx']);

export function localCommandAllowed(command, { portal = 'off', phase } = {}) {
  const [bin, ...args] = command;
  if (NETWORK_COMMANDS.has(bin) || /https?:\/\//.test([bin, ...args].join(' '))) return false;
  return bin === 'git';
}

function defaultRun(command, cwd) {
  if (command[0] === 'limix') return { status: 1, stdout: '', stderr: '未授权调用 limix' };
  const result = spawnSync(command[0], command.slice(1), { cwd, encoding: 'utf8' });
  return { status: result.status ?? 1, stdout: result.stdout || '', stderr: result.stderr || '' };
}

function runAt(run, command, cwd) {
  return run.length > 1 ? run(command, cwd) : run(command);
}

async function readJson(file) {
  return JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
}

async function findProjectRoot(slice) {
  let current = path.dirname(slice);
  while (current !== path.dirname(current)) {
    try {
      await fs.access(path.join(current, '.product-workflow-config.json'));
      return current;
    } catch {
      current = path.dirname(current);
    }
  }
  return path.resolve(slice, '../../..');
}

function quotedFiles(line) {
  return line.split('`').filter((_, index) => index % 2 === 1);
}

function taskScope(plan, key) {
  const lines = plan.split(/\r?\n/);
  const start = lines.findIndex((line) => line.includes(key));
  if (start < 0) return [];
  const files = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith('#') || /TASK-\d+/.test(lines[index])) break;
    if (!lines[index].includes('文件范围')) continue;
    files.push(...quotedFiles(lines[index]));
  }
  return files;
}

function reuseRecorded(text) {
  if (!text.includes('复用已有测试')) return true;
  const basis = (text.split(/\r?\n/).find((line) => line.includes('覆盖依据：')) || '').split('覆盖依据：')[1] || '';
  const round = (text.split(/\r?\n/).find((line) => line.includes('本轮执行：')) || '').split('本轮执行：')[1] || '';
  return Boolean(basis.trim() && round.trim() && !round.includes('未执行'));
}

function resultPasses(lines, index) {
  const result = lines[index].slice(lines[index].indexOf('结果：') + 3);
  if (!result.trim() || /未通过|失败|未执行|阻断/.test(result) || !result.includes('通过')) return false;
  const nearby = lines.slice(Math.max(0, index - 1), index + 2).join('\n');
  return /退出码[:：]?\s*0|exit\s+0/.test(nearby);
}

function verificationSupports(text) {
  const lines = text.split(/\r?\n/);
  const groups = new Map();
  let task = '';
  lines.forEach((line, index) => {
    const heading = line.match(/TASK-\d+/);
    if (heading) task = heading[0];
    if (!line.includes('结果：')) return;
    const key = task || `line-${index}`;
    groups.set(key, index);
  });
  if (!groups.size) return false;
  return [...groups.values()].every((index) => resultPasses(lines, index));
}

export async function checkLocalCloseout(sliceDir, options = {}) {
  const slice = path.resolve(sliceDir);
  const run = options.run || ((command, cwd) => defaultRun(command, cwd));
  const missing = [];
  const notices = [];
  const skipped = [];
  const stateFile = path.join(slice, '.workflow-state.json');
  const state = await readJson(stateFile);
  const structural = validateWorkflowState(state);
  if (structural.errors.length) missing.push(...structural.errors);

  const projectRoot = options.projectRoot || await findProjectRoot(slice);
  const configFile = path.join(projectRoot, '.product-workflow-config.json');
  const config = await readJson(configFile);
  const portal = config.portal_sync || 'off';
  function runChecked(command, cwd) {
    if (!localCommandAllowed(command, { portal, phase: options.phase })) {
      missing.push(`收工检查拒绝联网或未声明命令：${command.join(' ')}`);
      return { status: 1, stdout: '', stderr: '' };
    }
    return runAt(run, command, cwd);
  }
  // This checker establishes local facts only; portal synchronization is a separate operation.
  if (portal === 'bound_project') {
    notices.push(options.phase === 'start' ? '门户未同步：本地开发继续' : '门户未同步：本地收工继续');
  }

  const targets = (state.tasks || []).filter((task) => task?.status === 'done').map((task) => task.key);
  if (options.phase !== 'start' && !targets.length) missing.push('tasks[] 没有显式 done 的目标任务');
  const plan = await fs.readFile(path.join(slice, 'development-plan.md'), 'utf8').catch(() => '');
  if (!plan) missing.push('缺少 development-plan.md');
  const scope = targets.flatMap((key) => taskScope(plan, key));
  if (options.phase !== 'start' && targets.length && !scope.length) missing.push('已批准开发计划缺少目标任务的文件范围');

  const develop = (state.stages || {}).develop;
  if (options.phase !== 'start' && (canonicalStatus(develop) !== 'Reviewed' || !develop?.reviewed_by || !develop?.review_source)) {
    missing.push('develop 验证证据缺少对应该报告的 Reviewed');
  } else if (develop?.review_source) {
    const approved = path.resolve(slice, develop.review_source);
    const evidence = await fs.readFile(approved, 'utf8').catch(() => '');
    if (!verificationSupports(evidence)) missing.push('本轮验证缺失或失败，不能宣称完成');
    else if (!reuseRecorded(evidence)) missing.push('复用已有测试缺少覆盖依据或本轮执行记录');
  }

  let committed = false;
  const gitProbe = runChecked(['git', 'rev-parse', '--show-toplevel'], projectRoot);
  const toplevel = (gitProbe.stdout || '').trim();
  const sameRepository = gitProbe.status === 0 && toplevel && fsSync.existsSync(toplevel) && fsSync.realpathSync(toplevel) === fsSync.realpathSync(projectRoot);
  if (!sameRepository) {
    skipped.push('没有 .git，跳过提交核对，不报成已提交');
    if (options.phase !== 'start') missing.push('没有 .git，不能把计划范围报成已提交');
  } else if (options.phase !== 'start') {
    const status = runChecked(['git', 'status', '--short', '--', ...scope], projectRoot);
    const log = runChecked(['git', 'log', '-1', '--format=%s', '--', ...scope], projectRoot);
    const subject = (log.stdout || '').trim();
    committed = status.status === 0 && !(status.stdout || '').trim() && targets.every((key) => subject.includes(key));
    if (!committed) missing.push('计划文件范围没有指向该 TASK 的合格提交，或仍有未提交改动');
  }

  const ok = missing.length === 0;
  const wrapUp = ok && options.phase !== 'start'
    ? { at: options.now || new Date().toISOString(), portal_sync: portal }
    : undefined;
  return { ok, missing, notices, skipped, committed, portal, wrapUp };
}

export async function writeLocalWrapUp(sliceDir, options = {}) {
  const report = await checkLocalCloseout(sliceDir, options);
  if (!report.ok || !report.wrapUp) return { ...report, wrote: false };
  const stateFile = path.join(path.resolve(sliceDir), '.workflow-state.json');
  const state = JSON.parse((await fs.readFile(stateFile, 'utf8')).replace(/^\uFEFF/, ''));
  state.slice_wrap_up = report.wrapUp;
  await fs.writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`);
  return { ...report, wrote: true };
}

function format({ root, errors, warnings }) {
  return [
    errors.length ? `lite 切片校验失败：${root}` : `lite 切片校验通过：${root}`,
    ...errors.map((line) => `错误  ${line}`),
    ...warnings.map((line) => `提醒  ${line}`),
  ].join('\n');
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write('用法：node validate_lite_slice.mjs <workflow-dir>\n');
    return 0;
  }
  const target = argv.find((arg) => !arg.startsWith('--'));
  if (!target) {
    process.stderr.write('用法：node validate_lite_slice.mjs <workflow-dir>\n');
    return 1;
  }
  const report = await validateLiteSlice(target, { testAutomationRequired: argv.includes('--test-automation-required') });
  process.stdout.write(`${format(report)}\n`);
  return report.errors.length ? 1 : 0;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    process.stderr.write(`${error.message || error}\n`);
    process.exitCode = 1;
  });
}
