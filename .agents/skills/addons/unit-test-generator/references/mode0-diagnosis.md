# Unit Test Generator: Mode 0 Project Diagnosis

> This file is referenced by `unit-test-generator/SKILL.md`. Complete this
> diagnosis before entering any generation, review, or refactor mode.
> Domain words: `CONTEXT.md` — 遗留套件、健康套件、增量覆盖、新增代码、可测试性挑战、抽出、外包.

## Mode 0: diagnose the project state first

Do not write or repair tests before you understand the existing test posture.
The correct strategy depends on the current state of the project.

### Three project states

```text
What is the state of the current test suite?
├── No test suite exists at all
│   └── 遗留套件: zero-test project
│       Use 增量覆盖.
│       Do not backfill the entire codebase in one pass.
│
├── A suite exists, but it is broken, abandoned, or regularly failing
│   └── 遗留套件: abandoned suite
│       Use 增量覆盖.
│       Do not try to repair every old failure in the current PR.
│       Unrelated failures belong in follow-up tracking.
│
└── A suite exists and is healthy
    └── 健康套件
        Continue normally. Run the testability pre-check, then choose
        Mode 1, 2, or 3. Option A (refactor) remains available.
```

## 增量覆盖

For a 遗留套件, 增量覆盖 is the default operating model, not a shortcut.

Trying to rehabilitate an abandoned suite or backfill an entire legacy codebase
during feature delivery is an anti-pattern because it mixes two different jobs:

1. Deliver the new or changed behavior safely.
2. Repair historical test debt.

Keep them separate.

### What this means in practice

| Situation | Action |
|---|---|
| 新增代码 (new function, type, or file) | Must be testable. Write tests in Mode 1. Prefer 抽出: put new behavior in a new unit, old code only calls it. |
| You modified an existing function and it is already testable | Write or update tests for that function in Mode 1 |
| You touched untestable legacy code | Treat it as a 可测试性挑战. Do **not** silently enter Mode 3 and do **not** silently exclude. List the challenge with a recommended answer. Default recommendation: narrow exclusion + follow-up. 抽出 is allowed without extra approval. wrap / constructor changes / Mode 3 need explicit user approval and stay inside this slice. |
| You found a broken test related to your change | Fix it in the current PR |
| You found broken tests unrelated to your change | Record a follow-up item and leave them out of scope |
| You found untested legacy code you did not touch | Record a follow-up item and do not backfill it here |

This is how a 遗留套件 improves without blocking feature work.

## Legacy-system mindset

- Keep feature delivery and large-scale suite rehabilitation separate.
- Treat changed-line coverage checks as a scope boundary. Do not raise a global coverage threshold to force backfill.
- Use dedicated follow-up items for unrelated failures or untested legacy code.
- Prefer 抽出 over rewriting an untestable method. Do not split a legacy class just to write a characterization test.
- Prefer steady progress over oversized PRs that are difficult to review.

## Testability pre-check

Run this check before choosing Mode 1, 2, or 3.

### Common blockers

| Blocker | Example |
|---|---|
| Singleton with private construction | `WeatherManager._instance`, `getInstance()` with no injection path |
| Hardcoded instantiation inside methods | `new SomeService()` or `SomeService()` inside a method body |
| Static calls on concrete collaborators | `NetworkClient.fetch(url)` called directly |
| No injection points | Constructor creates dependencies internally and accepts no collaborators |
| Global mutable state | Module-level or singleton state shared across calls |

### Decision tree

```text
Does the code contain any blocker listed above?
│
├── YES → This is a 可测试性挑战. Stop and ask; do not silently Mode 3 or exclude.
│         Write the list (range, why untestable, recommended answer, basis).
│         │
│         ├── 抽出 — default for 新增代码
│         │   Put new behavior in a new testable unit. Old code only adds a call.
│         │   Test the new unit (RED then GREEN). Do not rewrite the old class.
│         │
│         ├── Option B — narrow exclude (default for untestable legacy lines
│         │   the user did not approve changing)
│         │   Use the narrowest exclusion the project's coverage tool accepts.
│         │   Record follow-up. Continue Mode 1 for the remaining code.
│         │
│         ├── wrap / constructor injection / Mode 3
│         │   Only after explicit user approval, and only for code this slice touched.
│         │
│         └── 健康套件 only: Option A remains available when the team owns the
│             code, the change is safe, and the user wants the seam now.
│
└── NO  → Choose the next mode:
          - Writing tests for 新增代码 or testable changes: Mode 1
          - Reviewing existing test quality: Mode 2
          - User-approved testability refactor on a 健康套件: Mode 3
```

> Changed-line coverage checks should not be bypassed by lowering thresholds.
> Coverage exclusions with explicit reasoning are the only acceptable exemption
> mechanism. Do not backfill untouched legacy code to chase coverage.
