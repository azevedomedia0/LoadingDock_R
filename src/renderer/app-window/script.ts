import { Electroview } from "electrobun/view";
import type {
  AppMetricsPoint,
  DockerApp,
  IpcMessage,
} from "../../shared/types";
import {
  buildSparkline,
  classifyLogLevel,
  filterLogLines,
  latestMetricsLabel,
  maskValue,
  scopeMetrics,
  type LogLevel,
} from "./metrics";

// Electrobun ≥1.18.1 requires a config arg; polyfill ev.on/ev.send with the
// RPC envelope format: { type: "message", id: <channel>, payload: <data> }
const ev = new Electroview({} as any);
(ev as any).on = function (
  name: string,
  handler: (msg: unknown) => void,
): void {
  this.rpcHandler = (envelope: any) => {
    if (envelope?.type === "message" && envelope?.id === name) {
      handler(envelope.payload);
    }
  };
};
(ev as any).send = function (name: string, payload: unknown): void {
  this.bunBridge(JSON.stringify({ type: "message", id: name, payload }));
};
let currentApp: DockerApp | null = null;
let logs: string[] = [];
let metrics: AppMetricsPoint[] = [];
let logFilter = "";
let logLevel: LogLevel = "all";
let maskSecrets = true;
let metricsRange: "1h" | "24h" | "7d" = "24h";

function send(msg: IpcMessage) {
  ev.send("ipc-message", msg);
}

function showError(message: string) {
  const banner = document.getElementById("error-banner");
  if (!banner) return;
  banner.textContent = message;
  banner.classList.remove("hidden");
  window.setTimeout(() => banner.classList.add("hidden"), 4500);
}

function renderLogs() {
  const out = document.getElementById("log-output")!;
  while (out.firstChild) out.removeChild(out.firstChild);
  for (const line of filterLogLines(logs, logFilter, logLevel)) {
    const span = document.createElement("span");
    const level = classifyLogLevel(line);
    span.className = `log-line log-line--${level}`;
    span.textContent = line + "\n";
    out.appendChild(span);
  }
  out.scrollTop = out.scrollHeight;
}

function renderMetrics() {
  const scoped = scopeMetrics(metrics, metricsRange);
  const label = latestMetricsLabel(scoped, metrics);
  if (label) document.getElementById("metrics-value")!.textContent = label;
  document.getElementById("metrics-chart")!.textContent = buildSparkline(scoped);
}

function renderApp(app: DockerApp) {
  document.title = app.name;
  document.getElementById("app-name")!.textContent = app.name;
  document.getElementById("app-image")!.textContent = app.image;

  const portsList = document.getElementById("ports-list")!;
  portsList.innerHTML = app.ports.length
    ? app.ports.map((p) => `<li>${p}</li>`).join("")
    : '<li style="color:var(--muted)">None</li>';

  const envList = document.getElementById("env-list")!;
  const entries = Object.entries(app.env);
  envList.innerHTML = entries.length
    ? entries
        .map(
          ([k, v]) => `<li><span class="key">${k}</span>${maskValue(v, maskSecrets)}</li>`,
        )
        .join("")
    : '<li style="color:var(--muted)">None</li>';

  if (app.openUrl) {
    document.getElementById("section-url")!.classList.remove("hidden");
    document.getElementById("open-url-label")!.textContent = app.openUrl;
  } else {
    document.getElementById("section-url")!.classList.add("hidden");
  }
  updateStatus(app.status);
  document.getElementById("health-value")!.textContent =
    app.health ?? "unknown";
}

function updateStatus(status: DockerApp["status"]) {
  const badge = document.getElementById("status-badge")!;
  badge.className = "badge badge--" + status;
  badge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
  const btnLaunch = document.getElementById("btn-launch")! as HTMLButtonElement;
  const btnStop = document.getElementById("btn-stop")! as HTMLButtonElement;
  const busy = status === "starting" || status === "stopping";
  if (status === "running") {
    btnLaunch.classList.add("hidden");
    btnStop.classList.remove("hidden");
  } else {
    btnLaunch.classList.remove("hidden");
    btnStop.classList.add("hidden");
  }
  btnLaunch.disabled = busy;
  btnStop.disabled = busy;
}

