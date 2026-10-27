# Java / Kotlin (JVM): Unit Test Infrastructure Setup

This file is loaded by `unit-test-init` when the project is identified as Java or
Kotlin using Maven or Gradle. Follow every step in order.

---

## What you're configuring

JUnit is almost certainly already present in JVM projects. The gap is usually
coverage reporting. JaCoCo is the standard coverage tool for the JVM; it produces
an XML report that needs one conversion step to reach Cobertura format.

| Tool | Purpose |
|---|---|
| JaCoCo | Coverage instrumentation and XML report generation |
| `jacoco2cobertura.py` | Converts JaCoCo XML to Cobertura XML |

JUnit XML output is handled by the Surefire (Maven) or the built-in test task
(Gradle). No extra plugin is needed for that.

---

## Maven (`pom.xml`)

本节的 Maven / JaCoCo 配置是**示例**，不是要迁去的清单：版本号、插件、路径一律先读项目现有 `pom.xml`，沿用仓库已有版本，只补缺的执行。优先零配置：`mvn test jacoco:report` 命令行 goal 能出报告时不动 pom。

### Step 1: Add the JaCoCo plugin

如果项目还没有 JaCoCo 插件，且命令行 goal 拿不到报告，先出 diff 请用户批准，再在 `<build><plugins>` 内加（版本沿用项目 Spring Boot / 父 POM / 仓库已有 JaCoCo 版本；下方版本号仅为示意）：

```xml
<plugin>
  <groupId>org.jacoco</groupId>
  <artifactId>jacoco-maven-plugin</artifactId>
  <version>0.8.11</version>
  <executions>
    <execution>
      <id>prepare-agent</id>
      <goals><goal>prepare-agent</goal></goals>
    </execution>
    <execution>
      <id>report</id>
      <phase>test</phase>
      <goals><goal>report</goal></goals>
    </execution>
  </executions>
</plugin>
```

The `prepare-agent` execution instruments the JVM before tests run. The `report`
execution generates `target/site/jacoco/jacoco.xml` after tests complete.

### Step 2: Confirm Surefire produces JUnit XML

Maven Surefire writes JUnit XML to `target/surefire-reports/` by default. No
additional configuration is needed unless Surefire is missing from the POM, in
which case add:

```xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-surefire-plugin</artifactId>
  <version>3.2.5</version>
</plugin>
```

### Step 3: Run tests

```bash
mvn test
```

This produces:
- `target/surefire-reports/TEST-*.xml` - JUnit XML files (one per test class)
- `target/site/jacoco/jacoco.xml` - JaCoCo XML coverage report

---

## Gradle (`build.gradle.kts` or `build.gradle`)

### Step 1: Apply the JaCoCo plugin

**Kotlin DSL (`build.gradle.kts`):**

```kotlin
plugins {
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
        xml.outputLocation.set(file("${buildDir}/reports/jacoco/test/jacocoTestReport.xml"))
        html.required.set(false)
    }
}
```

**Groovy DSL (`build.gradle`):**

```groovy
plugins {
    id 'jacoco'
}

test {
    useJUnitPlatform()
    finalizedBy jacocoTestReport
}

jacocoTestReport {
    dependsOn test
    reports {
        xml.required = true
        xml.destination file("${buildDir}/reports/jacoco/test/jacocoTestReport.xml")
        html.required = false
    }
}
```

Gradle's built-in test task writes JUnit XML to `build/test-results/test/` by
default. No extra configuration is needed.

### Step 2: Run tests

```bash
./gradlew test jacocoTestReport
```

This produces:
- `build/test-results/test/TEST-*.xml` - JUnit XML files
- `build/reports/jacoco/test/jacocoTestReport.xml` - JaCoCo XML coverage report

---

## Step 4: Convert JaCoCo XML to Cobertura XML

Run the converter after the test step, pointing at the JaCoCo XML output:

**Maven:**

```bash
mkdir -p reports
python3 scripts/jacoco2cobertura.py target/site/jacoco/jacoco.xml src/main/java reports/coverage.xml
```

**Gradle:**

```bash
mkdir -p reports
python3 scripts/jacoco2cobertura.py build/reports/jacoco/test/jacocoTestReport.xml src/main/java reports/coverage.xml
```

This writes `reports/coverage.xml` in Cobertura format.

---

## Step 5: Consolidate JUnit XML (optional but recommended)

If there are multiple `TEST-*.xml` files, some tools may expect a single
`junit.xml`. Merge them with:

```bash
# Maven
cat target/surefire-reports/TEST-*.xml > junit.xml

# Gradle
cat build/test-results/test/TEST-*.xml > junit.xml
```

A simple concatenation works for many consumers. If a downstream tool needs a
single well-formed XML document, use a merge tool such as `junitparser`:

```bash
pip install junitparser
python -c "
from junitparser import JUnitXml
xml = JUnitXml()
import glob, sys
for f in glob.glob('target/surefire-reports/TEST-*.xml'):
    xml += JUnitXml.fromfile(f)
xml.write('junit.xml')
"
```

---

## Output file locations

| File | Default path |
|---|---|
| `coverage.xml` | `./reports/coverage.xml` (Cobertura, read by coverage gates) |
| JaCoCo XML (Maven) | `target/site/jacoco/jacoco.xml` |
| JaCoCo XML (Gradle) | `build/reports/jacoco/test/jacocoTestReport.xml` |
| JUnit XML (Maven) | `target/surefire-reports/TEST-*.xml` |
| JUnit XML (Gradle) | `build/test-results/test/TEST-*.xml` |

