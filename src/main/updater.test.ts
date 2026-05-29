import { describe, expect, test } from "bun:test";
import { isNewer } from "./updater";

describe("isNewer", () => {
  test("higher major version is newer", () => {
    expect(isNewer("2.0.0", "1.9.9")).toBe(true);
  });

  test("higher minor version is newer", () => {
    expect(isNewer("1.2.0", "1.1.9")).toBe(true);
  });

  test("higher patch version is newer", () => {
    expect(isNewer("1.0.1", "1.0.0")).toBe(true);
  });

  test("same version is not newer", () => {
    expect(isNewer("1.0.0", "1.0.0")).toBe(false);
  });

  test("older remote is not newer", () => {
    expect(isNewer("0.9.9", "1.0.0")).toBe(false);
  });

  test("strips leading v from versions", () => {
    expect(isNewer("v1.1.0", "v1.0.0")).toBe(true);
    expect(isNewer("v1.0.0", "v1.0.0")).toBe(false);
  });

  test("works with partial version strings", () => {
    expect(isNewer("2.0", "1.9.9")).toBe(true);
  });
});
