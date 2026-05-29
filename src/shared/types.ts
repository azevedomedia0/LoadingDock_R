// src/shared/types.ts
export type ContainerStatus =
  | "running"
  | "stopped"
  | "starting"
  | "stopping"
  | "error";

export interface DockerApp {
  id: string;
  name: string;
  icon: string;
  description: string;
  image: string;
  ports: string[];
  env: Record<string, string>;
  volumes: string[];
  openUrl?: string;
  composeProject?: string;
  group?: string;
  tags?: string[];
  restartPolicy?: "no" | "on-failure" | "unless-stopped";
  healthcheck?: {
    cmd?: string;
    intervalSec?: number;
    timeoutSec?: number;
    retries?: number;
  };
  health?: "healthy" | "unhealthy" | "starting" | "none" | "unknown";
  status: ContainerStatus;
  containerId?: string;
  keychainEnvKeys?: string[];
  sortOrder?: number;
}

export interface AppMetricsPoint {
  id: string;
  cpuPercent: number;
  memUsageMB: number;
  timestamp: number;
}

export interface DockerHubImage {
  name: string;
  namespace: string;
  fullName: string;
  description: string;
  starCount: number;
  pullCount: number;
  isOfficial: boolean;
}

export type IpcMessage =
  | { type: "apps:list"; apps: DockerApp[] }
  | { type: "onboarding:state"; firstRun: boolean }
  | { type: "docker:availability"; available: boolean }
  | {
      type: "app:status";
      id: string;
      status: ContainerStatus;
      containerId?: string;
    }
  | { type: "app:launch"; id: string }
  | { type: "app:stop"; id: string }
  | { type: "app:open-window"; app: DockerApp }
  | { type: "app:open-webui"; id: string }
  | { type: "app:open-external"; id: string }
  | { type: "app:add"; app: Omit<DockerApp, "status" | "containerId"> }
  | {
      type: "app:update";
      app: Omit<DockerApp, "status" | "containerId">;
    }
  | { type: "app:remove"; id: string }
  | { type: "app:restart"; id: string }
  | {
      type: "compose:import";
      yaml: string;
      projectName?: string;
    }
  | { type: "dockerhub:browse"; query?: string }
  | { type: "dockerhub:results"; query?: string; images: DockerHubImage[] }
  | { type: "dockerhub:og-images"; results: Record<string, string> }
  | { type: "metrics:history"; id: string; points: AppMetricsPoint[] }
  | { type: "registry:export" }
  | { type: "registry:exported"; json: string }
  | { type: "registry:import"; json: string }
  | { type: "notifications:enabled"; enabled: boolean }
  | { type: "secrets:keychain"; enabled: boolean }
  | { type: "app:pull-progress"; id: string; status: string; detail?: string }
  | { type: "docker:log"; id: string; line: string }
  | { type: "docker:logs:history"; id: string; lines: string[] }
  | { type: "app:health"; id: string; health: DockerApp["health"] }
  | { type: "app:metrics"; point: AppMetricsPoint }
  | { type: "secrets:mask"; enabled: boolean }
  | { type: "update:channel:set"; channel: "stable" | "beta" }
  | { type: "update:check" }
  | {
      type: "update:available";
      version: string;
      releaseNotes: string;
      channel: "stable" | "beta";
    }
  | { type: "update:not-available" }
  | { type: "update:download"; downloadUrl: string; version: string; channel: "stable" | "beta" }
  | { type: "update:download:progress"; percent: number }
  | { type: "update:download:done"; localPath: string }
  | { type: "update:apply"; localPath: string }
  | { type: "update:state"; channel: "stable" | "beta" }
  | { type: "keychain:set"; appId: string; envKey: string; value: string }
  | { type: "keychain:delete"; appId: string; envKey: string }
  | { type: "keychain:set:done"; appId: string; envKey: string }
  | { type: "keychain:error"; message: string }
  | { type: "app:reorder"; ids: string[] }
  | { type: "notification:show"; title: string; body: string }
  | { type: "error"; message: string }
  | { type: "settings:auto-restart"; enabled: boolean }
  | { type: "settings:error-logging"; enabled: boolean }
  | { type: "settings:open-at-login"; enabled: boolean }
  | { type: "settings:auto-check-updates"; enabled: boolean }
  | { type: "settings:state"; autoRestartOnUnhealthy: boolean; errorLoggingEnabled: boolean; openAtLogin: boolean; autoCheckUpdates: boolean }
  | { type: "errors:export" }
  | { type: "errors:exported"; json: string }
  | { type: "app:health-restart"; id: string; name: string };
