import { expect, it } from "bun:test";
import { bunEnv, bunExe, normalizeBunSnapshot, tempDir, tempDirWithFiles } from "harness";

it("should handle quote escapes", () => {
  const package_json = JSON.stringify({
    scripts: {
      test: `echo "test\\\\$(pwd)"`,
    },
  });
  expect(package_json).toContain('\\"');
  expect(package_json).toContain("\\\\");
  const dir = tempDirWithFiles("run-quote", { "package.json": package_json });
  const result = Bun.spawnSync({
    cmd: [bunExe(), "run", "--silent", "test"],
    cwd: dir,
    env: bunEnv,
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(result.stdout.toString().trim()).toBe(`test\\${dir}`);
});

it("should not escape plain passthrough args containing no special chars", async () => {
  using dir = tempDir("run-quote-plain", {
    "package.json": JSON.stringify({
      scripts: {
        foo: `echo "ONE" TWO`,
      },
    }),
  });

  await using proc = Bun.spawn({
    cmd: [bunExe(), "run", "--silent", "foo", "THREE"],
    cwd: String(dir),
    env: bunEnv,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

  expect(normalizeBunSnapshot(stdout)).toMatchInlineSnapshot(`"ONE TWO THREE"`);
  expect(exitCode).toBe(0);
});

it("should use single-quote wrapping for passthrough args with dollar signs", async () => {
  using dir = tempDir("run-quote-dollar", {
    "package.json": JSON.stringify({
      scripts: {
        foo: `echo "ONE" TWO`,
      },
    }),
  });

  await using proc = Bun.spawn({
    cmd: [bunExe(), "run", "foo", "$NOTAVAR"],
    cwd: String(dir),
    env: { ...bunEnv, NOTAVAR: undefined },
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

  expect(stderr).toContain("'$NOTAVAR'");
  expect(normalizeBunSnapshot(stdout)).toMatchInlineSnapshot(`"ONE TWO $NOTAVAR"`);
  expect(exitCode).toBe(0);
});

it("should use single-quote wrapping for passthrough args with spaces", async () => {
  using dir = tempDir("run-quote-space", {
    "package.json": JSON.stringify({
      scripts: {
        foo: `echo "ONE" TWO`,
      },
    }),
  });

  await using proc = Bun.spawn({
    cmd: [bunExe(), "run", "foo", "hello world"],
    cwd: String(dir),
    env: bunEnv,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

  expect(stderr).toContain("'hello world'");
  expect(normalizeBunSnapshot(stdout)).toMatchInlineSnapshot(`"ONE TWO hello world"`);
  expect(exitCode).toBe(0);
});

it("should use single-quote wrapping for passthrough args containing double quotes", async () => {
  using dir = tempDir("run-quote-dquote", {
    "package.json": JSON.stringify({
      scripts: {
        foo: `echo "ONE" TWO`,
      },
    }),
  });

  await using proc = Bun.spawn({
    cmd: [bunExe(), "run", "foo", '"hello"'],
    cwd: String(dir),
    env: bunEnv,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

  // With single-quote wrapping: '"hello"' — no backslash-escaped quotes in display
  expect(stderr).not.toContain('\\"');
  expect(stderr).toContain(`'"hello"'`);
  expect(normalizeBunSnapshot(stdout)).toMatchInlineSnapshot(`'ONE TWO "hello"'`);
  expect(exitCode).toBe(0);
});
