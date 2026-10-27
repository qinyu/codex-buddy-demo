#!/usr/bin/env node
// 校验 .workflow-state.json。规则来源：product-workflow-suite/product-setup/references/charter-rules.md § 状态转移，
// product-workflow-suite/product-workflow/references/common-contracts.md § 状态转移规则、§ 看板。
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const STATUS_ENUM = ['Draft', 'Reviewed', 'Blocked', 'Not Generated', 'Not Applicable'];
export const TASK_RESULTS = ['todo', 'doing', 'done', 'blocked'];
export const RUN_MODES = ['stage-gated', 'through-run', 'lite'];
export const KNOWN_STAGES = [
  'product-setup',
  'product-init', // persisted legacy state, not an invocable skill alias
  'clarify',
  'project-wiki',
  'prd',
  'prototype',
  'stitch-prototype',
  'test-cases',
  'test-automation',
  'technical-solution',
  'development-plan',
  'start-implement',
  'develop',
  'unit-test-init',
  'git-hook-init',
  'wrap-up',
];

const STATUS_ALIASES = {
  draft: 'Draft',
  reviewed: 'Reviewed',
  approved: 'Reviewed',
  done: 'Reviewed',
  blocked: 'Blocked',
  'not generated': 'Not Generated',
  'not-generated': 'Not Generated',
  not_generated: 'Not Generated',
  empty: 'Not Generated',
  missing: 'Not Generated',
  'not applicable': 'Not Applicable',
  'not-applicable': 'Not Applicable',
  not_applicable: 'Not Applicable',
  na: 'Not Applicable',
  'n/a': 'Not Applicable',
  '草稿': 'Draft',
  '已评审': 'Reviewed',
  '阻断': 'Blocked',
  '未生成': 'Not Generated',
  '不适用': 'Not Applicable',
};

export function canonicalStatus(value) {
  const raw = typeof value === 'object' && value ? value.status : value;
  if (raw === undefined || raw === null) return null;
  const text = String(raw).trim();
  return STATUS_ALIASES[text.toLowerCase()] || STATUS_ALIASES[text] || null;
}

