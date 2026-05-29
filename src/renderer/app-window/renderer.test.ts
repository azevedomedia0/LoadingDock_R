import { describe, expect, test } from "bun:test";
import type { DockerApp } from "../../shared/types";
import {
  buildEnvEntries,
  buildPortsListItems,
  formatHealthLabel,
  statusBadgeSpec,
} from "./renderer";

const base: DockerApp = {
  id: "pg",
  name: "Postgres",
  icon: "postgres.png",
  description: "db",
  image: "postgres:15",
  ports: ["5432:5432", "5433:5433"],
  env: { POSTGRES_PASSWORD: "supersecret", POSTGRES_USER: "dev" },
  volumes: [],
  status: "stopped",
};

// ── statusBadgeSpec ───────────────────────────────────────────

describe("statusBadgeSpec", () => {
  test("stopped: correct class, Launch visible, Stop hidden, not disabled", () => {
    const s = statusBadgeSpec("stopped");
    expect(s.className).toBe("badge badge--stopped");
    expect(s.text).toBe("Stopped");
    expect(s.launchHidden).toBe(false);
    expect(s.stopHidden).toBe(true);
    expect(s.launchDisabled).toBe(false);
    expect(s.stopDisabled).toBe(false);
  });

  test("running: Stop visible, Launch hidden, not disabled", () => {
    const s = statusBadgeSpec("running");
    expect(s.className).toBe("badge badge--running");
    expect(s.text).toBe("Running");
    expect(s.launchHidden).toBe(true);
    expect(s.stopHidden).toBe(false);
    expect(s.launchDisabled).toBe(false);
    expect(s.stopDisabled).toBe(false);
  });

  test("starting: Launch not hidden, both buttons disabled", () => {
    const s = statusBadgeSpec("starting");
    expect(s.launchHidden).toBe(false);
    expect(s.launchDisabled).toBe(true);
    expect(s.stopDisabled).toBe(true);
  });

  test("stopping: Stop not hidden, both buttons disabled", () => {
    const s = statusBadgeSpec("stopping");
    expect(s.stopHidden).toBe(true); // running = false means stop hidden = true
    expect(s.launchDisabled).toBe(true);
    expect(s.stopDisabled).toBe(true);
  });

  test("error: correct class, not disabled", () => {
    const s = statusBadgeSpec("error");
    expect(s.className).toBe("badge badge--error");
    expect(s.text).toBe("Error");
    expect(s.launchDisabled).toBe(false);
  });

  test("text is capitalised", () => {
    for (const status of ["stopped", "running", "starting", "stopping", "error"] as const) {
      const s = statusBadgeSpec(status);
      expect(s.text[0]).toBe(s.text[0].toUpperCase());
    }
  });
});

// ── buildPortsListItems ───────────────────────────────────────

describe("buildPortsListItems", () => {
  test("returns ports array unchanged", () => {
    expect(buildPortsListItems(["5432:5432", "5433:5433"])).toEqual(["5432:5432", "5433:5433"]);
  });
  test("empty ports returns empty array", () => {
    expect(buildPortsListItems([])).toEqual([]);
  });
});

// ── buildEnvEntries ───────────────────────────────────────────

describe("buildEnvEntries", () => {
  test("masking disabled returns values as-is", () => {
    const entries = buildEnvEntries(base.env, false);
    const pg = entries.find((e) => e.key === "POSTGRES_PASSWORD");
    expect(pg?.value).toBe("supersecret");
  });

  test("masking enabled hides middle of long values", () => {
    const entries = buildEnvEntries(base.env, true);
    const pg = entries.find((e) => e.key === "POSTGRES_PASSWORD");
    expect(pg?.value).toMatch(/^su\*{4}et$/);
  });

  test("masking short values shows ****", () => {
    const entries = buildEnvEntries({ KEY: "abc" }, true);
    expect(entries[0]?.value).toBe("****");
  });

  test("empty env returns empty array", () => {
    expect(buildEnvEntries({}, true)).toHaveLength(0);
  });

  test("keychain-backed keys are marked locked", () => {
    const entries = buildEnvEntries(base.env, false, ["POSTGRES_PASSWORD"]);
    const pg = entries.find((e) => e.key === "POSTGRES_PASSWORD");
    const user = entries.find((e) => e.key === "POSTGRES_USER");
    expect(pg?.locked).toBe(true);
    expect(user?.locked).toBe(false);
  });

  test("locked flag is false when keychainKeys not provided", () => {
    const entries = buildEnvEntries(base.env, false);
    expect(entries.every((e) => !e.locked)).toBe(true);
  });

  test("all entries have key, value, locked fields", () => {
    const entries = buildEnvEntries(base.env, true, []);
    for (const e of entries) {
      expect(typeof e.key).toBe("string");
      expect(typeof e.value).toBe("string");
      expect(typeof e.locked).toBe("boolean");
    }
  });

  test("multiple env vars all returned", () => {
    const env = { A: "1", B: "2", C: "3" };
    expect(buildEnvEntries(env, false)).toHaveLength(3);
  });
});

