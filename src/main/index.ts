// src/main/index.ts
import { BrowserWindow, Tray, ApplicationMenu } from "electrobun/bun";
import { tmpdir } from "os";
import { join } from "path";
import { writeFileSync } from "fs";
import type { ContainerStatus, DockerApp, IpcMessage } from "../shared/types";
import { loadRegistry, registryExists, saveRegistry } from "./registry";
import {
  getContainerHealth,
  getContainerMetrics,
  isDockerAvailable,
  startDockerDaemon,
  launchApp,
  stopApp,
} from "./docker";
import { normalizeName } from "../shared/validation";
import { importComposeAsApps } from "./compose";
import { getPopularImages, searchImages, fetchAllOgImages } from "./dockerhub";
import { presetForImage } from "../shared/presets";
import { loadMetricsHistory, saveMetricsHistory } from "./metrics-store";
import { loadSettings, saveSettings } from "./settings";
import {
  nextUnhealthyStreak,
  shouldRestartUnhealthy,
} from "./health-recovery";
import {
  appendErrorEntry,
  formatErrorExport,
  loadRecentErrors,
} from "./error-report";
import {
  checkForUpdate,
  downloadUpdate,
  applyUpdate,
  type ReleaseInfo,
} from "./updater";
import { keychainSet, keychainDelete, resolveKeychainEnv } from "./keychain";
import { openWebUiWindow, closeWebUiWindow } from "./webui";
import { Utils } from "electrobun/bun";
import { validateOpenUrl } from "../shared/validation";

// Tray icon embedded as base64 so it survives app-bundle packaging
// (assets/ is not copied into the .app bundle at build time).
const TRAY_ICON_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAGyElEQVR42q1XXWxcVxH+Zs69ex1vdmPtKvHe" +
  "uxvsKA5NESUIWkAIKAEpoj+QCoosEUKrouYFqAQvNEoVqYIoidSHliJB1QpFgIoCEULQhrZUjVzgraEKUh3k" +
  "JCaOf9Yb/3Rlr2N795wZHnIv3Li2Y4ce6WpXe87eM/N9M9/MGKx9eQCkUCjkC4XCE9lsNmg0GhcBEAAGoLiF" +
  "ZdZwhuNPCcPws77v/56ZHwTQm8/nM7Ozs30AJDFwvQbQGry2ADgMw8PMfBgAqV53lpkhIn9T1Uer1eq/Yodk" +
  "PWiYm+y5MAx35vP5U8aYh+KLxfO8s6q6QVV9Zu4GsD+Xy1VnZ2ffTqGm/68BGobht4noFDN/UESaAIzneRev" +
  "XLmyq7Ozc9E5d69zbpGZs8z8QDab7cpkMmfm5+cX1oDushQQAOrp6fHn5uaeM8Y8JCKqqk0iMgBARAtBEDxn" +
  "rf28tXYXAE2QMcYEqnreWvv1Wq3WH79P1oMAA5AgCHYw8/OqKkTEzOwREQNgIsqo6qdFJCIiJiLDzIaZPRFp" +
  "GmNKqjrdaDTeSMXEqkH2XuxVSVUtEXmq+hcReR1AO4Ccqr5rjGmIyIYYFQKgRNQG4DFV9YiotZ7cXpkfIqjq" +
  "i8aYkwBOE9G8qvoAeqvV6nS5XP6+iLxZrVbPAuAoih4BkFsr/+kcv+E3VU2oUQAkIr2e500ODw/fa4xZFJG9" +
  "URQ9AeAQM/+yVCp9MwzDtsQhVb1lAwiAWGun45eRqi4Q0RURuaO7u/uAqu50zk0y8x9UtV9EXlbVvzebzZX4" +
  "prVSwABcFEW3EdEPmXkCwAYiun90dHRfFEU/AfAxVT1eq9VejpXxiIgM1Gq1f1cqlYKI6DKXaxLcqyFAAKhY" +
  "LOaY+dl8Pn+pWCw+3dHR8YgxhqIo+igRfcb3/RIz3xOGYaFcLj8VBMHjmUzmxTAMH9i+ffvMMjHV6urqaovv" +
  "p9UMYAAuCIJD7e3t5xqNxlcmJyeP1Ov1bzjn/qGq9xhjghMnTjxIRL6I7AVw58GDB/dks9lfMHNvX1+fTXHP" +
  "ALB169ao1Wr9M4qiwzESZjkDGIArlUp3+r7f7ZyLAHyCmUFEATO3E1FNRLbt37//ABFtV9UhAHTs2LHvNZvN" +
  "+wCMXk8acnHtIACw1h5i5h1E9GQURb0xEkGMFCP1RZj5c5lM5hVmPmuMebq9vR2tVmu8Xq8/box5wVq7YIz5" +
  "kHPu+NWrV18vlUp1a+1e59xb9Xr9hZ6enszc3FyemT1rbYLsF1U1gf8ogJMAFtMAUFLxKpXKd4wxo93d3a9c" +
  "vnz5SSLKhGF4dGho6OcA7lLVaqyMBCBLREZVZzzPGzbGBNeuXXvG9/2IiLZZa387Pj5+PgzDC8zcExvBqvpo" +
  "rKSLzPzm6OjohaSZMJVK5VebN29+Znp6+inn3F1E1GTmId/3/ywi98cCxM65DhHpMMb0iUgBQLlYLP5gamrq" +
  "z/Dw8L50BkRRdJqZvyQiFoCh6wsA4JxbIKLfEQDu6urKWGt/4/u+iMhXN23adHehUBgcHBwcZuaXPM+rJeXZ" +
  "Wnu7c+7jY2Njbbt37y4ODAxMMvNrImJVdX9nZ+fs/Pw89ff3N8vl8qcA/FVVOdEYVXUAnDFmg3Pu4g2pUSwW" +
  "oyAIXvU8zwKYtdZuazabX1hYWHg3DjIJguADQRCcMcacIaJ8q9W6vdls3j05OXkh/a4tW7Z0ep73LQA/BuAn" +
  "gUlEICKISD8z76EwDN8AUIg3F1W1wswRAIjIFIABIuKk5saRfAcz55IzRHQ+jm7E6tkGYKsxZpOIJJIuAKaJ" +
  "aFpVTwM4MjY2NkXlclmXqYZJW2USzpbsA4BLSvpNzmhcqo+2tbUdHxwcXEhlAlMURZcAdCeFJ/UklusK+p4+" +
  "I6vtq+qiMWbHyMjIaKqLFgDKqvoW/c8FXiKZlBKr9LP0jFnyJGccMzOAn8WXe7HBLnGMmfnUEovfryVEZJxz" +
  "I5lM5keJ4r5HionoJRG5FKMg79PlCXVERA8PDQ3VU5Xxxp5wZmbG5nK5KWb+mqraNQ4rq3oeB55R1e+OjY2d" +
  "TDRkpabUNBqNcxs3bryNmXepanMZntfqtSMiQ0QsIo9Vq9Wfxry71ToiAcAdHR0PO+f+yMyZ+HK7BkqSDLAA" +
  "iJk9VR1V1S9Xq9VnU5PVzdvyiYkJ12g0TuZyOQPgkylDElglxa2mYoiYmVV1HsDz1tp94+Pjb68G+0r9GqUm" +
  "op1EdICI7lPVnngmWE5sFgG8o6p/Msb8emRk5GJ6rLvV4fS/f+7q6mpzzn1ERD5MRNvi6qdENKGqF0TkXK1W" +
  "e2fJf9c1nP4HWCA+QSNCyegAAAAASUVORK5CYII=";

