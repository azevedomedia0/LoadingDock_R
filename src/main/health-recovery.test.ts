import { describe, expect, test } from "bun:test";
import type { DockerApp } from "../shared/types";
import {
  nextUnhealthyStreak,
  shouldRestartUnhealthy,
  UNHEALTHY_RESTART_THRESHOLD,
} from "./health-recovery";

function app(overrides: Partial<DockerApp> = {}): DockerApp {
  return {
    id: "a1",
    name: "Test",
    icon: "T",
    description: "",
    image: "alpine",
    ports: [],
    env: {},
    volumes: [],
    status: "running",
    healthcheck: { cmd: "curl -f http://localhost" },
    restartPolicy: "unless-stopped",
    ...overrides,
  };
}

describe("nextUnhealthyStreak", () => {
  test("increments on unhealthy", () => {
    expect(nextUnhealthyStreak("unhealthy", 0)).toBe(1);
    expect(nextUnhealthyStreak("unhealthy", 2)).toBe(3);
  });

  test("resets when not unhealthy", () => {
    expect(nextUnhealthyStreak("healthy", 5)).toBe(0);
    expect(nextUnhealthyStreak("starting", 2)).toBe(0);
  });
});

describe("shouldRestartUnhealthy", () => {
  test("requires threshold streak", () => {
    const a = app();
    expect(
      shouldRestartUnhealthy(a, "unhealthy", UNHEALTHY_RESTART_THRESHOLD - 1, true),
    ).toBe(false);
    expect(
      shouldRestartUnhealthy(a, "unhealthy", UNHEALTHY_RESTART_THRESHOLD, true),
    ).toBe(true);
  });

  test("disabled when setting off", () => {
    expect(
      shouldRestartUnhealthy(app(), "unhealthy", 10, false),
    ).toBe(false);
  });

  test("requires healthcheck command", () => {
    expect(
      shouldRestartUnhealthy(
        app({ healthcheck: undefined }),
        "unhealthy",
        10,
        true,
      ),
    ).toBe(false);
  });

  test("skips restart policy no", () => {
    expect(
      shouldRestartUnhealthy(
        app({ restartPolicy: "no" }),
        "unhealthy",
        10,
        true,
      ),
    ).toBe(false);
  });

  test("only when running", () => {
    expect(
      shouldRestartUnhealthy(
        app({ status: "stopped" }),
        "unhealthy",
        10,
        true,
      ),
    ).toBe(false);
  });
});
