# iOS & Swift Unit Testing Initialization

This guide explains how to initialize unit testing and coverage reporting for iOS App projects (`.xcodeproj`/`.xcworkspace`) and Swift Package Manager (SPM) projects (`Package.swift`).

Apple's native `xcodebuild` generates `.xcresult` bundles rather than standard XML reports. Use the tools below when a project needs `junit.xml` and `coverage.xml` artifacts.

## 1. Project Type Detection

Identify whether the project is an Xcode workspace/project or a pure Swift Package:

- **Xcode Project/Workspace**: Contains `*.xcworkspace` or `*.xcodeproj`. (If both exist, prefer `.xcworkspace` especially if CocoaPods is used).
- **Swift Package**: Contains `Package.swift` at the root and no Xcode project.

## 2. Xcode Project / Workspace Setup

### 2.1 Enable Code Coverage in Xcode Scheme

Coverage is not enabled by default. To collect coverage data, the scheme's test action must have "Gather Coverage" enabled.
Instruct the user to enable it, or if you can manipulate XML/pbxproj (which is risky), let the user know they need to check:
1. Open the project in Xcode.
2. Edit Scheme -> Test -> Options.
3. Check "Gather coverage for" (either "all targets" or specific targets).

### 2.2 Generating JUnit XML (`junit.xml`)

We use `xcbeautify` to format `xcodebuild` logs and generate JUnit reports.

1. **Install `xcbeautify`** (if not installed):
   ```bash
   brew install xcbeautify
   ```

2. **Test Command**:
   Instead of raw `xcodebuild test`, pipe the output to `xcbeautify`.
   ```bash
   set -o pipefail && xcodebuild test -workspace YourApp.xcworkspace -scheme YourAppScheme -destination 'platform=iOS Simulator,name=iPhone 15' | xcbeautify --report junit --report-path .
   ```
   This generates `build/reports/junit.xml` (or similar depending on the exact flag behavior; `--report-path .` usually generates `junit.xml` in the current directory).

### 2.3 Generating Cobertura Coverage (`coverage.xml`)

For standard XML coverage reporting (used by CI tools like SonarQube), we recommend `slather`.

1. **Add `slather` via Gemfile** (Recommended to ensure consistency with hooks):
   Create or update a `Gemfile` in the project root:
   ```ruby
   source "https://rubygems.org"
   gem "slather"
   ```
   Then run: `bundle install`

2. **Configure `.slather.yml`**:
   Create `.slather.yml` in the project root to define formatting and exclusions:
   ```yaml
   coverage_service: cobertura_xml
   xcodeproj: YourApp.xcodeproj
   workspace: YourApp.xcworkspace
   scheme: YourAppScheme
   output_directory: ./reports
   ignore:
     - "Pods/*"
     - "*/Tests/*"
     - "*/Generated/*"
   ```

3. **Generate Coverage**:
   After running the tests (which generates the `.xcresult` bundle), run:
   ```bash
   bundle exec slather
   ```
   This will read the Xcode derived data and generate `reports/cobertura.xml` (which serves as our `coverage.xml`).

### 2.4 Integrating existing setups

If the project already has testing configured and passing but is simply missing the XML reports:
- **Do not modify the existing scheme or test commands fundamentally.**
- Just append the piping to `xcbeautify` and add the `slather` step post-test.

## 3. Swift Package Manager (SPM) Setup

If it's a pure SPM package:

### 3.1 Enable Code Coverage
SPM handles coverage natively via the `--enable-code-coverage` flag.

### 3.2 Generating JUnit XML
`swift test` doesn't natively output JUnit, but `xcbeautify` can parse SPM output too.
```bash
set -o pipefail && swift test --enable-code-coverage 2>&1 | xcbeautify --report junit --report-path .
```

### 3.3 Generating Cobertura Coverage
For SPM, convert LLVM coverage to Cobertura. The most robust way is using `slather` (if applicable) or a lightweight Python script calling `llvm-cov export -format=lcov`. However, `slather` supports SPM projects to some degree, or you can rely on native `xcrun xccov` output for local coverage checks when full XML is not required.

If full `coverage.xml` is needed for CI in an SPM project, using a tool like [swift-cov](https://github.com/mattpolzin/swift-cov) or relying on Xcode's integration of SPM is often best.

**Note:** Some local coverage checks can parse the JSON output of `xcrun xccov` directly, so `coverage.xml` may only be required for CI or reporting tools.

---

## Coverage XML Readiness Check

Run the following verification after configuration:

```bash
bundle exec slather
mv reports/cobertura.xml reports/coverage.xml
ls -lh reports/coverage.xml  # should exist and be non-empty
```

If `reports/coverage.xml` is missing, check:
1. whether the Xcode scheme has "Gather coverage" enabled
2. whether `.slather.yml` exists and sets `coverage_service: cobertura_xml`
3. whether `bundle install` has already been run

---

## Coverage exclusions

Reserve file-level exclusions in `.slather.yml` during initialization. This is
the finest granularity supported by the iOS coverage toolchain:

```yaml
coverage_service: cobertura_xml
xcodeproj: YourApp.xcodeproj
workspace: YourApp.xcworkspace
scheme: YourAppScheme
output_directory: ./reports
ignore:
  - "Pods/*"
  - "*/Tests/*"
  - "*/Generated/*"
  # Add legacy file paths to exclude here
```

> Swift and `llvm-cov` do not support line-level or method-level coverage
> ignore annotations.
> If a legacy method must be excluded, move it into a dedicated file and exclude
> that file through `ignore`.
> The exact exclusion rules should be decided later by `unit-test-generator`
> after the testability assessment.
