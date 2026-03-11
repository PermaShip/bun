import { expect, test } from "bun:test";
import { bunEnv, bunExe } from "harness";

// Regression test for https://github.com/oven-sh/bun/issues/8480
// Intl.DateTimeFormat().resolvedOptions().locale should match $LANG

async function getLocale(env: Record<string, string | undefined>): Promise<string> {
  await using proc = Bun.spawn({
    cmd: [bunExe(), "-e", "console.log(Intl.DateTimeFormat().resolvedOptions().locale)"],
    env: { ...bunEnv, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, exitCode] = await Promise.all([proc.stdout.text(), proc.exited]);

  expect(exitCode).toBe(0);
  return stdout.trim();
}

test("LANG=zh_CN sets ICU locale to zh-CN", async () => {
  const locale = await getLocale({ LANG: "zh_CN", LC_ALL: undefined, LC_CTYPE: undefined });
  expect(locale).toBe("zh-CN");
});

test("LANG=en_US.UTF-8 sets ICU locale to en-US", async () => {
  const locale = await getLocale({ LANG: "en_US.UTF-8", LC_ALL: undefined, LC_CTYPE: undefined });
  expect(locale).toBe("en-US");
});

test("LANG=fr sets ICU locale to fr", async () => {
  const locale = await getLocale({ LANG: "fr", LC_ALL: undefined, LC_CTYPE: undefined });
  expect(locale).toBe("fr");
});

test("LC_ALL takes priority over LANG", async () => {
  const locale = await getLocale({ LC_ALL: "de_DE", LANG: "fr", LC_CTYPE: undefined });
  expect(locale).toBe("de-DE");
});

test("LANG=C does not crash", async () => {
  // LANG=C means no locale — Bun should not crash and should return some default locale
  const locale = await getLocale({ LANG: "C", LC_ALL: undefined, LC_CTYPE: undefined });
  expect(typeof locale).toBe("string");
  expect(locale.length).toBeGreaterThan(0);
});

test("LANG=POSIX does not crash", async () => {
  // POSIX is also a special value meaning no locale
  const locale = await getLocale({ LANG: "POSIX", LC_ALL: undefined, LC_CTYPE: undefined });
  expect(typeof locale).toBe("string");
  expect(locale.length).toBeGreaterThan(0);
});

test("LC_CTYPE takes priority over LANG", async () => {
  const locale = await getLocale({ LC_CTYPE: "ja_JP.UTF-8", LANG: "fr", LC_ALL: undefined });
  expect(locale).toBe("ja-JP");
});
