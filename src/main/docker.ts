import type { ContainerStatus, DockerApp } from "../shared/types";

export type StatusCallback = (
  id: string,
  status: ContainerStatus,
  containerId?: string,
) => void;
export type LogCallback = (id: string, line: string) => void;

const activeProcs = new Map<string, ReturnType<typeof Bun.spawn>>();

// Cached path to the docker binary. `undefined` = not yet searched.
// Set to `null` only after a successful resolution fails — but we never
// permanently cache `null` so that re-detection works after daemon start.
let resolvedDockerBin: string | undefined;

// All paths where Docker CLI may live, ordered by likelihood.
const DOCKER_CANDIDATES = [
  process.env.DOCKER_PATH,
  "docker",
  "/usr/local/bin/docker",
  "/opt/homebrew/bin/docker",
  // Docker Desktop (macOS) bundles its own CLI here
  "/Applications/Docker.app/Contents/Resources/bin/docker",
  "/usr/bin/docker",
  // Docker Desktop (Windows)
  process.env["PROGRAMFILES"] &&
    `${process.env["PROGRAMFILES"]}\\Docker\\Docker\\resources\\bin\\docker.exe`,
].filter(Boolean) as string[];

/**
 * Locate the docker binary. Returns the resolved path or `null`.
 * Pass `force = true` to bypass the cache (used when polling after daemon start).
 */
async function resolveDockerBinary(force = false): Promise<string | null> {
  if (!force && resolvedDockerBin !== undefined) return resolvedDockerBin;

  for (const candidate of DOCKER_CANDIDATES) {
    try {
      // `docker version` works without a running daemon — it only needs the CLI.
      const p = Bun.spawn(
        [candidate, "version", "--format", "{{.Client.Version}}"],
        { stdout: "pipe", stderr: "pipe" },
      );
      await p.exited;
      if (p.exitCode === 0) {
        resolvedDockerBin = candidate;
        return candidate;
      }
    } catch {
      // binary not at this path — try next
    }
  }

  // Do NOT cache null permanently: Docker Desktop may not have finished
  // adding its CLI to PATH yet. Leave resolvedDockerBin unchanged so the
  // next call retries the full candidate list.
  return null;
}

async function dockerCmd(
  args: string[],
  force = false,
): Promise<string[] | null> {
  const bin = await resolveDockerBinary(force);
  if (!bin) return null;
  return [bin, ...args];
}

export async function isDockerAvailable(force = false): Promise<boolean> {
  const cmd = await dockerCmd(["info"], force);
  if (!cmd) return false;
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  await proc.exited;
  return proc.exitCode === 0;
}

/**
 * Attempt to start the Docker daemon / Docker Desktop for the current
 * platform, then poll until `docker info` succeeds or the timeout elapses.
 *
 * Returns `true` when Docker is ready, `false` on timeout / failure.
 */