export function validateWorkflowState(state) {
  const errors = [];
  const warnings = [];
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return { errors: ['state 必须是 JSON 对象'], warnings };
  }

  if (state.schema_version !== undefined && state.schema_version !== 1) {
    errors.push(`schema_version="${state.schema_version}"：当前只支持 1`);
  }

  const stages = state.stages ?? state.phases;
  if (stages === undefined || stages === null) {
    warnings.push('缺少 stages 对象，看板所有阶段按文件存在与否推断状态');
  } else if (typeof stages !== 'object' || Array.isArray(stages)) {
    errors.push('stages 必须是对象');
  } else {
    for (const [id, value] of Object.entries(stages)) {
      if (!KNOWN_STAGES.includes(id)) warnings.push(`stages.${id}：未知阶段 id`);
      if (typeof value === 'string') {
        warnings.push(`stages.${id}：状态应写成对象 { "status": "..." }，当前是字符串`);
      } else if (!value || typeof value !== 'object') {
        errors.push(`stages.${id}：必须是对象`);
        continue;
      }
      const rawStatus = typeof value === 'object' ? value.status : value;
      if (rawStatus === undefined) {
        errors.push(`stages.${id}：缺少 status`);
        continue;
      }
      const status = canonicalStatus(value);
      if (!status) {
        errors.push(`stages.${id}.status="${rawStatus}"：不在枚举 ${STATUS_ENUM.join(' / ')}`);
        continue;
      }
      if (typeof value !== 'object') continue;
      if (value.revising !== undefined && typeof value.revising !== 'boolean') {
        errors.push(`stages.${id}.revising：必须是 boolean`);
      }
      if (value.revising === true && status !== 'Draft') {
        errors.push(`stages.${id}：revising=true 只能挂在 Draft，当前 ${status}`);
      }
      if (status === 'Reviewed' && !value.reviewed_by && !value.reviewed_at && !value.approved_by) {
        warnings.push(`stages.${id}：Reviewed 缺 reviewed_by / reviewed_at；Reviewed 是人专用状态，应记录谁批准`);
      }
      if ((status === 'Not Applicable' || status === 'Blocked') && !value.reason) {
        warnings.push(`stages.${id}：${status} 缺 reason`);
      }
    }
  }

  if (state.current_stage === undefined && state.currentStage === undefined) {
    warnings.push('缺少 current_stage，看板默认落在 clarify');
  } else {
    const current = state.current_stage ?? state.currentStage;
    if (!KNOWN_STAGES.includes(current)) errors.push(`current_stage="${current}"：不是已知阶段 id`);
  }

  if (state.run_mode === undefined) {
    warnings.push(`缺少 run_mode（${RUN_MODES.join(' / ')}）`);
  } else if (!RUN_MODES.includes(state.run_mode)) {
    errors.push(`run_mode="${state.run_mode}"：不在 ${RUN_MODES.join(' / ')}`);
  }

  if (state.explicit_overrides !== undefined) {
    if (!Array.isArray(state.explicit_overrides)) {
      errors.push('explicit_overrides 必须是数组');
    } else {
      state.explicit_overrides.forEach((override, index) => {
        for (const key of ['policy', 'reason', 'risk', 'recovery']) {
          if (!override || !override[key]) errors.push(`explicit_overrides[${index}] 缺 ${key}`);
        }
      });
    }
  }

  if (state.slice_wrap_up !== undefined) {
    const wrap = state.slice_wrap_up;
    if (!wrap || typeof wrap !== 'object') {
      errors.push('slice_wrap_up 必须是对象');
    } else {
      if (!wrap.at) errors.push('slice_wrap_up 缺 at');
      if (wrap.portal_sync !== 'off' && wrap.portal_sync !== 'bound_project') {
        errors.push('slice_wrap_up.portal_sync 必须是 off 或 bound_project');
      }
    }
  }

  if (state.tasks !== undefined) {
    if (!Array.isArray(state.tasks)) {
      errors.push('tasks 必须是数组');
    } else {
      const seen = new Set();
      state.tasks.forEach((task, index) => {
        if (!task || typeof task !== 'object' || Array.isArray(task)) {
          errors.push(`tasks[${index}]：必须是对象`);
          return;
        }
        if (!/^TASK-\d+$/.test(task.key || '')) errors.push(`tasks[${index}].key：必须是 TASK-编号`);
        if (seen.has(task.key)) errors.push(`tasks[${index}].key="${task.key}"：重复`);
        seen.add(task.key);
        if (!task.title) errors.push(`tasks[${index}] 缺 title`);
        if (!TASK_RESULTS.includes(task.status)) {
          errors.push(`tasks[${index}].status="${task.status}"：不在 ${TASK_RESULTS.join(' / ')}`);
        }
      });
    }
  }

  if (state.waivers !== undefined) {
    if (!Array.isArray(state.waivers)) {
      errors.push('waivers 必须是数组');
    } else {
      state.waivers.forEach((waiver, index) => {
        for (const key of ['task', 'owner', 'reason', 'waived_at']) {
          if (!waiver || !waiver[key]) errors.push(`waivers[${index}] 缺 ${key}`);
        }
        if (waiver?.stage && !KNOWN_STAGES.includes(waiver.stage)) {
          errors.push(`waivers[${index}].stage="${waiver.stage}"：不是已知阶段 id`);
        }
      });
    }
  }

  return { errors, warnings };
}

export async function loadState(target) {
  const resolved = path.resolve(target);
  const stat = await fs.stat(resolved);
  const file = stat.isDirectory() ? path.join(resolved, '.workflow-state.json') : resolved;
  let text = await fs.readFile(file, 'utf8');
  const bom = text.charCodeAt(0) === 0xfeff;
  if (bom) text = text.slice(1);
  return { file, state: JSON.parse(text), bom };
}

export async function validateFile(target) {
  let loaded;
  try {
    loaded = await loadState(target);
  } catch (error) {
    return { file: target, errors: [`无法读取或解析：${error.message}`], warnings: [] };
  }
  const result = validateWorkflowState(loaded.state);
  if (loaded.bom) result.warnings.unshift('文件带 BOM，应保存为 UTF-8 无 BOM');
  return { file: loaded.file, ...result };
}

export function formatReport({ file, errors, warnings }) {
  const head = errors.length ? `state 校验失败：${file}` : `state 校验通过：${file}`;
  return [
    head,
    ...errors.map((line) => `错误  ${line}`),
    ...warnings.map((line) => `提醒  ${line}`),
  ].join('\n');
}

function usage() {
  return '用法：node validate_workflow_state.mjs <workflow-dir|state-file> [--strict]';
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  const target = argv.find((arg) => !arg.startsWith('--'));
  if (!target) {
    process.stderr.write(`${usage()}\n`);
    return 1;
  }
  const strict = argv.includes('--strict');
  const report = await validateFile(target);
  process.stdout.write(`${formatReport(report)}\n`);
  if (report.errors.length) return 1;
  if (strict && report.warnings.length) return 1;
  return 0;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    process.stderr.write(`${error.message || error}\n`);
    process.exitCode = 1;
  });
}
