#pragma once

#include <stdint.h>
#include <stdio.h>
#include <stddef.h>

inline void formatResetCountdown(int64_t remaining, bool available, bool compact, char* out, size_t len) {
  if (!available) {
    snprintf(out, len, "NA");
    return;
  }
  if (remaining <= 0) {
    snprintf(out, len, "reset soon");
    return;
  }

  const uint64_t left = static_cast<uint64_t>(remaining);
  if (left >= 86400) {
    snprintf(out, len, compact ? "%llud %02lluh" : "resets in %llud %02lluh",
             static_cast<unsigned long long>(left / 86400),
             static_cast<unsigned long long>((left / 3600) % 24));
  } else if (left >= 3600) {
    snprintf(out, len, compact ? "%lluh %02llum" : "resets in %lluh %02llum",
             static_cast<unsigned long long>(left / 3600),
             static_cast<unsigned long long>((left / 60) % 60));
  } else {
    const uint64_t minutes = (left + 59) / 60;
    snprintf(out, len, compact ? "%llum" : "resets in %llum", static_cast<unsigned long long>(minutes));
  }
}
