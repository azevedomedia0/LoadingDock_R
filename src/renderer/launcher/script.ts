import { Electroview } from "electrobun/view";
import type { DockerApp, DockerHubImage, IpcMessage } from "../../shared/types";
import {
  generateAppId,
  isValidPortMapping,
  normalizeName,
  parsePortMappings,
  validateOpenUrl,
} from "../../shared/validation";
import { presetForImage } from "../../shared/presets";
import {
  buildCardHTML,
  buildHubCardHTML,
  collectGroups,
  filterApps,
} from "./filter";

// Electrobun ≥1.18.1 changed Electroview to require a config arg; pass {} to
// avoid the "Cannot read properties of undefined (reading 'rpc')" crash.
// Polyfill ev.on / ev.send to match the Electrobun RPC envelope format:
//   { type: "message", id: <channel>, payload: <data> }
const ev = new Electroview({} as any);
(ev as any).on = function (
  name: string,
  handler: (msg: unknown) => void,
): void {
  // rpcHandler receives the full RPC envelope from bun; unwrap payload before
  // dispatching so the handler sees the raw IpcMessage, not the envelope.
  this.rpcHandler = (envelope: any) => {
    if (envelope?.type === "message" && envelope?.id === name) {
      handler(envelope.payload);
    }
  };
};
(ev as any).send = function (name: string, payload: unknown): void {
  // Wrap in the RPC message envelope that Electrobun's bun-side handler expects.
  this.bunBridge(JSON.stringify({ type: "message", id: name, payload }));
};

// ── OG image cache ──────────────────────────────────────────────
// docker image reference → og:image URL received from the main process
const ogImageCache = new Map<string, string>();

function overlayOgImage(icon: HTMLElement, url: string) {
  if (icon.querySelector(".app-card__og-img")) return; // already applied
  const img = document.createElement("img");
  img.className = "app-card__og-img";
  img.src = url;
  img.alt = "";
  img.addEventListener("error", () => img.remove());
  icon.appendChild(img);
}

function applyOgImagesFromCache() {
  document
    .querySelectorAll<HTMLElement>(".app-card__icon[data-app-image]")
    .forEach((icon) => {
      const ref = icon.dataset.appImage!;
      const url = ogImageCache.get(ref);
      if (url) overlayOgImage(icon, url);
    });
}

let apps: DockerApp[] = [];
let editTarget: DockerApp | null = null;
let firstRun = false;
let hubImages: DockerHubImage[] = [];
let searchTerm = "";
let statusFilter = "all";
let groupFilter = "all";
let searchDebounce: ReturnType<typeof setTimeout> | null = null;

let pendingUpdateInfo: {
  version: string;
  releaseNotes: string;
  downloadUrl?: string;
  channel: "stable" | "beta";
} | null = null;

// Hub search cache: query (or "" for popular) → results
const hubCache = new Map<string, DockerHubImage[]>();

// Tracks GET buttons currently installing: appId → button element
const installingRecApps = new Map<string, HTMLButtonElement>();

// ── Recommended Apps catalogue ──────────────────────────────────

interface RecommendedApp {
  category: string;
  name: string;
  image: string;
  icon: string;
  /** Dashboard Icons slug — https://github.com/walkxcode/dashboard-icons */
  iconSlug?: string;
  /** Custom icon image URL (overrides iconSlug when set) */
  iconUrl?: string;
  description: string;
  ports?: string[];
  openUrl?: string;
  restartPolicy?: "no" | "on-failure" | "unless-stopped";
  tags?: string[];
}

const ICON_CDN =
  "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons@main/png";

