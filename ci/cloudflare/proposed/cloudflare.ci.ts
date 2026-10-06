import { CIWorkflow, type CIEvent, type CIStep } from "@cloudflare/ci";

// Proposed shape. APIs marked PROPOSED do not exist in the current dev docs.
const environments = ["dev", "test", "qa", "stage", "preprod", "prod"] as const;
const approvalRequired = new Set(["preprod", "prod"]);

export default class MonorepoCI extends CIWorkflow {
	async run(event: CIEvent, step: CIStep) {
		const source = await step.checkout("check out repository");

		// PROPOSED: provider-neutral changed files for PR base...head or push before...after.
		const changes = await step.changes("detect changes");

		// PROPOSED: discover wrangler configs + pnpm workspace graph, include dependents.
		const workspace = await step.workspace("read monorepo graph", { inputs: [source] });
		const affected = workspace.workers.affectedBy(changes, {
			global: ["pnpm-lock.yaml", "pnpm-workspace.yaml", "package.json"],
		});

		// PROPOSED: unaffected Workers are reported as skipped with a reason, not left pending.
		await step.skip(
			workspace.workers.filter((worker) => !affected.includes(worker)),
			"no changes in Worker or its workspace dependencies",
		);
		if (affected.length === 0) return;

		const dependencies = await step.runner("install dependencies", {
			command: "pnpm install --frozen-lockfile",
			inputs: [source],
			outputs: ["./node_modules"],
		});

		await Promise.all(
			affected.map((worker) =>
				// PROPOSED: named group gives a per-Worker status and view in one run.
				step.group(worker.name, async () => {
					const project = [source, dependencies];
					const [buildOutput] = await Promise.all([
						step.runner("build", {
							command: `pnpm --filter ${worker.packageName} build`,
							inputs: project,
							outputs: [`./${worker.dir}/dist`],
						}),
						step.runner("test", { command: `pnpm --filter ${worker.packageName} test`, inputs: project, outputs: [] }),
						step.runner("lint", { command: `pnpm --filter ${worker.packageName} lint`, inputs: project, outputs: [] }),
					]);

					// PROPOSED: build a specific Wrangler config in the monorepo.
					const bundle = await step.build("bundle", { inputs: [buildOutput], config: worker.wranglerConfig });

					if (event.payload.type !== "push" || event.payload.branch !== "main") {
						return step.preview("preview", { bundle, worker: worker.name });
					}

					for (const environment of environments) {
						if (approvalRequired.has(environment)) {
							// PROPOSED: durable approval gate with audit trail; could be replaced by checks later.
							await step.approval(`approve ${environment}`, { environment, approvers: ["team:ikea-start-page"] });
						}
						// PROPOSED: target Worker + Wrangler environment explicitly; still limited by connection allowlist.
						await step.deploy(`deploy ${environment}`, { bundle, worker: worker.name, environment });
					}
				}),
			),
		);
	}
}
