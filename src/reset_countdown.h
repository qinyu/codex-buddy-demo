#pragma once

#include <stdint.h>
#include <stdio.h>
#include <stddef.h>

namespace reset_countdown {
constexpr uint32_t kSecondsPerMinute = 60;
constexpr uint32_t kMinutesPerHour = 60;
constexpr uint32_t kHoursPerDay = 24;
constexpr uint32_t kSecondsPerHour = kSecondsPerMinute * kMinutesPerHour;
constexpr uint32_t kSecondsPerDay = kSecondsPerHour * kHoursPerDay;
}

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
  if (left >= reset_countdown::kSecondsPerDay) {
    snprintf(out, len, compact ? "%llud %02lluh" : "resets in %llud %02lluh",
             static_cast<unsigned long long>(left / reset_countdown::kSecondsPerDay),
             static_cast<unsigned long long>((left / reset_countdown::kSecondsPerHour) % reset_countdown::kHoursPerDay));
  } else if (left >= reset_countdown::kSecondsPerHour) {
    snprintf(out, len, compact ? "%lluh %02llum" : "resets in %lluh %02llum",
             static_cast<unsigned long long>(left / reset_countdown::kSecondsPerHour),
             static_cast<unsigned long long>((left / reset_countdown::kSecondsPerMinute) % reset_countdown::kMinutesPerHour));
  } else {
    const uint64_t minutes = (left + reset_countdown::kSecondsPerMinute - 1) / reset_countdown::kSecondsPerMinute;
    snprintf(out, len, compact ? "%llum" : "resets in %llum", static_cast<unsigned long long>(minutes));
  }
}