const RECOMMENDED_APPS: RecommendedApp[] = [
  // Self-hosted Essentials
  { category: "Self-hosted Essentials", name: "Nextcloud", image: "nextcloud:latest", icon: "☁️", iconSlug: "nextcloud", description: "File hosting, calendar, contacts, and full collaboration suite.", ports: ["8080:80"], openUrl: "http://localhost:8080", restartPolicy: "unless-stopped" },
  { category: "Self-hosted Essentials", name: "WordPress", image: "wordpress:latest", icon: "📝", iconSlug: "wordpress", description: "The world's most popular CMS for building websites and blogs.", ports: ["8082:80"], openUrl: "http://localhost:8082", restartPolicy: "unless-stopped" },
  { category: "Self-hosted Essentials", name: "Syncthing", image: "syncthing/syncthing:latest", icon: "🔄", iconSlug: "syncthing", description: "Continuous file synchronization across all your devices.", ports: ["8384:8384", "22000:22000"], openUrl: "http://localhost:8384", restartPolicy: "unless-stopped" },
  { category: "Self-hosted Essentials", name: "Coolify", image: "coollabsio/coolify:latest", icon: "🚀", iconSlug: "coolify", description: "Self-hosted PaaS — deploy apps, databases, and services with ease.", ports: ["8000:8000"], openUrl: "http://localhost:8000", restartPolicy: "unless-stopped" },
  { category: "Self-hosted Essentials", name: "Puter", image: "ghcr.io/heyputer/puter:latest", icon: "🖥️", iconSlug: "puter", description: "Self-hosted cloud desktop — files, apps, and AI in your browser.", ports: ["4100:4100"], openUrl: "http://localhost:4100", restartPolicy: "unless-stopped", tags: ["cloud", "desktop", "storage"] },
  { category: "Self-hosted Essentials", name: "Tailscale", image: "tailscale/tailscale:latest", icon: "🔐", iconSlug: "tailscale", description: "Mesh VPN for secure private networking across all your devices. Complete auth via container logs after launch.", ports: [], restartPolicy: "unless-stopped", tags: ["vpn", "mesh", "tailscale", "network"] },
  // Media Servers
  { category: "Media Servers", name: "Plex", image: "lscr.io/linuxserver/plex:latest", icon: "🎬", iconSlug: "plex", description: "Powerful media server for movies, TV, music, and photos.", ports: ["32400:32400"], openUrl: "http://localhost:32400/web", restartPolicy: "unless-stopped" },
  { category: "Media Servers", name: "Jellyfin", image: "jellyfin/jellyfin:latest", icon: "🎞️", iconSlug: "jellyfin", description: "Free open-source media system — no subscriptions, no tracking.", ports: ["8096:8096"], openUrl: "http://localhost:8096", restartPolicy: "unless-stopped" },
  { category: "Media Servers", name: "Navidrome", image: "deluan/navidrome:latest", icon: "🎵", iconSlug: "navidrome", description: "Modern self-hosted music server and streamer, compatible with Subsonic clients.", ports: ["4533:4533"], openUrl: "http://localhost:4533", restartPolicy: "unless-stopped", tags: ["music", "streaming", "audio"] },

  // Smart Home & Network
  { category: "Smart Home & Network", name: "Home Assistant", image: "ghcr.io/home-assistant/home-assistant:latest", icon: "🏠", iconSlug: "home-assistant", description: "Open source home automation platform for smart home control.", ports: ["8123:8123"], openUrl: "http://localhost:8123", restartPolicy: "unless-stopped" },
  { category: "Smart Home & Network", name: "Pi-hole", image: "pihole/pihole:latest", icon: "🛡️", iconSlug: "pi-hole", description: "Network-wide ad and tracker blocking via DNS sinkhole.", ports: ["8053:80", "53:53"], openUrl: "http://localhost:8053/admin", restartPolicy: "unless-stopped" },
  { category: "Smart Home & Network", name: "Nginx Proxy Manager", image: "jc21/nginx-proxy-manager:latest", icon: "🔀", iconSlug: "nginx-proxy-manager", description: "Reverse proxy with a web UI for hosts, SSL (Let's Encrypt), and access lists. Default login: admin@example.com / changeme.", ports: ["8181:81", "8880:80", "4443:443"], openUrl: "http://localhost:8181", restartPolicy: "unless-stopped", tags: ["proxy", "ssl", "network"] },
  { category: "Smart Home & Network", name: "Cloudflare DDNS", image: "favonia/cloudflare-ddns:latest", icon: "📝", iconSlug: "cloudflare", description: "Updates Cloudflare DNS when your public IP changes. Add CLOUDFLARE_API_TOKEN and DOMAINS (e.g. example.com) in env after install.", ports: [], restartPolicy: "unless-stopped", tags: ["cloudflare", "ddns", "dns", "network"] },
  { category: "Smart Home & Network", name: "Homebridge", image: "homebridge/homebridge:latest", icon: "🏡", iconSlug: "homebridge", description: "Bridge non-HomeKit smart home devices to Apple HomeKit via a lightweight Node.js server.", ports: ["8581:8581"], openUrl: "http://localhost:8581", restartPolicy: "unless-stopped", tags: ["homekit", "smart-home", "apple", "bridge"] },
  { category: "Smart Home & Network", name: "Guacamole", image: "guacamole/guacamole:latest", icon: "🖥️", iconSlug: "guacamole", description: "Clientless remote desktop gateway — access RDP, VNC, and SSH from your browser. Requires a guacd container.", ports: ["8888:8080"], openUrl: "http://localhost:8888/guacamole", restartPolicy: "unless-stopped", tags: ["remote-desktop", "rdp", "vnc", "ssh"] },

  // AI & Automation
  { category: "AI & Automation", name: "Ollama", image: "ollama/ollama:latest", icon: "🤖", iconSlug: "ollama", description: "Run large language models locally with a simple REST API.", ports: ["11434:11434"], restartPolicy: "unless-stopped" },
  { category: "AI & Automation", name: "n8n", image: "n8nio/n8n:latest", icon: "⚙️", iconSlug: "n8n", description: "Workflow automation with 400+ integrations and a visual node editor.", ports: ["5678:5678"], openUrl: "http://localhost:5678", restartPolicy: "unless-stopped" },
  { category: "AI & Automation", name: "OpenClaw", image: "openclaw/openclaw:latest", icon: "🦀", iconSlug: "openclaw", description: "Open-source orchestration and automation platform.", ports: ["9000:9000"], openUrl: "http://localhost:9000", restartPolicy: "unless-stopped" },
  { category: "AI & Automation", name: "Hermes Chat", image: "ghcr.io/hermeschat/hermes:latest", icon: "💬", iconUrl: "https://agentlocker.ai/static/uploads/ac3292ea-f056-4667-a3a8-f3c5e1467242_hermes.webp", description: "Self-hosted team chat and messaging platform.", ports: ["3000:3000"], openUrl: "http://localhost:3000", restartPolicy: "unless-stopped" },

  // Media Management
  { category: "Media Management", name: "Radarr", image: "lscr.io/linuxserver/radarr:latest", icon: "🎥", iconSlug: "radarr", description: "Movie collection manager with automated downloading and organisation.", ports: ["7878:7878"], openUrl: "http://localhost:7878", restartPolicy: "unless-stopped" },
  { category: "Media Management", name: "Sonarr", image: "lscr.io/linuxserver/sonarr:latest", icon: "📺", iconSlug: "sonarr", description: "TV series manager with automatic episode monitoring and downloading.", ports: ["8989:8989"], openUrl: "http://localhost:8989", restartPolicy: "unless-stopped" },
  { category: "Media Management", name: "Bazarr", image: "lscr.io/linuxserver/bazarr:latest", icon: "🗣️", iconSlug: "bazarr", description: "Subtitle manager that integrates with Radarr and Sonarr.", ports: ["6767:6767"], openUrl: "http://localhost:6767", restartPolicy: "unless-stopped" },
  { category: "Media Management", name: "Lidarr", image: "lscr.io/linuxserver/lidarr:latest", icon: "🎵", iconSlug: "lidarr", description: "Music collection manager with automated album downloading.", ports: ["8686:8686"], openUrl: "http://localhost:8686", restartPolicy: "unless-stopped" },
  { category: "Media Management", name: "qBittorrent", image: "lscr.io/linuxserver/qbittorrent:latest", icon: "⬇️", iconSlug: "qbittorrent", description: "Feature-rich torrent client with a web-based management UI.", ports: ["8090:8080", "6881:6881"], openUrl: "http://localhost:8090", restartPolicy: "unless-stopped" },

  // Photo Libraries
  { category: "Photo Libraries", name: "Immich", image: "ghcr.io/immich-app/immich-server:latest", icon: "📸", iconSlug: "immich", description: "Self-hosted photo and video backup with AI-powered search and faces.", ports: ["2283:3001"], openUrl: "http://localhost:2283", restartPolicy: "unless-stopped" },
  { category: "Photo Libraries", name: "PhotoPrism", image: "photoprism/photoprism:latest", icon: "🖼️", iconSlug: "photoprism", description: "AI-powered photo management with face recognition and geo-tagging.", ports: ["2342:2342"], openUrl: "http://localhost:2342", restartPolicy: "unless-stopped" },
];

