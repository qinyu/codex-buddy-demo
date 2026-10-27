# Flutter and Dart Unit Testing Generator Reference

## Framework

- Use **flutter_test** for Flutter projects.
- Use **test** for pure Dart packages when Flutter is not involved.
- Prefer `mocktail` or `mockito` when mocking is necessary.

## AAA structure example

```dart
test('should_return_zero_if_input_is_empty', () {
  // Arrange
  final calculator = Calculator();

  // Act
  final result = calculator.sum([]);

  // Assert
  expect(result, equals(0));
});
```

## Parameterized tests

Dart does not provide native parameterized tests. Use a case list and loop
inside a `group()`.

```dart
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Calculator.sum', () {
    final cases = [
      {'name': 'empty list', 'input': <int>[], 'expected': 0},
      {'name': 'positive sum', 'input': <int>[1, 2, 3], 'expected': 6},
    ];

    for (final tc in cases) {
      test('should_return_correct_sum_if_${tc['name']}', () {
        // Arrange
        final calculator = Calculator();

        // Act
        final result = calculator.sum(tc['input'] as List<int>);

        // Assert
        expect(result, equals(tc['expected']));
      });
    }
  });
}
```

## Coverage XML readiness check

```bash
python3 -c "import lcov_cobertura" 2>/dev/null || echo "MISSING"
ls coverage.xml reports/coverage.xml 2>/dev/null || echo "XML_MISSING"
```

## Minimal fix when readiness is missing

```bash
pip install lcov_cobertura
flutter test --coverage
python3 -m lcov_cobertura coverage/lcov.info --output reports/coverage.xml
```

## Coverage exclusions

### When to use the exclude path

Offer Option B when the pre-check finds:

- UI logic that cannot be meaningfully validated in the current unit-test scope
- generated files such as `*.g.dart` or `*.freezed.dart`

### Line-level or block-level exclusions

```dart
void legacyProcess() {
  // coverage:ignore-start
  oldCode();
  deprecatedCall();
  // coverage:ignore-end
}

void newFeature() {
  final x = legacyInit(); // coverage:ignore-line
  return compute(x);
}
```

### File-level fallback

```bash
lcov_cobertura coverage/lcov.info \
  --excludes ".*legacy.*" ".*generated.*" \
  -o reports/coverage.xml
```

Document the exclusion reason in the PR description and leave broader cleanup to
a tracked follow-up item.
