import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import type { DockerApp } from "../shared/types";
import {
  getRegistryDir,
  getRegistryFile,
  loadRegistry,
  saveRegistry,
} from "./registry";

describe("registry paths", () => {
  test("uses platform-specific config dir", () => {
    expect(getRegistryDir("darwin", { HOME: "/Users/test" })).toBe(
      "/Users/test/Library/Application Support/electrodocker",
    );
    expect(getRegistryDir("linux", { HOME: "/home/test" })).toBe(
      "/home/test/.config/electrodocker",
    );
    expect(
      getRegistryDir("win32", { APPDATA: "C:/Users/test/AppData/Roaming" }),
    ).toBe("C:/Users/test/AppData/Roaming/electrodocker");
  });

  test("registry file is apps.json in registry dir", () => {
    expect(getRegistryFile("linux", { HOME: "/home/test" })).toBe(
      "/home/test/.config/electrodocker/apps.json",
    );
  });
});

describe("registry persistence", () => {
  test("save/load excludes runtime status fields", async () => {
    const tmpRoot = await mkdtemp(join(tmpdir(), "electrodocker-test-"));
    const registryFile = join(tmpRoot, "apps.json");
    const apps: DockerApp[] = [
      {
        id: "test",
        name: "Test",
        icon: "default.png",
        description: "test app",
        image: "nginx:latest",
        ports: ["8080:80"],
        env: { FOO: "bar" },
        volumes: [],
        status: "running",
        containerId: "abc123",
      },
    ];
    await saveRegistry(apps, registryFile);
    const loaded = await loadRegistry(registryFile);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].status).toBe("stopped");
    expect(loaded[0].containerId).toBeUndefined();
    expect(loaded[0].id).toBe("test");
  });
});