function send(msg: IpcMessage) {
  ev.send("ipc-message", msg);
}

// ── Banners ────────────────────────────────────────────────────

function showBanner(id: string, message: string, timeout = 4500) {
  const banner = document.getElementById(id);
  if (!banner) return;
  banner.textContent = message;
  banner.classList.remove("hidden");
  if (timeout > 0)
    window.setTimeout(() => banner.classList.add("hidden"), timeout);
}
function showError(message: string) {
  showBanner("error-banner", message);
}
let dockerStartAttempted = false;
function toggleDockerWarning(show: boolean) {
  const banner = document.getElementById("docker-warning");
  const label = document.getElementById("docker-warning-text");
  if (!banner || !label) return;
  banner.classList.toggle("hidden", !show);
  if (show) {
    if (!dockerStartAttempted) {
      dockerStartAttempted = true;
      label.textContent = "Starting Docker — please wait…";
    }
    // If we receive a second false→true cycle it means the timeout was hit
    // and the main process never sent available:true. Keep the warning visible.
  } else {
    // Docker became available — reset for next session
    dockerStartAttempted = false;
  }
}

// ── Update banner ───────────────────────────────────────────────

function showUpdateBanner(version: string, notes: string) {
  const banner = document.getElementById("update-banner")!;
  const title = document.getElementById("update-banner-title")!;
  const notesEl = document.getElementById("update-banner-notes")!;
  title.textContent = `Update available: v${version}`;
  notesEl.textContent = notes.split("\n")[0]?.slice(0, 120) ?? "";
  banner.classList.remove("hidden");
  (banner.querySelector(".update-banner__progress") as HTMLElement).classList.add("hidden");
}

function showUpdateProgress(percent: number) {
  const prog = document.querySelector(".update-banner__progress") as HTMLElement;
  const fill = document.getElementById("update-progress-fill") as HTMLElement;
  const label = document.getElementById("update-progress-label")!;
  prog.classList.remove("hidden");
  fill.style.width = `${percent}%`;
  label.textContent = `${percent}%`;
  // Disable Install button while downloading
  (document.getElementById("btn-update-install") as HTMLButtonElement).disabled = true;
}

document.getElementById("btn-update-install")!.addEventListener("click", () => {
  if (!pendingUpdateInfo?.downloadUrl) return;
  send({
    type: "update:download",
    downloadUrl: pendingUpdateInfo.downloadUrl,
    version: pendingUpdateInfo.version,
    channel: pendingUpdateInfo.channel,
  });
});
document.getElementById("btn-update-later")!.addEventListener("click", () => {
  document.getElementById("update-banner")!.classList.add("hidden");
});

// ── Grid rendering ──────────────────────────────────────────────

function filteredApps(): DockerApp[] {
  return filterApps(apps, searchTerm, statusFilter, groupFilter);
}

function refreshGroupFilterOptions() {
  const select = document.getElementById("group-filter") as HTMLSelectElement;
  const current = select.value;
  const groups = collectGroups(apps);
  while (select.options.length > 1) select.remove(1);
  for (const g of groups) {
    const opt = document.createElement("option");
    opt.value = g;
    opt.textContent = g;
    select.appendChild(opt);
  }
  if (groups.includes(current) || current === "all") {
    select.value = current;
  } else {
    select.value = "all";
    groupFilter = "all";
  }
}

function wireCardButtons(card: HTMLElement, app: DockerApp) {
  // Icon click: launch or stop (depends on current data-action)
  const iconEl = card.querySelector<HTMLElement>(".app-card__icon--clickable");
  if (iconEl) {
    iconEl.addEventListener("click", (e) => {
      e.stopPropagation();
      if (iconEl.dataset.busy) return;
      if (iconEl.dataset.action === "stop") {
        send({ type: "app:stop", id: app.id });
      } else {
        send({ type: "app:launch", id: app.id });
      }
    });
  }
  card.querySelector("[data-action='restart']")?.addEventListener("click", (e) => {
    e.stopPropagation();
    send({ type: "app:restart", id: app.id });
  });
  card.querySelector("[data-action='edit']")?.addEventListener("click", (e) => {
    e.stopPropagation();
    openEditModal(app);
  });
}

// ── Drag-and-drop reorder ───────────────────────────────────────

let dragSrcId: string | null = null;

function wireDragDrop(card: HTMLElement, app: DockerApp) {
  card.setAttribute("draggable", "true");
  card.addEventListener("dragstart", (e) => {
    dragSrcId = app.id;
    e.dataTransfer!.effectAllowed = "move";
    e.dataTransfer!.setData("text/plain", app.id);
  });
  card.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = "move";
    card.classList.add("app-card--drag-over");
  });
  card.addEventListener("dragleave", () => {
    card.classList.remove("app-card--drag-over");
  });
  card.addEventListener("drop", (e) => {
    e.preventDefault();
    card.classList.remove("app-card--drag-over");
    if (!dragSrcId || dragSrcId === app.id) return;
    // Reorder in local array then persist
    const srcIdx = apps.findIndex((a) => a.id === dragSrcId);
    const dstIdx = apps.findIndex((a) => a.id === app.id);
    if (srcIdx < 0 || dstIdx < 0) return;
    const reordered = [...apps];
    const [moved] = reordered.splice(srcIdx, 1);
    reordered.splice(dstIdx, 0, moved);
    apps = reordered;
    send({ type: "app:reorder", ids: apps.map((a) => a.id) });
    renderGrid();
    dragSrcId = null;
  });
  card.addEventListener("dragend", () => {
    card.classList.remove("app-card--drag-over");
  });
}

