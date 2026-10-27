# Kotlin Unit Testing Generator Reference

## Framework

- Use **JUnit 5** by default.
- Use **Kotest** only when it is already established in the project.
- Prefer **MockK** for Kotlin-first code, or **Mockito-Kotlin** if that is the
  current stack.

## AAA structure example

```kotlin
@Test
fun `should return zero if input is empty`() {
    // Arrange
    val calc = Calculator()
    val input = emptyList<Int>()

    // Act
    val result = calc.sum(input)

    // Assert
    assertEquals(0, result)
}
```

## Parameterized tests

Use `@ParameterizedTest` with `@MethodSource`, or the project's existing data
driven helper if it already exists.

```kotlin
@ParameterizedTest
@MethodSource("provideInputsForSum")
fun `should return correct sum for various inputs`(input: List<Int>, expected: Int) {
    // Arrange
    val calc = Calculator()

    // Act
    val result = calc.sum(input)

    // Assert
    assertEquals(expected, result)
}

companion object {
    @JvmStatic
    fun provideInputsForSum() = listOf(
        Arguments.of(emptyList<Int>(), 0),
        Arguments.of(listOf(1, 2, 3), 6)
    )
}
```

## Coverage XML readiness check

```bash
grep -q "kover\\|jacoco" build.gradle.kts 2>/dev/null || echo "MISSING"
ls build/reports/kover/report.xml build/reports/jacoco/test/jacocoTestReport.xml reports/coverage.xml 2>/dev/null || echo "XML_MISSING"
```

## Minimal fix when readiness is missing

- Ensure `build.gradle.kts` applies `id("org.jetbrains.kotlinx.kover")`
- Add XML reporting to the Kover configuration
- Use the bundled `jacoco2cobertura.py` conversion helper when Cobertura XML is
  required

```bash
python3 scripts/jacoco2cobertura.py build/reports/kover/report.xml src/main/kotlin reports/coverage.xml
```

For Kotlin Multiplatform, set `source_root` to the correct source set such as
`src/commonMain/kotlin` or `src/androidMain/kotlin`.

## Coverage exclusions

### When to use the exclude path

Offer Option B when the pre-check finds:

- high-risk legacy methods with no protective tests
- generated code
- DI-only configuration classes with no meaningful logic

### Method-level exclusions

Prefer the narrowest supported mechanism:

```kotlin
@ExcludeFromCoverage
fun legacyProcess() {
    // legacy code
}

@Generated("legacy")
fun anotherLegacyMethod() {}
```

### Class-level or file-level fallback

```kotlin
koverReport {
    filters {
        excludes {
            classes("com.example.legacy.*")
            annotatedBy("javax.annotation.Generated")
        }
    }
}
```

Kotlin coverage tools do not support line-level ignore comments in the same way
Istanbul or Coverage.py do. Extract legacy logic into dedicated methods or files
when finer granularity is required.
