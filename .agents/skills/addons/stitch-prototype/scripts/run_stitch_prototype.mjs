#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { summarizeStitchEvidence, retainStitchRun } from '../../../scripts/stitch-evidence.mjs'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const VALID_DEVICE_TYPES = new Set(['MOBILE', 'DESKTOP', 'TABLET', 'AGNOSTIC'])

function parseArgs(argv) {
  const options = {
    adapter: 'real',
    deviceType: 'DESKTOP',
    projectTitle: 'Stitch Prototype',
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]
    if (arg === '--workflow-dir') {
      options.workflowDir = next
      index += 1
    } else if (arg === '--project-id') {
      options.projectId = next
      index += 1
    } else if (arg === '--project-title') {
      options.projectTitle = next
      index += 1
    } else if (arg === '--device-type') {
      options.deviceType = next
      index += 1
    } else if (arg === '--adapter') {
      options.adapter = next
      index += 1
    } else if (arg === '--mock-response') {
      options.mockResponse = next
      index += 1
    } else if (arg === '--help' || arg === '-h') {
      options.help = true
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (options.deviceType && !VALID_DEVICE_TYPES.has(options.deviceType)) {
    throw new Error(`--device-type must be one of ${Array.from(VALID_DEVICE_TYPES).join(', ')}`)
  }

  return options
}

function usage() {
  return `Usage: node run_stitch_prototype.mjs --workflow-dir <dir> [options]

Options:
  --adapter mock|real
  --mock-response <json>
  --project-id <id>
  --project-title <title>
  --device-type MOBILE|DESKTOP|TABLET|AGNOSTIC
`
}

function readOptional(workflowDir, fileName) {
  const file = join(workflowDir, fileName)
  return existsSync(file) ? readFileSync(file, 'utf8') : ''
}

function headingLevel(line) {
  const match = /^(#{1,6})\s+/.exec(line)
  return match ? match[1].length : 0
}

function extractExperienceContext(prd) {
  const lines = prd.split(/\r?\n/)
  const start = lines.findIndex((line) => /体验意图与界面依据|体验意图|界面依据/.test(line))
  if (start < 0) return ''

  const startLevel = headingLevel(lines[start]) || 2
  const end = lines.findIndex(
    (line, index) => index > start && headingLevel(line) > 0 && headingLevel(line) <= startLevel,
  )
  return lines
    .slice(start, end >= 0 ? end : undefined)
    .join('\n')
    .trim()
}

function extractCoverageItems(contextText) {
  return contextText
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((line) => {
      if (!line) return false
      if (/^#{1,6}\s+/.test(line)) return true
      if (/^\s*[-*]\s+/.test(line)) return true
      if (/^\s*\d+\.\s+/.test(line)) return true
      if (/^\|/.test(line) && !/^\|\s*-+/.test(line)) return true
      return false
    })
}

function splitMarkdownTableRow(line) {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function extractStateCoverage(contextText) {
  const lines = contextText.split(/\r?\n/)
  const start = lines.findIndex((line) => /状态覆盖/.test(line))
  if (start < 0) return ['空状态', '加载中/处理中', '失败/异常']

  const sectionLevel = headingLevel(lines[start]) || 6
  const sectionLines = lines.slice(start + 1)
  const states = []
  for (const line of sectionLines) {
    const currentLevel = headingLevel(line)
    if (currentLevel > 0 && currentLevel <= sectionLevel) break
    const trimmed = line.trim()
    if (!trimmed || /^\|\s*-+/.test(trimmed)) continue
    if (/^\|/.test(trimmed)) {
      const [state] = splitMarkdownTableRow(trimmed)
      if (state && !/状态|触发条件/.test(state)) states.push(state)
    } else if (/^\s*[-*]\s+/.test(trimmed)) {
      states.push(trimmed.replace(/^\s*[-*]\s+/, '').split(/[：:]/)[0].trim())
    }
  }

  return states.length ? states : ['空状态', '加载中/处理中', '失败/异常']
}

function buildPrompt({ projectWiki, prd, projectTitle, deviceType }) {
  const experienceContext = prd.trim() || '未提供 PRD。'
  const projectContext = projectWiki.trim() || '未提供 project-wiki.md，请仅使用 PRD 中的事实。'

  return `你是 Stitch 中的产品原型设计 agent。请为「${projectTitle}」生成 ${deviceType} UI 原型。

只使用下面的项目上下文和 PRD。缺少的页面、按钮、字段或状态标为缺口，不从其他产品补内容。

项目代码上下文：
${projectContext}

PRD 业务范围与体验意图：
${experienceContext}

输出要求：
- 生成可评审的关键 screen/frame，而不是营销落地页。
- 每个主流程节点都要覆盖正常、空、处理中、失败或权限限制等状态。
- 使用 PRD 中的真实字段和示例数据，不要编造已批准事实。
- 保留业务红线，尤其是错误与失败状态必须在界面内可见。`
}

function pickProjectId(result) {
  if (!result || typeof result !== 'object') return ''
  return (
    result.projectId ||
    result.project_id ||
    result.id ||
    String(result.name || '').replace(/^projects\//, '')
  )
}

function normalizeScreens(rawScreens) {
  return rawScreens.map((screen, index) => ({
    id: screen.id || screen.screenId || `screen-${index + 1}`,
    title: screen.title || screen.name || screen.id || `Screen ${index + 1}`,
    htmlUrl: screen.htmlUrl || screen.html || screen.htmlDownloadUrl || '',
    imageUrl: screen.imageUrl || screen.image || screen.imageDownloadUrl || '',
  }))
}

async function runMockAdapter(options) {
  if (!options.mockResponse) {
    throw new Error('--mock-response is required when --adapter mock')
  }
  const mock = JSON.parse(readFileSync(resolve(options.mockResponse), 'utf8'))
  return {
    status: 'Draft',
    authStatus: 'Mocked',
    toolName: '@google/stitch-sdk mock adapter',
    supportedOperations: mock.capabilities || ['project.generate', 'screen.getHtml', 'screen.getImage'],
    projectId: mock.projectId || 'mock-project',
    projectUrl: mock.projectUrl || '',
    generatedAt: mock.generatedAt || new Date().toISOString(),
    screens: normalizeScreens(mock.screens || []),
    failureSummary: '',
    recoveryPath: '',
  }
}

async function runRealAdapter(options, prompt) {
  const hasApiKey = Boolean(process.env.STITCH_API_KEY)
  const hasOAuth = Boolean(process.env.STITCH_ACCESS_TOKEN && process.env.GOOGLE_CLOUD_PROJECT)
  if (!hasApiKey && !hasOAuth) {
    return blockedResult(
      'Missing Stitch SDK credentials: set STITCH_API_KEY, or set STITCH_ACCESS_TOKEN together with GOOGLE_CLOUD_PROJECT.',
      '配置 Stitch SDK 认证后重试本阶段。不得自动降级为 HTML。',
    )
  }

  let sdk
  try {
    sdk = await import('@google/stitch-sdk')
  } catch (error) {
    return blockedResult(
      `Unable to import @google/stitch-sdk: ${error.message}`,
      '安装 @google/stitch-sdk 后重试本阶段。不得自动降级为 HTML。',
    )
  }

  try {
    const { stitch } = sdk
    let projectId = options.projectId
    if (!projectId) {
      const created = await stitch.callTool('create_project', { title: options.projectTitle })
      projectId = pickProjectId(created)
    }
    if (!projectId) {
      return blockedResult(
        'Stitch SDK create_project did not return a project id.',
        '确认 Stitch SDK create_project 返回结构后重试。不得自动降级为 HTML。',
      )
    }

    const project = stitch.project(projectId)
    const screen = await project.generate(prompt, options.deviceType)
    const htmlUrl = await screen.getHtml()
    const imageUrl = await screen.getImage()
    return {
      status: 'Draft',
      authStatus: hasApiKey ? 'STITCH_API_KEY' : 'OAuth token + GOOGLE_CLOUD_PROJECT',
      toolName: '@google/stitch-sdk real adapter',
      supportedOperations: ['create_project', 'project.generate', 'screen.getHtml', 'screen.getImage'],
      projectId,
      projectUrl: `https://stitch.withgoogle.com/projects/${projectId}`,
      generatedAt: new Date().toISOString(),
      screens: normalizeScreens([
        {
          id: screen.id || screen.screenId,
          title: options.projectTitle,
          htmlUrl,
          imageUrl,
        },
      ]),
      failureSummary: '',
      recoveryPath: '',
    }
  } catch (error) {
    return blockedResult(
      `Stitch SDK execution failed: ${error.message}`,
      '检查 Stitch 权限、项目写入能力、配额和网络后重试。不得自动降级为 HTML。',
    )
  }
}

function blockedResult(failureSummary, recoveryPath) {
  return {
    status: 'Blocked',
    authStatus: 'Unavailable',
    toolName: '@google/stitch-sdk real adapter',
    supportedOperations: [],
    projectId: '',
    projectUrl: '',
    generatedAt: new Date().toISOString(),
    screens: [],
    failureSummary,
    recoveryPath,
  }
}

function renderArtifact({ result, prompt, coverageItems, states, workflowDir }) {
  const screenRows = result.screens.length
    ? result.screens
        .map(
          (screen) =>
            `| ${screen.title} | ${screen.id} | ${screen.htmlUrl || '未返回'} | ${
              screen.imageUrl || '未返回'
            } |`,
        )
        .join('\n')
    : '| 未生成 | 未返回 | 未返回 | 未返回 |'

  const coverageRows = coverageItems.length
    ? coverageItems
        .map((line) => `| ${line.replace(/\|/g, '\\|')} | ${result.status === 'Draft' ? '已写入 Stitch prompt' : 'Blocked，待 Stitch SDK 恢复后验证'} |`)
        .join('\n')
    : '| 业务范围与体验意图 | PRD 未提供独立章节，已要求 Stitch 从 PRD 正文提取，待人工确认覆盖 |'

  const stateRows = states
    .slice(0, Math.max(3, states.length))
    .map((state) => `| ${state} | ${result.status === 'Draft' ? '要求 Stitch screen 覆盖并进入评审' : 'Blocked，未生成 screen'} |`)
    .join('\n')

  return `# Stitch 原型

状态：${result.status}

## 阅读上下文

- 评审目的：通过 Stitch SDK 自动化生成产品原型并进入 Prototype tab 评审。
- 工作目录：${workflowDir}
- 依赖事实：project-wiki.md、prd.md 的业务范围、用户任务、验收边界和体验意图。

## MCP/SDK 能力检查

- 工具名：${result.toolName}
- SDK 包：@google/stitch-sdk
- 认证状态：${result.authStatus}
- 支持操作：${result.supportedOperations.length ? result.supportedOperations.join('、') : '未发现'}
${result.failureSummary ? `- 失败摘要：${result.failureSummary}` : '- 失败摘要：无'}

## Stitch 项目信息

- Project ID：${result.projectId || '未生成'}
- Project Link：${result.projectUrl || '未返回'}
- 生成或更新时间：${result.generatedAt}
- 预览/导出说明：HTML 与截图 URL 来自 Stitch screen metadata；若未返回，需在 Stitch 项目内复查导出能力。

| Screen/Frame | Screen ID | HTML URL | Image URL |
| --- | --- | --- | --- |
${screenRows}

## Prompt 包

\`\`\`text
${prompt}
\`\`\`

## DESIGN.md 使用

- 来源：优先使用项目已有 DESIGN.md 或 project-wiki.md 中的设计系统事实。
- Gap：如果没有可信 DESIGN.md，本记录只引用已提供上下文，不伪造设计规则。

## 业务范围覆盖矩阵

| 业务范围 / 体验意图 | Stitch 证据或缺口 |
| --- | --- |
${coverageRows}

## 状态覆盖

| 状态 | Screen/Frame 证据 |
| --- | --- |
${stateRows}

## 评审缺口

- Stitch 生成结果仍需人工检查视觉、字段、状态覆盖和业务红线。
- 不得把 Stitch 生成偏差写成已批准产品事实。

## 恢复路径

${result.status === 'Blocked' ? `- ${result.recoveryPath}` : '- 若后续 SDK 更新失败，修复认证、权限或配额后重新运行本脚本。'}
`
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv)
  if (options.help) {
    process.stdout.write(usage())
    return
  }
  if (!options.workflowDir) {
    throw new Error('--workflow-dir is required')
  }
  if (!['mock', 'real'].includes(options.adapter)) {
    throw new Error('--adapter must be mock or real')
  }

  const workflowDir = resolve(options.workflowDir)
  const projectWiki = readOptional(workflowDir, 'project-wiki.md')
  const prd = readOptional(workflowDir, 'prd.md')
  const projectTitle =
    options.projectTitle === 'Stitch Prototype' ? basename(workflowDir) : options.projectTitle
  const prompt = buildPrompt({ projectWiki, prd, projectTitle, deviceType: options.deviceType })
  const experienceContext = prd.trim() || '未提供 PRD。'
  const coverageItems = extractCoverageItems(prd)
  const states = extractStateCoverage(experienceContext || prd)
  const result =
    options.adapter === 'mock' ? await runMockAdapter(options) : await runRealAdapter(options, prompt)

  const artifact = renderArtifact({ result, prompt, coverageItems, states, workflowDir })
  const evidence = summarizeStitchEvidence({
    prd,
    prompt,
    screens: result.screens,
    adapter: options.adapter,
    status: result.status,
    verified: options.adapter === 'real' && result.status !== 'Blocked',
  })
  const marked = `${artifact}\n## 证据来源\n\n- 来源：${evidence.source}\n- 已验证：${evidence.verified ? '是' : '否'}\n- 完整 PRD 已进入 prompt：${evidence.promptIncludesPrd ? '是' : '否'}\n- 真实生成覆盖：${evidence.generatedCoverage ? '是' : '否'}\n`
  retainStitchRun({ dir: workflowDir, status: result.status === 'Blocked' ? 'failed' : 'recorded', body: marked })
  writeFileSync(join(workflowDir, 'stitch-prototype.md'), marked)
  process.stdout.write(`${join(workflowDir, 'stitch-prototype.md')}\n`)
}

export {
  parseArgs,
  extractExperienceContext,
  extractCoverageItems,
  splitMarkdownTableRow,
  extractStateCoverage,
  buildPrompt,
  pickProjectId,
  normalizeScreens,
  blockedResult,
  main,
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isMain) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}
