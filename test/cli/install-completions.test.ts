import { test, expect, describe } from "bun:test";
import { bunEnv, bunExe, tempDir } from "harness";
import path from "node:path";
import fs from "node:fs";

describe("bun completions (fish)", () => {
  test("installs to vendor_completions.d when directory does not exist", async () => {
    using dir = tempDir("fish-completions-vendor", {});
    const home = String(dir);

    await using proc = Bun.spawn({
      cmd: [bunExe(), "completions"],
      env: {
        ...bunEnv,
        SHELL: "fish",
        HOME: home,
        IS_BUN_AUTO_UPDATE: "1",
        // Unset XDG overrides so we test the HOME-based fallback
        XDG_DATA_HOME: undefined,
        XDG_CONFIG_HOME: undefined,
      },
      stderr: "pipe",
      stdout: "pipe",
    });

    const [stderr, exitCode] = await Promise.all([proc.stderr.text(), proc.exited]);

    const completionFile = path.join(home, ".local", "share", "fish", "vendor_completions.d", "bun.fish");
    expect(fs.existsSync(completionFile)).toBe(true);
    expect(fs.readFileSync(completionFile, "utf8").length).toBeGreaterThan(0);
    expect(exitCode).toBe(0);
  });

  test("installs to vendor_completions.d when directory already exists", async () => {
    using dir = tempDir("fish-completions-vendor-exists", {});
    const home = String(dir);
    const vendorDir = path.join(home, ".local", "share", "fish", "vendor_completions.d");
    fs.mkdirSync(vendorDir, { recursive: true });

    await using proc = Bun.spawn({
      cmd: [bunExe(), "completions"],
      env: {
        ...bunEnv,
        SHELL: "fish",
        HOME: home,
        IS_BUN_AUTO_UPDATE: "1",
        XDG_DATA_HOME: undefined,
        XDG_CONFIG_HOME: undefined,
      },
      stderr: "pipe",
      stdout: "pipe",
    });

    const [stderr, exitCode] = await Promise.all([proc.stderr.text(), proc.exited]);

    const completionFile = path.join(vendorDir, "bun.fish");
    expect(fs.existsSync(completionFile)).toBe(true);
    expect(fs.readFileSync(completionFile, "utf8").length).toBeGreaterThan(0);
    expect(exitCode).toBe(0);
  });

  test("respects XDG_DATA_HOME for vendor_completions.d", async () => {
    using dir = tempDir("fish-completions-xdg", {});
    const home = String(dir);
    const xdgDataHome = path.join(home, "xdg-data");
    fs.mkdirSync(xdgDataHome, { recursive: true });

    await using proc = Bun.spawn({
      cmd: [bunExe(), "completions"],
      env: {
        ...bunEnv,
        SHELL: "fish",
        HOME: home,
        XDG_DATA_HOME: xdgDataHome,
        IS_BUN_AUTO_UPDATE: "1",
        XDG_CONFIG_HOME: undefined,
      },
      stderr: "pipe",
      stdout: "pipe",
    });

    const [stderr, exitCode] = await Promise.all([proc.stderr.text(), proc.exited]);

    // Should install to XDG_DATA_HOME/fish/vendor_completions.d, not HOME/.local/...
    const xdgCompletionFile = path.join(xdgDataHome, "fish", "vendor_completions.d", "bun.fish");
    const homeCompletionFile = path.join(home, ".local", "share", "fish", "vendor_completions.d", "bun.fish");
    expect(fs.existsSync(xdgCompletionFile)).toBe(true);
    expect(fs.existsSync(homeCompletionFile)).toBe(false);
    expect(fs.readFileSync(xdgCompletionFile, "utf8").length).toBeGreaterThan(0);
    expect(exitCode).toBe(0);
  });

  test("does not install to config/fish/completions when vendor_completions.d can be created", async () => {
    using dir = tempDir("fish-completions-no-config", {});
    const home = String(dir);
    // Create the old-style config completions dir to ensure we prefer vendor dir
    const configDir = path.join(home, ".config", "fish", "completions");
    fs.mkdirSync(configDir, { recursive: true });

    await using proc = Bun.spawn({
      cmd: [bunExe(), "completions"],
      env: {
        ...bunEnv,
        SHELL: "fish",
        HOME: home,
        IS_BUN_AUTO_UPDATE: "1",
        XDG_DATA_HOME: undefined,
        XDG_CONFIG_HOME: undefined,
      },
      stderr: "pipe",
      stdout: "pipe",
    });

    const [stderr, exitCode] = await Promise.all([proc.stderr.text(), proc.exited]);

    // vendor_completions.d should be used (created), not config/fish/completions
    const vendorFile = path.join(home, ".local", "share", "fish", "vendor_completions.d", "bun.fish");
    const configFile = path.join(configDir, "bun.fish");
    expect(fs.existsSync(vendorFile)).toBe(true);
    expect(fs.existsSync(configFile)).toBe(false);
    expect(exitCode).toBe(0);
  });
});
