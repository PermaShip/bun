import { expect, test } from "bun:test";
import { bunEnv, bunExe, normalizeBunSnapshot, tempDir } from "harness";

// Regression test for https://github.com/oven-sh/bun/issues/27922
// Bun 1.3.10 incorrectly reorders constructor body when combining ES standard
// decorators with TypeScript parameter properties, causing decorator initializers
// to run BEFORE the parameter properties are assigned (leading to undefined errors).

const tsconfig = JSON.stringify({
  compilerOptions: {
    target: "ES2022",
    // No experimentalDecorators → uses ES standard decorators
  },
});

test("#27922 ES decorator + single parameter property: initializer runs after assignment", async () => {
  using dir = tempDir("issue-27922-single", {
    "tsconfig.json": tsconfig,
    "test.ts": `
function Injectable(target: any, context: ClassDecoratorContext) {
  context.addInitializer(function(this: any) {
    if (this.tokenUrl === undefined) {
      throw new Error("tokenUrl is undefined in decorator initializer");
    }
  });
}

@Injectable
class AuthService {
  constructor(private tokenUrl: string) {}
}

new AuthService("https://example.com/token");
console.log("success");
`,
  });

  await using proc = Bun.spawn({
    cmd: [bunExe(), "test.ts"],
    env: bunEnv,
    cwd: String(dir),
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

  expect(normalizeBunSnapshot(stdout)).toMatchInlineSnapshot(`"success"`);
  expect(exitCode).toBe(0);
});

test("#27922 ES decorator + multiple parameter properties: all assigned before initializer", async () => {
  using dir = tempDir("issue-27922-multi", {
    "tsconfig.json": tsconfig,
    "test.ts": `
function Injectable(target: any, context: ClassDecoratorContext) {
  context.addInitializer(function(this: any) {
    if (this.host === undefined) throw new Error("host is undefined");
    if (this.port === undefined) throw new Error("port is undefined");
    if (this.name === undefined) throw new Error("name is undefined");
  });
}

@Injectable
class DatabaseService {
  constructor(
    private host: string,
    private port: number,
    private name: string,
  ) {}
}

new DatabaseService("localhost", 5432, "mydb");
console.log("success");
`,
  });

  await using proc = Bun.spawn({
    cmd: [bunExe(), "test.ts"],
    env: bunEnv,
    cwd: String(dir),
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

  expect(normalizeBunSnapshot(stdout)).toMatchInlineSnapshot(`"success"`);
  expect(exitCode).toBe(0);
});

test("#27922 ES decorator + extends + parameter properties: super then params then initializer", async () => {
  using dir = tempDir("issue-27922-extends", {
    "tsconfig.json": tsconfig,
    "test.ts": `
function Injectable(target: any, context: ClassDecoratorContext) {
  context.addInitializer(function(this: any) {
    if (this.clientId === undefined) throw new Error("clientId is undefined");
    if (this.clientSecret === undefined) throw new Error("clientSecret is undefined");
  });
}

class BaseService {
  protected baseUrl: string;
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }
}

@Injectable
class OAuthService extends BaseService {
  constructor(
    baseUrl: string,
    private clientId: string,
    private clientSecret: string,
  ) {
    super(baseUrl);
  }
}

new OAuthService("https://auth.example.com", "my-client-id", "my-secret");
console.log("success");
`,
  });

  await using proc = Bun.spawn({
    cmd: [bunExe(), "test.ts"],
    env: bunEnv,
    cwd: String(dir),
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

  expect(normalizeBunSnapshot(stdout)).toMatchInlineSnapshot(`"success"`);
  expect(exitCode).toBe(0);
});

test("#27922 ES decorator addInitializer reads parameter property value correctly", async () => {
  using dir = tempDir("issue-27922-read-value", {
    "tsconfig.json": tsconfig,
    "test.ts": `
let capturedTokenUrl: string | undefined;

function Injectable(target: any, context: ClassDecoratorContext) {
  context.addInitializer(function(this: any) {
    capturedTokenUrl = this.tokenUrl;
  });
}

@Injectable
class AuthService {
  constructor(private tokenUrl: string) {}
}

new AuthService("https://example.com/token");

if (capturedTokenUrl !== "https://example.com/token") {
  throw new Error("capturedTokenUrl = " + capturedTokenUrl);
}
console.log("success");
`,
  });

  await using proc = Bun.spawn({
    cmd: [bunExe(), "test.ts"],
    env: bunEnv,
    cwd: String(dir),
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

  expect(normalizeBunSnapshot(stdout)).toMatchInlineSnapshot(`"success"`);
  expect(exitCode).toBe(0);
});
