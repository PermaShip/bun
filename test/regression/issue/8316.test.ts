// https://github.com/oven-sh/bun/issues/8316
// console.log should respect enumerable:false from Object.defineProperty

import { test, expect } from "bun:test";
import { bunEnv, bunExe } from "harness";

test("console.log hides properties with enumerable:false set via Object.defineProperty", async () => {
  await using proc = Bun.spawn({
    cmd: [
      bunExe(),
      "-e",
      `
const test = { a: 1, b: 2 };
Object.defineProperty(test, "b", { enumerable: false });
console.log(test);
`,
    ],
    env: bunEnv,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, exitCode] = await Promise.all([proc.stdout.text(), proc.exited]);

  expect(stdout).toContain("a: 1");
  expect(stdout).not.toContain("b:");
  expect(exitCode).toBe(0);
});

test("console.log shows all properties before Object.defineProperty change", async () => {
  await using proc = Bun.spawn({
    cmd: [
      bunExe(),
      "-e",
      `
const test = { a: 1, b: 2 };
console.log(test);
`,
    ],
    env: bunEnv,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, exitCode] = await Promise.all([proc.stdout.text(), proc.exited]);

  expect(stdout).toContain("a: 1");
  expect(stdout).toContain("b: 2");
  expect(exitCode).toBe(0);
});

test("console.log hides property initially defined with enumerable:false", async () => {
  await using proc = Bun.spawn({
    cmd: [
      bunExe(),
      "-e",
      `
const obj = {};
Object.defineProperty(obj, "hidden", { value: 42, enumerable: false });
Object.defineProperty(obj, "visible", { value: 99, enumerable: true });
console.log(obj);
`,
    ],
    env: bunEnv,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, exitCode] = await Promise.all([proc.stdout.text(), proc.exited]);

  expect(stdout).toContain("visible: 99");
  expect(stdout).not.toContain("hidden:");
  expect(exitCode).toBe(0);
});
