// src/renderer/launcher/filter.ts — pure functions extracted for testability
import type { DockerApp, DockerHubImage } from "../../shared/types";

export function filterApps(
  apps: DockerApp[],
  searchTerm: string,
  statusFilter: string,
  groupFilter: string,
): DockerApp[] {
  const term = searchTerm.trim().toLowerCase();
  return apps.filter((app) => {
    const termOk =
      !term ||
      app.name.toLowerCase().includes(term) ||
      app.image.toLowerCase().includes(term) ||
      app.description.toLowerCase().includes(term) ||
      (app.tags ?? []).some((t) => t.toLowerCase().includes(term));
    const statusOk = statusFilter === "all" || app.status === statusFilter;
    const groupOk =
      groupFilter === "all" ||
      (app.group?.trim() || "ungrouped") === groupFilter;
    return termOk && statusOk && groupOk;
  });
}

export function collectGroups(apps: DockerApp[]): string[] {
  return Array.from(
    new Set(
      apps.map((a) => (a.group && a.group.trim() ? a.group.trim() : "ungrouped")),
    ),
  ).sort();
}

const ICON_CDN =
  "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons@main/png";

/**
 * Derive a Dashboard Icons slug from a Docker image reference.
 * e.g. "lscr.io/linuxserver/plex:latest" → "plex"
 *      "ghcr.io/home-assistant/home-assistant:stable" → "home-assistant"
 */
function iconSlugFromImage(image: string): string {
  // Strip registry (anything with a dot before the first slash)
  let slug = image.replace(/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9._-]+(:\d+)?\//, "");
  // Strip tag / digest
  slug = slug.split(":")[0].split("@")[0];
  // Take the last path segment
  slug = slug.split("/").pop() ?? slug;
  return slug;
}

// Deterministic gradient per app name
const ICON_GRADIENTS: [string, string][] = [
  ["#3b82f6", "#1d4ed8"], // blue
  ["#10b981", "#059669"], // green
  ["#f59e0b", "#b45309"], // amber
  ["#ef4444", "#b91c1c"], // red
  ["#8b5cf6", "#6d28d9"], // purple
  ["#06b6d4", "#0e7490"], // cyan
  ["#f97316", "#c2410c"], // orange
  ["#ec4899", "#be185d"], // pink
];

function appIconStyle(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) & 0xffff;
  const [a, b] = ICON_GRADIENTS[h % ICON_GRADIENTS.length];
  return `background:linear-gradient(135deg,${a},${b})`;
}

function appInitials(name: string): string {
  const words = name.replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function buildCardHTML(app: DockerApp): string {
  const isRunning = app.status === "running";
  const busy = app.status === "starting" || app.status === "stopping";
  const dot = `<span class="status-dot status-dot--${app.status}"></span>`;
  const statusLabels: Record<string, string> = { stopped: "Offline" };
  const label = statusLabels[app.status] ?? (app.status.charAt(0).toUpperCase() + app.status.slice(1));
  const actionAttr = isRunning ? "stop" : "launch";
  const iconTitle = isRunning ? "Stop" : "Launch";
  const disabledAttr = busy ? " data-busy='true'" : "";

  // Icon: CDN image overlay on gradient+initials fallback; clicking launches/stops
  const iconSlug = iconSlugFromImage(app.image);
  const cdnImg = `<img class="app-card__og-img" src="${ICON_CDN}/${iconSlug}.png" alt="" onerror="this.style.display='none'" />`;

  return (
    `<div class="app-card__icon app-card__icon--clickable" style="${appIconStyle(app.name)}" data-app-image="${app.image.replace(/"/g, "&quot;")}" data-action="${actionAttr}" title="${iconTitle}"${disabledAttr}>${cdnImg}</div>` +
    `<div class="app-card__info">` +
    `<div class="app-card__name">${app.name}</div>` +
    `<div class="app-card__status-row">${dot}<span class="status-label status-label--${app.status}">${label}</span>${isRunning ? `<button class="app-card__settings-btn" data-action="restart" title="Restart"><i class="iconoir-refresh-circular"></i></button>` : ""}<button class="app-card__settings-btn" data-action="edit" title="Settings"><i class="iconoir-settings"></i></button></div>` +
    `</div>`
  );
}

export function buildHubCardHTML(
  image: DockerHubImage,
  display: string,
): string {
  return (
    `<div class="hub-card__meta">★ ${image.starCount.toLocaleString()} · ${image.pullCount.toLocaleString()} pulls</div>` +
    `<div class="hub-card__desc">${(image.description || "No description").slice(0, 160)}</div>` +
    `<div class="hub-actions"><button class="btn btn--ghost" data-action="details">Details</button><button class="btn btn--primary" data-action="install">Install</button></div>`
  );
}