function makeCard(app: DockerApp): HTMLElement {
  const card = document.createElement("div");
  card.className = "app-card";
  card.dataset.id = app.id;
  card.innerHTML = buildCardHTML(app);
  // Apply cached og image immediately if available
  const cachedOg = ogImageCache.get(app.image);
  if (cachedOg) {
    const icon = card.querySelector<HTMLElement>(".app-card__icon");
    if (icon) overlayOgImage(icon, cachedOg);
  }
  card.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t.closest(".app-card__cta")) return;
    if (t.closest(".app-card__icon--clickable")) return;
    send({ type: "app:open-window", app });
  });
  wireCardButtons(card, app);
  wireDragDrop(card, app);
  return card;
}

let vsFiltered: DockerApp[] = [];

function renderGrid() {
  const grid = document.getElementById("grid")!;
  vsFiltered = filteredApps();

  if (vsFiltered.length <= 80) {
    while (grid.firstChild) grid.removeChild(grid.firstChild);
    for (const app of vsFiltered) grid.appendChild(makeCard(app));
  } else {
    renderVirtualGrid(grid);
  }

}

function renderVirtualGrid(grid: HTMLElement) {
  const BATCH = 40;
  while (grid.firstChild) grid.removeChild(grid.firstChild);
  let rendered = 0;

  function renderBatch(from: number) {
    const end = Math.min(from + BATCH, vsFiltered.length);
    for (let i = from; i < end; i++) grid.appendChild(makeCard(vsFiltered[i]));
    rendered = end;
    if (rendered < vsFiltered.length) {
      const sentinel = document.createElement("div");
      sentinel.className = "virtual-sentinel";
      grid.appendChild(sentinel);
      const obs = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            obs.disconnect();
            sentinel.remove();
            renderBatch(rendered);
          }
        },
        { rootMargin: "200px" },
      );
      obs.observe(sentinel);
    }
  }
  renderBatch(0);
}

function updateCard(app: DockerApp) {
  const card = document.querySelector(
    `.app-card[data-id="${app.id}"]`,
  ) as HTMLElement | null;
  if (!card) { renderGrid(); return; }
  card.innerHTML = buildCardHTML(app);
  // Re-apply cached og image (innerHTML wipe removes the overlay)
  const cachedOg = ogImageCache.get(app.image);
  if (cachedOg) {
    const icon = card.querySelector<HTMLElement>(".app-card__icon");
    if (icon) overlayOgImage(icon, cachedOg);
  }
  wireCardButtons(card, app);
  wireDragDrop(card, app);
}

// ── Env-var table editor ────────────────────────────────────────

interface _EnvRow { key: string; value: string; keychain: boolean }

function buildEnvTable(
  containerId: string,
  initial: Record<string, string> = {},
  keychainKeys: string[] = [],
): void {
  const container = document.getElementById(containerId)!;
  while (container.firstChild) container.removeChild(container.firstChild);
  for (const [k, v] of Object.entries(initial)) {
    addEnvRow(container, k, v, keychainKeys.includes(k));
  }
}

function addEnvRow(
  container: HTMLElement,
  k = "",
  v = "",
  inKeychain = false,
): void {
  const row = document.createElement("div");
  row.className = "kv-row";

  const keyInput = document.createElement("input");
  keyInput.type = "text";
  keyInput.placeholder = "KEY";
  keyInput.value = k;
  keyInput.className = "kv-key";

  const valInput = document.createElement("input");
  valInput.type = "text";
  valInput.placeholder = "value";
  valInput.value = v;
  valInput.className = "kv-val";

  const kcLabel = document.createElement("label");
  kcLabel.className = "kv-keychain";
  const kcCheck = document.createElement("input");
  kcCheck.type = "checkbox";
  kcCheck.checked = inKeychain;
  kcCheck.title = "Store in system keychain";
  kcLabel.appendChild(kcCheck);
  kcLabel.append(" 🔑");

  const removeBtn = document.createElement("button");
  removeBtn.className = "kv-remove";
  removeBtn.textContent = "✕";
  removeBtn.type = "button";
  removeBtn.addEventListener("click", () => container.removeChild(row));

  row.appendChild(keyInput);
  row.appendChild(valInput);
  row.appendChild(kcLabel);
  row.appendChild(removeBtn);
  container.appendChild(row);
}

function readEnvTable(containerId: string): { env: Record<string, string>; keychainKeys: string[] } {
  const container = document.getElementById(containerId)!;
  const env: Record<string, string> = {};
  const keychainKeys: string[] = [];
  for (const row of container.querySelectorAll(".kv-row")) {
    const k = (row.querySelector(".kv-key") as HTMLInputElement).value.trim();
    const v = (row.querySelector(".kv-val") as HTMLInputElement).value;
    const kc = (row.querySelector("input[type=checkbox]") as HTMLInputElement).checked;
    if (k) {
      env[k] = v;
      if (kc) keychainKeys.push(k);
    }
  }
  return { env, keychainKeys };
}

// ── Volume table editor ─────────────────────────────────────────

function buildVolTable(containerId: string, initial: string[] = []): void {
  const container = document.getElementById(containerId)!;
  while (container.firstChild) container.removeChild(container.firstChild);
  for (const v of initial) addVolRow(container, v);
}

function addVolRow(container: HTMLElement, value = ""): void {
  const row = document.createElement("div");
  row.className = "vol-row";

  const [host = "", rest = ""] = value.split(":");
  const containerPath = rest.split(":").slice(0, 1).join("") || "";

  const hostInput = document.createElement("input");
  hostInput.type = "text";
  hostInput.placeholder = "~/host/path";
  hostInput.value = host;
  hostInput.className = "vol-host";

  const sep = document.createElement("span");
  sep.textContent = ":";
  sep.style.color = "var(--muted)";

  const containerInput = document.createElement("input");
  containerInput.type = "text";
  containerInput.placeholder = "/container/path";
  containerInput.value = containerPath;
  containerInput.className = "vol-container";

  const removeBtn = document.createElement("button");
  removeBtn.className = "vol-remove";
  removeBtn.textContent = "✕";
  removeBtn.type = "button";
  removeBtn.addEventListener("click", () => container.removeChild(row));

  row.appendChild(hostInput);
  row.appendChild(sep);
  row.appendChild(containerInput);
  row.appendChild(removeBtn);
  container.appendChild(row);
}