export async function startDockerDaemon(
  pollIntervalMs = 2000,
  timeoutMs = 60_000,
): Promise<boolean> {
  const platform = process.platform;

  try {
    if (platform === "darwin") {
      // macOS — try Colima first (brew install colima), then Docker Desktop
      const colimaPath = [
        "/opt/homebrew/bin/colima",
        "/usr/local/bin/colima",
      ].find((p) => {
        try { return Bun.spawnSync(["test", "-f", p]).exitCode === 0; } catch { return false; }
      });

      if (colimaPath) {
        // Colima: start returns when the VM is up (may take ~30-60s)
        Bun.spawn([colimaPath, "start"], { stdout: "pipe", stderr: "pipe" });
      } else {
        // Fall back to Docker Desktop
        const p = Bun.spawn(["open", "-a", "Docker"], {
          stdout: "pipe",
          stderr: "pipe",
        });
        await p.exited;
      }
    } else if (platform === "win32") {
      // Windows — find and launch Docker Desktop
      const candidates = [
        process.env["PROGRAMFILES"] &&
          `${process.env["PROGRAMFILES"]}\\Docker\\Docker\\Docker Desktop.exe`,
        process.env["LOCALAPPDATA"] &&
          `${process.env["LOCALAPPDATA"]}\\Docker\\Docker Desktop.exe`,
        "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe",
      ].filter(Boolean) as string[];

      for (const exe of candidates) {
        try {
          Bun.spawn(["cmd", "/c", "start", "", exe], {
            stdout: "pipe",
            stderr: "pipe",
          });
          break; // launched successfully
        } catch {
          // try next path
        }
      }
    } else {
      // Linux — try systemctl then SysV service
      const systemctl = Bun.spawn(["systemctl", "start", "docker"], {
        stdout: "pipe",
        stderr: "pipe",
      });
      await systemctl.exited;
      if (systemctl.exitCode !== 0) {
        const svc = Bun.spawn(["service", "docker", "start"], {
          stdout: "pipe",
          stderr: "pipe",
        });
        await svc.exited;
      }
    }
  } catch {
    // If the start command itself throws, still try polling below —
    // the daemon may already be coming up from a previous attempt.
  }

  // Poll until docker info succeeds or we time out.
  // force = true on every poll so the binary cache is bypassed — Docker
  // Desktop may not have added its CLI to PATH until the daemon is fully up.
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise<void>((r) => setTimeout(r, pollIntervalMs));
    if (await isDockerAvailable(true)) return true;
  }
  return false;
}

export async function launchApp(
  app: DockerApp,
  onStatus: StatusCallback,
  onLog: LogCallback,
  onPullProgress?: (id: string, status: string, detail?: string) => void,
  resolvedEnv?: Record<string, string>,
): Promise<void> {
  onStatus(app.id, "starting");

  const dockerBin = await resolveDockerBinary();
  if (!dockerBin) {
    onStatus(app.id, "error");
    onLog(
      app.id,
      "[loading-dock] Docker CLI not found. Install Docker Desktop or set DOCKER_PATH.",
    );
    return;
  }

  await silentRun(["rm", "-f", containerName(app)]);
  if (onPullProgress) {
    onPullProgress(app.id, "pulling", app.image);
    await pullImage(dockerBin, app, onPullProgress);
    onPullProgress(app.id, "pulled", app.image);
  }
  const effectiveApp = resolvedEnv
    ? { ...app, env: { ...app.env, ...resolvedEnv } }
    : app;
  const args = buildDockerRunArgs(effectiveApp, dockerBin);

  try {
    const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
    activeProcs.set(app.id, proc);
    streamLogs(proc.stdout, app.id, onLog);
    streamLogs(proc.stderr, app.id, onLog);

    const inspectCmd = [
      dockerBin,
      "inspect",
      "--format",
      "{{.Id}}",
      containerName(app),
    ];
    const idProc = Bun.spawn(inspectCmd, { stdout: "pipe", stderr: "pipe" });
    await idProc.exited;
    const rawId = await new Response(idProc.stdout).text();
    const containerId = rawId.trim().slice(0, 12);
    onStatus(app.id, "running", containerId);

    proc.exited.then((code) => {
      activeProcs.delete(app.id);
      onStatus(app.id, code === 0 ? "stopped" : "error");
      onLog(app.id, "[loading-dock] Container exited with code " + code);
    });
  } catch (err) {
    onStatus(app.id, "error");
    onLog(app.id, "[loading-dock] Failed to start: " + String(err));
  }
}

export async function stopApp(
  app: DockerApp,
  onStatus: StatusCallback,
): Promise<void> {
  onStatus(app.id, "stopping");
  const proc = activeProcs.get(app.id);
  if (proc) {
    proc.kill();
    activeProcs.delete(app.id);
  }
  await silentRun(["stop", containerName(app)]);
  await silentRun(["rm", containerName(app)]);
  onStatus(app.id, "stopped");
}

export function containerName(app: DockerApp): string {
  return "loading-dock-" + app.id;
}

