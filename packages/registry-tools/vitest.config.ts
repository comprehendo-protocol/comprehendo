import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // This package's suites spawn real subprocesses throughout (npm pack,
    // npm install --offline, the real ffmpeg binary), by design: the whole
    // project's discipline is real induction, never a mock. The 5s default
    // is comfortable on a fast machine and latently flaky under load; found
    // by 34-upstream-watch's build (gate-folklore.test.ts's "reports the
    // same defect the same way whichever tier carries it" ran 5.24s under
    // load, over the default). 20s gives real subprocess work headroom
    // without hiding a genuinely hung test (still fails, just later).
    testTimeout: 20_000,
  },
});
