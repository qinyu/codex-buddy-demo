# Java Unit Testing Generator Reference

## Framework

- Use **JUnit 5**.
- Use **Mockito** for mocks and **AssertJ** only if it already exists in the
  project.

## AAA structure example

```java
@Test
void shouldReturnZeroIfInputIsEmpty() {
    // Arrange
    Calculator calc = new Calculator();
    List<Integer> input = Collections.emptyList();

    // Act
    int result = calc.sum(input);

    // Assert
    assertEquals(0, result);
}
```

## Parameterized tests

Use `@ParameterizedTest` with `@MethodSource` or `@CsvSource`.

```java
@ParameterizedTest
@MethodSource("provideInputsForSum")
void shouldReturnCorrectSumForVariousInputs(List<Integer> input, int expected) {
    // Arrange
    Calculator calc = new Calculator();

    // Act
    int result = calc.sum(input);

    // Assert
    assertEquals(expected, result);
}

private static Stream<Arguments> provideInputsForSum() {
    return Stream.of(
        Arguments.of(Collections.emptyList(), 0),
        Arguments.of(Arrays.asList(1, 2, 3), 6)
    );
}
```

## Coverage XML readiness check

```bash
grep -r "jacoco" build.gradle build.gradle.kts pom.xml 2>/dev/null | grep -q "jacocoTestReport\\|jacoco-maven-plugin" || echo "MISSING"
ls build/reports/jacoco/test/jacocoTestReport.xml target/site/jacoco/jacoco.xml reports/coverage.xml 2>/dev/null || echo "XML_MISSING"
```

## Minimal fix when readiness is missing

Gradle Kotlin DSL:

```kotlin
tasks.jacocoTestReport {
    dependsOn(tasks.test)
    reports {
        xml.required.set(true)
        xml.outputLocation.set(file("${buildDir}/reports/jacoco/test/jacocoTestReport.xml"))
    }
}
```

Maven:

```xml
<execution>
  <id>report</id>
  <phase>test</phase>
  <goals><goal>report</goal></goals>
</execution>
```

Conversion to Cobertura:

```bash
python3 scripts/jacoco2cobertura.py target/site/jacoco/jacoco.xml src/main/java reports/coverage.xml
# or
python3 scripts/jacoco2cobertura.py build/reports/jacoco/test/jacocoTestReport.xml src/main/java reports/coverage.xml
```

If JaCoCo is entirely absent, recommend `unit-test-init` unless the user asks
for a minimal patch.

## Coverage exclusions

### When to use the exclude path

Offer Option B when the pre-check finds:

- high-risk legacy methods with no existing tests
- generated code marked by naming or `@Generated`
- pure DI or configuration classes with no branching logic

### Method-level exclusions

JaCoCo does not support line-level ignore comments. Prefer extracting legacy
logic into a dedicated method and marking it as generated when your toolchain
recognizes that annotation.

```java
import javax.annotation.Generated;

@Generated("legacy")
public void legacyProcess() {
    // legacy code
}

public void handle() {
    newLogic();
    legacyLogic();
}

@Generated("legacy")
private void legacyLogic() {
    // extracted legacy branch
}
```

### File-level or class-level fallback

```kotlin
tasks.jacocoTestReport {
    classDirectories.setFrom(files(classDirectories.files.collect {
        fileTree(dir: it, exclude: [
            "**/LegacyOrderService.class",
            "**/generated/**",
        ])
    }))
}
```

Document the exclusion reason in the PR description and route broader cleanup to
a tracked follow-up item.
