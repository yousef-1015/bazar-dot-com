#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
BOOK_ID="${BOOK_ID:-1}"
RUNS="${RUNS:-20}"

average() {
  awk '{ sum += $1 } END { if (NR > 0) printf "%.7f\n", sum / NR }'
}

measure_cached_info() {
  echo "Experiment 1: GET /info/${BOOK_ID} with cache"
  echo "Warming cache..."
  curl -s "${BASE_URL}/info/${BOOK_ID}" > /dev/null

  for i in $(seq 1 "${RUNS}"); do
    curl -s -o /dev/null -w "%{time_total}\n" "${BASE_URL}/info/${BOOK_ID}"
  done | tee /tmp/bazar_cached_times.txt

  echo "Average cached response time:"
  average < /tmp/bazar_cached_times.txt
  echo
}

measure_cache_miss_after_invalidation() {
  echo "Experiment 2: GET /info/${BOOK_ID} after cache invalidation"

  for i in $(seq 1 "${RUNS}"); do
    curl -s -X DELETE "${BASE_URL}/cache/${BOOK_ID}" > /dev/null
    curl -s -o /dev/null -w "%{time_total}\n" "${BASE_URL}/info/${BOOK_ID}"
  done | tee /tmp/bazar_cache_miss_times.txt

  echo "Average cache-miss response time:"
  average < /tmp/bazar_cache_miss_times.txt
  echo
}

measure_invalidation_overhead() {
  echo "Experiment 3: DELETE /cache/${BOOK_ID} invalidation overhead"

  for i in $(seq 1 "${RUNS}"); do
    curl -s -o /dev/null -w "%{time_total}\n" -X DELETE "${BASE_URL}/cache/${BOOK_ID}"
  done | tee /tmp/bazar_invalidation_times.txt

  echo "Average invalidation response time:"
  average < /tmp/bazar_invalidation_times.txt
  echo
}

echo "Bazar.com Phase 2 performance measurement"
echo "Base URL: ${BASE_URL}"
echo "Book ID: ${BOOK_ID}"
echo "Runs per experiment: ${RUNS}"
echo

measure_cached_info
measure_cache_miss_after_invalidation
measure_invalidation_overhead
