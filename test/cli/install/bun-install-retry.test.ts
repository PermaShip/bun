import { file, spawn } from "bun";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, setDefaultTimeout } from "bun:test";
import { access, writeFile } from "fs/promises";
import { basename } from "path";
import { bunExe, bunEnv as env, readdirSorted, tmpdirSync, toBeValidBin, toBeWorkspaceLink, toHaveBins } from "harness";
import { join } from "path";
import {
  dummyAfterAll,
  dummyAfterEach,
  dummyBeforeAll,
  dummyBeforeEach,
  dummyRegistry,
  package_dir,
  requested,
  root_url,
  setHandler,
} from "./dummy.registry";

beforeAll(dummyBeforeAll);
afterAll(dummyAfterAll);

expect.extend({
  toHaveBins,
  toBeValidBin,
  toBeWorkspaceLink,
});

let port: string;
let add_dir: string;
beforeAll(() => {
  setDefaultTimeout(1000 * 60 * 5);
  port = new URL(root_url).port;
});

beforeEach(async () => {
  add_dir = tmpdirSync();
  await dummyBeforeEach();
});
afterEach(async () => {
  await dummyAfterEach();
});

it("retries on 500", async () => {
  const urls: string[] = [];
  setHandler(dummyRegistry(urls, undefined, 4));
  await writeFile(
    join(package_dir, "package.json"),
    JSON.stringify({
      name: "foo",
      version: "0.0.1",
    }),
  );
  const { stdout, stderr, exited } = spawn({
    cmd: [bunExe(), "add", "BaR", "--linker=hoisted"],
    cwd: package_dir,
    stdout: "pipe",
    stdin: "pipe",
    stderr: "pipe",
    env,
  });
  const err = await stderr.text();
  expect(err).not.toContain("error:");
  expect(err).toContain("Saved lockfile");
  const out = await stdout.text();
  expect(out.replace(/\s*\[[0-9\.]+m?s\]\s*$/, "").split(/\r?\n/)).toEqual([
    expect.stringContaining("bun add v1."),
    "",
    "installed BaR@0.0.2",
    "",
    "1 package installed",
  ]);
  expect(await exited).toBe(0);
  expect(urls.sort()).toEqual([
    `${root_url}/BaR`,
    `${root_url}/BaR`,
    `${root_url}/BaR`,
    `${root_url}/BaR`,
    `${root_url}/BaR`,
    `${root_url}/BaR`,
    `${root_url}/BaR-0.0.2.tgz`,
    `${root_url}/BaR-0.0.2.tgz`,
    `${root_url}/BaR-0.0.2.tgz`,
    `${root_url}/BaR-0.0.2.tgz`,
    `${root_url}/BaR-0.0.2.tgz`,
    `${root_url}/BaR-0.0.2.tgz`,
  ]);
  expect(requested).toBe(12);
  await Promise.all([
    (async () => expect(await readdirSorted(join(package_dir, "node_modules"))).toEqual([".cache", "BaR"]))(),
    (async () => expect(await readdirSorted(join(package_dir, "node_modules", "BaR"))).toEqual(["package.json"]))(),
    (async () =>
      expect(await file(join(package_dir, "node_modules", "BaR", "package.json")).json()).toEqual({
        name: "bar",
        version: "0.0.2",
      }))(),
    (async () =>
      expect(await file(join(package_dir, "package.json")).text()).toEqual(
        JSON.stringify(
          {
            name: "foo",
            version: "0.0.1",
            dependencies: {
              BaR: "^0.0.2",
            },
          },
          null,
          2,
        ),
      ))(),
    async () => await access(join(package_dir, "bun.lockb")),
  ]);
});