// Write once at process start into OS temp dir (survives bundle packaging)
const TRAY_ICON_PATH = join(tmpdir(), "loading-dock-tray.png");
writeFileSync(TRAY_ICON_PATH, Buffer.from(TRAY_ICON_B64, "base64"));

const CURRENT_VERSION = "0.2.0";
const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 h

let apps: DockerApp[] = [];
let launcherWindow: InstanceType<typeof BrowserWindow> | null = null;
const appWindows = new Map<string, InstanceType<typeof BrowserWindow>>();
const logHistory = new Map<string, string[]>();
const metricsHistory = new Map<
  string,
  { id: string; cpuPercent: number; memUsageMB: number; timestamp: number }[]
>();
let dockerAvailable = false;
let isFirstRun = false;
let secretsMaskingEnabled = true;
let releaseChannel: "stable" | "beta" = "stable";
let notificationsEnabled = true;
let keychainSecretsEnabled = false;
let autoRestartOnUnhealthy = true;
let errorLoggingEnabled = true;
let openAtLogin = false;
let autoCheckUpdates = true;
let _pendingUpdate: ReleaseInfo | null = null;
const unhealthyStreaks = new Map<string, number>();
const healthRestartInProgress = new Set<string>();

// Cache: docker image reference → og:image URL (persists for the process lifetime)
const ogCache = new Map<string, string>();

/**
 * Fetch og:image URLs for all current apps, send any results to the launcher.
 * Already-cached entries are sent immediately; new ones are fetched in the background.
 */
