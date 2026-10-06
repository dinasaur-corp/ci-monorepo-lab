import { CIWorkflow } from "@cloudflare/ci";

// Uses only APIs described in the Cloudflare CI dev docs as of Sep 16, 2026.
// One account-level workflow can be reused by many connections, but each connection
// publishes "the Worker selected by the connection" and has no path filter.
// GAP: the workflow has no documented way to learn which Worker/directory its connection targets.
const WORKER_DIR = "workers/router";

export default class WorkerCI extends CIWorkflow {
	async run(event, step) {
		const source = await step.checkout("check out repository");

		const dependencies = await step.runner("install dependencies", {
			command: "pnpm install --frozen-lockfile",
			inputs: [source],
			outputs: ["./node_modules"],
		});

		const project = [source, dependencies];
		const [buildOutput] = await Promise.all([
			step.runner("build", {
				command: `pnpm --dir ${WORKER_DIR} build`,
				inputs: project,
				outputs: [`./${WORKER_DIR}/dist`],
			}),
			step.runner("lint", { command: `pnpm --dir ${WORKER_DIR} lint`, inputs: project, outputs: [] }),
			step.runner("test", { command: `pnpm --dir ${WORKER_DIR} test`, inputs: project, outputs: [] }),
		]);

		const bundle = await step.build("create Worker bundle", { inputs: [buildOutput] });

		// GAP: one production target only; no dev/test/qa/stage/preprod promotion or approval step.
		if (event.payload.type === "push" && event.payload.branch === "main") {
			return step.deploy("deploy to production", { bundle });
		}
		return step.preview("create preview", { bundle });
	}
}
