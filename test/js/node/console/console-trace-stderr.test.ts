import { test, expect } from "bun:test";
import { bunEnv, bunExe } from "harness";

// Regression test for https://github.com/oven-sh/bun/issues/19952
// console.trace() must write to stderr, not stdout
test("console.trace() writes to stderr, not stdout", async () => {
  await using proc = Bun.spawn({
    cmd: [bunExe(), "-e", 'console.trace("hello")'],
    env: bunEnv,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

  expect(stdout).toBe("");
  expect(stderr).toContain("Trace: hello");
  expect(exitCode).toBe(0);
});

test("console.trace() with no args writes to stderr", async () => {
  await using proc = Bun.spawn({
    cmd: [bunExe(), "-e", "console.trace()"],
    env: bunEnv,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

  expect(stdout).toBe("");
  expect(stderr).toContain("Trace");
  expect(exitCode).toBe(0);
});
