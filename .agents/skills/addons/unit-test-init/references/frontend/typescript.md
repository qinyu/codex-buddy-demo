# TypeScript: Unit Test Infrastructure Setup

This file is loaded by `unit-test-init` when the project is identified as
TypeScript via a `tsconfig.json` or `.ts` source files. Follow every step in
order.

> **Note:** If `package.json` contains `react-native` or the project has a
> `pubspec.yaml`, stop here and use `references/flutter.md` instead. If the
> project has no TypeScript at all (only `.js` files), use
> `references/javascript.md` instead.

---

## What you're installing

| Package | Purpose |
|---|---|
| `jest` | Test runner |
| `ts-jest` | TypeScript preprocessor for Jest (compiles `.ts` on the fly) |
| `@types/jest` | TypeScript type definitions for Jest globals |
| `jest-junit` | Reporter that writes JUnit XML |

Jest's built-in coverage provider writes Cobertura XML natively when configured.
No separate conversion tool is needed.

---

## Step 1: Install dependencies

依赖安装遵循「只增不改」：包管理器沿用仓库现有（npm/pnpm/yarn），版本沿用已有 lockfile；`--save-dev` 会改 package.json，若可用 `--no-save` 或 `npx` 直跑则优先零配置变更。以下包名是示例，不穷尽：

```bash
npm install --save-dev jest ts-jest @types/jest jest-junit
```

If Jest is already present, only install the missing packages:

```bash
npm install --save-dev ts-jest @types/jest jest-junit
```

---

## Step 2: Configure Jest

Create or update `jest.config.ts` (preferred for TypeScript projects) or
`jest.config.js`. Adjust `collectCoverageFrom` to match your actual source paths.

**`jest.config.ts`:**

```ts
import type { Config } from 'jest';

const config: Config = {
  // ts-jest handles TypeScript compilation
  preset: 'ts-jest',

  testEnvironment: 'node',

  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/index.ts',   // remove if you want index files counted
  ],
  coverageReporters: ['cobertura', 'text'],
  coverageDirectory: 'reports',

  // JUnit XML reporter
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: '.',
      outputName: 'junit.xml',
    }],
  ],
};

export default config;
```

**`jest.config.js` (if you prefer CommonJS):**

```js
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
  coverageReporters: ['cobertura', 'text'],
  coverageDirectory: 'reports',
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: '.',
      outputName: 'junit.xml',
    }],
  ],
};
```

Key settings:

- `preset: 'ts-jest'` — tells Jest to use `ts-jest` to compile TypeScript before
  running tests. No separate `tsc` step is needed.
- `coverageReporters: ['cobertura']` — writes `coverage-cobertura.xml` inside
  `coverageDirectory`.
- `coverageDirectory: 'reports'` — places the coverage file under `reports/`.
- `jest-junit` reporter — writes `junit.xml` to the project root.

---

## Step 3: Configure ts-jest (if needed)

By default `ts-jest` reads your existing `tsconfig.json`. If the project's
`tsconfig.json` is strict or has settings that break test compilation (e.g.,
`"module": "ESNext"` without `"moduleResolution": "bundler"`), create a separate
`tsconfig.test.json` that extends the main one and overrides only what's needed:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "node"
  }
}
```

Then point `ts-jest` at it in `jest.config.ts`:

```ts
const config: Config = {
  preset: 'ts-jest',
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json',
    },
  },
  // ... rest of config
};
```

Only do this if you see TypeScript compilation errors when running `npm test`.

---

## Step 4: Add a test script to `package.json`

Use separate scripts for fast local red/green and full hook/CI gates:

- Local TDD loop: `npm run test:unit:quick -- <path>`. This intentionally
  disables coverage for speed.
- Gate command: `npm run test:coverage`. This must generate both `junit.xml` and
  `reports/coverage.xml`.

If a `test` script doesn't exist, add one:

```json
{
  "scripts": {
    "test": "npm run test:unit:quick",
    "test:unit:quick": "jest --coverage=false",
    "test:coverage": "jest --coverage"
  }
}
```

Keep coverage enabled in the `test:coverage` script even if `collectCoverage:
true` is set in the config; the script name should make the gate intent obvious.

---

## Step 5: Normalize the coverage file

Different Jest/Vitest versions and reporters may write either
`coverage-cobertura.xml` or `cobertura-coverage.xml`. Normalize both names to
`reports/coverage.xml` so downstream hook/CI checks have one stable path:

```sh
mkdir -p reports
if [ -f reports/cobertura-coverage.xml ]; then
  mv reports/cobertura-coverage.xml reports/coverage.xml
