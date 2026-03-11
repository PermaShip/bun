import { test, expect } from "bun:test";
import { bunEnv, bunExe } from "../../harness.js";

// https://github.com/oven-sh/bun/issues/4223
// console.log of class instances should not show prototype methods

test("console.log does not show prototype methods on class instances", async () => {
  await using proc = Bun.spawn({
    cmd: [
      bunExe(),
      "-e",
      `
class ImageSettings {
  a = 123;
  toJSON() {
    return { a: '456' };
  }
}
const imageSettings = new ImageSettings();
console.log(imageSettings);
`,
    ],
    env: bunEnv,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
  expect(stdout).toBe("ImageSettings { a: 123 }\n");
  expect(stderr).toBe("");
  expect(exitCode).toBe(0);
});

test("console.log shows own function properties (not prototype methods)", async () => {
  await using proc = Bun.spawn({
    cmd: [
      bunExe(),
      "-e",
      `
const obj = { a: 1, fn: function myFn() {} };
console.log(obj);
`,
    ],
    env: bunEnv,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
  expect(stdout).toBe("{ a: 1, fn: [Function: myFn] }\n");
  expect(stderr).toBe("");
  expect(exitCode).toBe(0);
});

test("console.log shows class name and own properties only", async () => {
  await using proc = Bun.spawn({
    cmd: [
      bunExe(),
      "-e",
      `
class Foo {
  x = 1;
  y = 2;
  method1() {}
  method2() { return this.x; }
  get computed() { return this.y; }
}
console.log(new Foo());
`,
    ],
    env: bunEnv,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
  // Should show own properties x and y, but NOT prototype methods method1, method2
  // getter 'computed' may appear as [Getter] - this matches Node.js behavior
  expect(stdout).toContain("Foo {");
  expect(stdout).toContain("x: 1");
  expect(stdout).toContain("y: 2");
  expect(stdout).not.toContain("method1");
  expect(stdout).not.toContain("method2");
  expect(stderr).toBe("");
  expect(exitCode).toBe(0);
});

test("console.log handles empty class instance correctly", async () => {
  await using proc = Bun.spawn({
    cmd: [
      bunExe(),
      "-e",
      `
class Empty {
  doSomething() { return 42; }
}
console.log(new Empty());
`,
    ],
    env: bunEnv,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
  expect(stdout).toBe("Empty {}\n");
  expect(stderr).toBe("");
  expect(exitCode).toBe(0);
});

test("Bun.inspect does not show prototype methods on class instances", async () => {
  await using proc = Bun.spawn({
    cmd: [
      bunExe(),
      "-e",
      `
class Settings {
  value = 42;
  toString() { return String(this.value); }
  toJSON() { return { value: this.value }; }
}
const result = Bun.inspect(new Settings());
console.log(result);
`,
    ],
    env: bunEnv,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
  expect(stdout).toBe("Settings { value: 42 }\n");
  expect(stderr).toBe("");
  expect(exitCode).toBe(0);
});
