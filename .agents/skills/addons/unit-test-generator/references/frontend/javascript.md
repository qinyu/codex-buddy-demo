# JavaScript Unit Testing Generator Reference

## Framework

- Prefer **Jest** unless the project already uses another runner such as Mocha
  or Vitest.

## AAA structure example

```javascript
test('should return zero if input is empty', () => {
  // Arrange
  const calc = new Calculator();
  const input = [];

  // Act
  const result = calc.sum(input);

  // Assert
  expect(result).toBe(0);
});
```

## Parameterized tests

Use `test.each` for table-driven coverage.

```javascript
test.each([
  [[], 0],
  [[1, 2, 3], 6],
])('should return correct sum for inputs %p, expecting %p', (input, expected) => {
  // Arrange
  const calc = new Calculator();

  // Act
  const result = calc.sum(input);

  // Assert
  expect(result).toBe(expected);
});
```

## Coverage XML readiness check

```bash
cat jest.config.js jest.config.ts 2>/dev/null | grep -q "cobertura" || echo "XML_DISABLED"
ls coverage/cobertura-coverage.xml reports/coverage.xml 2>/dev/null || echo "XML_MISSING"
```

## Minimal fix when readiness is missing

If the project only needs a small repair:

```js
coverageReporters: ['cobertura', 'text'],
```

## Legacy component testability seam

For legacy Vue, Nuxt, React, Angular, or H5 pages, do not force a full component
mount environment if the project lacks a reliable DOM/test transform setup.
First extract pure, framework-light seams and test those:

- validation rules and normalization
- request payload builders
- response-to-state mapping
- permission and visibility decisions
- route/query parsing

Keep the component shell responsible for rendering, event wiring, framework
lifecycle, and browser APIs such as `FileReader`. Generate unit tests for the
extracted helper first, then add a small shell test only if the component runner
is already healthy.

If a shell path cannot be tested safely in this PR, use the coverage exemption
path and create `docs/testing/coverage-exemptions.md`:

```markdown
# Coverage Exemptions

| 范围 | 原因 | 替代验证 | Owner | 回看时机 |
|---|---|---|---|---|
| `src/pages/legacy-page.js` component shell | Legacy framework mount env unavailable in this PR | Pure helper tests cover validation and payload mapping | @team | Before next UI refactor |
```

## Coverage exclusions

### When to use the exclude path

Offer Option B when the pre-check finds:

- high-risk legacy functions with no protective tests
- generated files such as `*.generated.ts` or declaration files such as
  `*.d.ts`

### Line-level or function-level exclusions

Istanbul supports fine-grained exclusions:

```javascript
/* istanbul ignore next */
function legacyProcess() {
  oldAlgorithm();
}

function newFeature() {
  /* istanbul ignore next */
  if (legacyCondition) {
    doLegacy();
  }
  return newResult;
}
```

### File-level fallback

```js
collectCoverageFrom: [
  'src/**/*.{js,ts}',
  '!src/**/*.generated.ts',
  '!src/legacy/**',
],
```

Document the exclusion reason in `docs/testing/coverage-exemptions.md` and leave
broader cleanup to a tracked follow-up item.