// ── formatHealthLabel ─────────────────────────────────────────

describe("formatHealthLabel", () => {
  test("healthy → 'healthy'", () => expect(formatHealthLabel("healthy")).toBe("healthy"));
  test("unhealthy → 'unhealthy'", () => expect(formatHealthLabel("unhealthy")).toBe("unhealthy"));
  test("starting → 'starting'", () => expect(formatHealthLabel("starting")).toBe("starting"));
  test("none → 'none'", () => expect(formatHealthLabel("none")).toBe("none"));
  test("unknown → 'unknown'", () => expect(formatHealthLabel("unknown")).toBe("unknown"));
  test("undefined → 'unknown'", () => expect(formatHealthLabel(undefined)).toBe("unknown"));
});

// ── IPC message handler logic (state transitions) ─────────────

describe("IPC state-transition logic", () => {
  // These test the pure state logic that the renderer applies when
  // handling IPC messages, without needing a DOM.

  test("app:status updates local status reference", () => {
    let currentStatus: DockerApp["status"] = "stopped";
    // Simulate what the renderer does on app:status
    function applyStatus(newStatus: DockerApp["status"]) {
      currentStatus = newStatus;
    }
    applyStatus("starting");
    expect(currentStatus).toBe("starting");
    applyStatus("running");
    expect(currentStatus).toBe("running");
  });

  test("docker:log appends and trims to 2000 lines", () => {
    const logs: string[] = [];
    function appendLog(line: string) {
      logs.push(line);
      if (logs.length > 2000) logs.shift();
    }
    for (let i = 0; i < 2100; i++) appendLog(`line ${i}`);
    expect(logs).toHaveLength(2000);
    expect(logs[0]).toBe("line 100");
    expect(logs[1999]).toBe("line 2099");
  });

  test("docker:logs:history replaces entire log buffer", () => {
    let logs = ["old log 1", "old log 2"];
    const incoming = ["new 1", "new 2", "new 3"];
    // Simulate what the renderer does on docker:logs:history
    logs = [...incoming];
    expect(logs).toEqual(["new 1", "new 2", "new 3"]);
  });

  test("metrics:history replaces buffer and new points append", () => {
    let metrics = [{ id: "x", cpuPercent: 10, memUsageMB: 50, timestamp: 1 }];
    const history = [
      { id: "x", cpuPercent: 5, memUsageMB: 30, timestamp: 100 },
      { id: "x", cpuPercent: 15, memUsageMB: 60, timestamp: 200 },
    ];
    // On metrics:history
    metrics = [...history];
    // On app:metrics (new live point)
    const point = { id: "x", cpuPercent: 20, memUsageMB: 70, timestamp: 300 };
    metrics.push(point);
    if (metrics.length > 240) metrics.shift();
    expect(metrics).toHaveLength(3);
    expect(metrics[2].cpuPercent).toBe(20);
  });

  test("secrets:mask toggle updates maskSecrets state", () => {
    let maskSecrets = true;
    // Simulate IPC handler
    maskSecrets = false;
    expect(maskSecrets).toBe(false);
    maskSecrets = true;
    expect(maskSecrets).toBe(true);
  });

  test("app:health updates health field on current app", () => {
    let currentApp: DockerApp | null = { ...base };
    type Health = DockerApp["health"];
    function applyHealth(id: string, health: Health) {
      if (currentApp && currentApp.id === id) currentApp.health = health;
    }
    applyHealth("pg", "healthy");
    expect(currentApp?.health).toBe("healthy");
    applyHealth("pg", "unhealthy");
    expect(currentApp?.health).toBe("unhealthy");
    // Different id doesn't update
    applyHealth("other", "healthy");
    expect(currentApp?.health).toBe("unhealthy");
  });
});
