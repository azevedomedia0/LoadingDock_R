import { load } from "js-yaml";
import type { DockerApp } from "../shared/types";
import { generateAppId } from "../shared/validation";

type ComposeDoc = {
  services?: Record<
    string,
    {
      image?: string;
      ports?: string[];
      environment?: Record<string, string> | string[];
      volumes?: string[];
    }
  >;
};

function parseEnvironment(
  env: Record<string, string> | string[] | undefined,
): Record<string, string> {
  if (!env) return {};
  if (Array.isArray(env)) {
    return Object.fromEntries(
      env
        .map((line) => line.split("="))
        .filter((parts) => parts.length >= 2)
        .map(([k, ...v]) => [k, v.join("=")]),
    );
  }
  return env;
}

export function importComposeAsApps(
  yaml: string,
  projectName = "compose",
): Omit<DockerApp, "status" | "containerId">[] {
  const parsed = load(yaml) as ComposeDoc;
  if (!parsed?.services || typeof parsed.services !== "object") {
    throw new Error("No services found in compose YAML.");
  }

  const apps: Omit<DockerApp, "status" | "containerId">[] = [];
  for (const [serviceName, service] of Object.entries(parsed.services)) {
    if (!service?.image) continue;
    apps.push({
      id: generateAppId(`${projectName}-${serviceName}`),
      name: serviceName,
      icon: "default.png",
      description: `${service.image} (imported from ${projectName})`,
      image: service.image,
      ports: service.ports ?? [],
      env: parseEnvironment(service.environment),
      volumes: service.volumes ?? [],
      composeProject: projectName,
    });
  }

  if (!apps.length) {
    throw new Error("No importable services with an image were found.");
  }
  return apps;
}