function readVolTable(containerId: string): string[] {
  const container = document.getElementById(containerId)!;
  const vols: string[] = [];
  for (const row of container.querySelectorAll(".vol-row")) {
    const h = (row.querySelector(".vol-host") as HTMLInputElement).value.trim();
    const c = (row.querySelector(".vol-container") as HTMLInputElement).value.trim();
    if (h && c) vols.push(`${h}:${c}`);
  }
  return vols;
}

// ── Modal wiring ────────────────────────────────────────────────

function openEditModal(app: DockerApp) {
  editTarget = app;
  (document.getElementById("edit-name") as HTMLInputElement).value = app.name;
  (document.getElementById("edit-image") as HTMLInputElement).value = app.image;
  (document.getElementById("edit-ports") as HTMLInputElement).value = app.ports.join(", ");
  (document.getElementById("edit-url") as HTMLInputElement).value = app.openUrl ?? "";
  (document.getElementById("edit-group") as HTMLInputElement).value = app.group ?? "";
  (document.getElementById("edit-tags") as HTMLInputElement).value = (app.tags ?? []).join(", ");
  (document.getElementById("edit-restart") as HTMLSelectElement).value = app.restartPolicy ?? "no";
  (document.getElementById("edit-health-cmd") as HTMLInputElement).value = app.healthcheck?.cmd ?? "";
  (document.getElementById("edit-health-interval") as HTMLInputElement).value =
    app.healthcheck?.intervalSec?.toString() ?? "";
  (document.getElementById("edit-health-timeout") as HTMLInputElement).value =
    app.healthcheck?.timeoutSec?.toString() ?? "";
  (document.getElementById("edit-health-retries") as HTMLInputElement).value =
    app.healthcheck?.retries?.toString() ?? "";
  buildEnvTable("edit-env-table", app.env, app.keychainEnvKeys);
  buildVolTable("edit-vol-table", app.volumes);
  document.getElementById("modal-edit")!.classList.remove("hidden");
}

function parseHealth(prefix: "add" | "edit") {
  const cmd = (document.getElementById(`${prefix}-health-cmd`) as HTMLInputElement).value.trim();
  const intervalSec = Number((document.getElementById(`${prefix}-health-interval`) as HTMLInputElement).value || "0") || undefined;
  const timeoutSec = Number((document.getElementById(`${prefix}-health-timeout`) as HTMLInputElement).value || "0") || undefined;
  const retries = Number((document.getElementById(`${prefix}-health-retries`) as HTMLInputElement).value || "0") || undefined;
  if (!cmd && !intervalSec && !timeoutSec && !retries) return undefined;
  return { cmd: cmd || undefined, intervalSec, timeoutSec, retries };
}

function parseAndValidateForm(
  name: string,
  image: string,
  portsRaw: string,
  openUrlRaw: string,
  sourceId?: string,
) {
  if (!name || !image) throw new Error("Name and Docker image are required.");
  const normalizedName = normalizeName(name);
  if (apps.some((a) => normalizeName(a.name) === normalizedName && a.id !== sourceId)) {
    throw new Error("An app with this name already exists.");
  }
  const ports = parsePortMappings(portsRaw);
  if (ports.some((p) => !isValidPortMapping(p))) {
    throw new Error("Ports must use host:container (1-65535), e.g. 8080:80 or 53:53/udp.");
  }
  const openUrl = validateOpenUrl(openUrlRaw);
  return { ports, openUrl };
}

// ── IPC message handlers ────────────────────────────────────────

ev.on("ipc-message", (msg: IpcMessage) => {
  switch (msg.type) {
    case "apps:list":
      apps = msg.apps;
      // Mark any installing rec-app buttons as done if now in the list
      for (const [id, btn] of installingRecApps) {
        if (apps.some((a) => a.id === id)) {
          btn.classList.remove("btn-pill--installing");
          btn.classList.add("btn-pill--added");
          btn.textContent = "✓ Added";
          installingRecApps.delete(id);
        }
      }
      refreshGroupFilterOptions();
      renderGrid();
      break;
    case "update:state":
      (document.getElementById("release-channel") as HTMLSelectElement).value =
        msg.channel;
      break;
    case "docker:availability":
      toggleDockerWarning(!msg.available);
      break;
    case "onboarding:state":
      firstRun = msg.firstRun;
      renderGrid();
      break;
    case "app:status": {
      const app = apps.find((a) => a.id === msg.id);
      if (app) {
        app.status = msg.status;
        app.containerId = msg.containerId;
        updateCard(app);
      }
      break;
    }
    case "app:pull-progress": {
      // Update the installing rec-app button with live pull status
      const installingBtn = installingRecApps.get(msg.id);
      if (installingBtn) {
        const label = (msg.detail ?? msg.status).slice(0, 18);
        installingBtn.textContent = "";
        const sp = document.createElement("span");
        sp.className = "rec-spin";
        installingBtn.appendChild(sp);
        installingBtn.appendChild(document.createTextNode(label));
      }
      showBanner("welcome-banner", `Pulling ${msg.id}: ${msg.detail ?? msg.status}`, 3000);
      break;
    }
    case "error":
      showError(msg.message);
      break;
    case "dockerhub:og-images":
      for (const [image, url] of Object.entries(msg.results)) {
        ogImageCache.set(image, url);
      }
      applyOgImagesFromCache();
      break;
    case "dockerhub:results":
      hubImages = msg.images;
      hubCache.set(msg.query ?? "", msg.images);
      renderHubResults(msg.query);
      break;
    case "registry:exported": {
      const blob = new Blob([msg.json], { type: "application/json" });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = "loading-dock-apps.json";
      a.click();
      URL.revokeObjectURL(href);
      break;
    }
    case "update:available":
      pendingUpdateInfo = {
        version: msg.version,
        releaseNotes: msg.releaseNotes,
        channel: msg.channel,
      };
      showUpdateBanner(msg.version, msg.releaseNotes);
      break;
    case "update:not-available":
      showBanner("welcome-banner", "You are on the latest version.", 3000);
      break;
    case "update:download:progress":
      showUpdateProgress(msg.percent);
      break;
    case "update:download:done":
      showBanner("welcome-banner", "Update ready. Restarting to apply…", 0);
      send({ type: "update:apply", localPath: msg.localPath });
      break;
    case "keychain:set:done":
      showBanner("welcome-banner", `🔑 ${msg.envKey} stored in system keychain.`, 3000);
      break;
    case "keychain:error":
      showError(msg.message);
      break;
    case "settings:state": {
      (document.getElementById("toggle-open-at-login") as HTMLInputElement).checked =
        msg.openAtLogin;
      (document.getElementById("toggle-auto-restart") as HTMLInputElement).checked =
        msg.autoRestartOnUnhealthy;
      (document.getElementById("toggle-auto-check-updates") as HTMLInputElement).checked =
        msg.autoCheckUpdates;
      break;
    }
    case "errors:exported": {
      const blob = new Blob([msg.json], { type: "application/json" });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = "loading-dock-errors.json";
      a.click();
      URL.revokeObjectURL(href);
      break;
    }
    case "app:health-restart":
      showBanner(
        "welcome-banner",
        `↻ Restarting ${msg.name} (unhealthy health check)…`,
        5000,
      );
      break;
    case "notification:show":
      showBanner("welcome-banner", msg.body, 3000);
      break;
  }
});

