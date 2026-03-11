import { test, expect } from "bun:test";
import { bunEnv, bunExe } from "harness";

// https://github.com/oven-sh/bun/issues/27783
// SyntaxError: Export named 'cacheStores' not found in module 'undici'
test("cacheStores named export exists in undici", async () => {
  await using proc = Bun.spawn({
    cmd: [
      bunExe(),
      "-e",
      `
        import { cacheStores } from 'undici';
        if (typeof cacheStores !== 'object' || cacheStores === null) {
          throw new Error('cacheStores is not an object');
        }
        if (typeof cacheStores.MemoryCacheStore !== 'function') {
          throw new Error('cacheStores.MemoryCacheStore is not a constructor');
        }
        const store = new cacheStores.MemoryCacheStore();
        if (typeof store.isFull !== 'boolean') {
          throw new Error('store.isFull is not a boolean');
        }
        if (typeof store.size !== 'number') {
          throw new Error('store.size is not a number');
        }
        if (typeof store.get !== 'function') {
          throw new Error('store.get is not a function');
        }
        if (typeof store.createWriteStream !== 'function') {
          throw new Error('store.createWriteStream is not a function');
        }
        if (typeof store.delete !== 'function') {
          throw new Error('store.delete is not a function');
        }
        console.log('ok');
      `,
    ],
    env: bunEnv,
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

  expect(stdout.trim()).toBe("ok");
  expect(exitCode).toBe(0);
});

test("MemoryCacheStore can be instantiated with options", async () => {
  await using proc = Bun.spawn({
    cmd: [
      bunExe(),
      "-e",
      `
        import { cacheStores } from 'undici';
        const store = new cacheStores.MemoryCacheStore({ maxSize: 1024, maxCount: 10, maxEntrySize: 512 });
        if (store.size !== 0) throw new Error('initial size should be 0');
        if (store.isFull !== false) throw new Error('should not be full initially');
        console.log('ok');
      `,
    ],
    env: bunEnv,
    stderr: "pipe",
  });

  const [stdout, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

  expect(stdout.trim()).toBe("ok");
  expect(exitCode).toBe(0);
});

test("cacheStores is also available on the default export", async () => {
  await using proc = Bun.spawn({
    cmd: [
      bunExe(),
      "-e",
      `
        import undici from 'undici';
        if (typeof undici.cacheStores !== 'object' || undici.cacheStores === null) {
          throw new Error('undici.cacheStores is not an object');
        }
        if (typeof undici.cacheStores.MemoryCacheStore !== 'function') {
          throw new Error('undici.cacheStores.MemoryCacheStore is not a constructor');
        }
        console.log('ok');
      `,
    ],
    env: bunEnv,
    stderr: "pipe",
  });

  const [stdout, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

  expect(stdout.trim()).toBe("ok");
  expect(exitCode).toBe(0);
});