it("retries on IntegrityCheckFailed and succeeds", async () => {
  // Compute the SHA512 integrity hash of the real tarball so we can include it in the manifest.
  const tarballPath = join(import.meta.dir, "bar-0.0.2.tgz");
  const tarballBytes = new Uint8Array(await file(tarballPath).arrayBuffer());
  const hasher = new Bun.CryptoHasher("sha512");
  hasher.update(tarballBytes);
  const integrity = `sha512-${hasher.digest("base64")}`;

  // Count tarball requests so we can serve corrupted bytes on the first attempt.
  let tarballRequestCount = 0;

  setHandler(async request => {
    const url = request.url;

    if (url.endsWith(".tgz")) {
      tarballRequestCount++;
      if (tarballRequestCount <= 1) {
        // Serve corrupted bytes on the first attempt to trigger IntegrityCheckFailed.
        return new Response(new Uint8Array(16).fill(0xff));
      }
      // Serve the real tarball on retry.
      return new Response(file(join(import.meta.dir, basename(url).toLowerCase())));
    }

    // Manifest request: include dist.integrity so Bun verifies the hash.
    const name = new URL(url).pathname.slice(1);
    return new Response(
      JSON.stringify({
        name,
        versions: {
          "0.0.2": {
            name,
            version: "0.0.2",
            dist: {
              tarball: `${root_url}/${name}-0.0.2.tgz`,
              integrity,
            },
          },
        },
        "dist-tags": { latest: "0.0.2" },
      }),
    );
  });

  await writeFile(
    join(package_dir, "package.json"),
    JSON.stringify({
      name: "foo",
      version: "0.0.1",
    }),
  );

  const { stdout, stderr, exited } = spawn({
    cmd: [bunExe(), "add", "BaR", "--linker=hoisted"],
    cwd: package_dir,
    stdout: "pipe",
    stdin: "pipe",
    stderr: "pipe",
    env,
  });

  const err = await stderr.text();
  // The warning about the integrity retry should appear.
  expect(err).toContain("Integrity check failed");
  expect(err).toContain("Retrying");
  // The install should ultimately succeed.
  expect(err).not.toContain("error:");
  expect(err).toContain("Saved lockfile");
  expect(await exited).toBe(0);
  // Exactly two tarball downloads: first (corrupted) + one retry (correct).
  expect(tarballRequestCount).toBe(2);
  expect(await readdirSorted(join(package_dir, "node_modules", "BaR"))).toEqual(["package.json"]);
});

it("fails after exhausting retries on persistent IntegrityCheckFailed", async () => {
  // Compute the SHA512 integrity hash of the real tarball so the manifest has a valid hash.
  const tarballPath = join(import.meta.dir, "bar-0.0.2.tgz");
  const tarballBytes = new Uint8Array(await file(tarballPath).arrayBuffer());
  const hasher = new Bun.CryptoHasher("sha512");
  hasher.update(tarballBytes);
  const integrity = `sha512-${hasher.digest("base64")}`;

  setHandler(async request => {
    const url = request.url;

    if (url.endsWith(".tgz")) {
      // Always serve corrupted bytes so every attempt fails integrity check.
      return new Response(new Uint8Array(16).fill(0xff));
    }

    // Manifest request: include dist.integrity so Bun verifies the hash.
    const name = new URL(url).pathname.slice(1);
    return new Response(
      JSON.stringify({
        name,
        versions: {
          "0.0.2": {
            name,
            version: "0.0.2",
            dist: {
              tarball: `${root_url}/${name}-0.0.2.tgz`,
              integrity,
            },
          },
        },
        "dist-tags": { latest: "0.0.2" },
      }),
    );
  });

  await writeFile(
    join(package_dir, "package.json"),
    JSON.stringify({
      name: "foo",
      version: "0.0.1",
    }),
  );

  const { stdout, stderr, exited } = spawn({
    cmd: [bunExe(), "add", "BaR", "--linker=hoisted"],
    cwd: package_dir,
    stdout: "pipe",
    stdin: "pipe",
    stderr: "pipe",
    env,
  });

  const err = await stderr.text();
  // The integrity error should be reported after retries are exhausted.
  expect(err).toContain("IntegrityCheckFailed");
  expect(await exited).toBe(1);
});