// ── Hub rendering ───────────────────────────────────────────────

function renderHubResults(query?: string) {
  const statusEl = document.getElementById("hub-status")!;
  const grid = document.getElementById("hub-grid")!;
  statusEl.textContent = query?.trim()
    ? `Results for "${query}" (${hubImages.length})`
    : `Popular images (${hubImages.length})`;
  while (grid.firstChild) grid.removeChild(grid.firstChild);
  for (const image of hubImages) grid.appendChild(buildHubCard(image, true));
}

function fillAddFromRec(app: RecommendedApp) {
  (document.getElementById("add-name") as HTMLInputElement).value = app.name;
  (document.getElementById("add-image") as HTMLInputElement).value = app.image;
  (document.getElementById("add-ports") as HTMLInputElement).value = (app.ports ?? []).join(", ");
  (document.getElementById("add-url") as HTMLInputElement).value = app.openUrl ?? "";
  (document.getElementById("add-restart") as HTMLSelectElement).value = app.restartPolicy ?? "no";
  (document.getElementById("add-health-cmd") as HTMLInputElement).value = "";
  (document.getElementById("add-health-interval") as HTMLInputElement).value = "";
  (document.getElementById("add-health-timeout") as HTMLInputElement).value = "";
  (document.getElementById("add-health-retries") as HTMLInputElement).value = "";
  (document.getElementById("add-group") as HTMLInputElement).value = app.category;
  (document.getElementById("add-tags") as HTMLInputElement).value = (app.tags ?? []).join(", ");
  buildEnvTable("add-env-table", {});
  buildVolTable("add-vol-table", []);
}

function buildRecCard(app: RecommendedApp): HTMLElement {
  const card = document.createElement("div");
  card.className = "rec-card";

  // Icon square — use Dashboard Icons CDN if slug is available, else emoji
  const icon = document.createElement("div");
  icon.className = "rec-card__icon";

  const iconSrc = app.iconUrl
    ? app.iconUrl
    : app.iconSlug
      ? `${ICON_CDN}/${app.iconSlug}.png`
      : null;
  if (iconSrc) {
    const img = document.createElement("img");
    img.className = "rec-card__logo";
    img.src = iconSrc;
    img.alt = app.name;
    img.addEventListener("error", () => {
      img.remove();
      icon.textContent = app.icon;
    });
    icon.appendChild(img);
  } else {
    icon.textContent = app.icon;
  }

  // Info column
  const info = document.createElement("div");
  info.className = "app-card__info";

  const name = document.createElement("div");
  name.className = "app-card__name";
  name.textContent = app.name;

  const desc = document.createElement("div");
  desc.className = "app-card__sub app-card__sub--desc";
  desc.textContent = app.description;

  info.appendChild(name);
  info.appendChild(desc);

  // CTA column
  const cta = document.createElement("div");
  cta.className = "app-card__cta";

  const btn = document.createElement("button");
  btn.className = "btn-pill";

  const alreadyInstalled = apps.some((a) => a.image === app.image);
  if (alreadyInstalled) {
    btn.classList.add("btn-pill--added");
    btn.textContent = "✓ Added";
    btn.disabled = true;
  } else {
    btn.textContent = "GET";
    btn.addEventListener("click", () => {
      const appId = generateAppId(app.name);

      // Immediately enter installing state
      btn.disabled = true;
      btn.classList.add("btn-pill--installing");
      const spinner = document.createElement("span");
      spinner.className = "rec-spin";
      btn.textContent = "";
      btn.appendChild(spinner);
      btn.appendChild(document.createTextNode("Installing…"));

      installingRecApps.set(appId, btn);

      send({
        type: "app:add",
        app: {
          id: appId,
          name: app.name,
          image: app.image,
          icon: "default.png",
          description: app.description,
          ports: app.ports ?? [],
          env: {},
          volumes: [],
          openUrl: app.openUrl,
          group: app.category,
          tags: app.tags ?? [],
          restartPolicy: app.restartPolicy ?? "no",
        },
      });
    });
  }

  cta.appendChild(btn);

  card.appendChild(icon);
  card.appendChild(info);
  card.appendChild(cta);
  return card;
}

function renderRecommendedApps() {
  const grid = document.getElementById("store-grid")!;
  while (grid.firstChild) grid.removeChild(grid.firstChild);
  let currentCategory = "";
  for (const app of RECOMMENDED_APPS) {
    if (app.category !== currentCategory) {
      currentCategory = app.category;
      const header = document.createElement("div");
      header.className = "rec-category-header";
      header.textContent = app.category;
      grid.appendChild(header);
    }
    grid.appendChild(buildRecCard(app));
  }
}

function renderHubMeta(image: DockerHubImage, display: string) {
  const meta = document.getElementById("hub-meta")!;
  const preset = presetForImage(display);
  meta.classList.remove("hidden");
  meta.innerHTML =
    `<h3>${display}</h3>` +
    `<p>${image.description || "No description"}</p>` +
    `<p><strong>Stars:</strong> ${image.starCount.toLocaleString()} | <strong>Pulls:</strong> ${image.pullCount.toLocaleString()}</p>` +
    `<p><a href="https://hub.docker.com/r/${image.fullName}" target="_blank">View docs on Docker Hub</a></p>` +
    (preset
      ? `<p><strong>Preset:</strong> Ports ${preset.ports.join(", ") || "none"}, Restart ${preset.restartPolicy || "no"}</p>`
      : `<p><strong>Preset:</strong> none</p>`);
}

