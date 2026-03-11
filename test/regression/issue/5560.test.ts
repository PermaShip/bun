// https://github.com/oven-sh/bun/issues/5560
// The `cpy` npm library fails with "undefined is not an object" when using graceful-fs.
// Root cause: Readable.prototype.on and Readable.prototype.removeListener crash when
// _readableState is undefined (e.g. when a stream inherits from Readable.prototype
// but does not call the Readable constructor, as graceful-fs does with its wrapper
// ReadStream class).

import { test, expect } from "bun:test";
import { bunEnv, bunExe, tempDir } from "harness";

test("Readable.prototype.on does not crash when _readableState is undefined", async () => {
  await using proc = Bun.spawn({
    cmd: [
      bunExe(),
      "-e",
      `
import { Readable } from 'node:stream';

// Simulate how graceful-fs wraps the native ReadStream:
// It creates a wrapper that inherits from Readable.prototype
// but does NOT call the Readable constructor, so _readableState is undefined.
function GracefulReadStream(path, options) {
  if (!(this instanceof GracefulReadStream)) {
    return new GracefulReadStream(path, options);
  }
  // Intentionally NOT calling Readable constructor - simulates streams that
  // inherit from Readable prototype without calling Readable.call(this, ...)
}
GracefulReadStream.prototype = Object.create(Readable.prototype);
GracefulReadStream.prototype.constructor = GracefulReadStream;

const stream = new GracefulReadStream('/some/path');

// These must not throw even though _readableState is undefined
stream.on('readable', () => {});
stream.on('data', () => {});
stream.removeListener('readable', () => {});
stream.removeListener('data', () => {});
stream.off('readable', () => {});
stream.off('data', () => {});
stream.removeAllListeners('readable');
stream.removeAllListeners('data');
stream.removeAllListeners();

console.log('OK');
`,
    ],
    env: bunEnv,
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

  expect(stdout.trim()).toBe("OK");
  expect(exitCode).toBe(0);
});

test("cpy library can copy files", async () => {
  using dir = tempDir("cpy-test", {
    "package.json": JSON.stringify({
      type: "module",
      dependencies: { cpy: "latest" },
    }),
    "dir1/a.txt": "aaaa",
    "dir1/b.txt": "bbbb",
    "index.mjs": `
import cpy from 'cpy';
await cpy('./dir1/**', './dir2');
const fs = await import('node:fs');
const files = fs.readdirSync('./dir2');
console.log(files.sort().join(','));
`,
  });

  // Install dependencies
  await using installProc = Bun.spawn({
    cmd: [bunExe(), "install"],
    env: bunEnv,
    cwd: String(dir),
    stderr: "pipe",
  });
  const installExit = await installProc.exited;
  expect(installExit).toBe(0);

  // Run the cpy script
  await using proc = Bun.spawn({
    cmd: [bunExe(), "index.mjs"],
    env: bunEnv,
    cwd: String(dir),
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

  expect(stdout.trim()).toBe("a.txt,b.txt");
  expect(exitCode).toBe(0);
});
