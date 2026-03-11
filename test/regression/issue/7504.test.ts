import { test, expect } from "bun:test";
import { bunEnv, bunExe, isWindows, tempDir } from "harness";
import os from "node:os";

// https://github.com/oven-sh/bun/issues/7504
// When bun --bun is used to override Node.js, the override directory path
// must be user-specific (include UID) to avoid collisions between users
// or between different Bun installations for the same user.
test("bun --bun uses a user-unique path for node override", async () => {
  using dir = tempDir("bun-node-uid-test", {
    "package.json": JSON.stringify({ scripts: { "find-node": "which node" } }),
  });

  await using proc = Bun.spawn({
    cmd: [bunExe(), "--bun", "run", "find-node"],
    env: bunEnv,
    cwd: String(dir),
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, exitCode] = await Promise.all([proc.stdout.text(), proc.exited]);

  if (!isWindows) {
    const uid = String(os.userInfo().uid);
    const nodePath = stdout.trim();
    // The path used for node override must contain "bun-node" and the user's UID
    expect(nodePath).toContain("bun-node");
    expect(nodePath).toContain(`-${uid}`);
  }

  expect(exitCode).toBe(0);
});
