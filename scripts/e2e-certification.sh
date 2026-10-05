#!/usr/bin/env bash
set -u
echo "diagnostic unit test stage"
node --experimental-strip-types --test --test-reporter=tap tests/*.test.ts
code=$?
echo "unit-test-exit-code=$code"
exit $code