function broadcastOgImages() {
  const refs = [...new Set(apps.map((a) => a.image))];

  // Send already-cached results right away
  const cached: Record<string, string> = {};
  const uncached: string[] = [];
  for (const ref of refs) {
    const url = ogCache.get(ref);
    if (url) cached[ref] = url;
    else uncached.push(ref);
  }
  if (Object.keys(cached).length > 0) {
    sendToLauncher({ type: "dockerhub:og-images", results: cached });
  }

  // Fetch uncached ones without blocking
  if (uncached.length > 0) {
    fetchAllOgImages(uncached)
      .then((results) => {
        for (const [img, url] of Object.entries(results)) ogCache.set(img, url);
        if (Object.keys(results).length > 0) {
          sendToLauncher({ type: "dockerhub:og-images", results });
        }
      })
      .catch(() => {/* best-effort */});
  }
}

async function main() {
  isFirstRun = !(await registryExists());
  apps = await loadRegistry();
  const persistedMetrics = await loadMetricsHistory();
  for (const [id, points] of Object.entries(persistedMetrics)) {
    metricsHistory.set(id, points);
  }
  const settings = await loadSettings();
  releaseChannel = settings.releaseChannel;
  notificationsEnabled = settings.notificationsEnabled;
  secretsMaskingEnabled = settings.secretsMaskingEnabled;
  keychainSecretsEnabled = settings.keychainSecretsEnabled;
  autoRestartOnUnhealthy = settings.autoRestartOnUnhealthy;
  errorLoggingEnabled = settings.errorLoggingEnabled;
  openAtLogin = settings.openAtLogin ?? false;
  autoCheckUpdates = settings.autoCheckUpdates ?? true;
  dockerAvailable = await isDockerAvailable();

  setupProcessErrorHandlers();

  setupTray();
  setupMenu();
  openLauncher();
  startRuntimeTelemetry();
  scheduleStartupUpdateCheck();

  // If Docker is not yet running, attempt to start it in the background
  // so the UI is never blocked. The launcher receives a docker:availability
  // update the moment the daemon responds.
  if (!dockerAvailable) {
    console.log(
      "[loading-dock] Docker not running — attempting to start daemon…",
    );
    ensureDockerRunning();
  }
}

/** Starts the Docker daemon and notifies the launcher when it becomes ready. */
async function ensureDockerRunning() {
  const ready = await startDockerDaemon();
  if (ready) {
    dockerAvailable = true;
    sendToLauncher({ type: "docker:availability", available: true });
    console.log("[loading-dock] Docker daemon is now ready.");
  } else {
    console.error(
      "[loading-dock] Docker daemon did not become ready within the timeout.",
    );
  }
}

async function scheduleStartupUpdateCheck() {
  if (!autoCheckUpdates) return;
  const settings = await loadSettings();
  const sinceLastCheck = Date.now() - (settings.lastUpdateCheckAt ?? 0);
  if (sinceLastCheck < UPDATE_CHECK_INTERVAL_MS) return;
  // Small delay so the launcher window is ready to receive the message
  setTimeout(() => {
    checkForUpdate(CURRENT_VERSION, releaseChannel, async (result) => {
      if (result.type === "available") {
        _pendingUpdate = result.info;
        broadcast({
          type: "update:available",
          version: result.info.version,
          releaseNotes: result.info.releaseNotes,
          channel: result.info.channel,
        });
      }
      await saveSettings({ lastUpdateCheckAt: Date.now() });
    });
  }, 3000);
}

function sendNativeNotification(title: string, body: string) {
  try {
    if (process.platform === "darwin") {
      Bun.spawn(["osascript", "-e",
        `display notification "${body.replace(/"/g, '\\"')}" with title "${title.replace(/"/g, '\\"')}"`]);
    } else if (process.platform === "linux") {
      Bun.spawn(["notify-send", title, body]);
    } else if (process.platform === "win32") {
      const script = `
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType=WindowsRuntime] | Out-Null
        $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
        $template.GetElementsByTagName('text')[0].AppendChild($template.CreateTextNode('${title.replace(/'/g, "''")}')) | Out-Null
        $template.GetElementsByTagName('text')[1].AppendChild($template.CreateTextNode('${body.replace(/'/g, "''")}')) | Out-Null
        $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('The Loading Dock(r)')
        $notifier.Show([Windows.UI.Notifications.ToastNotification]::new($template))
      `.trim();
      Bun.spawn(["powershell", "-NoProfile", "-Command", script]);
    }
  } catch {
    // Notifications are best-effort; never crash the main process
  }
}

