#include "../src/reset_countdown.h"

#include <cstring>
#include <cstdio>

int main() {
  char out[32];
  struct Case { int64_t seconds; bool available; bool compact; const char* expected; };
  const Case cases[] = {
      {90061, true, false, "resets in 1d 01h"},
      {3661, true, false, "resets in 1h 01m"},
      {3600, true, false, "resets in 1h 00m"},
      {59, true, false, "resets in 1m"},
      {1, true, false, "resets in 1m"},
      {0, true, false, "reset soon"},
      {-1, true, false, "reset soon"},
      {3600, false, false, "NA"},
      {90061, true, true, "1d 01h"},
      {3661, true, true, "1h 01m"},
      {59, true, true, "1m"},
      {3600, false, true, "NA"},
  };
  for (const Case& testCase : cases) {
    // Arrange
    memset(out, 0, sizeof(out));

    // Act
    formatResetCountdown(testCase.seconds, testCase.available, testCase.compact, out, sizeof(out));

    // Assert
    if (strcmp(out, testCase.expected) != 0) {
      fprintf(stderr, "%lld => %s expected %s\n", (long long)testCase.seconds, out, testCase.expected);
      return 1;
    }
  }
  return 0;
}
