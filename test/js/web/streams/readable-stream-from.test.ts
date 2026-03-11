import { test, expect, describe } from "bun:test";

describe("ReadableStream.from()", () => {
  test("exists as a static method with length 1", () => {
    expect(typeof ReadableStream.from).toBe("function");
    expect(ReadableStream.from.length).toBe(1);
  });

  test("returns a ReadableStream instance", async () => {
    const stream = ReadableStream.from([1, 2, 3]);
    expect(stream).toBeInstanceOf(ReadableStream);
  });

  test("reads from an array (sync iterable)", async () => {
    const stream = ReadableStream.from([1, 2, 3]);
    const reader = stream.getReader();
    expect(await reader.read()).toEqual({ value: 1, done: false });
    expect(await reader.read()).toEqual({ value: 2, done: false });
    expect(await reader.read()).toEqual({ value: 3, done: false });
    expect(await reader.read()).toEqual({ value: undefined, done: true });
  });

  test("reads from a sync generator (function*)", async () => {
    function* gen() {
      yield "a";
      yield "b";
      yield "c";
    }
    const stream = ReadableStream.from(gen());
    const reader = stream.getReader();
    expect(await reader.read()).toEqual({ value: "a", done: false });
    expect(await reader.read()).toEqual({ value: "b", done: false });
    expect(await reader.read()).toEqual({ value: "c", done: false });
    expect(await reader.read()).toEqual({ value: undefined, done: true });
  });

  test("reads from an async generator (async function*)", async () => {
    async function* asyncGen() {
      yield 10;
      yield 20;
      yield 30;
    }
    const stream = ReadableStream.from(asyncGen());
    const reader = stream.getReader();
    expect(await reader.read()).toEqual({ value: 10, done: false });
    expect(await reader.read()).toEqual({ value: 20, done: false });
    expect(await reader.read()).toEqual({ value: 30, done: false });
    expect(await reader.read()).toEqual({ value: undefined, done: true });
  });

  test("reads from a custom async iterable", async () => {
    const asyncIterable = {
      [Symbol.asyncIterator]() {
        let i = 0;
        return {
          next() {
            if (i < 3) return Promise.resolve({ value: i++, done: false });
            return Promise.resolve({ value: undefined, done: true });
          },
        };
      },
    };
    const stream = ReadableStream.from(asyncIterable);
    const reader = stream.getReader();
    expect(await reader.read()).toEqual({ value: 0, done: false });
    expect(await reader.read()).toEqual({ value: 1, done: false });
    expect(await reader.read()).toEqual({ value: 2, done: false });
    expect(await reader.read()).toEqual({ value: undefined, done: true });
  });

  test("reads from a string (sync iterable of characters)", async () => {
    const stream = ReadableStream.from("abc");
    const reader = stream.getReader();
    expect(await reader.read()).toEqual({ value: "a", done: false });
    expect(await reader.read()).toEqual({ value: "b", done: false });
    expect(await reader.read()).toEqual({ value: "c", done: false });
    expect(await reader.read()).toEqual({ value: undefined, done: true });
  });

  test("reads from a Set", async () => {
    const stream = ReadableStream.from(new Set([1, 2, 3]));
    const reader = stream.getReader();
    expect(await reader.read()).toEqual({ value: 1, done: false });
    expect(await reader.read()).toEqual({ value: 2, done: false });
    expect(await reader.read()).toEqual({ value: 3, done: false });
    expect(await reader.read()).toEqual({ value: undefined, done: true });
  });

  test("throws TypeError for null", () => {
    expect(() => ReadableStream.from(null)).toThrow(TypeError);
  });

  test("throws TypeError for undefined", () => {
    expect(() => ReadableStream.from(undefined)).toThrow(TypeError);
  });

  test("throws TypeError for a plain number", () => {
    expect(() => ReadableStream.from(42 as any)).toThrow(TypeError);
  });

  test("throws TypeError for a plain object without iterator", () => {
    expect(() => ReadableStream.from({} as any)).toThrow(TypeError);
  });

  test("collects all values via stream.values()", async () => {
    const values: number[] = [];
    for await (const v of ReadableStream.from([1, 2, 3])) {
      values.push(v);
    }
    expect(values).toEqual([1, 2, 3]);
  });

  test("cancel calls iterator.return()", async () => {
    let returnCalled = false;
    const asyncIterable = {
      [Symbol.asyncIterator]() {
        return {
          next() {
            return Promise.resolve({ value: 1, done: false });
          },
          return(value: any) {
            returnCalled = true;
            return Promise.resolve({ value, done: true });
          },
        };
      },
    };
    const stream = ReadableStream.from(asyncIterable);
    const reader = stream.getReader();
    await reader.read(); // consume one value
    await reader.cancel("reason");
    expect(returnCalled).toBe(true);
  });

  test("propagates error from async iterator", async () => {
    const err = new Error("iterator error");
    async function* failing() {
      yield 1;
      throw err;
    }
    const stream = ReadableStream.from(failing());
    const reader = stream.getReader();
    expect(await reader.read()).toEqual({ value: 1, done: false });
    await expect(reader.read()).rejects.toThrow("iterator error");
  });

  test("works with empty iterable", async () => {
    const stream = ReadableStream.from([]);
    const reader = stream.getReader();
    expect(await reader.read()).toEqual({ value: undefined, done: true });
  });
});