elif [ -f reports/coverage-cobertura.xml ]; then
  mv reports/coverage-cobertura.xml reports/coverage.xml
elif [ -f coverage/cobertura-coverage.xml ]; then
  cp coverage/cobertura-coverage.xml reports/coverage.xml
elif [ -f coverage/coverage-cobertura.xml ]; then
  cp coverage/coverage-cobertura.xml reports/coverage.xml
fi
test -s junit.xml
test -s reports/coverage.xml
```

**npm script (recommended):**

```json
{
  "scripts": {
    "test:unit:quick": "jest --coverage=false",
    "test:coverage": "jest --coverage && mkdir -p reports && (test -f reports/cobertura-coverage.xml && mv reports/cobertura-coverage.xml reports/coverage.xml || test -f reports/coverage-cobertura.xml && mv reports/coverage-cobertura.xml reports/coverage.xml || test -f coverage/cobertura-coverage.xml && cp coverage/cobertura-coverage.xml reports/coverage.xml || test -f coverage/coverage-cobertura.xml && cp coverage/coverage-cobertura.xml reports/coverage.xml) && test -s junit.xml && test -s reports/coverage.xml",
    "test:ci": "npm run test:coverage"
  }
}
```

Use `test:ci` in CI pipelines and git hooks.

---

## Step 6: Verify

```bash
npm run test:ci
ls -lh junit.xml reports/coverage.xml
```

Both files should be present and non-empty. Common issues:

- **`Cannot find module 'ts-jest'`** — run `npm install --save-dev ts-jest` again.
- **`SyntaxError: Cannot use import statement`** — add `"module": "CommonJS"` to
  `tsconfig.test.json` and point `ts-jest` at it (see Step 3).
- **`coverage.xml` missing** — confirm `coverageReporters` includes
  `'cobertura'`, `collectCoverage` is `true`, and the normalization script
  handles both `coverage-cobertura.xml` and `cobertura-coverage.xml`.

---

## Alternative runner: Vitest

If the project uses Vite or prefers Vitest over Jest:

```bash
npm install --save-dev vitest @vitest/coverage-v8
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['cobertura', 'text'],
      reportsDirectory: '.',
    },
    reporters: ['default', 'junit'],
    outputFile: {
      junit: './junit.xml',
    },
  },
});
```

Vitest writes `cobertura-coverage.xml` in many configurations. Normalize it to
`reports/coverage.xml` using the same approach as Step 5.

---

## Output file locations

| File | Default path |
|---|---|
| `junit.xml` | `./junit.xml` |
| `coverage.xml` | `./reports/coverage.xml` |

## .gitignore additions

```
junit.xml
reports/
```

---

## Coverage XML Readiness Check

Run the following verification after configuration:

```bash
npm run test:ci
ls -lh reports/coverage.xml  # should exist and be non-empty
```

If the file is missing, check:
1. whether `jest.config.ts` or `jest.config.js` includes `coverageReporters: ['cobertura']`
2. whether `coverageDirectory: 'reports'` is set
3. whether the `test:coverage` script normalizes both `coverage-cobertura.xml` and `cobertura-coverage.xml`

---

## Coverage exclusions

Reserve exclusion placeholders in the Jest config during initialization:

```js
// jest.config.js
module.exports = {
  collectCoverageFrom: [
    'src/**/*.{js,ts,jsx,tsx}',
    '!src/**/*.generated.{js,ts}',  // exclude generated code
    // Add other exclusion rules here
  ],
};
```

**Line-level or function-level exclusions (the finest granularity Istanbul supports):**

```javascript
/* istanbul ignore next */
function legacyProcess() {
    oldAlgorithm();
}

function newFeature() {
    /* istanbul ignore next */
    if (legacyCondition) { doLegacy(); }
    return newResult;  // counted normally
}
```

> The exact exclusion rules should be decided later by `unit-test-generator`
> after the testability assessment.
