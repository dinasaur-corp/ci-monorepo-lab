import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { performance } from "node:perf_hooks";

const [workspacePath, provider = "local"] = process.argv.slice(2);

if (!workspacePath) {
  throw new Error("Usage: node lab/run-workspace-benchmark.mjs <workspace-path> [provider]");
}

const packageJson = JSON.parse(await readFile(join(workspacePath, "package.json"), "utf8"));
const startedAt = new Date().toISOString();
const start = performance.now();
const phases = [];

for (const phase of ["lint", "test", "build"]) {
  const phaseStart = performance.now();
  await execute("npm", ["--prefix", workspacePath, "run", phase]);
  phases.push({ name: phase, durationMs: round(performance.now() - phaseStart) });
}

const result = {
  schemaVersion: 1,
  provider,
  workspace: packageJson.name,
  workspacePath,
  kind: workspacePath.startsWith("workers/") ? "worker" : "package",
  startedAt,
  finishedAt: new Date().toISOString(),
  durationMs: round(performance.now() - start),
  phases,
  metadata: {
    commitSha: process.env.GITHUB_SHA || null,
    runId: process.env.GITHUB_RUN_ID || null,
    job: process.env.GITHUB_JOB || null,
    runnerLabel: process.env.BENCH_RUNNER_LABEL || null,
    cpuCount: globalThis.navigator?.hardwareConcurrency || null,
    nodeVersion: process.version,
    platform: `${process.platform}-${process.arch}`
  }
};

await mkdir("lab/benchmark-results", { recursive: true });
const outputPath = join("lab/benchmark-results", `${basename(workspacePath)}.json`);
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, ...result }));

function execute(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
    child.on("error", reject);
  });
}

function round(value) {
  return Math.round(value * 100) / 100;
}

