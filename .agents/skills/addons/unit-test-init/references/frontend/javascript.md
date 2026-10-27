# JavaScript / TypeScript: Unit Test Infrastructure Setup

This file is loaded by `unit-test-init` when the project is identified as
JavaScript or TypeScript (Node.js, React, Vue, etc.). Follow every step in order.

> **Note:** If `package.json` contains `react-native` or the project has a
> `pubspec.yaml`, stop here and use `references/flutter.md` instead.

---

## What you're installing

Jest is the assumed test runner. If the project already uses Vitest or Mocha, see
the "Alternative runners" section at the bottom.

| Package | Purpose |
|---|---|
| `jest` | Test runner (skip if already installed) |
| `jest-junit` | Reporter that writes JUnit XML |
| `@jest/coverage-provider` | Built into Jest — no install needed |

Jest's built-in V8 or Babel coverage provider writes Cobertura XML natively when
configured. No separate conversion tool is needed.

---

## Step 1: Install dependencies

依赖安装遵循「只增不改」：包管理器沿用仓库现有（npm/pnpm/yarn），版本沿用已有 lockfile；`--save-dev` 会改 package.json，若可用 `--no-save` 或 `npx` 直跑则优先零配置变更。以下包名是示例，不穷尽：

```bash
npm install --save-dev jest jest-junit
```

If the project uses TypeScript, also install:
```bash
npm install --save-dev ts-jest @types/jest
```

If Jest is already present, only install `jest-junit`:
```bash
npm install --save-dev jest-junit
```

If the project is ESM-first (`"type": "module"`), Nuxt/Vue legacy code imports
ES modules, or Jest fails with `SyntaxError: Cannot use import statement outside
a module`, add Babel support:

```bash
npm install --save-dev babel-jest @babel/core @babel/preset-env
```

---

## Step 2: Configure Jest

Create or update `jest.config.js` (or `jest.config.ts` for TypeScript projects)
with the following. Adjust `collectCoverageFrom` to match the actual source paths.

**`jest.config.js`:**
```js
/** @type {import('jest').Config} */
module.exports = {
  // Use ts-jest for TypeScript projects; remove for plain JS
  preset: 'ts-jest',

  testEnvironment: 'node',

  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js,ts,jsx,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
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
```

For ESM-first packages, prefer `jest.config.cjs` so the config itself can stay
CommonJS even when application code is ESM:

```js
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.[cm]?[jt]sx?$': ['babel-jest', {
      presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
    }],
  },
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js,jsx,mjs,cjs}',
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

- `coverageReporters: ['cobertura']` — writes `coverage-cobertura.xml` inside
  `coverageDirectory`.
- `coverageDirectory: 'reports'` — places the coverage file under `reports/`.
- `jest-junit` reporter — writes `junit.xml` to the project root.

---

## Step 3: Normalize the coverage file

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

**npm script in `package.json`:**
```json
{
  "scripts": {
    "test:unit:quick": "jest --coverage=false",
    "test:coverage": "jest --coverage && mkdir -p reports && (test -f reports/cobertura-coverage.xml && mv reports/cobertura-coverage.xml reports/coverage.xml || test -f reports/coverage-cobertura.xml && mv reports/coverage-cobertura.xml reports/coverage.xml || test -f coverage/cobertura-coverage.xml && cp coverage/cobertura-coverage.xml reports/coverage.xml || test -f coverage/coverage-cobertura.xml && cp coverage/coverage-cobertura.xml reports/coverage.xml) && test -s junit.xml && test -s reports/coverage.xml",
    "test:ci": "npm run test:coverage"
  }
}
```

---

## Step 4: Add test scripts to `package.json`

Use separate scripts for fast local red/green and full hook/CI gates:

- Local TDD loop: `npm run test:unit:quick -- <path>` or
  `npm run test:unit:quick -- path/to/file.test.js`. This intentionally disables
  coverage for speed.
- Gate command: `npm run test:coverage`. This must generate both `junit.xml` and
  `reports/coverage.xml`.

If a `test` script doesn't exist, add one that points at the fast command:
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

## Step 5: Verify

```bash
npm run test:ci
ls -lh junit.xml reports/coverage.xml
```

Both files should be present and non-empty.

---

## Alternative runners

### Vitest

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

Vitest writes `cobertura-coverage.xml` in many configurations. Use the same
normalization step as Step 3 and point hooks/CI at `npm run test:coverage`.

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
1. whether `jest.config.js` or `jest.config.ts` includes `coverageReporters: ['cobertura']`
2. whether `coverageDirectory: 'reports'` is set
3. whether the `test:coverage` script normalizes both `coverage-cobertura.xml` and `cobertura-coverage.xml`
4. whether an ESM project needs `jest.config.cjs` plus `babel-jest` transform

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
