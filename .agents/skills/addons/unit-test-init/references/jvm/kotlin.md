# Kotlin: Unit Test Infrastructure Setup

This file is loaded by `unit-test-init` when the project is identified as Kotlin
via `.kt` source files or a `build.gradle.kts` build script. Follow every step in
order.

> **KMP first:** If the project uses Kotlin Multiplatform (KMP) — look for
> `kotlin("multiplatform")` in any `build.gradle.kts` — follow the **KMP path**
> below. KMP is the common case for modern Kotlin projects targeting Android,
> desktop, iOS, or server simultaneously. The single-platform JVM path is a
> fallback for legacy `kotlin("jvm")` projects only.

---

## Identify the project type

| Signal | Project type |
|---|---|
| `kotlin("multiplatform")` in build script | **KMP** — use Option A (KMP + Kover) |
| `kotlin("jvm")` only, no multiplatform | JVM-only — use Option B (JVM + Kover) |
| JaCoCo already configured | Mixed/legacy — use Option C (JaCoCo) |

---

## Option A: KMP + Kover (primary path for Kotlin Multiplatform)

**Kover** (`org.jetbrains.kotlinx.kover`) is the correct coverage tool for KMP.
JaCoCo does not support KMP's native/iOS targets and produces incomplete reports
for multiplatform builds. Always use Kover for KMP projects.

### Step 1: Apply the Kover plugin

In the root `build.gradle.kts` (or the module that aggregates all targets):

```kotlin
plugins {
    kotlin("multiplatform") version "1.9.23"   // or your current Kotlin version
    id("org.jetbrains.kotlinx.kover") version "0.7.6"
}

kotlin {
    jvm()                  // JVM target (required for coverage instrumentation)
    // iosArm64()          // native targets are excluded from coverage by default
    // js(IR) { browser() }

    sourceSets {
        val commonMain by getting
        val commonTest by getting {
            dependencies {
                implementation(kotlin("test"))
            }
        }
    }
}

kover {
    reports {
        total {
            xml {
                onCheck = true
                // Kover produces JaCoCo-compatible XML — jacoco2cobertura.py works directly (bundled in skill assets, no pip install needed)
                xmlFile.set(file("${layout.buildDirectory.get()}/reports/kover/report.xml"))
            }
        }
        // Optionally scope coverage to specific targets only:
        // filters {
        //     includes { classes("com.example.*") }
        // }
    }
}
```

If you're on Kover 0.6.x, the DSL differs slightly:

```kotlin
koverReport {
    defaults {
        xml {
            onCheck = true
            setReportFile(file("${buildDir}/reports/kover/report.xml"))
        }
    }
}
```

Check the version with `./gradlew dependencies | grep kover` and match the DSL.

### Step 2: Run tests

KMP projects have multiple test tasks. Use the right one for your targets:

| Task | When to use |
|---|---|
| `./gradlew allTests` | Run tests across **all** configured targets |
| `./gradlew jvmTest` | JVM target only (fastest, most common for CI) |
| `./gradlew desktopTest` | Desktop (JVM) target if named `desktop` |
| `./gradlew koverXmlReport` | Generate coverage XML (runs tests if needed) |

For CI, the typical command is:

```bash
./gradlew jvmTest koverXmlReport
```

Or to cover all targets at once:

```bash
./gradlew allTests koverXmlReport
```

This produces:
- `build/test-results/jvmTest/TEST-*.xml` — JUnit XML files (one per test class)
- `build/reports/kover/report.xml` — Kover XML coverage report (JaCoCo-compatible format)

> **Note on test result paths:** KMP names test result directories after the
> target. `jvmTest` results land in `build/test-results/jvmTest/`. If you use
> `allTests`, results appear under `build/test-results/<targetName>Test/` for
> each target. Adjust the glob in Step 4 accordingly.

### Step 3: Convert Kover XML to Cobertura XML

Kover's XML output is JaCoCo-compatible, so `jacoco2cobertura.py` handles it
directly without any preprocessing:

```bash
mkdir -p reports
# See the `source_root` notes below.
python3 scripts/jacoco2cobertura.py build/reports/kover/report.xml src/main/kotlin reports/coverage.xml
```

This writes `reports/coverage.xml` in Cobertura format.

> **KMP `source_root` note:** the second argument to
> `jacoco2cobertura.py` is the source root. It maps relative paths from the
> coverage report back to the actual source files. Common values:
>
> | sourceSet | `source_root` value |
> |-----------|-----------------|
> | `commonMain` (shared KMP logic) | `src/commonMain/kotlin` |
> | `androidMain` (Android implementation) | `src/androidMain/kotlin` |
> | `iosMain` (iOS implementation) | `src/iosMain/kotlin` |
> | Standard single-module JVM/Android project | `src/main/kotlin` |
>
> Kover usually merges source sets into one XML report. `src/main/kotlin` or
> `src/commonMain/kotlin` works for many projects. If the XML contains data but
> downstream tooling cannot locate source files, verify that `source_root`
> matches the actual source set directory.

---

## Option B: JVM-only Kotlin + Kover

For projects using `kotlin("jvm")` without multiplatform targets.