function fillAddFromImage(image: DockerHubImage, display: string) {
  const preset = presetForImage(display);
  (document.getElementById("add-name") as HTMLInputElement).value = preset?.suggestedName ?? image.name;
  (document.getElementById("add-image") as HTMLInputElement).value = display;
  (document.getElementById("add-ports") as HTMLInputElement).value = preset?.ports.join(", ") ?? "";
  (document.getElementById("add-url") as HTMLInputElement).value = preset?.openUrl ?? "";
  (document.getElementById("add-restart") as HTMLSelectElement).value = preset?.restartPolicy ?? "no";
  (document.getElementById("add-health-cmd") as HTMLInputElement).value = preset?.healthcheck?.cmd ?? "";
  (document.getElementById("add-health-interval") as HTMLInputElement).value =
    preset?.healthcheck?.intervalSec?.toString() ?? "";
  (document.getElementById("add-health-timeout") as HTMLInputElement).value =
    preset?.healthcheck?.timeoutSec?.toString() ?? "";
  (document.getElementById("add-health-retries") as HTMLInputElement).value =
    preset?.healthcheck?.retries?.toString() ?? "";
  (document.getElementById("add-group") as HTMLInputElement).value =
    preset?.suggestedName?.toLowerCase().includes("db") ? "databases" : "";
  (document.getElementById("add-tags") as HTMLInputElement).value = "";
  buildEnvTable("add-env-table", {});
  buildVolTable("add-vol-table", []);
}

function buildHubCard(image: DockerHubImage, closeModal: boolean): HTMLElement {
  const card = document.createElement("div");
  card.className = "hub-card";
  const display = image.isOfficial ? image.name : image.fullName;
  card.innerHTML = buildHubCardHTML(image, display);
  card.querySelector("[data-action='details']")?.addEventListener("click", () =>
    renderHubMeta(image, display),
  );
  card.querySelector("[data-action='install']")?.addEventListener("click", () => {
    fillAddFromImage(image, display);
    if (closeModal) document.getElementById("modal-hub")!.classList.add("hidden");
    document.getElementById("modal-add")!.classList.remove("hidden");
  });
  return card;
}

// ── Add modal ───────────────────────────────────────────────────

let addModalTab: "app" | "compose" = "app";

function switchAddTab(tab: "app" | "compose") {
  addModalTab = tab;
  document.querySelectorAll<HTMLElement>(".modal-tab").forEach((btn) => {
    btn.classList.toggle("modal-tab--active", btn.dataset.tab === tab);
  });
  document.getElementById("add-tab-app")!.classList.toggle("hidden", tab !== "app");
  document.getElementById("add-tab-compose")!.classList.toggle("hidden", tab !== "compose");
  (document.getElementById("btn-add-confirm") as HTMLButtonElement).textContent =
    tab === "compose" ? "Import" : "Add";
}

document.querySelectorAll<HTMLElement>(".modal-tab").forEach((btn) => {
  btn.addEventListener("click", () => switchAddTab(btn.dataset.tab as "app" | "compose"));
});

document.getElementById("btn-add")!.addEventListener("click", () => {
  switchAddTab("app");
  buildEnvTable("add-env-table", {});
  buildVolTable("add-vol-table", []);
  document.getElementById("modal-add")!.classList.remove("hidden");
});
document.getElementById("btn-add-cancel")!.addEventListener("click", () => {
  document.getElementById("modal-add")!.classList.add("hidden");
});
document.getElementById("add-env-add-row")!.addEventListener("click", () => {
  addEnvRow(document.getElementById("add-env-table")!);
});
document.getElementById("add-vol-add-row")!.addEventListener("click", () => {
  addVolRow(document.getElementById("add-vol-table")!);
});
document.getElementById("btn-add-confirm")!.addEventListener("click", () => {
  if (addModalTab === "compose") {
    const projectName = (document.getElementById("add-compose-project") as HTMLInputElement).value.trim();
    const yaml = (document.getElementById("add-compose-yaml") as HTMLTextAreaElement).value.trim();
    if (!yaml) { showError("Compose YAML is required."); return; }
    send({ type: "compose:import", yaml, projectName: projectName || undefined });
    document.getElementById("modal-add")!.classList.add("hidden");
    return;
  }
  try {
    const name = (document.getElementById("add-name") as HTMLInputElement).value.trim();
    const image = (document.getElementById("add-image") as HTMLInputElement).value.trim();
    const portsRaw = (document.getElementById("add-ports") as HTMLInputElement).value.trim();
    const openUrlRaw = (document.getElementById("add-url") as HTMLInputElement).value.trim();
    const restartPolicy = (document.getElementById("add-restart") as HTMLSelectElement)
      .value as DockerApp["restartPolicy"];
    const group = (document.getElementById("add-group") as HTMLInputElement).value.trim();
    const tags = (document.getElementById("add-tags") as HTMLInputElement).value
      .split(",").map((s) => s.trim()).filter(Boolean);
    const healthcheck = parseHealth("add");
    const { env, keychainKeys } = readEnvTable("add-env-table");
    const volumes = readVolTable("add-vol-table");
    const { ports, openUrl } = parseAndValidateForm(name, image, portsRaw, openUrlRaw);
    const appId = generateAppId(name);
    send({
      type: "app:add",
      app: {
        id: appId,
        name,
        image,
        icon: "default.png",
        description: image,
        ports,
        env,
        volumes,
        openUrl,
        group: group || undefined,
        tags,
        restartPolicy,
        healthcheck,
        keychainEnvKeys: keychainKeys.length ? keychainKeys : undefined,
      },
    });
    for (const k of keychainKeys) {
      if (env[k]) send({ type: "keychain:set", appId, envKey: k, value: env[k] });
    }
    document.getElementById("modal-add")!.classList.add("hidden");
  } catch (err) {
    showError(String(err));
  }
});

// ── Edit modal ──────────────────────────────────────────────────

