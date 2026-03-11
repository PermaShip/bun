import { describe, expect, test } from "bun:test";
import { bunEnv, bunExe, isWindows, tempDir } from "harness";
import fs from "node:fs";
import path from "node:path";

// https://github.com/oven-sh/bun/issues/27924
// Globally installed CLIs using `#!/usr/bin/env -S node` (or other env flags) failed on Windows.
// The Windows shim writer (BinLinkingShim.zig) would treat "-S" as the interpreter name,
// causing bun_shim_impl.exe to report: error: interpreter executable "-S" not found in %PATH%
describe.if(isWindows)("#27924 - env flags in shebang are ignored when creating Windows shim", () => {
  test("#!/usr/bin/env -S node shebang runs correctly", async () => {
    using dir = tempDir("issue-27924-env-s", {
      "package.json": JSON.stringify({
        name: "test-project",
        version: "1.0.0",
        dependencies: {
          "env-s-cli": "file:./env-s-cli",
        },
      }),
      "env-s-cli/package.json": JSON.stringify({
        name: "env-s-cli",
        version: "1.0.0",
        bin: {
          "env-s-cli": "./index.js",
        },
      }),
      // Use -S flag before node — this is what breaks the Windows shim without the fix
      "env-s-cli/index.js": `#!/usr/bin/env -S node\nconsole.log("hello from env -S node");\n`,
    });

    // Install to create .bunx shim in node_modules/.bin
    await using installProc = Bun.spawn({
      cmd: [bunExe(), "install"],
      env: bunEnv,
      cwd: String(dir),
      stderr: "pipe",
    });
    await installProc.exited;
    expect(installProc.exitCode).toBe(0);

    // Verify the .bunx file was created
    const bunxPath = path.join(String(dir), "node_modules", ".bin", "env-s-cli.bunx");
    expect(fs.existsSync(bunxPath)).toBe(true);

    // Run the binary — without the fix, this fails with "interpreter executable -S not found"
    await using proc = Bun.spawn({
      cmd: [bunExe(), "run", "env-s-cli"],
      env: bunEnv,
      cwd: String(dir),
      stderr: "pipe",
    });

    const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

    expect(stdout.trim()).toBe("hello from env -S node");
    expect(exitCode).toBe(0);
  });

  test("#!/usr/bin/env --split-string node shebang runs correctly", async () => {
    using dir = tempDir("issue-27924-split-string", {
      "package.json": JSON.stringify({
        name: "test-project",
        version: "1.0.0",
        dependencies: {
          "split-string-cli": "file:./split-string-cli",
        },
      }),
      "split-string-cli/package.json": JSON.stringify({
        name: "split-string-cli",
        version: "1.0.0",
        bin: {
          "split-string-cli": "./index.js",
        },
      }),
      "split-string-cli/index.js": `#!/usr/bin/env --split-string node\nconsole.log("hello from env --split-string");\n`,
    });

    await using installProc = Bun.spawn({
      cmd: [bunExe(), "install"],
      env: bunEnv,
      cwd: String(dir),
      stderr: "pipe",
    });
    await installProc.exited;
    expect(installProc.exitCode).toBe(0);

    const bunxPath = path.join(String(dir), "node_modules", ".bin", "split-string-cli.bunx");
    expect(fs.existsSync(bunxPath)).toBe(true);

    await using proc = Bun.spawn({
      cmd: [bunExe(), "run", "split-string-cli"],
      env: bunEnv,
      cwd: String(dir),
      stderr: "pipe",
    });

    const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

    expect(stdout.trim()).toBe("hello from env --split-string");
    expect(exitCode).toBe(0);
  });

  test("#!/usr/bin/env node (no flags) still works correctly", async () => {
    using dir = tempDir("issue-27924-no-flags", {
      "package.json": JSON.stringify({
        name: "test-project",
        version: "1.0.0",
        dependencies: {
          "no-flags-cli": "file:./no-flags-cli",
        },
      }),
      "no-flags-cli/package.json": JSON.stringify({
        name: "no-flags-cli",
        version: "1.0.0",
        bin: {
          "no-flags-cli": "./index.js",
        },
      }),
      "no-flags-cli/index.js": `#!/usr/bin/env node\nconsole.log("hello from plain env node");\n`,
    });

    await using installProc = Bun.spawn({
      cmd: [bunExe(), "install"],
      env: bunEnv,
      cwd: String(dir),
      stderr: "pipe",
    });
    await installProc.exited;
    expect(installProc.exitCode).toBe(0);

    await using proc = Bun.spawn({
      cmd: [bunExe(), "run", "no-flags-cli"],
      env: bunEnv,
      cwd: String(dir),
      stderr: "pipe",
    });

    const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

    expect(stdout.trim()).toBe("hello from plain env node");
    expect(exitCode).toBe(0);
  });
});