function openLauncher() {
  if (launcherWindow) {
    launcherWindow.show();
    return;
  }
  launcherWindow = new BrowserWindow({
    title: "The Loading Dock(r)",
    url: "views://launcher/index.html",
    frame: { x: 100, y: 80, width: 920, height: 640 },
  } as any);
  launcherWindow.webview.on("dom-ready", () => {
    sendToLauncher({ type: "apps:list", apps });
    sendToLauncher({ type: "docker:availability", available: dockerAvailable });
    sendToLauncher({ type: "onboarding:state", firstRun: isFirstRun });
    sendToLauncher({ type: "update:state", channel: releaseChannel });
    broadcastSettingsState();
    broadcastOgImages();
  });
  (launcherWindow.webview as any).on(
    "ipc-message",
    async (message: IpcMessage) => await handleIpc(message),
  );
  launcherWindow.on("close", () => {
    launcherWindow = null;
  });
}

function openAppWindow(app: DockerApp) {
  if (appWindows.has(app.id)) {
    appWindows.get(app.id)!.show();
    return;
  }
  const win = new BrowserWindow({
    title: app.name,
    url: "views://app-window/index.html",
    frame: { x: 140, y: 120, width: 820, height: 580 },
  } as any);
  win.webview.on("dom-ready", () =>
    safeSend(win.webview, { type: "app:open-window", app }),
  );
  win.webview.on("dom-ready", () => {
    safeSend(win.webview, {
      type: "docker:logs:history",
      id: app.id,
      lines: logHistory.get(app.id) ?? [],
    });
    safeSend(win.webview, {
      type: "secrets:mask",
      enabled: secretsMaskingEnabled,
    });
    safeSend(win.webview, {
      type: "metrics:history",
      id: app.id,
      points: metricsHistory.get(app.id) ?? [],
    });
  });
  (win.webview as any).on(
    "ipc-message",
    async (message: IpcMessage) => await handleIpc(message),
  );
  win.on("close", () => {
    appWindows.delete(app.id);
  });
  appWindows.set(app.id, win);
}

