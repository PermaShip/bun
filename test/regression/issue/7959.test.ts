/**
 * Regression test for https://github.com/oven-sh/bun/issues/7959
 *
 * child_process.spawn() should accept fs.ReadStream and fs.WriteStream objects
 * as stdio options. When the stream has no open fd (e.g. a newly-created
 * fs.createReadStream before opening), a pipe is created and data is forwarded
 * after spawning instead of throwing "Invalid stdio option".
 */
import { expect, test } from "bun:test";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { bunEnv, bunExe, tempDir } from "harness";

test("spawn() accepts fs.createReadStream() as stdio[0] (stdin)", async () => {
  using dir = tempDir("issue-7959-stdin", {
    "input.txt": "hello from file\n",
  });

  const inputFile = path.join(String(dir), "input.txt");
  const readStream = fs.createReadStream(inputFile);

  // Before our fix, this would throw: "TODO: stream.Readable stdio @ 0"
  const child = spawn(
    bunExe(),
    [
      "-e",
      "let d=''; process.stdin.setEncoding('utf8'); process.stdin.on('data', c => d+=c); process.stdin.on('end', () => process.stdout.write(d));",
    ],
    {
      stdio: [readStream, "pipe", "pipe"],
      env: bunEnv,
    },
  );

  const [stdout, exitCode] = await Promise.all([
    new Response(child.stdout!).text(),
    new Promise<number>(resolve => child.once("close", resolve)),
  ]);

  expect(stdout).toBe("hello from file\n");
  expect(exitCode).toBe(0);
});

test("spawn() accepts fs.createWriteStream() as stdio[1] (stdout)", async () => {
  using dir = tempDir("issue-7959-stdout", {
    "output.txt": "",
  });

  const outputFile = path.join(String(dir), "output.txt");
  const writeStream = fs.createWriteStream(outputFile);

  // Before our fix, this would throw: "Invalid stdio option[1] \"[object WriteStream]\""
  const child = spawn(bunExe(), ["-e", "process.stdout.write('hello from child\\n');"], {
    stdio: ["pipe", writeStream, "pipe"],
    env: bunEnv,
  });

  // Wait for the write stream to close (after child finishes writing)
  await new Promise<void>((resolve, reject) => {
    writeStream.once("close", resolve);
    writeStream.once("error", reject);
    child.once("error", reject);
  });

  const output = await Bun.file(outputFile).text();
  expect(output).toBe("hello from child\n");
});

test("spawn() with ReadStream as stdio[0]: proc.stdin is null", async () => {
  using dir = tempDir("issue-7959-stdin-null", {
    "input.txt": "data\n",
  });

  const inputFile = path.join(String(dir), "input.txt");
  const readStream = fs.createReadStream(inputFile);

  const child = spawn(bunExe(), ["-e", "process.stdin.resume();"], {
    stdio: [readStream, "pipe", "pipe"],
    env: bunEnv,
  });

  // When a ReadStream (no open fd) is passed as stdin, proc.stdin must be null
  expect(child.stdin).toBeNull();

  await new Promise<void>(resolve => child.once("close", resolve));
});

test("spawn() with WriteStream as stdio[1]: proc.stdout is null", async () => {
  using dir = tempDir("issue-7959-stdout-null", {
    "output.txt": "",
  });

  const outputFile = path.join(String(dir), "output.txt");
  const writeStream = fs.createWriteStream(outputFile);

  const child = spawn(bunExe(), ["-e", "process.stdout.write('x');"], {
    stdio: ["pipe", writeStream, "pipe"],
    env: bunEnv,
  });

  // When a WriteStream (no open fd) is passed as stdout, proc.stdout must be null
  expect(child.stdout).toBeNull();

  await new Promise<void>((resolve, reject) => {
    writeStream.once("close", resolve);
    writeStream.once("error", reject);
    child.once("error", reject);
  });
});

test("spawn() with ReadStream that has an open fd uses it directly (no regression)", async () => {
  // process.stdin has fd=0 — should be used directly without pipe forwarding
  const child = spawn(bunExe(), ["-e", 'process.stdout.write("ok");'], {
    stdio: [process.stdin, "pipe", "pipe"],
    env: bunEnv,
  });

  const [stdout, exitCode] = await Promise.all([
    new Response(child.stdout!).text(),
    new Promise<number>(resolve => child.once("close", resolve)),
  ]);

  expect(stdout).toBe("ok");
  expect(exitCode).toBe(0);
});
