#!/usr/bin/env node
import { fileURLToPath } from 'node:url'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function readText(path) {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

function listIfDir(path) {
  if (!path) return []
  if (!existsSync(path)) return []
  try {
    if (!statSync(path).isDirectory()) return []
    return readdirSync(path).filter((name) => name !== '_' && !name.startsWith('.'))
  } catch {
    return []
  }
}

function readGitConfig(cwd) {
  const gitPath = resolve(cwd, '.git')
  if (!existsSync(gitPath)) return null
  try {
    if (statSync(gitPath).isDirectory()) {
      return readText(resolve(gitPath, 'config'))
    }
    const gitFile = readText(gitPath)
    const match = gitFile?.match(/^gitdir:\s*(.+)\s*$/m)
    if (!match) return null
    const gitDir = resolve(cwd, match[1])
    return readText(resolve(gitDir, 'config'))
  } catch {
    return null
  }
}

function getCoreHooksPath(gitConfig) {
  if (!gitConfig) return null
  let inCoreSection = false
  for (const rawLine of gitConfig.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#') || line.startsWith(';')) continue
    if (line.startsWith('[')) {
      inCoreSection = /^\[core\]$/i.test(line)
      continue
    }
    if (!inCoreSection) continue
    const match = line.match(/^hooksPath\s*=\s*(.+)$/i)
    if (match) return match[1].trim()
  }
  return null
}

function resolveHooksPath(cwd, hooksPath) {
  if (!hooksPath) return null
  return hooksPath.startsWith('/') ? hooksPath : resolve(cwd, hooksPath)
}

function detect(cwd) {
  const packageJsonPath = resolve(cwd, 'package.json')
  const packageJson = existsSync(packageJsonPath) ? readJson(packageJsonPath) : null
  const simpleGitHooksConfig = packageJson?.['simple-git-hooks']
  const huskyV4Config = packageJson?.husky?.hooks
  const simpleGitHooks =
    simpleGitHooksConfig !== null && typeof simpleGitHooksConfig === 'object' && !Array.isArray(simpleGitHooksConfig)
  const huskyV4 =
    huskyV4Config !== null && typeof huskyV4Config === 'object' && !Array.isArray(huskyV4Config)
  const huskyV7 = existsSync(resolve(cwd, '.husky'))
  const conventionalGitHooksDir = existsSync(resolve(cwd, '.githooks'))
  const coreHooksPath = getCoreHooksPath(readGitConfig(cwd))
  const coreHooksDir = resolveHooksPath(cwd, coreHooksPath)
  const managers = []
  if (existsSync(resolve(cwd, 'lefthook.yml')) || existsSync(resolve(cwd, '.lefthook.yml'))) managers.push('lefthook')
  if (existsSync(resolve(cwd, '.pre-commit-config.yaml'))) managers.push('pre-commit')
  if (huskyV4 || huskyV7) managers.push('husky')
  if (coreHooksPath || conventionalGitHooksDir) managers.push('git-core-hooksPath')
  if (simpleGitHooks) managers.push('simple-git-hooks')
  const stages = new Set()
  for (const file of listIfDir(resolve(cwd, '.husky'))) stages.add(file)
  if (huskyV4) {
    for (const key of Object.keys(huskyV4Config)) stages.add(key)
  }
  for (const file of listIfDir(coreHooksDir)) stages.add(file)
  if (!coreHooksPath) {
    for (const file of listIfDir(resolve(cwd, '.githooks'))) stages.add(file)
  }
  if (simpleGitHooks) {
    for (const key of Object.keys(simpleGitHooksConfig)) stages.add(key)
  }
  return {
    cwd,
    hookManagers: managers,
    hookManagerDetails: {
      husky: {
        hasPackageJsonHooks: huskyV4,
        hasDotHuskyDirectory: huskyV7,
      },
      coreHooksPath,
      hasConventionalGitHooksDirectory: conventionalGitHooksDir,
    },
    hookStages: [...stages].sort(),
    packageScripts: packageJson && packageJson.scripts ? Object.keys(packageJson.scripts).sort() : [],
    hasJava: existsSync(resolve(cwd, 'pom.xml')) || existsSync(resolve(cwd, 'build.gradle')) || existsSync(resolve(cwd, 'build.gradle.kts')),
    hasJavaScriptH5: existsSync(packageJsonPath) || existsSync(resolve(cwd, 'tsconfig.json')),
    hasAndroid: existsSync(resolve(cwd, 'gradlew')) && listIfDir(cwd).some((name) => name.toLowerCase().includes('android')),
    hasIos: listIfDir(cwd).some((name) => name.endsWith('.xcodeproj') || name.endsWith('.xcworkspace')) || existsSync(resolve(cwd, 'Package.swift')),
    hasGo: existsSync(resolve(cwd, 'go.mod')),
    hasRust: existsSync(resolve(cwd, 'Cargo.toml')),
  }
}

export { detect, readJson, getCoreHooksPath, resolveHooksPath }

function main(argv = process.argv) {
  const cwdArgIndex = argv.indexOf('--cwd')
  let cwd = process.cwd()
  if (cwdArgIndex >= 0) {
    const cwdArg = argv[cwdArgIndex + 1]
    if (!cwdArg || cwdArg.startsWith('--')) {
      console.error('inspect-git-hooks: --cwd requires a value')
      process.exit(2)
    }
    cwd = resolve(cwdArg)
  }
  console.log(JSON.stringify(detect(cwd), null, 2))
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isMain) main()
