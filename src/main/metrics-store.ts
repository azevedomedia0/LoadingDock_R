import { dirname } from "path";
import type { AppMetricsPoint } from "../shared/types";
import { getMetricsFile } from "./registry";

type MetricsMap = Record<string, AppMetricsPoint[]>;

export async function loadMetricsHistory(
  file = getMetricsFile(),
): Promise<MetricsMap> {
  try {
    const text = await Bun.file(file).text();
    const parsed = JSON.parse(text) as MetricsMap;
    return parsed ?? {};
  } catch {
    return {};
  }
}

export async function saveMetricsHistory(
  history: MetricsMap,
  file = getMetricsFile(),
): Promise<void> {
  await Bun.write(`${dirname(file)}/.keep`, "");
  await Bun.write(file, JSON.stringify(history, null, 2));
}
