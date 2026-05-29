// src/main/registry.ts
import { dirname, join } from "path";
import type { DockerApp } from "../shared/types";

const APP_DIR_NAME = "loading-dock";
const APPS_FILE_NAME = "apps.json";
const METRICS_FILE_NAME = "metrics.json";

export function getRegistryDir(
  platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const home = env.HOME ?? ".";
  if (platform === "darwin")
    return join(home, "Library", "Application Support", APP_DIR_NAME);
  if (platform === "win32") {
    const appData = env.APPDATA ?? join(home, "AppData", "Roaming");
    return join(appData, APP_DIR_NAME);
  }
  const xdg = env.XDG_CONFIG_HOME ?? join(home, ".config");
  return join(xdg, APP_DIR_NAME);
}

export function getRegistryFile(
  platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return join(getRegistryDir(platform, env), APPS_FILE_NAME);
}

export function getMetricsFile(
  platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return join(getRegistryDir(platform, env), METRICS_FILE_NAME);
}

async function ensureDir(registryDir = getRegistryDir()) {
  await Bun.write(join(registryDir, ".keep"), "");
}

function randomSecret(length = 24): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function loadRegistry(
  registryFile = getRegistryFile(),
): Promise<DockerApp[]> {
  try {
    const file = Bun.file(registryFile);
    const text = await file.text();
    const raw = JSON.parse(text) as Omit<DockerApp, "status">[];
    return raw.map((a) => ({
      ...a,
      status: "stopped",
      containerId: undefined,
    }));
  } catch {
    return getDefaultApps();
  }
}

export async function registryExists(
  registryFile = getRegistryFile(),
): Promise<boolean> {
  return Bun.file(registryFile).exists();
}

export async function saveRegistry(
  apps: DockerApp[],
  registryFile = getRegistryFile(),
): Promise<void> {
  await ensureDir(dirname(registryFile));
  const serializable = apps.map(
    ({ status: _s, containerId: _c, ...rest }) => rest,
  );
  await Bun.write(registryFile, JSON.stringify(serializable, null, 2));
}

function getDefaultApps(): DockerApp[] {
  const postgresPassword = randomSecret();
  const minioPassword = randomSecret();
  return [
    {
      id: "postgres-dev",
      name: "Postgres",
      icon: "postgres.png",
      description: "PostgreSQL 15 development database",
      image: "postgres:15",
      ports: ["5432:5432"],
      env: {
        POSTGRES_PASSWORD: postgresPassword,
        POSTGRES_USER: "dev",
        POSTGRES_DB: "devdb",
      },
      volumes: ["~/.loading-dock/data/postgres:/var/lib/postgresql/data"],
      status: "stopped",
    },
    {
      id: "redis-dev",
      name: "Redis",
      icon: "redis.png",
      description: "Redis 7 in-memory store",
      image: "redis:7-alpine",
      ports: ["6379:6379"],
      env: {},
      volumes: [],
      status: "stopped",
    },
    {
      id: "minio-dev",
      name: "MinIO",
      icon: "minio.png",
      description: "S3-compatible object storage",
      image: "minio/minio",
      ports: ["9000:9000", "9001:9001"],
      env: {
        MINIO_ROOT_USER: "minioadmin",
        MINIO_ROOT_PASSWORD: minioPassword,
      },
      volumes: ["~/.loading-dock/data/minio:/data"],
      openUrl: "http://localhost:9001",
      status: "stopped",
    },
  ];
}
