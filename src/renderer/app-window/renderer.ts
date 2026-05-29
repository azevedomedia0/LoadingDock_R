// src/renderer/app-window/renderer.ts
// Pure rendering helpers extracted for unit testability (no DOM dependency for logic).
import type { DockerApp } from "../../shared/types";

export interface StatusBadgeSpec {
  className: string;
  text: string;
  launchHidden: boolean;
  stopHidden: boolean;
  launchDisabled: boolean;
  stopDisabled: boolean;
}

export function statusBadgeSpec(status: DockerApp["status"]): StatusBadgeSpec {
  const busy = status === "starting" || status === "stopping";
  const isRunning = status === "running";
  return {
    className: "badge badge--" + status,
    text: status.charAt(0).toUpperCase() + status.slice(1),
    launchHidden: isRunning,
    stopHidden: !isRunning,
    launchDisabled: busy,
    stopDisabled: busy,
  };
}

export function buildPortsListItems(ports: string[]): string[] {
  return ports.length ? ports : [];
}

export function buildEnvEntries(
  env: Record<string, string>,
  maskEnabled: boolean,
  keychainKeys: string[] = [],
): { key: string; value: string; locked: boolean }[] {
  return Object.entries(env).map(([k, v]) => {
    const locked = keychainKeys.includes(k);
    if (!maskEnabled) return { key: k, value: v, locked };
    const masked = v.length <= 4 ? "****" : v.slice(0, 2) + "****" + v.slice(-2);
    return { key: k, value: masked, locked };
  });
}

export function formatHealthLabel(
  health: DockerApp["health"] | undefined,
): string {
  return health ?? "unknown";
}
