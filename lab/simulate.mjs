import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  automaticEnvironments,
  globalInputs,
  handMaintainedPaths,
  loadWorkspace,
  root,
  workers as listWorkers,
} from "./model.mjs";

const workspace = loadWorkspace();
const workers = listWorkers(workspace);
const sprawlDir = join(root, "ci/github-sprawl/.github/workflows");

const scenarios = [
  { id: "A", event: "pull_request", title: "PR edits router code", files: ["workers/router/src/handler.js"] },
  { id: "B", event: "pull_request", title: "PR edits shared package", files: ["packages/shared/src/index.js"] },
  { id: "C", event: "pull_request", title: "PR edits image-core (dependency drift)", files: ["packages/image-core/src/index.js"] },
  { id: "D", event: "pull_request", title: "PR edits docs only", files: ["docs/architecture.md"] },
  { id: "E", event: "pull_request", title: "PR updates lockfile", files: ["pnpm-lock.yaml"] },
  { id: "F", event: "pull_request", title: "PR edits Terraform", files: ["infra/terraform/cloudflare/main.tf"] },
  { id: "G", event: "push", title: "Merge shared package change to main", files: ["packages/shared/src/index.js"] },
];

function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*")}$`);
}
const matchesAny = (files, globs) => files.some((file) => globs.some((glob) => globToRegExp(glob).test(file)));

function parseWorkflow(file) {
  const lines = readFileSync(join(sprawlDir, file), "utf8").split("\n");
  const name = lines.find((line) => line.startsWith("name:")).slice(5).trim().replace(/^"|"$/g, "");
  const start = lines.indexOf("on:");
  const triggers = {};
  let event;
  let list;
  for (const line of lines.slice(start + 1)) {
    if (line && !line.startsWith(" ")) break;
    const eventMatch = line.match(/^  ([a-z_]+):/);
    if (eventMatch) {
      event = eventMatch[1];
      triggers[event] = { paths: null, types: null, workflows: null };
      list = null;
      const inlineTypes = line.match(/types: \[(.*)\]/);
      if (inlineTypes) triggers[event].types = inlineTypes[1].split(",").map((item) => item.trim());
      continue;
    }
    const keyMatch = line.match(/^    ([a-z_]+):\s*(.*)$/);
    if (keyMatch && event) {
      const [, key, value] = keyMatch;
      list = null;
      if (value.startsWith("[")) {
        triggers[event][key] = value.slice(1, -1).split(",").map((item) => item.trim().replace(/^"|"$/g, ""));
      } else if (key === "paths") {
        list = triggers[event].paths = [];
      }
      continue;
    }
    const itemMatch = line.match(/^      - "?(.*?)"?$/);
    if (itemMatch && list) list.push(itemMatch[1]);
  }
  return { file, name, triggers };
}

const sprawl = readdirSync(sprawlDir).filter((file) => file.endsWith(".yml")).map(parseWorkflow);

function ownerOf(file) {
  return [...workspace.values()].find((pkg) => file.startsWith(`${pkg.dir}/`));
}

function truth(files) {
  if (files.some((file) => globalInputs.includes(file))) return { workers: [...workers], infra: false };
  const changed = new Set(files.map(ownerOf).filter(Boolean).map((pkg) => pkg.name));
  let grew = true;
  while (grew) {
    grew = false;
    for (const pkg of workspace.values()) {
      if (!changed.has(pkg.name) && pkg.dependencies.some((dep) => changed.has(dep))) {
        changed.add(pkg.name);
        grew = true;
      }
    }
  }
  return {
    workers: [...changed].map((name) => workspace.get(name)).filter((pkg) => pkg.kind === "worker").map((pkg) => pkg.short).sort(),
    infra: files.some((file) => file.startsWith("infra/")),
  };
}

