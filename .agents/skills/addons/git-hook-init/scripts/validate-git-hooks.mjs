#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const requiredFiles = [
  'SKILL.md',
  'assets/prompts/review.prompt',
  'assets/prompts/init.prompt',
  'assets/prompts/repair.prompt',
  'references/manager-selection.md',
  'references/git-hook-stages.md',
  'references/hook-patterns.md',
  'references/safety-rules.md',
  'references/merge-strategy.md',
  'references/unit-test-quality-gates.md',
  'references/tools/lefthook.md',
  'references/tools/pre-commit.md',
  'references/tools/husky.md',
  'references/tools/simple-git-hooks.md',
  'references/stacks/java.md',
  'references/stacks/javascript-h5.md',
  'references/stacks/go.md',
  'references/stacks/android.md',
  'references/stacks/ios.md',
  'references/stacks/csharp.md',
  'references/stacks/shared.md',
  'evals/evals.json',
  'evals/trigger-evals.json',
]

const root = fileURLToPath(new URL('..', import.meta.url))
const issues = []

for (const file of requiredFiles) {
  if (!existsSync(resolve(root, file))) issues.push(`missing ${file}`)
}

const skillPath = resolve(root, 'SKILL.md')
if (existsSync(skillPath)) {
  const text = readFileSync(skillPath, 'utf8')
  for (const term of ['git-hook-init', 'Lefthook', 'unit-test-init', 'unit-test-generator']) {
    if (!text.includes(term)) issues.push(`SKILL.md missing ${term}`)
  }
}

for (const evalFile of ['evals/evals.json', 'evals/trigger-evals.json']) {
  const path = resolve(root, evalFile)
  if (!existsSync(path)) continue
  try {
    JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    issues.push(`${evalFile} is invalid JSON: ${error.message}`)
  }
}

if (issues.length > 0) {
  console.error('git-hook-init validation failed:')
  for (const issue of issues) console.error(`- ${issue}`)
  process.exitCode = 1
} else {
  console.log('git-hook-init validation passed')
}