async function handleIpc(message: IpcMessage) {
  switch (message.type) {
    case "app:launch": {
      const app = apps.find((a) => a.id === message.id);
      if (!app) return;
      try {
        const resolvedEnv = keychainSecretsEnabled
          ? await resolveKeychainEnv(app.id, app.env, app.keychainEnvKeys)
          : undefined;
        await launchApp(
          app,
          (id, status, containerId) => {
            const t = apps.find((a) => a.id === id);
            if (t) {
              t.status = status;
              t.containerId = containerId;
            }
            broadcast({ type: "app:status", id, status, containerId });
          },
          (id, line) => broadcast({ type: "docker:log", id, line }),
          (id, status, detail) =>
            broadcast({ type: "app:pull-progress", id, status, detail }),
          resolvedEnv,
        );
      } catch (err) {
        const text = "Failed to launch app: " + String(err);
        recordError("app:launch", text, message.id);
        broadcast({ type: "error", message: text });
      }
      break;
    }
    case "update:channel:set": {
      releaseChannel = message.channel;
      await saveSettings({ releaseChannel });
      broadcast({ type: "update:state", channel: releaseChannel });
      break;
    }
    case "update:check": {
      checkForUpdate(CURRENT_VERSION, releaseChannel, (result) => {
        if (result.type === "available") {
          _pendingUpdate = result.info;
          broadcast({
            type: "update:available",
            version: result.info.version,
            releaseNotes: result.info.releaseNotes,
            channel: result.info.channel,
          });
        } else if (result.type === "not-available") {
          broadcast({ type: "update:not-available" });
        } else if (result.type === "error") {
          const message = "Update check failed: " + result.message;
          recordError("updater:check", message);
          broadcast({ type: "error", message });
        }
      });
      break;
    }
    case "update:download": {
      const info: ReleaseInfo = {
        version: message.version,
        releaseNotes: "",
        downloadUrl: message.downloadUrl,
        channel: message.channel,
      };
      downloadUpdate(info, (result) => {
        if (result.type === "progress") {
          broadcast({ type: "update:download:progress", percent: result.percent });
        } else if (result.type === "ready") {
          broadcast({ type: "update:download:done", localPath: result.localPath });
        } else if (result.type === "error") {
          const message = "Download failed: " + result.message;
          recordError("updater:download", message);
          broadcast({ type: "error", message });
        }
      });
      break;
    }
    case "update:apply": {
      await applyUpdate(message.localPath);
      break;
    }
    case "secrets:mask": {
      secretsMaskingEnabled = message.enabled;
      await saveSettings({ secretsMaskingEnabled });
      broadcast({ type: "secrets:mask", enabled: secretsMaskingEnabled });
      break;
    }
    case "secrets:keychain": {
      keychainSecretsEnabled = message.enabled;
      await saveSettings({ keychainSecretsEnabled });
      sendToLauncher({
        type: "notification:show",
        title: "The Loading Dock(r)",
        body: `Keychain secrets ${keychainSecretsEnabled ? "enabled" : "disabled"}.`,
      });
      break;
    }
    case "settings:auto-restart": {
      autoRestartOnUnhealthy = message.enabled;
      await saveSettings({ autoRestartOnUnhealthy });
      broadcastSettingsState();
      break;
    }
    case "settings:error-logging": {
      errorLoggingEnabled = message.enabled;
      await saveSettings({ errorLoggingEnabled });
      broadcastSettingsState();
      break;
    }
    case "settings:open-at-login": {
      openAtLogin = message.enabled;
      await saveSettings({ openAtLogin });
      // Apply to macOS login items via osascript
      if (process.platform === "darwin") {
        const action = openAtLogin ? "make login item" : "delete login item";
        const appPath = process.execPath.split(".app/")[0] + ".app";
        const script = openAtLogin
          ? `tell application "System Events" to make login item at end with properties {path:"${appPath}", hidden:false}`
          : `tell application "System Events" to delete login item "The Loading Dock(r)"`;
        Bun.spawn(["osascript", "-e", script]);
      }
      break;
    }
    case "settings:auto-check-updates": {
      autoCheckUpdates = message.enabled;
      await saveSettings({ autoCheckUpdates });
      break;
    }
    case "errors:export": {
      const entries = await loadRecentErrors(200);
      broadcast({
        type: "errors:exported",
        json: formatErrorExport(entries),
      });
      break;
    }
    case "notifications:enabled": {
      notificationsEnabled = message.enabled;
      await saveSettings({ notificationsEnabled });
      break;
    }
    case "registry:export": {
      const serializable = apps.map(
        ({ status: _s, containerId: _c, ...rest }) => rest,
      );
      broadcast({
        type: "registry:exported",
        json: JSON.stringify(serializable, null, 2),
      });
      break;
    }
    case "registry:import": {
      try {
        const parsed = JSON.parse(message.json) as Omit<
          DockerApp,
          "status" | "containerId"
        >[];
        apps = parsed.map((a) => ({ ...a, status: "stopped" as const }));
        await saveRegistry(apps);
        broadcast({ type: "apps:list", apps });
        broadcastOgImages();
      } catch (err) {
        const message = "Import failed: " + String(err);
        recordError("registry:import", message);
        broadcast({ type: "error", message });
      }
      break;
    }
    case "app:stop": {
      const app = apps.find((a) => a.id === message.id);
      if (!app) return;
      try {
        await stopApp(app, (id, status) => {
          const t = apps.find((a) => a.id === id);
          if (t) t.status = status;
          broadcast({ type: "app:status", id, status });
        });
        closeWebUiWindow(app.id);
      } catch (err) {
        const text = "Failed to stop app: " + String(err);
        recordError("app:stop", text, message.id);
        broadcast({ type: "error", message: text });
      }
      break;
    }
    case "app:restart": {
      const app = apps.find((a) => a.id === message.id);
      if (!app) return;
      try {
        const statusCb = (id: string, status: ContainerStatus, containerId?: string) => {
          const t = apps.find((a) => a.id === id);
          if (t) { t.status = status; t.containerId = containerId; }
          broadcast({ type: "app:status", id, status, containerId });
        };
        await stopApp(app, statusCb);
        const resolvedEnv = keychainSecretsEnabled
          ? await resolveKeychainEnv(app.id, app.env, app.keychainEnvKeys)
          : undefined;
        await launchApp(app, statusCb,
          (id, line) => broadcast({ type: "docker:log", id, line }),
          (id, status, detail) => broadcast({ type: "app:pull-progress", id, status, detail }),
          resolvedEnv,
        );
      } catch (err) {
        const text = "Failed to restart app: " + String(err);
        recordError("app:restart", text, message.id);
        broadcast({ type: "error", message: text });
      }
      break;
    }
    case "app:open-window": {
      const app = apps.find((a) => a.id === message.app.id);
      if (app) openAppWindow(app);
      break;
    }
    case "app:open-webui": {
      const app = apps.find((a) => a.id === message.id);
      if (!app) return;
      const err = openWebUiWindow(app);
      if (err) broadcast({ type: "error", message: err });
      break;
    }
    case "app:open-external": {
      const app = apps.find((a) => a.id === message.id);
      if (!app?.openUrl) return;
      const url = validateOpenUrl(app.openUrl);
      if (!url) {
        broadcast({ type: "error", message: "Invalid Web UI URL." });
        return;
      }
      Utils.openExternal(url);
      break;
    }
    case "app:add": {
      if (
        apps.some(
          (a) =>
            a.id === message.app.id ||
            normalizeName(a.name) === normalizeName(message.app.name),
        )
      ) {
        broadcast({
          type: "error",
          message: "An app with this name already exists.",
        });
        return;
      }
      const newApp: DockerApp = { ...message.app, status: "stopped" };
      const preset = presetForImage(newApp.image);
      if (preset) {
        newApp.restartPolicy ??= preset.restartPolicy;
        newApp.healthcheck ??= preset.healthcheck;
      }
      apps.push(newApp);
      await saveRegistry(apps);
      broadcast({ type: "apps:list", apps });
      broadcastOgImages();
      break;
    }
    case "app:update": {
      const idx = apps.findIndex((a) => a.id === message.app.id);
      if (idx < 0) {
        broadcast({ type: "error", message: "App not found for update." });
        return;
      }
      const duplicate = apps.some(
        (a, i) =>
          i !== idx &&
          normalizeName(a.name) === normalizeName(message.app.name),
      );
      if (duplicate) {
        broadcast({
          type: "error",
          message: "Another app with this name already exists.",
        });
        return;
      }
      apps[idx] = { ...message.app, status: apps[idx].status };
      await saveRegistry(apps);
      broadcast({ type: "apps:list", apps });
      broadcastOgImages();
      break;
    }
    case "app:remove": {
      apps = apps.filter((a) => a.id !== message.id);
      await saveRegistry(apps);
      broadcast({ type: "apps:list", apps });
      break;
    }
    case "compose:import": {
      try {
        const imported = importComposeAsApps(message.yaml, message.projectName);
        const existingNames = new Set(apps.map((a) => normalizeName(a.name)));
        const unique = imported.filter(
          (a) => !existingNames.has(normalizeName(a.name)),
        );
        if (!unique.length) {
          broadcast({
            type: "error",
            message: "No new services to import (names already exist).",
          });
          return;
        }
        apps.push(...unique.map((a) => ({ ...a, status: "stopped" as const })));
        await saveRegistry(apps);
        broadcast({ type: "apps:list", apps });
      } catch (err) {
        broadcast({
          type: "error",
          message: "Compose import failed: " + String(err),
        });
      }
      break;
    }
    case "dockerhub:browse": {
      try {
        const images = message.query?.trim()
          ? await searchImages(message.query)
          : await getPopularImages();
        broadcast({
          type: "dockerhub:results",
          query: message.query,
          images,
        });
      } catch (err) {
        broadcast({
          type: "error",
          message: "Docker Hub fetch failed: " + String(err),
        });
      }
      break;
    }
    case "keychain:set": {
      try {
        await keychainSet(message.appId, message.envKey, message.value);
        // Mark the key as keychain-backed in the app record
        const app = apps.find((a) => a.id === message.appId);
        if (app) {
          app.keychainEnvKeys = Array.from(
            new Set([...(app.keychainEnvKeys ?? []), message.envKey]),
          );
          await saveRegistry(apps);
        }
        broadcast({ type: "keychain:set:done", appId: message.appId, envKey: message.envKey });
      } catch (err) {
        broadcast({ type: "keychain:error", message: "Keychain write failed: " + String(err) });
      }
      break;
    }
    case "keychain:delete": {
      try {
        await keychainDelete(message.appId, message.envKey);
        const app = apps.find((a) => a.id === message.appId);
        if (app) {
          app.keychainEnvKeys = (app.keychainEnvKeys ?? []).filter(
            (k) => k !== message.envKey,
          );
          await saveRegistry(apps);
        }
      } catch {
        // Best-effort
      }
      break;
    }
    case "app:reorder": {
      // message.ids is the new ordered list of app IDs
      const idOrder = new Map(message.ids.map((id, i) => [id, i]));
      apps = apps
        .map((a) => ({ ...a, sortOrder: idOrder.get(a.id) ?? a.sortOrder ?? 999 }))
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      await saveRegistry(apps);
      broadcast({ type: "apps:list", apps });
      break;
    }
  }
}

