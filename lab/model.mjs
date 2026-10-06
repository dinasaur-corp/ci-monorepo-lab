import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const root = new URL("..", import.meta.url).pathname;

export const environments = ["dev", "test", "qa", "stage", "preprod", "prod"];
export const automaticEnvironments = ["dev", "test"];
export const approvalEnvironments = ["preprod", "prod"];

export const globalInputs = ["pnpm-lock.yaml", "pnpm-workspace.yaml", "package.json"];

export function loadWorkspace() {
  const packages = new Map();
  for (const group of ["packages", "workers"]) {
    for (const dir of readdirSync(join(root, group))) {
      const manifest = JSON.parse(readFileSync(join(root, group, dir, "package.json"), "utf8"));
      packages.set(manifest.name, {
        name: manifest.name,
        short: dir,
        dir: `${group}/${dir}`,
        kind: group === "workers" ? "worker" : "package",
        dependencies: Object.keys(manifest.dependencies ?? {}).filter((dep) => dep.startsWith("@lab/")),
      });
    }
  }
  return packages;
}

export function workers(workspace = loadWorkspace()) {
  return [...workspace.values()].filter((pkg) => pkg.kind === "worker").map((pkg) => pkg.short).sort();
}

export function transitiveDependencyDirs(workspace, packageName, seen = new Set()) {
  for (const dep of workspace.get(packageName).dependencies) {
    if (seen.has(dep)) continue;
    seen.add(dep);
    transitiveDependencyDirs(workspace, dep, seen);
  }
  return [...seen].map((name) => workspace.get(name).dir).sort();
}

// Hand-maintained YAML path lists, as they usually exist in workflow files.
// Intentional drift: site started importing @lab/image-core, but nobody updated its CI paths.
export const handMaintainedDependencyDirs = {
  "assets-sync": ["packages/config"],
  "coworker-channel": ["packages/config", "packages/shared", "packages/ui"],
  "image-manager": ["packages/config", "packages/image-core", "packages/shared"],
  redirects: ["packages/config", "packages/shared"],
  router: ["packages/config", "packages/shared"],
  site: ["packages/config", "packages/ui"],
  streams: ["packages/config"],
};

export function handMaintainedPaths(worker) {
  return [
    `workers/${worker}/**`,
    ...handMaintainedDependencyDirs[worker].map((dir) => `${dir}/**`),
    ...globalInputs,
  ];
}
