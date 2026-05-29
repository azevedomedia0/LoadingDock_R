import { describe, expect, test } from "bun:test";
import { importComposeAsApps } from "./compose";

describe("compose import", () => {
  test("imports services with image", () => {
    const yaml = `
services:
  web:
    image: nginx:latest
    ports:
      - "8080:80"
  worker:
    image: redis:7
`;
    const apps = importComposeAsApps(yaml, "demo");
    expect(apps.length).toBe(2);
    expect(apps[0].composeProject).toBe("demo");
    expect(apps.some((a) => a.name === "web")).toBe(true);
  });

  test("throws when services are missing", () => {
    expect(() => importComposeAsApps("version: '3'", "x")).toThrow();
  });
});