function recordError(source: string, text: string, appId?: string) {
  if (!errorLoggingEnabled) return;
  appendErrorEntry({
    timestamp: Date.now(),
    level: "error",
    source,
    message: text,
    appId,
  }).catch(() => undefined);
}

function broadcastSettingsState() {
  sendToLauncher({
    type: "settings:state",
    autoRestartOnUnhealthy,
    errorLoggingEnabled,
    openAtLogin,
    autoCheckUpdates,
  });
}

function setupProcessErrorHandlers() {
  process.on("uncaughtException", (err) => {
    recordError("process:uncaughtException", String(err));
  });
  process.on("unhandledRejection", (reason) => {
    recordError("process:unhandledRejection", String(reason));
  });
}

async function restartAppForHealth(app: DockerApp) {
  if (healthRestartInProgress.has(app.id)) return;
  healthRestartInProgress.add(app.id);
  unhealthyStreaks.set(app.id, 0);
  try {
    broadcast({
      type: "app:health-restart",
      id: app.id,
      name: app.name,
    });
    recordError(
      "health:restart",
      `Restarting ${app.name} after repeated unhealthy health checks`,
      app.id,
    );
    sendNativeNotification(
      "The Loading Dock(r)",
      `${app.name} was unhealthy — restarting container`,
    );
    await stopApp(app, (id, status) => {
      const t = apps.find((a) => a.id === id);
      if (t) t.status = status;
      broadcast({ type: "app:status", id, status });
    });
    const fresh = apps.find((a) => a.id === app.id);
    if (!fresh) return;
    const resolvedEnv = keychainSecretsEnabled
      ? await resolveKeychainEnv(fresh.id, fresh.env, fresh.keychainEnvKeys)
      : undefined;
    await launchApp(
      fresh,
      (id, status, containerId) => {
        const t = apps.find((a) => a.id === id);
        if (t) {
          t.status = status;
          t.containerId = containerId;
        }
        broadcast({ type: "app:status", id, status, containerId });
      },
      (id, line) => broadcast({ type: "docker:log", id, line }),
      (id, status, detail) =>
        broadcast({ type: "app:pull-progress", id, status, detail }),
      resolvedEnv,
    );
  } catch (err) {
    recordError("health:restart", String(err), app.id);
    broadcast({
      type: "error",
      message: `Health restart failed for ${app.name}: ${String(err)}`,
    });
  } finally {
    healthRestartInProgress.delete(app.id);
  }
}

