import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  appendErrorEntry,
  formatErrorExport,
  loadRecentErrors,
  parseErrorLog,
} from "./error-report";

describe("error-report", () => {
  test("append and load round-trip", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ed-errors-"));
    const file = join(dir, "errors.jsonl");
    await appendErrorEntry(
      {
        timestamp: 1000,
        level: "error",
        source: "test",
        message: "boom",
        appId: "app-1",
      },
      file,
    );
    await appendErrorEntry(
      {
        timestamp: 2000,
        level: "warn",
        source: "test",
        message: "hmm",
      },
      file,
    );
    const entries = await loadRecentErrors(10, file);
    expect(entries).toHaveLength(2);
    expect(entries[0].message).toBe("boom");
    expect(entries[1].level).toBe("warn");
  });

  test("parseErrorLog skips corrupt lines", () => {
    const entries = parseErrorLog(
      '{"timestamp":1,"level":"error","source":"a","message":"ok"}\nnot json\n',
    );
    expect(entries).toHaveLength(1);
  });

  test("formatErrorExport includes metadata", () => {
    const json = formatErrorExport([
      { timestamp: 1, level: "error", source: "x", message: "y" },
    ]);
    const parsed = JSON.parse(json) as {
      count: number;
      entries: unknown[];
      exportedAt: string;
    };
    expect(parsed.count).toBe(1);
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.exportedAt).toBeDefined();
  });
});
