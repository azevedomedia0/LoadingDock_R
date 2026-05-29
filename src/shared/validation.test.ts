import { describe, expect, test } from "bun:test";
import {
  generateAppId,
  isValidPortMapping,
  parsePortMappings,
  validateOpenUrl,
} from "./validation";

describe("validation helpers", () => {
  test("generateAppId normalizes the name", () => {
    expect(generateAppId("My Cool App", 42)).toBe("my-cool-app-42");
  });

  test("parsePortMappings splits comma-separated list", () => {
    expect(parsePortMappings("8080:80, 9001:9001/udp")).toEqual([
      "8080:80",
      "9001:9001/udp",
    ]);
  });

  test("isValidPortMapping validates format and range", () => {
    expect(isValidPortMapping("8080:80")).toBe(true);
    expect(isValidPortMapping("0:80")).toBe(false);
    expect(isValidPortMapping("70000:80")).toBe(false);
    expect(isValidPortMapping("abc")).toBe(false);
  });

  test("validateOpenUrl accepts http(s) and rejects others", () => {
    expect(validateOpenUrl("http://localhost:8080")).toBe(
      "http://localhost:8080/",
    );
    expect(() => validateOpenUrl("ftp://localhost")).toThrow();
  });
});