function broadcast(message: IpcMessage) {
  // Rebuild tray menu whenever app status or list changes
  if (
    message.type === "app:status" ||
    message.type === "apps:list"
  ) {
    updateTrayMenu();
  }
  if (message.type === "error") {
    recordError("ui:error", message.message);
  }
  if (message.type === "docker:log") {
    const logs = logHistory.get(message.id) ?? [];
    logs.push(message.line);
    if (logs.length > 1000) logs.shift();
    logHistory.set(message.id, logs);
  }
  if (message.type === "app:status" && notificationsEnabled) {
    const app = apps.find((a) => a.id === message.id);
    const name = app?.name ?? message.id;
    if (message.status === "error") {
      sendNativeNotification("The Loading Dock(r)", `${name} entered an error state.`);
      broadcast({ type: "error", message: `App ${name} entered error state.` });
    } else if (message.status === "stopped") {
      // Only notify unexpected stops (not user-initiated ones)
      // We detect user-initiated stops by checking if the app was in "stopping"
      if (app?.status !== "stopping") {
        sendNativeNotification("The Loading Dock(r)", `${name} stopped unexpectedly.`);
      }
    }
  }
  sendToLauncher(message);
  for (const win of appWindows.values()) safeSend(win.webview, message);
}
function sendToLauncher(message: IpcMessage) {
  if (!launcherWindow) return;
  safeSend(launcherWindow.webview, message);
}

function safeSend(webview: unknown, message: IpcMessage) {
  // Electrobun ≥1.18.1: BrowserView exposes rpc.send as a proxy where
  // rpc.send["channelName"](payload) wraps into the RPC envelope and sends.
  const rpc = (webview as any)?.rpc;
  if (rpc?.send) {
    try {
      rpc.send["ipc-message"](message);
      return;
    } catch {
      // fall through to legacy path
    }
  }
  // Legacy path (older Electrobun had webview.send directly)
  const sender = (
    webview as { send?: (name: string, payload: IpcMessage) => void }
  )?.send;
  if (typeof sender === "function") sender("ipc-message", message);
}