### Step 1: Apply the Kover plugin

```kotlin
plugins {
    kotlin("jvm") version "1.9.23"
    id("org.jetbrains.kotlinx.kover") version "0.7.6"
}

kover {
    reports {
        total {
            xml {
                onCheck = true
                xmlFile.set(file("${layout.buildDirectory.get()}/reports/kover/report.xml"))
            }
        }
    }
}

tasks.test {
    useJUnitPlatform()
}
```

### Step 2: Run tests

```bash
./gradlew test koverXmlReport
```

This produces:
- `build/test-results/test/TEST-*.xml` — JUnit XML files
- `build/reports/kover/report.xml` — Kover XML coverage report

### Step 3: Convert to Cobertura XML

```bash
mkdir -p reports
python3 scripts/jacoco2cobertura.py build/reports/kover/report.xml src/main/kotlin reports/coverage.xml
```

---

## Option C: JaCoCo (mixed Kotlin/Java or existing JaCoCo setups only)

Use this only when JaCoCo is already present or the project mixes Kotlin and Java
in a single JVM module. Do **not** use JaCoCo for KMP projects.

### Step 1: Apply the JaCoCo plugin

```kotlin
plugins {
    kotlin("jvm") version "1.9.23"
    jacoco
}

tasks.test {
    useJUnitPlatform()
    finalizedBy(tasks.jacocoTestReport)
}

tasks.jacocoTestReport {
    dependsOn(tasks.test)
    reports {
        xml.required.set(true)
        xml.outputLocation.set(
            file("${buildDir}/reports/jacoco/test/jacocoTestReport.xml")
        )
        html.required.set(false)
    }
}
```

### Step 2: Run tests

```bash
./gradlew test jacocoTestReport
```

This produces:
- `build/test-results/test/TEST-*.xml` — JUnit XML files
- `build/reports/jacoco/test/jacocoTestReport.xml` — JaCoCo XML coverage report

### Step 3: Convert to Cobertura XML

```bash
mkdir -p reports
python3 scripts/jacoco2cobertura.py build/reports/jacoco/test/jacocoTestReport.xml src/main/java reports/coverage.xml
```

---

## Step 4: Consolidate JUnit XML (Optional)

Gradle writes one `TEST-*.xml` per test class. Most reporting and coverage-check tools support reading multiple XML files directly using glob patterns like `**/build/test-results/test/TEST-*.xml`.

---

## Output file locations

| File | Default path |
|---|---|
| `junit.xml` | `./junit.xml` (merged) |
| `coverage.xml` | `./reports/coverage.xml` (Cobertura, converted) |
| Kover XML | `build/reports/kover/report.xml` |
| KMP test results (jvmTest) | `build/test-results/jvmTest/TEST-*.xml` |
| KMP test results (allTests) | `build/test-results/*/TEST-*.xml` |
| JVM-only test results | `build/test-results/test/TEST-*.xml` |
| JaCoCo XML | `build/reports/jacoco/test/jacocoTestReport.xml` |

## .gitignore additions

```
reports/
```

---

## Common mistakes

| Mistake | Fix |
|---|---|
| Using JaCoCo on a KMP project | Switch to Kover — JaCoCo misses non-JVM targets |
| Running `test` task on KMP | Use `jvmTest` or `allTests` — `test` may not exist in KMP |
| Wrong test result glob for KMP | KMP uses `jvmTest/` not `test/` as the directory name |
| Kover XML not generated | Ensure `koverXmlReport` task runs after tests, or set `onCheck = true` |
| `buildDir` deprecation warning | Replace `${buildDir}` with `${layout.buildDirectory.get()}` in Gradle 8+ |

---

## Coverage XML Readiness Check

Run the following verification after configuration to confirm that
`coverage.xml` can be generated:

```bash
# Kover (KMP or JVM-only)
./gradlew koverXmlReport
mkdir -p reports
python3 scripts/jacoco2cobertura.py build/reports/kover/report.xml src/main/kotlin reports/coverage.xml
ls -lh reports/coverage.xml  # should exist and be non-empty
```

If `reports/coverage.xml` is missing or empty, check:
1. whether the Kover plugin is applied (`id("org.jetbrains.kotlinx.kover")`)
2. whether XML reporting is configured
3. whether `scripts/jacoco2cobertura.py` is present

---

## Coverage exclusions

Reserve exclusion placeholders in the Kover configuration during initialization:

```kotlin
// build.gradle.kts
koverReport {
    filters {
        excludes {
            classes(
                // Add exclusion patterns here, for example:
                // "*.generated.*",
                // "*.BuildConfig",
            )
            annotatedBy(
                // Add exclusion annotations here, for example:
                // "javax.annotation.Generated",
            )
        }
    }
}
```

**Method-level exclusion example:**

```kotlin
@ExcludeFromCoverage  // Kover-specific annotation
fun legacyProcess() {
    // Legacy code skipped by Kover
}

// Or reuse a JaCoCo-compatible annotation
@Generated("legacy")
fun anotherLegacyMethod() {}
```

> The exact exclusion rules should be decided later by `unit-test-generator`
> after the testability assessment.
> During initialization, it is enough to ensure the configuration location
> exists.