## .gitignore additions

```text
reports/
```

---

## Coverage XML Readiness Check

Run the following verification after configuration to confirm that
`coverage.xml` can be generated:

```bash
# Maven
mvn test
mkdir -p reports
python3 scripts/jacoco2cobertura.py target/site/jacoco/jacoco.xml src/main/java reports/coverage.xml
ls -lh reports/coverage.xml  # should exist and be non-empty

# Gradle
./gradlew test jacocoTestReport
mkdir -p reports
python3 scripts/jacoco2cobertura.py build/reports/jacoco/test/jacocoTestReport.xml src/main/java reports/coverage.xml
ls -lh reports/coverage.xml  # should exist and be non-empty
```

If `reports/coverage.xml` is missing or empty, check:
1. whether the JaCoCo plugin has been added to `pom.xml` or `build.gradle`
2. whether XML reporting is enabled
3. whether `scripts/jacoco2cobertura.py` exists

---

## Coverage exclusions

Reserve exclusion placeholders in the JaCoCo configuration during
initialization. `unit-test-generator` should decide the exact exclusion rules
later during testability analysis.

**Gradle (Kotlin DSL):**

```kotlin
tasks.jacocoTestReport {
    classDirectories.setFrom(files(classDirectories.files.collect {
        fileTree(dir: it, exclude: [
            // Add exclusion rules here, for example:
            // '**/generated/**',
            // '**/R.class',
            // '**/BuildConfig.class',
        ])
    }))
}
```

**Maven (`pom.xml`):**

```xml
<configuration>
  <excludes>
    <!-- Add exclusion rules here, for example: -->
    <!-- <exclude>**/generated/**</exclude> -->
    <!-- <exclude>**/R.class</exclude> -->
  </excludes>
</configuration>
```

**Method-level exclusion example:**

```java
import javax.annotation.Generated;

@Generated("legacy")  // JaCoCo skips instrumentation for this method when supported by the toolchain
public void legacyMethod() { ... }
```

> The exact exclusion rules should be decided later by `unit-test-generator`.
> During initialization, it is enough to ensure the configuration location
> exists.

---

## Step 6: Output the initialization script (do not execute it automatically)

The bash block below is the **command sequence**. Wrap it per `../windows-scripts.md`:
Windows native → `init_test_env.ps1` (`mvn.cmd` / `gradlew.bat`); otherwise `init_test_env.sh`.
Hand the matching file to the user. Do not default to `.sh` on Windows native.
Do not execute it automatically: `mvn` and `gradle` may trigger dependency
downloads and hang indefinitely in restricted enterprise environments.

```bash
#!/usr/bin/env bash
# init_test_env.sh - Java unit test environment setup and coverage reporting
# Usage: bash init_test_env.sh [maven|gradle]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONVERTER="${SCRIPT_DIR}/scripts/jacoco2cobertura.py"

check_deps() {
    set +e
    local missing=()
    command -v python3 >/dev/null 2>&1 || missing+=("python3")
    [ -f "${CONVERTER}" ] || missing+=("jacoco2cobertura.py (scripts/)")
    if [ -f "pom.xml" ]; then
        { command -v mvn >/dev/null 2>&1 || [ -x "./mvnw" ]; } || missing+=("mvn or ./mvnw")
    elif [ -f "build.gradle" ] || [ -f "build.gradle.kts" ]; then
        { command -v gradle >/dev/null 2>&1 || [ -x "./gradlew" ]; } || missing+=("gradle or ./gradlew")
    else
        missing+=("pom.xml or build.gradle (Java/Kotlin project not detected)")
    fi
    set -e
    if [ ${#missing[@]} -ne 0 ]; then
        echo "Missing dependencies. Install them before retrying:"
        for dep in "${missing[@]}"; do echo "   - $dep"; done
        exit 1
    fi
}

run_maven() {
    local mvn_cmd
    mvn_cmd=$([ -x "./mvnw" ] && echo "./mvnw" || echo "mvn")
    "${mvn_cmd}" test jacoco:report
    mkdir -p reports
    if ! python3 "${CONVERTER}" target/site/jacoco/jacoco.xml src/main/java reports/coverage.xml; then
        echo "JaCoCo XML conversion failed. Confirm jacoco-maven-plugin has a report goal configured."
        exit 1
    fi
}

run_gradle() {
    local gradle_cmd
    gradle_cmd=$([ -x "./gradlew" ] && echo "./gradlew" || echo "gradle")
    "${gradle_cmd}" test jacocoTestReport
    mkdir -p reports
    if ! python3 "${CONVERTER}" build/reports/jacoco/test/jacocoTestReport.xml src/main/java reports/coverage.xml; then
        echo "JaCoCo XML conversion failed. Confirm the jacocoTestReport task is configured."
        exit 1
    fi
}

verify_outputs() {
    echo ""
    echo "Finished. Generated artifacts:"
    ls -lh reports/coverage.xml 2>/dev/null || echo "reports/coverage.xml was not generated. Inspect the logs above."
}

main() {
    check_deps
    if [ -f "pom.xml" ]; then
        run_maven
    else
        run_gradle
    fi
    verify_outputs
}
main "$@"
```

After generating the script, tell the user:

```text
init_test_env.sh has been generated. Run it manually:
    bash init_test_env.sh
After it finishes, reports/coverage.xml will be available for the local
coverage threshold gate.
```
