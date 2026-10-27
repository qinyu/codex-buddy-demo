#!/usr/bin/env node

const help = `merge-hook-config.mjs

This helper intentionally does not mutate files in MVP.
Use git-hook-init to generate a conservative patch first.

Supported future targets:
  --target lefthook
  --target package-json
  --target pre-commit
`

if (process.argv.includes('--help') || process.argv.length === 2) {
  console.log(help)
  process.exit(0)
}

console.error('merge-hook-config.mjs is read-only in MVP. Generate a patch instead of mutating files.')
process.exit(2)
