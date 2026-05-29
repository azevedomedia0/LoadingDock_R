import { describe, expect, test } from "bun:test";
import type { DockerApp } from "../shared/types";

// Validate openUrl rules used by webui (no Electrobun runtime in unit tests).
import { validateOpenUrl } from "../shared/validation";

function app(overrides: Partial<DockerApp> = {}): DockerApp {
  return {
    id: "web-1",
    name: "Web App",
    icon: "W",
    description: "",
    image: "nginx:alpine",
    ports: ["8080:80"],
    env: {},
    volumes: [],
    status: "running",
    openUrl: "http://localhost:8080",
    ...overrides,
  };
}

describe("embedded web UI URL validation", () => {
  test("accepts http localhost URLs", () => {
    const url = validateOpenUrl(app().openUrl!);
    expect(url?.startsWith("http://localhost:8080")).toBe(true);
  });

  test("rejects non-http schemes", () => {
    expect(() => validateOpenUrl("ftp://localhost")).toThrow();
  });

  test("missing openUrl cannot validate", () => {
    expect(validateOpenUrl("")).toBeUndefined();
  });
});
