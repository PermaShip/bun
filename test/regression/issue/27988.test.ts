// https://github.com/oven-sh/bun/issues/27988
// On Windows, `bun run` could not find local .bat/.cmd files by bare name in
// package.json scripts. cmd.exe searches the current directory before PATH for
// bare command names; this test verifies Bun replicates that behavior.

import { test, expect } from "bun:test";
import { bunEnv, bunExe, isWindows, normalizeBunSnapshot, tempDir } from "harness";
import { which } from "bun";

test.skipIf(!isWindows)("bun run finds bare .bat file in cwd (package.json script)", async () => {
  using dir = tempDir("issue-27988-bat", {
    "package.json": JSON.stringify({
      name: "issue-27988",
      scripts: {
        recovery: "WebRecovery.bat",
      },
    }),
    "WebRecovery.bat": "@echo recovered\r\n",
  });

  await using proc = Bun.spawn({
    cmd: [bunExe(), "run", "recovery"],
    env: bunEnv,
    cwd: String(dir),
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

  expect(normalizeBunSnapshot(stdout, dir)).toContain("recovered");
  expect(exitCode).toBe(0);
});

test.skipIf(!isWindows)("bun run finds bare .cmd file in cwd (package.json script)", async () => {
  using dir = tempDir("issue-27988-cmd", {
    "package.json": JSON.stringify({
      name: "issue-27988",
      scripts: {
        dev: "start.cmd",
      },
    }),
    "start.cmd": "@echo started\r\n",
  });

  await using proc = Bun.spawn({
    cmd: [bunExe(), "run", "dev"],
    env: bunEnv,
    cwd: String(dir),
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

  expect(normalizeBunSnapshot(stdout, dir)).toContain("started");
  expect(exitCode).toBe(0);
});

test.skipIf(!isWindows)("Bun.which finds bare .bat file in cwd", () => {
  using dir = tempDir("issue-27988-which", {
    "WebRecovery.bat": "@echo recovered\r\n",
  });

  const result = which("WebRecovery.bat", { cwd: String(dir), PATH: "" });
  expect(result).not.toBeNull();
  expect(result!.toLowerCase()).toContain("webrecovery.bat");
});

test.skipIf(!isWindows)("Bun.which finds bare command name (no extension) for .bat in cwd", () => {
  using dir = tempDir("issue-27988-which-noext", {
    "WebRecovery.bat": "@echo recovered\r\n",
  });

  const result = which("WebRecovery", { cwd: String(dir), PATH: "" });
  expect(result).not.toBeNull();
  expect(result!.toLowerCase()).toContain("webrecovery");
});
