import { describe, expect, test } from "bun:test";
import { buildDockerRunArgs } from "./docker";
import type { DockerApp } from "../shared/types";

describe("docker args", () => {
  test("buildDockerRunArgs includes ports, env, and volumes", () => {
    const app: DockerApp = {
      id: "postgres-dev",
      name: "Postgres",
      icon: "postgres.png",
      description: "db",
      image: "postgres:15",
      ports: ["5432:5432"],
      env: { POSTGRES_DB: "devdb" },
      volumes: ["~/data/postgres:/var/lib/postgresql/data"],
      status: "stopped",
    };
    const args = buildDockerRunArgs(app);
    expect(args[0]).toBe("docker");
    expect(args).toContain("--name");
    expect(args).toContain("electrodocker-postgres-dev");
    expect(args).toContain("-p");
    expect(args).toContain("5432:5432");
    expect(args).toContain("-e");
    expect(args).toContain("POSTGRES_DB=devdb");
    expect(args).toContain("-v");
    expect(args[args.length - 1]).toBe("postgres:15");
  });
});