document.getElementById("btn-edit-cancel")!.addEventListener("click", () => {
  document.getElementById("modal-edit")!.classList.add("hidden");
  editTarget = null;
});
document.getElementById("btn-edit-delete")!.addEventListener("click", () => {
  if (!editTarget) return;
  if (!window.confirm(`Remove app '${editTarget.name}'?`)) return;
  send({ type: "app:remove", id: editTarget.id });
  document.getElementById("modal-edit")!.classList.add("hidden");
  editTarget = null;
});
document.getElementById("edit-env-add-row")!.addEventListener("click", () => {
  addEnvRow(document.getElementById("edit-env-table")!);
});
document.getElementById("edit-vol-add-row")!.addEventListener("click", () => {
  addVolRow(document.getElementById("edit-vol-table")!);
});
document.getElementById("btn-edit-confirm")!.addEventListener("click", () => {
  if (!editTarget) return;
  try {
    const name = (document.getElementById("edit-name") as HTMLInputElement).value.trim();
    const image = (document.getElementById("edit-image") as HTMLInputElement).value.trim();
    const portsRaw = (document.getElementById("edit-ports") as HTMLInputElement).value.trim();
    const openUrlRaw = (document.getElementById("edit-url") as HTMLInputElement).value.trim();
    const restartPolicy = (document.getElementById("edit-restart") as HTMLSelectElement)
      .value as DockerApp["restartPolicy"];
    const group = (document.getElementById("edit-group") as HTMLInputElement).value.trim();
    const tags = (document.getElementById("edit-tags") as HTMLInputElement).value
      .split(",").map((s) => s.trim()).filter(Boolean);
    const healthcheck = parseHealth("edit");
    const { env, keychainKeys } = readEnvTable("edit-env-table");
    const volumes = readVolTable("edit-vol-table");
    const { ports, openUrl } = parseAndValidateForm(name, image, portsRaw, openUrlRaw, editTarget.id);
    const appId = editTarget.id;
    send({
      type: "app:update",
      app: {
        ...editTarget,
        name,
        image,
        description: image,
        ports,
        env,
        volumes,
        openUrl,
        group: group || undefined,
        tags,
        restartPolicy,
        healthcheck,
        keychainEnvKeys: keychainKeys.length ? keychainKeys : undefined,
      },
    });
    // Sync keychain: set newly-checked keys, delete unchecked ones
    const previousKeychainKeys = editTarget.keychainEnvKeys ?? [];
    for (const k of keychainKeys) {
      if (env[k]) send({ type: "keychain:set", appId, envKey: k, value: env[k] });
    }
    for (const k of previousKeychainKeys) {
      if (!keychainKeys.includes(k)) {
        send({ type: "keychain:delete", appId, envKey: k });
      }
    }
    document.getElementById("modal-edit")!.classList.add("hidden");
    editTarget = null;
  } catch (err) {
    showError(String(err));
  }
});

// ── Filters & toolbar ───────────────────────────────────────────

document.getElementById("btn-check-update")?.addEventListener("click", () => {
  send({ type: "update:check" });
  showBanner("welcome-banner", "Checking for updates…", 3000);
});

// ── Import / export ─────────────────────────────────────────────

document.getElementById("btn-export-registry")!.addEventListener("click", () => {
  send({ type: "registry:export" });
});
document.getElementById("btn-import-registry")!.addEventListener("click", () => {
  (document.getElementById("registry-import-file") as HTMLInputElement).click();
});
document.getElementById("registry-import-file")!.addEventListener("change", async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const json = await file.text();
  send({ type: "registry:import", json });
});

document.getElementById("toggle-open-at-login")!.addEventListener("change", (e) => {
  send({
    type: "settings:open-at-login",
    enabled: (e.target as HTMLInputElement).checked,
  });
});
document.getElementById("toggle-auto-restart")!.addEventListener("change", (e) => {
  send({
    type: "settings:auto-restart",
    enabled: (e.target as HTMLInputElement).checked,
  });
});
document.getElementById("toggle-auto-check-updates")!.addEventListener("change", (e) => {
  send({
    type: "settings:auto-check-updates",
    enabled: (e.target as HTMLInputElement).checked,
  });
});
document.getElementById("release-channel")!.addEventListener("change", (e) => {
  const channel = (e.target as HTMLSelectElement).value as "stable" | "beta";
  send({ type: "update:channel:set", channel });
});
document.getElementById("app-search")!.addEventListener("input", (e) => {
  const value = (e.target as HTMLInputElement).value;
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    searchTerm = value;
    renderGrid();
  }, 120);
});

// ── Docker Hub ──────────────────────────────────────────────────

document.getElementById("btn-hub")!.addEventListener("click", () => {
  document.getElementById("modal-hub")!.classList.remove("hidden");
  const cached = hubCache.get("");
  if (cached) {
    hubImages = cached;
    renderHubResults(undefined);
  } else {
    document.getElementById("hub-status")!.textContent = "Loading popular images...";
    send({ type: "dockerhub:browse" });
  }
});
document.getElementById("btn-hub-close")!.addEventListener("click", () => {
  document.getElementById("modal-hub")!.classList.add("hidden");
});
document.getElementById("btn-hub-popular")!.addEventListener("click", () => {
  const cached = hubCache.get("");
  if (cached) {
    hubImages = cached;
    renderHubResults(undefined);
  } else {
    document.getElementById("hub-status")!.textContent = "Loading popular images...";
    send({ type: "dockerhub:browse" });
  }
});
document.getElementById("btn-hub-search")!.addEventListener("click", () => {
  const query = (document.getElementById("hub-search") as HTMLInputElement).value.trim();
  const cached = query ? hubCache.get(query) : hubCache.get("");
  if (cached) {
    hubImages = cached;
    renderHubResults(query || undefined);
    return;
  }
  document.getElementById("hub-status")!.textContent = query
    ? `Searching "${query}"...`
    : "Loading popular images...";
  send({ type: "dockerhub:browse", query: query || undefined });
});
document.getElementById("hub-search")!.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  (document.getElementById("btn-hub-search") as HTMLButtonElement).click();
});

// Render the static recommended apps catalogue on load.
// Wrap in DOMContentLoaded so the grid element is always ready
// regardless of how Electrobun's webview schedules module evaluation.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", renderRecommendedApps);
} else {
  renderRecommendedApps();
}