ev.on("ipc-message", (msg: IpcMessage) => {
  switch (msg.type) {
    case "app:open-window":
      currentApp = msg.app;
      renderApp(msg.app);
      break;
    case "app:status":
      if (currentApp && msg.id === currentApp.id) {
        currentApp.status = msg.status;
        currentApp.containerId = msg.containerId;
        updateStatus(msg.status);
      }
      break;
    case "docker:log":
      if (currentApp && msg.id === currentApp.id) {
        logs.push(msg.line);
        if (logs.length > 2000) logs.shift();
        renderLogs();
      }
      break;
    case "app:pull-progress":
      if (currentApp && msg.id === currentApp.id) {
        const line = `[pull] ${msg.detail ?? msg.status}`;
        logs.push(line);
        if (logs.length > 2000) logs.shift();
        renderLogs();
      }
      break;
    case "docker:logs:history":
      if (currentApp && msg.id === currentApp.id) {
        logs = [...msg.lines];
        renderLogs();
      }
      break;
    case "app:health":
      if (currentApp && msg.id === currentApp.id) {
        currentApp.health = msg.health;
        document.getElementById("health-value")!.textContent =
          msg.health ?? "unknown";
      }
      break;
    case "app:metrics":
      if (currentApp && msg.point.id === currentApp.id) {
        metrics.push(msg.point);
        if (metrics.length > 240) metrics.shift();
        renderMetrics();
      }
      break;
    case "metrics:history":
      if (currentApp && msg.id === currentApp.id) {
        metrics = [...msg.points];
        renderMetrics();
      }
      break;
    case "secrets:mask":
      maskSecrets = msg.enabled;
      if (currentApp) renderApp(currentApp);
      break;
    case "error":
      showError(msg.message);
      break;
  }
});

document.getElementById("btn-open-webui")!.addEventListener("click", () => {
  if (!currentApp) return;
  send({ type: "app:open-webui", id: currentApp.id });
});
document.getElementById("btn-open-external")!.addEventListener("click", () => {
  if (!currentApp) return;
  send({ type: "app:open-external", id: currentApp.id });
});
document.getElementById("btn-launch")!.addEventListener("click", () => {
  if (!currentApp) return;
  send({ type: "app:launch", id: currentApp.id });
});
document.getElementById("btn-stop")!.addEventListener("click", () => {
  if (!currentApp) return;
  send({ type: "app:stop", id: currentApp.id });
});
document.getElementById("btn-clear-log")!.addEventListener("click", () => {
  logs = [];
  renderLogs();
});
function visibleLogLines(): string[] {
  return filterLogLines(logs, logFilter, logLevel);
}

document.getElementById("btn-download-log")!.addEventListener("click", () => {
  if (!currentApp) return;
  const blob = new Blob([visibleLogLines().join("\n")], { type: "text/plain" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = `${currentApp.id}-logs.txt`;
  a.click();
  URL.revokeObjectURL(href);
});
document.getElementById("log-filter")!.addEventListener("input", (e) => {
  logFilter = (e.target as HTMLInputElement).value.toLowerCase();
  renderLogs();
});
document.getElementById("log-level")!.addEventListener("change", (e) => {
  logLevel = (e.target as HTMLSelectElement).value as LogLevel;
  renderLogs();
});
document.getElementById("toggle-mask")!.addEventListener("change", (e) => {
  send({
    type: "secrets:mask",
    enabled: (e.target as HTMLInputElement).checked,
  });
});
document.getElementById("metrics-range")!.addEventListener("change", (e) => {
  metricsRange = (e.target as HTMLSelectElement).value as "1h" | "24h" | "7d";
  renderMetrics();
});