function startRuntimeTelemetry() {
  setInterval(async () => {
    const running = apps.filter((a) => a.status === "running");
    for (const app of running) {
      const health = await getContainerHealth(app);
      const target = apps.find((a) => a.id === app.id);
      if (target) target.health = health;
      broadcast({ type: "app:health", id: app.id, health });

      const prevStreak = unhealthyStreaks.get(app.id) ?? 0;
      const streak = nextUnhealthyStreak(health, prevStreak);
      unhealthyStreaks.set(app.id, streak);
      if (
        shouldRestartUnhealthy(
          app,
          health,
          streak,
          autoRestartOnUnhealthy,
        )
      ) {
        void restartAppForHealth(app);
      }

      const metrics = await getContainerMetrics(app);
      if (metrics) {
        const point = {
          id: app.id,
          cpuPercent: metrics.cpuPercent,
          memUsageMB: metrics.memUsageMB,
          timestamp: Date.now(),
        };
        const list = metricsHistory.get(app.id) ?? [];
        list.push(point);
        const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const trimmed = list.filter((p) => p.timestamp >= cutoff).slice(-5000);
        metricsHistory.set(app.id, trimmed);
        saveMetricsHistory(Object.fromEntries(metricsHistory)).catch(
          () => undefined,
        );
        broadcast({
          type: "app:metrics",
          point,
        });
      }
    }
  }, 5000);
}

let trayInstance: InstanceType<typeof Tray> | null = null;

function setupTray() {
  trayInstance = new Tray({
    image: TRAY_ICON_PATH,
    template: true,
    width: 16,
    height: 16,
  });
  trayInstance.on("tray-clicked", handleTrayAction);
  updateTrayMenu();
}

function updateTrayMenu() {
  if (!trayInstance) return;

  // Per-app submenu items
  const appItems: any[] = apps.length === 0
    ? [{ type: "normal", label: "No apps installed", enabled: false }]
    : apps.map((app) => {
        const isRunning = app.status === "running";
        const busy = app.status === "starting" || app.status === "stopping";
        const dot = isRunning ? "● " : app.status === "error" ? "✕ " : "○ ";
        const statusText = app.status === "stopped"
          ? "Offline"
          : app.status.charAt(0).toUpperCase() + app.status.slice(1);
        return {
          type: "normal",
          label: `${dot}${app.name}`,
          tooltip: statusText,
          submenu: [
            {
              type: "normal",
              label: "Open Window",
              action: "tray-app-window",
              data: { id: app.id },
            },
            { type: "separator" },
            {
              type: "normal",
              label: isRunning ? "Stop" : "Launch",
              action: isRunning ? "tray-app-stop" : "tray-app-launch",
              data: { id: app.id },
              enabled: !busy,
            },
            {
              type: "normal",
              label: "Restart",
              action: "tray-app-restart",
              data: { id: app.id },
              enabled: isRunning && !busy,
            },
          ],
        };
      });

  const hasRunning = apps.some((a) => a.status === "running");

  trayInstance.setMenu([
    { type: "normal", label: "Open The Loading Dock(r)", action: "open-launcher" },
    { type: "separator" },
    ...appItems,
    { type: "separator" },
    { type: "normal", label: "Stop All", action: "tray-stop-all", enabled: hasRunning },
    { type: "normal", label: "Restart All", action: "tray-restart-all", enabled: hasRunning },
    { type: "separator" },
    { type: "normal", label: "Settings", action: "open-launcher" },
    { type: "separator" },
    { type: "normal", label: "Quit", action: "quit-app" },
  ]);
}

function handleTrayAction(event: unknown) {
  const ev = event as { action?: string; data?: { id?: string } } | undefined;
  const action = ev?.action;
  const id = ev?.data?.id;

  if (action === "open-launcher") { openLauncher(); return; }
  if (action === "quit-app") { process.exit(0); }

  if (id) {
    if (action === "tray-app-window") {
      const app = apps.find((a) => a.id === id);
      if (app) openAppWindow(app);
    } else if (action === "tray-app-launch") {
      void handleIpc({ type: "app:launch", id });
    } else if (action === "tray-app-stop") {
      void handleIpc({ type: "app:stop", id });
    } else if (action === "tray-app-restart") {
      void handleIpc({ type: "app:restart", id });
    }
  }

  if (action === "tray-stop-all") {
    for (const app of apps.filter((a) => a.status === "running")) {
      void handleIpc({ type: "app:stop", id: app.id });
    }
  }
  if (action === "tray-restart-all") {
    for (const app of apps.filter((a) => a.status === "running")) {
      void handleIpc({ type: "app:restart", id: app.id });
    }
  }
}

function setupMenu() {
  ApplicationMenu.setApplicationMenu([
    {
      label: "The Loading Dock(r)",
      submenu: [
        { label: "About The Loading Dock(r)", role: "about" },
        { type: "separator" },
        { label: "Quit", role: "quit-app" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { label: "Launcher", action: "open-launcher" },
        { label: "Minimize", role: "minimize" },
      ],
    },
  ]);
  ApplicationMenu.on("application-menu-clicked", (event: unknown) => {
    const action = (event as { action?: string } | undefined)?.action;
    if (action === "open-launcher") openLauncher();
  });
}

main().catch(console.error);