const staticSelection = (files) => workers.filter((worker) => matchesAny(files, handMaintainedPaths(worker)));
const workerFromName = (name) => name.match(/^worker \/ ([^/]+) \//)?.[1]?.trim();

function simulateSprawl(scenario) {
  const runs = [];
  for (const workflow of sprawl) {
    const trigger = workflow.triggers[scenario.event];
    if (!trigger) continue;
    if (scenario.event === "pull_request" && trigger.types && !trigger.types.includes("opened")) continue;
    if (trigger.paths && !matchesAny(scenario.files, trigger.paths)) continue;
    runs.push(workflow.name);
  }
  for (const workflow of sprawl) {
    const trigger = workflow.triggers.workflow_run;
    if (!trigger) continue;
    const upstream = runs.filter((run) => trigger.workflows.includes(run));
    upstream.forEach(() => runs.push(workflow.name));
  }
  const selected = [...new Set(runs.map(workerFromName).filter(Boolean))].sort();
  const requiredPending = scenario.event === "pull_request" ? workers.filter((worker) => !selected.includes(worker)).length : 0;
  return { runs: runs.length, jobs: runs.length, selected, requiredPending, note: `${runs.length} separate workflow runs` };
}

function simulateConsolidated(scenario) {
  const selected = staticSelection(scenario.files);
  const infra = matchesAny(scenario.files, ["infra/terraform/**"]);
  const envs = scenario.event === "push" ? 6 : 0;
  const workerJobs = selected.length ? selected.length * (1 + envs) : 0;
  const repoRun = scenario.event === "pull_request" ? 1 : 0;
  const runs = 1 + (infra ? 1 : 0) + repoRun;
  const jobs = 2 + workerJobs + (infra ? 6 : 0) + (repoRun ? 2 : 0);
  return { runs, jobs, selected, requiredPending: 0, note: "1 workers run; dynamic matrix; ci-ok gate" };
}

function simulateGitLab(scenario) {
  const selected = staticSelection(scenario.files);
  const infra = matchesAny(scenario.files, ["infra/terraform/**"]);
  const jobs = selected.length * (scenario.event === "push" ? 7 : 1) + (infra ? 6 : 0);
  return { runs: jobs ? 1 : 0, jobs, selected, requiredPending: 0, note: jobs ? "1 pipeline; folders via include" : "no pipeline created" };
}

function simulateCloudflareDocumented(scenario) {
  return {
    runs: workers.length,
    jobs: workers.length * 5,
    selected: [...workers],
    requiredPending: 0,
    note: "7 connections; no path filter or changed files",
  };
}

function simulateCloudflareProposed(scenario) {
  const expected = truth(scenario.files);
  const perWorker = scenario.event === "push" ? 5 + 6 + 2 : 5;
  return {
    runs: 1,
    jobs: 3 + (expected.workers.length ? 1 : 0) + expected.workers.length * perWorker,
    selected: expected.workers,
    requiredPending: 0,
    note: "1 run; graph-aware; skipped Workers explained",
  };
}

const providers = [
  ["GitHub: 81 files", simulateSprawl],
  ["GitHub: consolidated", simulateConsolidated],
  ["GitLab: includes", simulateGitLab],
  ["Cloudflare: documented", simulateCloudflareDocumented],
  ["Cloudflare: proposed", simulateCloudflareProposed],
];

const lines = [
  "# CI monorepo simulation",
  "",
  `Workspace: ${workers.length} Workers, ${[...workspace.values()].length - workers.length} shared packages, 6 environments.`,
  `GitHub sprawl: ${sprawl.length} workflow files generated from the same model.`,
  "",
  "Columns: runs = top-level workflow runs/pipelines; selected = Workers tested or deployed; missed/extra compare with the pnpm dependency graph; stuck = required PR checks left waiting because their workflow was skipped (assumes every Worker PR check is required).",
];

for (const scenario of scenarios) {
  const expected = truth(scenario.files);
  lines.push(
    "",
    `## ${scenario.id}. ${scenario.title}`,
    "",
    `Event: \`${scenario.event}\`; changed: ${scenario.files.map((file) => `\`${file}\``).join(", ")}`,
    `Should affect: ${expected.workers.length ? expected.workers.join(", ") : "no Workers"}${expected.infra ? " + Terraform" : ""}`,
    "",
    "| Provider | Runs | Selected Workers | Missed | Extra | Stuck required checks | Notes |",
    "| --- | ---: | --- | --- | --- | ---: | --- |",
  );
  for (const [label, simulate] of providers) {
    const result = simulate(scenario);
    const missed = expected.workers.filter((worker) => !result.selected.includes(worker));
    const extra = result.selected.filter((worker) => !expected.workers.includes(worker));
    lines.push(
      `| ${label} | ${result.runs} | ${result.selected.join(", ") || "-"} | ${missed.join(", ") || "-"} | ${extra.join(", ") || "-"} | ${result.requiredPending} | ${result.note} |`,
    );
  }
}

const touched = sprawl.filter((workflow) => readFileSync(join(sprawlDir, workflow.file), "utf8").includes("router")).length;
lines.push(
  "",
  "## Adding one Worker",
  "",
  "| Provider | Config changes |",
  "| --- | --- |",
  `| GitHub: 81 files | ${touched} files mention router: 8 new Worker workflows, plus smoke and rollback lists |`,
  "| GitHub: consolidated | Add one paths-filter entry; repeat dependency paths by hand |",
  "| GitLab: includes | Add one `ci/workers/<worker>.yml`; repeat dependency paths by hand |",
  "| Cloudflare: documented | Add one connection + Worker permission; workflow cannot discover its Worker directory |",
  "| Cloudflare: proposed | No workflow change; discovered from Wrangler config and workspace graph, subject to allowlist |",
);

const report = `${lines.join("\n")}\n`;
writeFileSync(join(root, "lab/results.md"), report);
console.log(report);