export function buildDockerRunArgs(
  app: DockerApp,
  dockerBin = "docker",
): string[] {
  const args = [dockerBin, "run", "--rm", "--name", containerName(app)];
  if (app.restartPolicy && app.restartPolicy !== "no") {
    args.push("--restart", app.restartPolicy);
  }
  if (app.healthcheck?.cmd) {
    args.push("--health-cmd", app.healthcheck.cmd);
    if (app.healthcheck.intervalSec)
      args.push("--health-interval", `${app.healthcheck.intervalSec}s`);
    if (app.healthcheck.timeoutSec)
      args.push("--health-timeout", `${app.healthcheck.timeoutSec}s`);
    if (app.healthcheck.retries)
      args.push("--health-retries", String(app.healthcheck.retries));
  }
  for (const port of app.ports) args.push("-p", port);
  for (const [key, val] of Object.entries(app.env))
    args.push("-e", key + "=" + val);
  for (const vol of app.volumes)
    args.push("-v", vol.replace(/^~/, process.env.HOME ?? "~"));
  args.push(app.image);
  return args;
}

async function pullImage(
  dockerBin: string,
  app: DockerApp,
  onPullProgress: (id: string, status: string, detail?: string) => void,
) {
  const p = Bun.spawn([dockerBin, "pull", app.image], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const reader = p.stdout?.getReader();
  const decoder = new TextDecoder();
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      for (const line of text.split("\n")) {
        if (line.trim()) onPullProgress(app.id, "pulling", line.trim());
      }
    }
  }
  await p.exited;
}

export async function getContainerHealth(
  app: DockerApp,
): Promise<DockerApp["health"]> {
  const cmd = await dockerCmd([
    "inspect",
    "--format",
    "{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}",
    containerName(app),
  ]);
  if (!cmd) return "unknown";

  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  await proc.exited;
  if (proc.exitCode !== 0) return "unknown";

  const raw = (await new Response(proc.stdout).text()).trim();
  if (
    raw === "healthy" ||
    raw === "unhealthy" ||
    raw === "starting" ||
    raw === "none"
  ) {
    return raw;
  }
  return "unknown";
}

export async function getContainerMetrics(
  app: DockerApp,
): Promise<{ cpuPercent: number; memUsageMB: number } | null> {
  const cmd = await dockerCmd([
    "stats",
    "--no-stream",
    "--format",
    "{{.CPUPerc}}|{{.MemUsage}}",
    containerName(app),
  ]);
  if (!cmd) return null;

  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  await proc.exited;
  if (proc.exitCode !== 0) return null;

  const line = (await new Response(proc.stdout).text()).trim();
  if (!line) return null;

  const [cpuRaw, memRaw] = line.split("|");
  const cpuPercent = Number(cpuRaw.replace("%", "").trim()) || 0;
  const used = (memRaw.split("/")[0] ?? "").trim();
  const memUsageMB = parseMemoryToMB(used);
  return { cpuPercent, memUsageMB };
}

function parseMemoryToMB(raw: string): number {
  const match = raw.match(/^([\d.]+)\s*([KMG]i?B?)?$/i);
  if (!match) return 0;
  const value = Number(match[1]);
  const unit = (match[2] ?? "B").toUpperCase();
  if (unit.startsWith("G")) return value * 1024;
  if (unit.startsWith("M")) return value;
  if (unit.startsWith("K")) return value / 1024;
  return value / (1024 * 1024);
}

async function silentRun(args: string[]): Promise<void> {
  try {
    const cmd = await dockerCmd(args);
    if (!cmd) return;
    const p = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
    await p.exited;
  } catch {
    // ignore best-effort cleanup failures
  }
}

async function streamLogs(
  stream: ReadableStream<Uint8Array> | null,
  id: string,
  onLog: LogCallback,
): Promise<void> {
  if (!stream) return;
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const lines = decoder.decode(value).split("\n");
    for (const line of lines) {
      if (line.trim()) onLog(id, line);
    }
  }
}
