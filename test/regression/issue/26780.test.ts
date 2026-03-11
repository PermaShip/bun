import { expect, test } from "bun:test";
import { bunEnv, bunExe, tempDir } from "harness";
import { join } from "node:path";

// https://github.com/oven-sh/bun/issues/26780
// Bun.write(localFile, s3File) should create parent directories by default,
// matching the behavior of Bun.write(localFile, string/Buffer/BunFile).

test("Bun.write(s3File, localFile) creates parent directories by default", async () => {
  using server = Bun.serve({
    port: 0,
    fetch(req) {
      // Respond to any GET request (simulates S3 GET object)
      return new Response("hello from s3", {
        headers: { "Content-Type": "text/plain" },
      });
    },
  });

  using dir = tempDir("issue-26780-default", {});
  const destPath = join(String(dir), "new-dir", "subdir", "file.txt");

  await using proc = Bun.spawn({
    cmd: [
      bunExe(),
      "-e",
      `
const { S3Client } = require("bun");
const { join } = require("node:path");

const client = new S3Client({
  accessKeyId: "test",
  secretAccessKey: "test",
  endpoint: process.env.MOCK_S3_URL,
  bucket: "test-bucket",
});

const destPath = process.env.DEST_PATH;
await Bun.write(destPath, client.file("hello.txt"));
const content = await Bun.file(destPath).text();
process.stdout.write(content);
`,
    ],
    env: {
      ...bunEnv,
      MOCK_S3_URL: server.url.href,
      DEST_PATH: destPath,
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

  expect(stdout).toBe("hello from s3");
  expect(stderr).toBe("");
  expect(exitCode).toBe(0);
});

test("Bun.write(s3File, localFile) creates parent directories with createPath: true", async () => {
  using server = Bun.serve({
    port: 0,
    fetch(req) {
      return new Response("hello from s3", {
        headers: { "Content-Type": "text/plain" },
      });
    },
  });

  using dir = tempDir("issue-26780-createpath-true", {});
  const destPath = join(String(dir), "new-dir", "subdir", "file.txt");

  await using proc = Bun.spawn({
    cmd: [
      bunExe(),
      "-e",
      `
const { S3Client } = require("bun");
const { join } = require("node:path");

const client = new S3Client({
  accessKeyId: "test",
  secretAccessKey: "test",
  endpoint: process.env.MOCK_S3_URL,
  bucket: "test-bucket",
});

const destPath = process.env.DEST_PATH;
await Bun.write(destPath, client.file("hello.txt"), { createPath: true });
const content = await Bun.file(destPath).text();
process.stdout.write(content);
`,
    ],
    env: {
      ...bunEnv,
      MOCK_S3_URL: server.url.href,
      DEST_PATH: destPath,
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

  expect(stdout).toBe("hello from s3");
  expect(stderr).toBe("");
  expect(exitCode).toBe(0);
});

test("Bun.write(s3File, localFile) rejects with createPath: false when parent dir missing", async () => {
  using server = Bun.serve({
    port: 0,
    fetch(req) {
      return new Response("hello from s3", {
        headers: { "Content-Type": "text/plain" },
      });
    },
  });

  using dir = tempDir("issue-26780-createpath-false", {});
  const destPath = join(String(dir), "new-dir", "subdir", "file.txt");

  await using proc = Bun.spawn({
    cmd: [
      bunExe(),
      "-e",
      `
const { S3Client } = require("bun");
const { join } = require("node:path");

const client = new S3Client({
  accessKeyId: "test",
  secretAccessKey: "test",
  endpoint: process.env.MOCK_S3_URL,
  bucket: "test-bucket",
});

const destPath = process.env.DEST_PATH;
try {
  await Bun.write(destPath, client.file("hello.txt"), { createPath: false });
  process.exit(1); // should not reach here
} catch (err) {
  process.stdout.write(err.code || "no-code");
}
`,
    ],
    env: {
      ...bunEnv,
      MOCK_S3_URL: server.url.href,
      DEST_PATH: destPath,
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

  expect(stdout).toBe("ENOENT");
  expect(exitCode).toBe(0);
});
