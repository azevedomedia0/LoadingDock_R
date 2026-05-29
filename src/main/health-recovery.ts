// src/main/health-recovery.ts
import type { DockerApp } from "../shared/types";

export const UNHEALTHY_RESTART_THRESHOLD = 3;

export function shouldRestartUnhealthy(
  app: DockerApp,
  health: DockerApp["health"],
  unhealthyStreak: number,
  autoRestartEnabled: boolean,
): boolean {
  if (!autoRestartEnabled) return false;
  if (app.status !== "running") return false;
  if (!app.healthcheck?.cmd?.trim()) return false;
  if (app.restartPolicy === "no") return false;
  if (health !== "unhealthy") return false;
  return unhealthyStreak >= UNHEALTHY_RESTART_THRESHOLD;
}

export function nextUnhealthyStreak(
  health: DockerApp["health"],
  previousStreak: number,
): number {
  if (health === "unhealthy") return previousStreak + 1;
  return 0;
}
