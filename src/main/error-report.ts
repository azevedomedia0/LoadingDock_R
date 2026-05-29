// src/main/error-report.ts — local error log (no remote telemetry)
import { join } from "path";
import { getRegistryDir } from "./registry";

const ERROR_LOG_FILE = "errors.jsonl";
const MAX_ENTRIES = 500;

export interface ErrorReportEntry {
  timestamp: number;
  level: "error" | "warn";
  source: string;
  message: string;
  appId?: string;
}

export function getErrorLogPath(
  platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return join(getRegistryDir(platform, env), ERROR_LOG_FILE);
}

export async function appendErrorEntry(
  entry: ErrorReportEntry,
  file = getErrorLogPath(),
): Promise<void> {
  const line = JSON.stringify(entry) + "\n";
  let existing = "";
  try {
    existing = await Bun.file(file).text();
  } catch {
    // new file
  }
  const lines = existing ? existing.split("\n").filter(Boolean) : [];
  lines.push(line.trim());
  const trimmed = lines.slice(-MAX_ENTRIES);
  await Bun.write(file, trimmed.map((l) => l + "\n").join(""));
}

export function parseErrorLog(text: string): ErrorReportEntry[] {
  const entries: ErrorReportEntry[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line) as ErrorReportEntry);
    } catch {
      // skip corrupt lines
    }
  }
  return entries;
}

export async function loadRecentErrors(
  limit = 100,
  file = getErrorLogPath(),
): Promise<ErrorReportEntry[]> {
  try {
    const text = await Bun.file(file).text();
    return parseErrorLog(text).slice(-limit);
  } catch {
    return [];
  }
}

export function formatErrorExport(entries: ErrorReportEntry[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      count: entries.length,
      entries,
    },
    null,
    2,
  );
}
